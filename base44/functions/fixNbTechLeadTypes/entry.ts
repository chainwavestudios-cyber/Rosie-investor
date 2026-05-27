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
  const base44Admin = createClientFromRequest(req).asServiceRole;

  // Find all leads tagged nb_tech but WITHOUT a real data room request badge
  // AND updated today (these are the ones incorrectly set by the previous bug)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const pageSize = 500;
  let totalFixed = 0;
  const fixed = [];

  while (true) {
    const leads = await base44Admin.entities.Lead.filter(
      { leadType: 'nb_tech', badgeDataRoomRequest: false },
      '-updated_date',
      pageSize
    );

    // Only process leads updated today
    const todayLeads = (leads || []).filter(l => new Date(l.updated_date) >= todayStart);

    if (!leads || leads.length === 0) break;

    for (const lead of todayLeads) {
      await base44Admin.entities.Lead.update(lead.id, {
        leadType: 'standard',
        leadPipelineOwner: null,
        leadPipelineStage: null,
      });
      fixed.push({ id: lead.id, name: `${lead.firstName} ${lead.lastName}`, email: lead.email });
      totalFixed++;
    }

    // Stop if no more today-leads in this batch
    if (todayLeads.length < leads.length || leads.length < pageSize) break;
  }

  console.log(`[fixNbTechLeadTypes] Reset ${totalFixed} leads back to standard`);
  return Response.json({ ok: true, totalFixed, fixed });
});