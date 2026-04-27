import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Get all leads with status='prospect'
  const prospects = await base44.asServiceRole.entities.Lead.filter({ status: 'prospect' });
  
  // Get all InvestorUsers
  const allInvestors = await base44.asServiceRole.entities.InvestorUser.list();
  
  // Match prospects to InvestorUsers by name similarity
  const remainingPortalUsers = [];
  
  for (const investor of allInvestors) {
    const investorName = (investor.name || '').toLowerCase().trim();
    const hasMatchingProspect = prospects.some(p => {
      const prospectName = `${(p.firstName || '')} ${(p.lastName || '')}`.toLowerCase().trim();
      return prospectName && (investorName.includes(prospectName.split(' ')[0]) || investorName === prospectName);
    });
    
    if (hasMatchingProspect) {
      remainingPortalUsers.push({
        id: investor.id,
        name: investor.name,
        email: investor.email,
        username: investor.username,
      });
    }
  }

  return Response.json({
    success: true,
    prospectCount: prospects.length,
    totalInvestorUsers: allInvestors.length,
    remainingPortalUsers,
    remainingCount: remainingPortalUsers.length,
  });
});