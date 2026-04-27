import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Get all InvestorUsers with status='prospect'
  const prospectInvestors = await base44.asServiceRole.entities.InvestorUser.filter({ status: 'prospect' });
  
  const deletedUsers = [];

  // Delete each prospect InvestorUser (orphaned accounts)
  for (const iu of prospectInvestors) {
    try {
      deletedUsers.push({
        id: iu.id,
        name: iu.name,
        email: iu.email,
        username: iu.username,
      });

      await base44.asServiceRole.entities.InvestorUser.delete(iu.id);
    } catch (e) {
      console.warn(`Failed to delete InvestorUser ${iu.id}:`, e.message);
    }
  }

  return Response.json({
    success: true,
    deletedCount: deletedUsers.length,
    deletedUsers,
  });
});