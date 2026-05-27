import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44Admin = createClientFromRequest(req).asServiceRole;

  const fixed = [];
  let offset = 0;
  const pageSize = 500;

  // Clear ALL leads with leadType='nb_tech' — full reset
  while (true) {
    const leads = await base44Admin.entities.Lead.filter(
      { leadType: 'nb_tech' },
      '-updated_date',
      pageSize
    );
    if (!leads || leads.length === 0) break;

    for (const lead of leads) {
      await base44Admin.entities.Lead.update(lead.id, {
        leadType: 'standard',
        leadPipelineOwner: null,
        leadPipelineStage: null,
      });
      fixed.push({ id: lead.id, name: `${lead.firstName} ${lead.lastName}`, email: lead.email });
    }

    if (leads.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`[fixNbTechLeadTypes] Reset ${fixed.length} leads to standard`);
  return Response.json({ ok: true, totalFixed: fixed.length, fixed });
});