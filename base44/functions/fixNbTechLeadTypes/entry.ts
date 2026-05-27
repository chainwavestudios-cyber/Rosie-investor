/**
 * fixNbTechLeadTypes
 * One-time cleanup: resets leads that were incorrectly set to leadType='nb_tech'
 * only because they received an NB Tech email (badge), not because they actually
 * requested data room access.
 * 
 * Safe rule: ONLY reset if leadType === 'nb_tech' AND badgeDataRoomRequest !== true
 * Leads with badgeDataRoomRequest=true are REAL NB Tech leads — left untouched.
 * 
 * Admin-only. Run once from dashboard → Code → Functions → fixNbTechLeadTypes
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const base44Admin = base44.asServiceRole;

  // Find all leads tagged nb_tech but without a real data room request
  let page = 0;
  const pageSize = 500;
  let totalFixed = 0;
  const fixed = [];

  while (true) {
    const leads = await base44Admin.entities.Lead.filter(
      { leadType: 'nb_tech', badgeDataRoomRequest: false },
      '-created_date',
      pageSize
    );

    if (!leads || leads.length === 0) break;

    for (const lead of leads) {
      await base44Admin.entities.Lead.update(lead.id, {
        leadType: 'standard',
        leadPipelineOwner: null,
        leadPipelineStage: null,
      });
      fixed.push({ id: lead.id, name: `${lead.firstName} ${lead.lastName}` });
      totalFixed++;
    }

    if (leads.length < pageSize) break;
    page++;
  }

  console.log(`[fixNbTechLeadTypes] Reset ${totalFixed} leads back to standard`);
  return Response.json({ ok: true, totalFixed, fixed });
});