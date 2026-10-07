/**
 * leadCrossEnrich — Unified lead enrichment engine.
 *
 * ONE enrichment process that uses both Apify and AI together:
 *   1. Apify Google Search gathers raw web results (2 targeted queries in parallel)
 *   2. Reddit profile data is fetched in parallel (if platform is reddit)
 *   3. ONE LLM call (Gemini with Google Search) analyzes all the gathered data
 *      to extract: company, domain, job title, full name, emails, and phones
 *
 * This replaces the old multi-phase approach (5-6 LLM calls) that caused 500
 * errors from timeouts. Now it's a single LLM call with rich context.
 *
 * Results are stored in enrichedEmailsJson, enrichedPhonesJson,
 * leadCrossSourcesJson, and the resolved* fields on the ScrapedLead record.
 *
 * VERIFICATION LAYERS (after LLM extraction):
 *   A. If company domain resolved → Apify Waterfall Contact Enrichment ($0.20/contact)
 *      — SMTP-verified email + phone in one call, confidence 95-98%
 *   B. If no company domain → BounceVerify emails ($0.00065/email) + Phone Lookup API
 *      (free 200/mo) to validate carrier/line type
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';
const PHONE_LOOKUP_KEY = process.env.PHONE_LOOKUP_API_KEY || '';

// ── Apify Google Search ─────────────────────────────────────────────────────
async function apifyGoogleSearch(query: string, maxResults = 10): Promise<{ title: string; url: string; snippet: string }[]> {
  if (!APIFY_TOKEN || !query) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: query,
          maxPagesPerQuery: 1,
          resultsPerPage: maxResults,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const items: any[] = await res.json();
    return (items || [])
      .filter((item: any) => item?.url || item?.link)
      .map((item: any) => ({
        title: item?.title || '',
        url: item?.url || item?.link || '',
        snippet: item?.description || item?.snippet || '',
      }));
  } catch {
    return [];
  }
}

function toE164(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return '+1' + cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return '+' + cleaned;
  if (cleaned.length > 10) return '+' + cleaned;
  return phone;
}

// ── Reddit profile fetch (for additional context) ──────────────────────────
async function fetchRedditUserProfile(username: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://www.reddit.com/user/${username}/about.json`, {
      headers: {
        'User-Agent': 'SettlementIQ-LeadGen/1.0 (debt settlement lead intelligence bot)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data || null;
  } catch {
    return null;
  }
}

// ── Omkar Twitter profile + tweets (for x_twitter leads) ───────────────────
// Uses the same PHONE_LOOKUP_API_KEY (ok_... prefix). Base: twitter-scraper.omkar.cloud
async function fetchOmkarTwitterProfile(username: string): Promise<any | null> {
  if (!username) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://twitter-scraper.omkar.cloud/users/profile?user=${encodeURIComponent(username)}`,
      { headers: { 'API-Key': PHONE_LOOKUP_KEY }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user || data || null;
  } catch {
    return null;
  }
}

async function fetchOmkarTwitterTweets(username: string, count = 20): Promise<any[]> {
  if (!username) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(
      `https://twitter-scraper.omkar.cloud/users/tweets?user=${encodeURIComponent(username)}&count=${count}`,
      { headers: { 'API-Key': PHONE_LOOKUP_KEY }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.tweets || [];
  } catch {
    return [];
  }
}

// ── Apify Waterfall Contact Enrichment (B2B, needs company domain) ──────────
// $0.20/contact, SMTP-verified email + phone. Only call when we have a domain.
async function apifyWaterfallEnrichment(
  firstName: string,
  lastName: string,
  domain: string
): Promise<{ emails: any[]; phones: any[]; sources: any[] } | null> {
  if (!APIFY_TOKEN || !domain || (!firstName && !lastName)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(
      `https://api.apify.com/v2/acts/ryanclinton~waterfall-contact-enrichment/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          people: [{ firstName, lastName, domain }],
          enrichFromWebsite: true,
          detectPattern: true,
          verificationLevel: 'deep',
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const items: any[] = await res.json();
    const item = items?.[0];
    if (!item) return null;

    const emails: any[] = [];
    // Primary email
    if (item.primaryEmail) {
      emails.push({
        email: item.primaryEmail,
        confidence: item.primaryEmailConfidence ?? 90,
        source_url: item.primaryEmailSource || '',
        validation_type: 'smtp_verified',
      });
    }
    // Ranked candidates
    for (const c of item.emailCandidates || []) {
      if (c.email && c.email !== item.primaryEmail) {
        emails.push({
          email: c.email,
          confidence: c.confidence ?? 60,
          source_url: c.source || '',
          validation_type: 'smtp_verified',
        });
      }
    }

    const phones: any[] = [];
    for (const p of item.phones || []) {
      if (p.phone || p.number) {
        phones.push({
          phone: p.phone || p.number,
          confidence: p.confidence ?? 70,
          source_url: p.source || '',
          type: p.type || 'unknown',
        });
      }
    }

    const sources: any[] = [];
    if (item.evidenceUrl) sources.push({ type: 'waterfall_evidence', url: item.evidenceUrl, snippet: 'Waterfall enrichment evidence' });

    return { emails, phones, sources };
  } catch {
    return null;
  }
}

// ── BounceVerify Email Verification (Apify, $0.00065/email) ──────────────────
// SMTP validation, catch-all detection, disposable filtering.
// Works for any email type (personal + business). Returns verified status.
async function bounceVerifyEmails(emails: string[]): Promise<Map<string, { valid: boolean; score: number; reason: string; isDisposable: boolean; isCatchAll: boolean }>> {
  const results = new Map<string, { valid: boolean; score: number; reason: string; isDisposable: boolean; isCatchAll: boolean }>();
  if (!APIFY_TOKEN || emails.length === 0) return results;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    const res = await fetch(
      `https://api.apify.com/v2/acts/bounceverify~bounceverify-email-verifier/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return results;
    const items: any[] = await res.json();
    for (const item of items || []) {
      if (item?.email) {
        results.set(item.email.toLowerCase(), {
          valid: item.status === 'valid' || item.smtp_valid === true,
          score: item.score ?? 0,
          reason: item.reason || '',
          isDisposable: item.is_disposable === true,
          isCatchAll: item.is_catch_all === true,
        });
      }
    }
  } catch {
    // Non-fatal — fall back to LLM confidence scores
  }
  return results;
}

// ── Phone Lookup API (omkarcloud, free 200/mo) ─────────────────────────────
// Validates carrier, line type (mobile/landline/VOIP), and number validity.
async function phoneLookup(phone: string): Promise<{ isValid: boolean; lineType: string; carrier: string } | null> {
  if (!PHONE_LOOKUP_KEY || !phone) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://carrier-lookup-api.omkar.cloud/lookup?phone=${encodeURIComponent(phone)}`,
      { headers: { 'API-Key': PHONE_LOOKUP_KEY }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      isValid: data?.is_valid_number === true,
      lineType: data?.line_type || 'unknown',
      carrier: data?.carrier || '',
    };
  } catch {
    return null;
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Auth is non-fatal — debt coach users are stored in DebtCoachUser, not the
    // Base44 User entity, so me() throws for them. The frontend already gates
    // this behind admin role. All data ops use asServiceRole.
    let username = 'system';
    try {
      const user = await base44.auth.me();
      if (user?.full_name) username = user.full_name;
    } catch { /* non-fatal */ }

    const body = await req.json().catch(() => ({}));
    const leadId = body?.leadId;
    const bulk = body?.bulk === true;

    // ── Bulk enrichment: process selected leads ────────────────────────────
    if (bulk) {
      const leadIds: string[] = body?.leadIds || [];
      if (leadIds.length === 0) {
        return Response.json({ error: 'leadIds array required for bulk mode' }, { status: 400 });
      }
      let enriched = 0, failed = 0;
      for (const id of leadIds) {
        try {
          await enrichSingleLead(base44, id);
          enriched++;
        } catch (e: any) {
          console.error(`[leadCrossEnrich] Failed for ${id}:`, e?.message);
          failed++;
        }
        // Rate limit between leads
        await new Promise(r => setTimeout(r, 2000));
      }
      return Response.json({ status: 'success', processed: leadIds.length, enriched, failed });
    }

    if (!leadId) return Response.json({ error: 'leadId required' }, { status: 400 });
    const result = await enrichSingleLead(base44, leadId);
    return Response.json(result);
  } catch (error) {
    console.error('[leadCrossEnrich] Fatal error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

// ── Single lead enrichment (the ONE process) ────────────────────────────────

async function enrichSingleLead(base44: any, leadId: string): Promise<any> {
  const lead = await base44.asServiceRole.entities.ScrapedLead.get(leadId);
  if (!lead) throw new Error('Lead not found');

  // Mark as processing
  await base44.asServiceRole.entities.ScrapedLead.update(leadId, { leadCrossStatus: 'processing' });

  const personName = lead.resolvedFullName || lead.displayName || '';
  const sources: { type: string; url: string; snippet: string }[] = [];

  // ── Phase 0: Gather raw data (Apify + Reddit profile, ALL in parallel) ──
  // Run 2 Apify searches + Reddit profile fetch simultaneously
  const apifyQuery1 = personName && personName !== 'unknown'
    ? [personName, lead.location, 'contact'].filter(Boolean).join(' ')
    : '';
  const apifyQuery2 = personName && personName !== 'unknown'
    ? [personName, lead.location, 'debt financial'].filter(Boolean).join(' ')
    : '';

  const isTwitter = lead.platform === 'x_twitter';
  const [apifyResults1, apifyResults2, redditProfile, twitterProfile, twitterTweets] = await Promise.all([
    apifyQuery1 ? apifyGoogleSearch(apifyQuery1, 10) : Promise.resolve([]),
    apifyQuery2 ? apifyGoogleSearch(apifyQuery2, 10) : Promise.resolve([]),
    lead.platform === 'reddit' ? fetchRedditUserProfile(lead.userHandle) : Promise.resolve(null),
    isTwitter ? fetchOmkarTwitterProfile(lead.userHandle) : Promise.resolve(null),
    isTwitter ? fetchOmkarTwitterTweets(lead.userHandle, 20) : Promise.resolve([]),
  ]);

  // Merge Apify results and record sources
  const apifyResults = [...apifyResults1, ...apifyResults2];
  const seenUrls = new Set<string>();
  for (const r of apifyResults) {
    if (r.url && !seenUrls.has(r.url)) {
      seenUrls.add(r.url);
      sources.push({ type: 'apify_google_search', url: r.url, snippet: r.title || r.snippet || '' });
    }
  }

  // Build context strings for the LLM
  const apifyContext = apifyResults.length > 0
    ? `\n\n--- APIFY WEB SEARCH RESULTS (primary evidence) ---\n${apifyResults.slice(0, 15).map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`).join('\n')}`
    : '';

  const redditContext = redditProfile
    ? `\n\n--- REDDIT PROFILE ---\n- Username: ${lead.userHandle}\n- Total karma: ${redditProfile.total_karma || 'N/A'}\n- Bio: ${redditProfile.subreddit?.public_description || 'N/A'}\n- Display name: ${redditProfile.subreddit?.display_name || 'N/A'}`
    : '';

  const twitterContext = twitterProfile || twitterTweets.length > 0
    ? `\n\n--- TWITTER/X PROFILE (via Omkar) ---\n- Handle: @${lead.userHandle}\n- Name: ${twitterProfile?.name || twitterProfile?.displayName || 'N/A'}\n- Bio: ${twitterProfile?.description || twitterProfile?.bio || 'N/A'}\n- Location: ${twitterProfile?.location || 'N/A'}\n- Followers: ${twitterProfile?.followers_count || twitterProfile?.followers || 'N/A'}\n- Following: ${twitterProfile?.following_count || twitterProfile?.following || 'N/A'}\n- Verified: ${twitterProfile?.verified ? 'Yes' : 'No'}\n- Profile URL: ${twitterProfile?.url || 'N/A'}\n\n--- RECENT TWEETS (${twitterTweets.length}) ---\n${twitterTweets.slice(0, 15).map((t: any, i: number) => `[${i + 1}] ${(t.text || '').substring(0, 300)}\n    Posted: ${t.created_at || 'N/A'} | Likes: ${t.stats?.likes ?? t.likes ?? 'N/A'}`).join('\n')}`
    : '';

  if (twitterProfile || twitterTweets.length > 0) {
    sources.push({ type: 'omkar_twitter', url: `https://twitter.com/${lead.userHandle}`, snippet: `@${lead.userHandle} — ${twitterTweets.length} tweets fetched via Omkar` });
  }

  // ── Phase 1: ONE LLM call with ALL context + web search ─────────────────
  // Gemini uses its own Google Search (add_context_from_internet) PLUS the
  // Apify results we gathered, giving it the best of both data sources.
  const postText = `${lead.postTitle || ''} ${lead.postText || ''} ${lead.bioText || ''}`.substring(0, 2000);

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a lead enrichment analyst. Find REAL contact information for a person who posted about debt/financial distress on ${lead.platform}.

PERSON DETAILS:
- Name: ${personName || 'unknown'}
- Username/Handle: ${lead.userHandle}
- Display Name: ${lead.displayName || 'N/A'}
- Location: ${lead.location || 'N/A'}
- Platform: ${lead.platform}

POST TEXT:
${postText}
${apifyContext}
${redditContext}
${twitterContext}

Using the Apify web search results above as primary evidence AND your own web search, extract ALL of the following:

1. company: Their employer/company (if found). "unknown" if not found.
2. company_domain: The company's official website domain (e.g., "company.com" — no www, no http). Empty if not found.
3. job_title: Their job title. "unknown" if not found.
4. full_name: Their real full name if you can determine it from search results. "unknown" if not found.
5. emails: Array of email addresses found publicly. Each with: email, confidence (0-100), source_url, validation_type ("exact_public_match", "domain_pattern_confirmed", or "web_search_match").
6. phones: Array of phone numbers found. Each with: phone (E.164 format like +1XXXXXXXXXX), confidence (0-100), source_url, type ("company_hq", "direct_dial", "mobile", or "unknown").

RULES:
- Only include REAL contacts you actually found via web search or the Apify results above.
- Do NOT fabricate or guess emails or phone numbers.
- If you found nothing, return empty arrays.
- Score confidence: 90-100 = exact public match, 60-89 = domain pattern confirmed, 30-59 = web search match, <30 = weak inference.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        company: { type: 'string' },
        company_domain: { type: 'string' },
        job_title: { type: 'string' },
        full_name: { type: 'string' },
        emails: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              confidence: { type: 'number' },
              source_url: { type: 'string' },
              validation_type: { type: 'string' },
            },
          },
        },
        phones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phone: { type: 'string' },
              confidence: { type: 'number' },
              source_url: { type: 'string' },
              type: { type: 'string' },
            },
          },
        },
      },
    },
  });

  // ── Phase 2: Process LLM results ────────────────────────────────────────
  const companyName = result?.company && result.company !== 'unknown' ? result.company : '';
  const companyDomain = result?.company_domain || '';
  const jobTitle = result?.job_title && result.job_title !== 'unknown' ? result.job_title : '';
  const fullName = result?.full_name && result.full_name !== 'unknown' ? result.full_name : '';

  let enrichedEmails = (result?.emails || [])
    .filter((e: any) => e.email && e.email.includes('@'))
    .map((e: any) => ({
      email: e.email,
      pattern: 'web_search',
      confidence: e.confidence || 40,
      sourceFound: e.source_url || '',
      validationType: e.validation_type || 'web_search_match',
    }));

  let enrichedPhones = (result?.phones || [])
    .filter((p: any) => p.phone)
    .map((p: any) => ({
      phone: toE164(p.phone),
      type: p.type || 'unknown',
      locationMatch: false,
      confidence: p.confidence || 30,
      source: p.source_url || '',
    }));

  // ── Phase 2b: VERIFICATION LAYERS ─────────────────────────────────────
  // A. If company domain resolved → Waterfall (SMTP-verified email + phone)
  // B. If no domain → BounceVerify emails + Phone Lookup API for phones
  let verificationMethod = 'none';

  if (companyDomain && fullName) {
    const nameParts = fullName.split(' ').filter(Boolean);
    const wfResult = await apifyWaterfallEnrichment(nameParts[0] || '', nameParts.slice(1).join(' ') || '', companyDomain);
    if (wfResult && (wfResult.emails.length > 0 || wfResult.phones.length > 0)) {
      verificationMethod = 'waterfall';
      // Merge waterfall emails — these are SMTP-verified, so high confidence
      for (const we of wfResult.emails) {
        const existing = enrichedEmails.find(e => e.email.toLowerCase() === we.email.toLowerCase());
        if (existing) {
          existing.confidence = Math.max(existing.confidence, we.confidence);
          existing.validationType = 'smtp_verified';
          existing.sourceFound = we.source_url || existing.sourceFound;
        } else {
          enrichedEmails.push({
            email: we.email,
            pattern: 'waterfall_smtp',
            confidence: we.confidence,
            sourceFound: we.source_url || '',
            validationType: 'smtp_verified',
          });
        }
      }
      // Merge waterfall phones
      for (const wp of wfResult.phones) {
        const e164 = toE164(wp.phone);
        const existing = enrichedPhones.find(p => p.phone === e164);
        if (existing) {
          existing.confidence = Math.max(existing.confidence, wp.confidence);
          existing.type = wp.type || existing.type;
        } else {
          enrichedPhones.push({
            phone: e164,
            type: wp.type || 'unknown',
            locationMatch: false,
            confidence: wp.confidence,
            source: wp.source_url || '',
          });
        }
      }
      for (const s of wfResult.sources) {
        if (!seenUrls.has(s.url)) { seenUrls.add(s.url); sources.push(s); }
      }
    }
  } else {
    // No company domain → cheaper verification path
    // B1. BounceVerify emails (SMTP validation)
    if (enrichedEmails.length > 0) {
      verificationMethod = 'bounceverify';
      const emailList = enrichedEmails.map(e => e.email);
      const verified = await bounceVerifyEmails(emailList);
      for (const e of enrichedEmails) {
        const v = verified.get(e.email.toLowerCase());
        if (v) {
          if (v.valid) {
            e.confidence = Math.max(e.confidence, 85);
            e.validationType = 'smtp_verified';
          } else if (v.isDisposable) {
            e.confidence = Math.min(e.confidence, 10);
            e.validationType = 'disposable_blocked';
          } else if (v.isCatchAll) {
            e.validationType = 'catch_all';
          } else {
            e.confidence = Math.min(e.confidence, 20);
            e.validationType = 'smtp_invalid';
          }
          if (v.reason) e.sourceFound = `BounceVerify: ${v.reason}`;
        }
      }
    }

    // B2. Phone Lookup API (carrier + line type validation)
    if (enrichedPhones.length > 0 && PHONE_LOOKUP_KEY) {
      if (verificationMethod === 'none') verificationMethod = 'phone_lookup';
      for (const p of enrichedPhones) {
        const lookup = await phoneLookup(p.phone);
        if (lookup) {
          if (lookup.isValid) {
            p.confidence = Math.max(p.confidence, 75);
            p.type = lookup.lineType || p.type;
            if (lookup.carrier) p.source = `Carrier: ${lookup.carrier}`;
          } else {
            p.confidence = Math.min(p.confidence, 15);
            p.type = 'invalid';
          }
        }
      }
    }
  }

  // Record sources from LLM findings
  for (const e of enrichedEmails) {
    if (e.sourceFound && !seenUrls.has(e.sourceFound)) {
      seenUrls.add(e.sourceFound);
      sources.push({ type: 'email_verification', url: e.sourceFound, snippet: `Email: ${e.email}` });
    }
  }
  for (const p of enrichedPhones) {
    if (p.source && !seenUrls.has(p.source)) {
      seenUrls.add(p.source);
      sources.push({ type: 'phone_verification', url: p.source, snippet: `Phone: ${p.phone} (${p.type})` });
    }
  }

  // Best email/phone
  const bestEmail = enrichedEmails.length > 0
    ? enrichedEmails.reduce((best, e) => e.confidence > best.confidence ? e : best)
    : null;
  const bestPhone = enrichedPhones.length > 0
    ? enrichedPhones.reduce((best, p) => p.confidence > best.confidence ? p : p)
    : null;

  // Enrichment status
  const hasHighConfidenceEmail = enrichedEmails.some(e => e.confidence >= 70);
  const hasHighConfidencePhone = enrichedPhones.some(p => p.confidence >= 70);
  const enrichmentStatus = hasHighConfidenceEmail || hasHighConfidencePhone
    ? 'fully_enriched'
    : enrichedEmails.length > 0 || enrichedPhones.length > 0
      ? 'partial'
      : 'no_public_data';

  // Identity confidence (max of all contact confidences)
  const maxConfidence = Math.max(
    ...enrichedEmails.map(e => e.confidence),
    ...enrichedPhones.map(p => p.confidence),
    0,
  );

  const updateData: any = {
    leadCrossStatus: 'enriched',
    leadCrossEnrichedAt: new Date().toISOString(),
    enrichedEmailsJson: JSON.stringify(enrichedEmails),
    enrichedPhonesJson: JSON.stringify(enrichedPhones),
    leadCrossSourcesJson: JSON.stringify(sources),
    companyName,
    companyDomain,
    jobTitle,
    enrichmentStatus,
    status: lead.status === 'pushed' ? 'pushed' : 'enriched',
  };

  if (fullName) updateData.resolvedFullName = fullName;
  if (bestEmail && bestEmail.confidence >= 50) updateData.resolvedEmail = bestEmail.email;
  if (bestPhone && bestPhone.confidence >= 50) updateData.resolvedPhone = bestPhone.phone;
  if (maxConfidence > 0) updateData.identityMatchConfidence = maxConfidence;

  await base44.asServiceRole.entities.ScrapedLead.update(leadId, updateData);

  return {
    status: 'success',
    leadId,
    companyName,
    companyDomain,
    verificationMethod,
    enrichedEmails: enrichedEmails.length,
    enrichedPhones: enrichedPhones.length,
    bestEmail: bestEmail?.email || null,
    bestPhone: bestPhone?.phone || null,
    enrichmentStatus,
    sources: sources.length,
  };
}