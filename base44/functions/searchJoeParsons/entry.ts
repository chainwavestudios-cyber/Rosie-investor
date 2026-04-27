import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const allLeads = await base44.asServiceRole.entities.Lead.list();
  const allInvestors = await base44.asServiceRole.entities.InvestorUser.list();

  const joeLead = allLeads.find(l => (l.firstName + ' ' + l.lastName).toLowerCase().includes('joe') && l.lastName.toLowerCase().includes('parsons'));
  const joeInvestor = allInvestors.find(i => i.name.toLowerCase().includes('joe') && i.name.toLowerCase().includes('parsons'));

  return Response.json({
    joeLead: joeLead || null,
    joeInvestor: joeInvestor || null,
    totalLeads: allLeads.length,
    totalInvestors: allInvestors.length,
  });
});