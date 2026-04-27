import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Get all leads with status='prospect'
  const prospects = await base44.asServiceRole.entities.Lead.filter({ status: 'prospect' });
  
  let cleared = 0;

  // Clear portal credentials from prospect leads, keep portalPasscode
  for (const lead of prospects) {
    try {
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        username: null,
        password: null,
      });
      cleared++;
    } catch (e) {
      console.warn(`Failed to clear creds for lead ${lead.id}:`, e.message);
    }
  }

  return Response.json({
    success: true,
    prospectCount: prospects.length,
    clearedCount: cleared,
    message: 'Portal credentials cleared. portalPasscode (investor site access) preserved.',
  });
});