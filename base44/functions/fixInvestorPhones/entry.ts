import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get all investors missing a phone but having a leadId
    const allInvestors = await base44.asServiceRole.entities.InvestorUser.list('-created_date', 2000);
    const missing = allInvestors.filter(u => !u.phone && u.leadId);

    let fixed = 0;
    const details = [];

    for (const investor of missing) {
      try {
        const leads = await base44.asServiceRole.entities.Lead.filter({ id: investor.leadId });
        const lead = leads?.[0];
        if (lead?.phone) {
          const patch = { phone: lead.phone };
          // Also patch email/address if missing
          if (!investor.email && lead.email) patch.email = lead.email.toLowerCase();
          if (!investor.address && lead.address) patch.address = lead.address;
          await base44.asServiceRole.entities.InvestorUser.update(investor.id, patch);
          fixed++;
          details.push({ name: investor.name, phone: lead.phone });
        }
      } catch (e) {
        details.push({ name: investor.name, error: e.message });
      }
    }

    return Response.json({ fixed, total: missing.length, details });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});