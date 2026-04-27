import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Get all leads with status='prospect'
  const prospects = await base44.asServiceRole.entities.Lead.filter({ status: 'prospect' });
  
  // Build a set of prospect emails for matching
  const prospectEmails = new Set(prospects.map(p => (p.email || '').toLowerCase().trim()).filter(e => e));
  
  // Get all InvestorUsers
  const allInvestors = await base44.asServiceRole.entities.InvestorUser.list();
  
  let deleted = 0;
  const deletedIds = [];
  const deletedNames = [];

  // Delete InvestorUsers whose email matches a prospect
  for (const investor of allInvestors) {
    const investorEmail = (investor.email || '').toLowerCase().trim();
    if (prospectEmails.has(investorEmail)) {
      try {
        await base44.asServiceRole.entities.InvestorUser.delete(investor.id);
        deleted++;
        deletedIds.push(investor.id);
        deletedNames.push(`${investor.name} (${investorEmail})`);
      } catch (e) {
        console.warn(`Failed to delete InvestorUser ${investor.id}:`, e.message);
      }
    }
  }

  return Response.json({
    success: true,
    prospectCount: prospects.length,
    deletedCount: deleted,
    deletedIds,
    deletedNames,
  });
});