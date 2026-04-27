import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const convertedLeads = await base44.asServiceRole.entities.Lead.filter({ status: 'converted' });
  
  let updated = 0;
  for (const lead of convertedLeads) {
    try {
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        status: 'prospect',
        convertedToInvestorUserId: null,
      });
      updated++;
    } catch (e) {
      console.warn(`Failed to update lead ${lead.id}:`, e.message);
    }
  }

  return Response.json({
    success: true,
    totalConverted: convertedLeads.length,
    reverted: updated,
  });
});