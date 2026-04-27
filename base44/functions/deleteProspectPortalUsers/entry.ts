import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Get all leads with status='prospect'
  const prospects = await base44.asServiceRole.entities.Lead.filter({ status: 'prospect' });
  
  let deleted = 0;
  const deletedIds = [];

  // For each prospect, if they have a convertedToInvestorUserId, delete that InvestorUser
  for (const prospect of prospects) {
    if (prospect.convertedToInvestorUserId) {
      try {
        await base44.asServiceRole.entities.InvestorUser.delete(prospect.convertedToInvestorUserId);
        deleted++;
        deletedIds.push(prospect.convertedToInvestorUserId);
      } catch (e) {
        console.warn(`Failed to delete InvestorUser ${prospect.convertedToInvestorUserId}:`, e.message);
      }
    }
  }

  return Response.json({
    success: true,
    prospectCount: prospects.length,
    deletedCount: deleted,
    deletedIds,
  });
});