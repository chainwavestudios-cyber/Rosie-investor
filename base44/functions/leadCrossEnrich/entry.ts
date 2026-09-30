/**
 * leadCrossEnrich — LeadCross AI enrichment engine.
 *
 * Takes a ScrapedLead and performs multi-phase web cross-referencing to find
 * verified emails and phone numbers using ZERO paid data APIs. Uses Gemini's
 * built-in Google Search (add_context_from_internet) to cross-reference public
 * indexes, press releases, SEC filings, company team pages, etc.
 *
 * Phase A: Entity & Domain Resolution
 *   - Normalize name, extract company/employer from post text/bio
 *   - Web search for company official domain if not known
 *
 * Phase B: Email Syntax Matrix & Cross-Referencing
 *   - Generate standard corporate email variations (first.last@, flast@, etc.)
 *   - Web search each variation with exact-match quotes
 *   - Score: High (exact public match), Medium (domain pattern confirmed),
 *     Low (unverified permutation)
 *
 * Phase C: Multi-Point Phone Number Resolution
 *   - Search for company HQ phone, direct dial, personal mobile
 *   - Parse to E.164 format, validate area-code geography
 *
 * Results are stored in enrichedEmailsJson, enrichedPhonesJson, and
 * leadCrossSourcesJson on the ScrapedLead record.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// ── Email syntax patterns ──────────────────────────────────────────────────
const EMAIL_PATTERNS = [
  '{first}.{last}@{domain}',
  '{first}{last}@{domain}',
  '{f}{last}@{domain}',
  '{first}.{l}@{domain}',
  '{first}@{domain}',
  '{last}@{domain}',
  '{first}_{last}@{domain}',
  '{f}.{last}@{domain}',
];

function normalizeName(fullName: string): { first: string; last: string; clean: string } {
  if (!fullName || fullName === 'unknown') return { first: '', last: '', clean: '' };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '', clean: '' };
  const first = parts[0].toLowerCase().replace(/[^a-z]/g, '');
  const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '') : '';
  return { first, last, clean: fullName.trim() };
}

function generateEmailVariations(first: string, last: string, domain: string): { email: string; pattern: string }[] {
  if (!first || !domain) return [];
  const f = first[0] || '';
  const l = last ? last[0] : '';
  const variations: { email: string; pattern: string }[] = [];
  for (const pattern of EMAIL_PATTERNS) {
    const email = pattern
      .replace('{first}', first)
      .replace('{last}', last || '')
      .replace('{f}', f)
      .replace('{l}', l)
      .replace('{domain}', domain);
    variations.push({ email, pattern });
  }
  // Deduplicate
  const seen = new Set<string>();
  return variations.filter(v => {
    if (seen.has(v.email)) return false;
    seen.add(v.email);
    return true;
  });
}

function toE164(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return '+1' + cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return '+' + cleaned;
  if (cleaned.length > 10) return '+' + cleaned;
  return phone;
}

// ── Phase A: Domain Resolution ─────────────────────────────────────────────
async function resolveCompanyDomain(base44: any, companyName: string, personName: string, location: string): Promise<{ domain: string; source: string }> {
  if (!companyName || companyName === 'unknown') return { domain: '', source: '' };
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Search the web for the official website domain of a company called "${companyName}"${location ? ` located in ${location}` : ''}${personName ? `, where ${personName} works` : ''}.

Return JSON with:
- domain: the primary root domain (e.g., "company.com") — NOT www., NOT http://, just the root domain
- source: the URL where you found this domain confirmed

If you cannot find a real official website, return empty strings. Do NOT guess or fabricate a domain.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        source: { type: 'string' },
      },
    },
  });
  return { domain: result?.domain || '', source: result?.source || '' };
}

// ── Phase B: Email Cross-Referencing ────────────────────────────────────────
async function crossReferenceEmails(
  base44: any,
  variations: { email: string; pattern: string }[],
  companyName: string,
  personName: string
): Promise<{ email: string; pattern: string; confidence: number; sourceFound: string; validationType: string }[]> {
  const results: { email: string; pattern: string; confidence: number; sourceFound: string; validationType: string }[] = [];

  // Batch: ask Gemini to search for all variations at once
  const emailList = variations.map(v => v.email).join('\n');
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a lead enrichment analyst. Search the web to verify which of these email addresses are real and publicly associated with "${personName}"${companyName ? ` at "${companyName}"` : ''}.

Email variations to verify:
${emailList}

For each email, search for it in public indexes — press releases, PDF documents, SEC filings, GitHub commits, conference slides, company team pages, LinkedIn profiles, etc.

Return JSON with a "results" array, one entry per email:
- email: the email address
- found: true if you found this email publicly indexed alongside the target name/company
- confidence: 0-100 score (90-100 = exact match found publicly, 60-89 = domain pattern confirmed from co-workers, <60 = unverified permutation)
- source_url: the URL where you found the match (empty if not found)
- source_snippet: a short snippet of where it appeared (empty if not found)
- validation_type: "exact_public_match", "domain_pattern_confirmed", or "unverified_permutation"

Be conservative: only report "found: true" if you actually found the email in a real public source. Do NOT fabricate sources.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              found: { type: 'boolean' },
              confidence: { type: 'number' },
              source_url: { type: 'string' },
              source_snippet: { type: 'string' },
              validation_type: { type: 'string' },
            },
          },
        },
      },
    },
  });

  const llmResults = result?.results || [];
  for (const v of variations) {
    const match = llmResults.find((r: any) => r.email === v.email);
    if (match) {
      results.push({
        email: v.email,
        pattern: v.pattern,
        confidence: match.confidence || 0,
        sourceFound: match.source_url || match.source_snippet || '',
        validationType: match.validation_type || 'unverified_permutation',
      });
    } else {
      results.push({
        email: v.email,
        pattern: v.pattern,
        confidence: 20,
        sourceFound: '',
        validationType: 'unverified_permutation',
      });
    }
  }

  return results;
}

// ── Phase C: Phone Number Resolution ────────────────────────────────────────
async function resolvePhoneNumbers(
  base44: any,
  personName: string,
  companyName: string,
  companyDomain: string,
  city: string,
  state: string
): Promise<{ phone: string; type: string; locationMatch: boolean; confidence: number; source: string }[]> {
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a lead enrichment analyst. Search the web for phone numbers associated with:
- Person: "${personName}"
${companyName ? `- Company: "${companyName}"` : ''}
${city || state ? `- Location: ${city || ''} ${state || ''}`.trim() : ''}

Search for:
1. Company main headquarters phone number (if company is known)
2. Direct dial or personal mobile numbers for this person
3. Any public phone numbers linked to this person or company in directories, press releases, or public records

Return JSON with a "phones" array:
- phone: the phone number in E.164 format (e.g., +1XXXXXXXXXX)
- type: "company_hq", "direct_dial", "mobile", or "unknown"
- location_match: true if the area code aligns with the person's listed city/state
- confidence: 0-100 score
- source: the URL where you found this number

Only include REAL phone numbers you actually found via web search. Do NOT fabricate numbers. If you found none, return an empty array.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        phones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phone: { type: 'string' },
              type: { type: 'string' },
              location_match: { type: 'boolean' },
              confidence: { type: 'number' },
              source: { type: 'string' },
            },
          },
        },
      },
    },
  });

  return (result?.phones || []).map((p: any) => ({
    phone: toE164(p.phone || ''),
    type: p.type || 'unknown',
    locationMatch: p.location_match ?? false,
    confidence: p.confidence || 0,
    source: p.source || '',
  }));
}

// ── Extract company/employer from post text ────────────────────────────────
async function extractCompanyFromPost(base44: any, lead: any): Promise<{ company: string; jobTitle: string }> {
  const postText = `${lead.postTitle || ''} ${lead.postText || ''} ${lead.bioText || ''}`.substring(0, 3000);
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Analyze this social media post by user "${lead.userHandle}" (display name: ${lead.displayName || 'N/A'}, location: ${lead.location || 'N/A'}). 

Post text:
${postText}

Extract:
1. company: The person's employer or company they work for (if mentioned). Only return a real company name if it's explicitly stated in the post. Return "unknown" if not mentioned.
2. job_title: Their job title (if mentioned). Return "unknown" if not mentioned.

Return JSON. Be conservative — do NOT guess.`,
    response_json_schema: {
      type: 'object',
      properties: {
        company: { type: 'string' },
        jobTitle: { type: 'string' },
      },
    },
  });
  return { company: result?.company || 'unknown', jobTitle: result?.jobTitle || 'unknown' };
}

// ── Main handler ───────────────────────────────────────────────────────────

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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
        await new Promise(r => setTimeout(r, 2000));
      }
      return Response.json({ status: 'success', processed: leadIds.length, enriched, failed });
    }

    if (!leadId) return Response.json({ error: 'leadId required' }, { status: 400 });
    const result = await enrichSingleLead(base44, leadId);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: (error as Error).message, stack: (error as Error).stack }, { status: 500 });
  }
}

async function enrichSingleLead(base44: any, leadId: string): Promise<any> {
  const lead = await base44.asServiceRole.entities.ScrapedLead.get(leadId);
  if (!lead) throw new Error('Lead not found');

  // Mark as processing
  await base44.asServiceRole.entities.ScrapedLead.update(leadId, { leadCrossStatus: 'processing' });

  const sources: { type: string; url: string; snippet: string }[] = [];
  const personName = lead.resolvedFullName || lead.displayName || '';
  const { first, last } = normalizeName(personName);

  // ── Phase A: Extract company & resolve domain ───────────────────────────
  let companyName = lead.companyName || '';
  let jobTitle = lead.jobTitle || '';
  if (!companyName) {
    const extracted = await extractCompanyFromPost(base44, lead);
    companyName = extracted.company;
    jobTitle = extracted.jobTitle;
  }

  let companyDomain = lead.companyDomain || '';
  if (companyName && companyName !== 'unknown' && !companyDomain) {
    const domainResult = await resolveCompanyDomain(base44, companyName, personName, lead.location || '');
    companyDomain = domainResult.domain;
    if (domainResult.source) sources.push({ type: 'domain_resolution', url: domainResult.source, snippet: `Domain for ${companyName}` });
  }

  // ── Phase B: Email syntax matrix & cross-referencing ────────────────────
  let enrichedEmails: any[] = [];
  if (first && companyDomain) {
    const variations = generateEmailVariations(first, last, companyDomain);
    enrichedEmails = await crossReferenceEmails(base44, variations, companyName, personName);
    for (const e of enrichedEmails) {
      if (e.sourceFound) sources.push({ type: 'email_verification', url: e.sourceFound, snippet: `Email: ${e.email} (${e.validationType})` });
    }
  }

  // Also try a direct name + location web search for personal email/phone
  // (works for B2C leads without a company)
  if (!companyDomain || enrichedEmails.length === 0) {
    const directResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Search the web for contact information (email and phone number) for a person named "${personName}"${lead.location ? ` in ${lead.location}` : ''} who posted about debt/financial distress on ${lead.platform}.

Their post mentioned: "${(lead.postText || '').substring(0, 500)}"

Search for their name in public records, social media profiles, directory listings, etc.

Return JSON with:
- emails: array of { email, confidence (0-100), source_url }
- phones: array of { phone, confidence (0-100), source_url, type }
- Only include REAL contacts you actually found. Do NOT fabricate.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          emails: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                confidence: { type: 'number' },
                source_url: { type: 'string' },
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

    for (const e of (directResult?.emails || [])) {
      if (e.email && e.email.includes('@')) {
        enrichedEmails.push({
          email: e.email,
          pattern: 'web_search_direct',
          confidence: e.confidence || 40,
          sourceFound: e.source_url || '',
          validationType: 'web_search_match',
        });
        if (e.source_url) sources.push({ type: 'email_direct_search', url: e.source_url, snippet: `Email: ${e.email}` });
      }
    }

    // Merge direct phone results into Phase C
    const directPhones = (directResult?.phones || []).map((p: any) => ({
      phone: toE164(p.phone || ''),
      type: p.type || 'unknown',
      locationMatch: false,
      confidence: p.confidence || 30,
      source: p.source_url || '',
    }));
    for (const p of directPhones) {
      if (p.source) sources.push({ type: 'phone_direct_search', url: p.source, snippet: `Phone: ${p.phone}` });
    }
    var directPhoneResults = directPhones;
  }

  // ── Phase C: Phone number resolution ───────────────────────────────────
  let enrichedPhones = await resolvePhoneNumbers(base44, personName, companyName, companyDomain, lead.location || '', '');
  // Merge direct phone results if available
  if (typeof directPhoneResults !== 'undefined' && directPhoneResults.length > 0) {
    enrichedPhones = [...enrichedPhones, ...directPhoneResults];
    // Deduplicate by phone number
    const seen = new Set<string>();
    enrichedPhones = enrichedPhones.filter(p => {
      if (seen.has(p.phone)) return false;
      seen.add(p.phone);
      return true;
    });
  }
  for (const p of enrichedPhones) {
    if (p.source && !sources.some(s => s.url === p.source)) {
      sources.push({ type: 'phone_verification', url: p.source, snippet: `Phone: ${p.phone} (${p.type})` });
    }
  }

  // ── Determine best email/phone ─────────────────────────────────────────
  const bestEmail = enrichedEmails.length > 0
    ? enrichedEmails.reduce((best, e) => e.confidence > best.confidence ? e : best)
    : null;
  const bestPhone = enrichedPhones.length > 0
    ? enrichedPhones.reduce((best, p) => p.confidence > best.confidence ? p : p)
    : null;

  // ── Update the lead ────────────────────────────────────────────────────
  const updateData: any = {
    leadCrossStatus: 'enriched',
    leadCrossEnrichedAt: new Date().toISOString(),
    enrichedEmailsJson: JSON.stringify(enrichedEmails),
    enrichedPhonesJson: JSON.stringify(enrichedPhones),
    leadCrossSourcesJson: JSON.stringify(sources),
    companyName: companyName !== 'unknown' ? companyName : '',
    companyDomain,
    jobTitle: jobTitle !== 'unknown' ? jobTitle : '',
  };

  // Update resolved email/phone with best results
  if (bestEmail && bestEmail.confidence >= 50) {
    updateData.resolvedEmail = bestEmail.email;
  }
  if (bestPhone && bestPhone.confidence >= 50) {
    updateData.resolvedPhone = bestPhone.phone;
  }

  // Update enrichment status
  const hasHighConfidenceEmail = enrichedEmails.some(e => e.confidence >= 70);
  const hasHighConfidencePhone = enrichedPhones.some(p => p.confidence >= 70);
  updateData.enrichmentStatus = hasHighConfidenceEmail || hasHighConfidencePhone
    ? 'fully_enriched'
    : enrichedEmails.length > 0 || enrichedPhones.length > 0
      ? 'partial'
      : 'no_public_data';
  updateData.status = hasHighConfidenceEmail || hasHighConfidencePhone ? 'enriched' : lead.status;

  await base44.asServiceRole.entities.ScrapedLead.update(leadId, updateData);

  return {
    status: 'success',
    leadId,
    companyName,
    companyDomain,
    enrichedEmails: enrichedEmails.length,
    enrichedPhones: enrichedPhones.length,
    bestEmail: bestEmail?.email || null,
    bestPhone: bestPhone?.phone || null,
    enrichmentStatus: updateData.enrichmentStatus,
    sources: sources.length,
  };
}