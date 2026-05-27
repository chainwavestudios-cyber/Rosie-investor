import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44Admin = createClientFromRequest(req).asServiceRole;

  const pageSize = 500;
  let totalFixed = 0;
  const fixed = [];

  // Get ALL leads with leadType='nb_tech' AND badgeDataRoomRequest=false
  // These were incorrectly tagged — real data room leads have badgeDataRoomRequest=true
  const leads = await base44Admin.entities.Lead.filter(
    { leadType: 'nb_tech', badgeDataRoomRequest: false },
    '-updated_date',
    pageSize
  );

  for (const lead of (leads || [])) {
    await base44Admin.entities.Lead.update(lead.id, {
      leadType: 'standard',
      leadPipelineOwner: null,
      leadPipelineStage: null,
    });
    fixed.push({ id: lead.id, name: `${lead.firstName} ${lead.lastName}`, email: lead.email });
    totalFixed++;
  }

  console.log(`[fixNbTechLeadTypes] Reset ${totalFixed} leads back to standard`);
  return Response.json({ ok: true, totalFixed, fixed });
});