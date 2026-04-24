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

    const base44 = createClientFromRequest(req).asServiceRole;

    // Look up lead by portalPasscode
    const leads = await base44.entities.Lead.filter({ portalPasscode: ref });
    const lead = leads?.[0];

    if (!lead) {
      console.log(`[SiteVisit] No lead found for ref: ${ref}`);
      // Still log the visit without a lead link so it shows up
      await base44.entities.SiteVisit.create({
        leadId:     '',
        leadName:   ref,
        passcode:   ref,
        page:       page || '/',
        referrer:   referrer || '',
        timeOnPage: timeOnPage || 0,
        sessionId:  sessionId || '',
        siteType,
        visitedAt:  new Date().toISOString(),
      });
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    await base44.entities.SiteVisit.create({
      leadId:     lead.id,
      leadName:   `${lead.firstName} ${lead.lastName}`,
      passcode:   ref,
      page:       page || '/',
      referrer:   referrer || '',
      timeOnPage: timeOnPage || 0,
      sessionId:  sessionId || '',
      siteType,
      visitedAt:  new Date().toISOString(),
    });

    // Update lead engagement
    await base44.entities.Lead.update(lead.id, {
      badgeConsumerWebsite: siteType === 'consumer' ? true : (lead.badgeConsumerWebsite || false),
      engagementScore: (lead.engagementScore || 0) + 2,
    });

    console.log(`[SiteVisit] Logged for ${lead.firstName} ${lead.lastName}`);
    return new Response(JSON.stringify({ ok: true, leadId: lead.id }), { headers: corsHeaders });

  } catch (e) {
    console.error('[SiteVisit] Error:', e.message);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }
});