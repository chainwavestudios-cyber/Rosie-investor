import { createClient } from 'npm:@base44/sdk@0.8.25';

const base44 = createClient({ serviceRole: true });

Deno.serve(async (req) => {
  // Allow CORS from rosieai.tech
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response('OK', { headers: corsHeaders });

  try {
    const { ref, page, referrer, timeOnPage, sessionId, siteType = 'consumer' } = await req.json();

    if (!ref) return new Response(JSON.stringify({ error: 'Missing ref' }), { status: 400, headers: corsHeaders });

    console.log(`[SiteVisit] ref=${ref} page=${page} siteType=${siteType}`);

    // Look up lead by portalPasscode
    const leads = await base44.entities.Lead.filter({ portalPasscode: ref });
    const lead = leads?.[0];

    if (!lead) {
      console.log(`[SiteVisit] No lead found for passcode: ${ref}`);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Log the visit
    await base44.entities.SiteVisit.create({
      leadId:      lead.id,
      leadName:    `${lead.firstName} ${lead.lastName}`,
      passcode:    ref,
      page:        page || '/',
      referrer:    referrer || '',
      timeOnPage:  timeOnPage || 0,
      sessionId:   sessionId || '',
      siteType:    siteType, // 'consumer' or 'investor'
      visitedAt:   new Date().toISOString(),
    });

    // Update lead engagement score
    await base44.entities.Lead.update(lead.id, {
      badgeConsumerWebsite: siteType === 'consumer' ? true : lead.badgeConsumerWebsite,
      badgeInvestorPage:    siteType === 'investor' ? true : lead.badgeInvestorPage,
      engagementScore:      (lead.engagementScore || 0) + 2,
      lastSiteVisit:        new Date().toISOString(),
    });

    // Log to LeadHistory
    await base44.entities.LeadHistory.create({
      leadId:  lead.id,
      type:    'note',
      content: `🌐 Visited ${siteType} site — ${page || '/'} (+2 engagement)`,
    });

    console.log(`[SiteVisit] Logged visit for ${lead.firstName} ${lead.lastName}`);
    return new Response(JSON.stringify({ ok: true, leadId: lead.id }), { headers: corsHeaders });

  } catch (e) {
    console.error('[SiteVisit] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});