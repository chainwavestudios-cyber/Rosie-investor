/**
 * autoTagNbTechLeads
 * Triggered by entity automation on Lead create/update.
 * If a lead has badgeNbtechEmail=true OR badgeDataRoomRequest=true,
 * automatically set leadType='nb_tech' and leadPipelineOwner='admin'.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req).asServiceRole;
    const body = await req.json();

    const { data, event } = body;
    const leadId = event?.entity_id;

    if (!leadId || !data) {
      return Response.json({ ok: true, skipped: 'no data' });
    }

    // Only act if the lead has NB Tech badge OR Data Room badge
    if (!data.badgeNbtechEmail && !data.badgeDataRoomRequest) {
      return Response.json({ ok: true, skipped: 'no relevant badges' });
    }

    // Only update if not already tagged as nb_tech
    if (data.leadType === 'nb_tech') {
      return Response.json({ ok: true, skipped: 'already nb_tech' });
    }

    await base44.entities.Lead.update(leadId, {
      leadType: 'nb_tech',
      leadPipelineOwner: data.leadPipelineOwner || 'admin',
    });

    console.log(`[autoTagNbTechLeads] Tagged lead ${leadId} as nb_tech (badge: ${data.badgeNbtechEmail ? 'nbtech' : 'dataroom'})`);

    return Response.json({ ok: true, tagged: leadId });
  } catch (e) {
    console.error('[autoTagNbTechLeads] Error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});