import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data } = payload;
    if (!data && !event?.entity_id) return Response.json({ skipped: true });

    const entityData = data || await base44.asServiceRole.entities.InvestorUser.get(event?.entity_id);
    if (!entityData) return Response.json({ skipped: true });

    const result = await base44.asServiceRole.functions.invoke('syncToSheets', {
      entityType: 'InvestorUser',
      eventType: event?.type || 'update',
      data: entityData,
    });

    return Response.json({ success: true });
  } catch (e) {
    console.error('syncInvestorToSheets error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});