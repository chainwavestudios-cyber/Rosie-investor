import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Find Jarvis Sturdivant
  const allLeads = await base44.asServiceRole.entities.Lead.list();
  const jarvis = allLeads.find(l => 
    (l.firstName || '').toLowerCase().includes('jarvis') && 
    (l.lastName || '').toLowerCase().includes('sturdivant')
  );

  if (!jarvis) {
    return Response.json({ error: 'Jarvis Sturdivant not found', totalLeads: allLeads.length }, { status: 404 });
  }

  // Clear the invalid portalPasscode
  await base44.asServiceRole.entities.Lead.update(jarvis.id, {
    portalPasscode: null,
  });

  return Response.json({
    success: true,
    message: `Cleared portalPasscode for ${jarvis.firstName} ${jarvis.lastName}`,
    leadId: jarvis.id,
    hadPasscode: jarvis.portalPasscode,
  });
});