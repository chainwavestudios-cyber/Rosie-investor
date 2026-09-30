/**
 * resolveLeadIdentity — Native B2C identity resolution & contact enrichment.
 *
 * Takes a ScrapedLead and attempts to resolve the anonymous social handle to
 * real full name, personal email, and phone using:
 * 1. Public profile data from the source platform (Reddit user profile JSON)
 * 2. LLM-based inference from username patterns, bio text, and post history
 * 3. Cross-platform handle matching (checks if same username exists on other platforms)
 *
 * Identity match confidence is scored 0-100%. Status marked 'fully_enriched'
 * if email or phone is found with >70% confidence.
 *
 * NOTE: True B2C identity resolution (resolving a Reddit username to a real
 * phone/email) requires paid people-search APIs (Spokeo, BeenVerified, etc.).
 * This function extracts all publicly available data and uses LLM inference
 * to estimate confidence. Connect a people-search API key to enable full
 * phone/email resolution.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

async function fetchRedditUserProfile(username: string): Promise<any | null> {
  try {
    const res = await fetch(`https://www.reddit.com/user/${username}/about.json`, {
      headers: {
        'User-Agent': 'SettlementIQ-LeadGen/1.0 (debt settlement lead intelligence bot)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data || null;
  } catch {
    return null;
  }
}

async function fetchRedditUserPosts(username: string, limit = 25): Promise<any[]> {
  try {
    const res = await fetch(`https://www.reddit.com/user/${username}/.json?limit=${limit}`, {
      headers: {
        'User-Agent': 'SettlementIQ-LeadGen/1.0 (debt settlement lead intelligence bot)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const children = data?.data?.children || [];
    return children.map((c: any) => c?.data).filter(Boolean);
  } catch {
    return [];
  }
}

// Check if a username exists on other platforms (cross-platform handle matching)
async function checkCrossPlatformHandles(username: string): Promise<{ platform: string; exists: boolean; profileSnippet: string }[]> {
  const results: { platform: string; exists: boolean; profileSnippet: string }[] = [];
  const platforms = [
    { name: 'twitter', url: `https://x.com/${username}` },
    { name: 'instagram', url: `https://www.instagram.com/${username}/` },
    { name: 'facebook', url: `https://www.facebook.com/${username}` },
    { name: 'tiktok', url: `https://www.tiktok.com/@${username}` },
  ];
  for (const p of platforms) {
    try {
      const res = await fetch(p.url, { method: 'HEAD', redirect: 'follow' });
      results.push({ platform: p.name, exists: res.ok && res.status < 400, profileSnippet: p.url });
    } catch {
      results.push({ platform: p.name, exists: false, profileSnippet: p.url });
    }
  }
  return results;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const leadId = body?.leadId;
    const bulk = body?.bulk === true;

    // ── Bulk enrichment: process all 'raw' leads ──────────────────────────
    if (bulk) {
      const rawLeads = await base44.asServiceRole.entities.ScrapedLead.filter({ status: 'raw' }, '-created_date', 50);
      let enrichedCount = 0;
      let partialCount = 0;
      let failedCount = 0;

      for (const lead of rawLeads || []) {
        try {
          await base44.functions.invoke('resolveLeadIdentity', { leadId: lead.id });
          enrichedCount++;
        } catch {
          failedCount++;
        }
        // Rate limit
        await new Promise((r) => setTimeout(r, 500));
      }
      return Response.json({ status: 'success', processed: (rawLeads || []).length, enriched: enrichedCount, failed: failedCount });
    }

    // ── Single lead enrichment ────────────────────────────────────────────
    if (!leadId) return Response.json({ error: 'leadId required' }, { status: 400 });

    const lead = await base44.asServiceRole.entities.ScrapedLead.get(leadId);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

    // Mark as enriching
    await base44.asServiceRole.entities.ScrapedLead.update(leadId, { status: 'enriching', enrichmentStatus: 'pending' });

    let profileData: any = {};
    let recentPosts: any[] = [];
    let crossPlatform: { platform: string; exists: boolean; profileSnippet: string }[] = [];

    // ── Step 1: Fetch public profile data from source platform ────────────
    if (lead.platform === 'reddit') {
      const profile = await fetchRedditUserProfile(lead.userHandle);
      if (profile) {
        profileData = {
          reddit: {
            username: lead.userHandle,
            created_utc: profile.created_utc,
            total_karma: profile.total_karma,
            comment_karma: profile.comment_karma,
            link_karma: profile.link_karma,
            verified: profile.verified,
            is_employee: profile.is_employee,
            bio: profile.subreddit?.public_description || '',
            display_name: profile.subreddit?.display_name || '',
            title: profile.subreddit?.title || '',
          },
        };
      }
      recentPosts = await fetchRedditUserPosts(lead.userHandle, 25);
    }

    // ── Step 2: Cross-platform handle matching ────────────────────────────
    crossPlatform = await checkCrossPlatformHandles(lead.userHandle);

    // ── Step 3: LLM-based identity inference ──────────────────────────────
    const postHistoryText = recentPosts.slice(0, 10).map((p: any) => p?.title || p?.body || '').join('\n').substring(0, 3000);

    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a B2C identity resolution analyst. Given the following public social media profile data, infer the likely real identity of this person. Analyze their username, bio, post history, and location hints.

Platform: ${lead.platform}
Username/Handle: ${lead.userHandle}
Display Name: ${lead.displayName || 'N/A'}
Bio: ${lead.bioText || profileData?.reddit?.bio || 'N/A'}
Location hints: ${lead.location || profileData?.reddit?.title || 'N/A'}
Account created: ${profileData?.reddit?.created_utc ? new Date(profileData.reddit.created_utc * 1000).toISOString() : 'N/A'}
Total karma: ${profileData?.reddit?.total_karma || 'N/A'}

Recent post history (for context/interests):
${postHistoryText}

Cross-platform handle check:
${crossPlatform.map((c) => `${c.platform}: ${c.exists ? 'FOUND' : 'not found'}`).join('\n')}

Based on this public data, provide your best inference:
1. Likely real full name (or "unknown" if no hints exist)
2. Likely personal email pattern (e.g., "john.smith@gmail.com" — only if the username strongly suggests a real name; otherwise "unknown")
3. Likely phone number (or "unknown" — public social data rarely reveals this)
4. Identity match confidence score (0-100) based on how much real identity data is available
5. Key signals that informed your assessment

Be conservative: do NOT fabricate email addresses or phone numbers. If the data doesn't support a real name, return "unknown".`,
      response_json_schema: {
        type: 'object',
        properties: {
          inferredFullName: { type: 'string' },
          inferredEmail: { type: 'string' },
          inferredPhone: { type: 'string' },
          confidenceScore: { type: 'number' },
          keySignals: { type: 'string' },
          enrichmentNotes: { type: 'string' },
        },
      },
    });

    const inferredName = llmResult?.inferredFullName || 'unknown';
    const inferredEmail = llmResult?.inferredEmail || '';
    const inferredPhone = llmResult?.inferredPhone || '';
    const confidence = llmResult?.confidenceScore || 0;
    const keySignals = llmResult?.keySignals || '';

    // Determine enrichment status
    const hasContact = (inferredEmail && inferredEmail !== 'unknown' && inferredEmail.includes('@')) ||
                       (inferredPhone && inferredPhone !== 'unknown');
    const enrichmentStatus = confidence >= 70 && hasContact ? 'fully_enriched' :
                             confidence >= 30 ? 'partial' :
                             'no_public_data';

    const updateData = {
      status: enrichmentStatus === 'fully_enriched' ? 'enriched' : 'raw',
      resolvedFullName: inferredName !== 'unknown' ? inferredName : '',
      resolvedEmail: inferredEmail && inferredEmail !== 'unknown' ? inferredEmail : '',
      resolvedPhone: inferredPhone && inferredPhone !== 'unknown' ? inferredPhone : '',
      identityMatchConfidence: confidence,
      enrichmentStatus,
      enrichedAt: new Date().toISOString(),
      profileDataJson: JSON.stringify({ ...profileData, crossPlatform, keySignals }),
    };

    await base44.asServiceRole.entities.ScrapedLead.update(leadId, updateData);

    return Response.json({
      status: 'success',
      leadId,
      enrichmentStatus,
      confidence,
      resolvedFullName: updateData.resolvedFullName,
      resolvedEmail: updateData.resolvedEmail,
      resolvedPhone: updateData.resolvedPhone,
      keySignals,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}