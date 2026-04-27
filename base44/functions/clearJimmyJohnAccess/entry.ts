import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const allLeads = await base44.asServiceRole.entities.Lead.list();
  const jimmy = allLeads.find(l => 
    (l.firstName || '').toLowerCase().includes('jimmy') && 
    (l.lastName || '').toLowerCase().includes('john')
  );

  if (!jimmy) {
    return Response.json({ error: 'Jimmy John not found' }, { status: 404 });
  }

  await base44.asServiceRole.entities.Lead.update(jimmy.id, {
    portalPasscode: null,
  });

  return Response.json({
    success: true,
    message: `Cleared invalid access for ${jimmy.firstName} ${jimmy.lastName}`,
    hadPasscode: jimmy.portalPasscode,
  });
});