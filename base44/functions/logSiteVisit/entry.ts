import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response('OK', { headers: corsHeaders });

  try {
    const { ref, page, referrer, timeOnPage, sessionId, siteType = 'consumer' } = await req.json();
    if (!ref) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

    console.log(`[SiteVisit] ref=${ref} page=${page} siteType=${siteType} time=${timeOnPage}`);

    const db  = createClientFromRequest(req).asServiceRole;
    const now = new Date().toISOString();

    // ── Resolve the visitor ──────────────────────────────────────────────────
    let lead       = null;
    let investorId = '';

    // 1. Lead.portalPasscode direct filter
    try {
      const rows = await db.entities.Lead.filter({ portalPasscode: ref });
      lead = rows?.[0] || null;
    } catch {}

    // 2. In-memory scan fallback (guards against base44 custom-field filter changes)
    if (!lead) {
      try {
        const allLeads = await db.entities.Lead.list('-created_date', 500);
        lead = (allLeads || []).find(l =>
          (l.portalPasscode || '').trim().toLowerCase() === ref.toLowerCase()
        ) || null;
      } catch {}
    }

    // 3. InvestorUser.siteAccessCode (migrated users — archived lead may not match anymore)
    if (!lead) {
      try {
        let investors = await db.entities.InvestorUser.filter({ siteAccessCode: ref });
        if (!investors?.length) {
          // also try username match as fallback
          investors = await db.entities.InvestorUser.filter({ username: ref });
        }
        if (investors?.[0]) {
          const iu = investors[0];
          investorId = iu.id;
          if (iu.leadId) {
            try {
              const linked = await db.entities.Lead.filter({ id: iu.leadId });
              lead = linked?.[0] || null;
            } catch {}
          }
        }
      } catch {}
    }

    // ── Create SiteVisit record ──────────────────────────────────────────────
    const visitRecord = {
      passcode:   ref,
      leadId:     lead?.id   || '',
      investorId: investorId || '',
      leadName:   lead
        ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim()
        : ref,
      page:       page       || '/',
      referrer:   referrer   || '',
      timeOnPage: timeOnPage || 0,
      sessionId:  sessionId  || '',
      siteType,
      visitedAt:  now,
    };

    await db.entities.SiteVisit.create(visitRecord);
    console.log(`[SiteVisit] Logged — lead:${visitRecord.leadId} investor:${investorId} site:${siteType}`);

    // ── Stamp lead ───────────────────────────────────────────────────────────
    if (lead) {
      const updates = {
        engagementScore: (lead.engagementScore || 0) + 2,
        lastSiteVisit:   now,
      };
      if (siteType === 'consumer') updates.badgeConsumerWebsite = true;
      if (siteType === 'investor') updates.badgeInvestorPage   = true;
      await db.entities.Lead.update(lead.id, updates).catch(() => {});
    }

    // ── Stamp InvestorUser lastActivityAt ────────────────────────────────────
    if (investorId) {
      await db.entities.InvestorUser.update(investorId, { lastActivityAt: now }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ ok: true, leadId: lead?.id || '', investorId }),
      { headers: corsHeaders }
    );

  } catch (e) {
    console.error('[SiteVisit] Error:', e.message);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }
});