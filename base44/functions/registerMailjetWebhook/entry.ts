import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET = Deno.env.get('MAILJET_API_SECRET');

const WEBHOOK_URL = 'https://investors.rosieai.tech/api/apps/69cd2741578c9b5ce655395b/functions/mailjetWebhook';

const EVENT_TYPES = ['open', 'click', 'bounce', 'spam', 'sent', 'blocked', 'unsub'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);

  // List existing webhooks
  const listRes = await fetch('https://api.mailjet.com/v3/REST/eventcallbackurl', {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  const listData = await listRes.json();
  const existing = listData.Data || [];

  console.log('[RegisterWebhook] Existing webhooks:', JSON.stringify(existing));

  const results = [];

  for (const eventType of EVENT_TYPES) {
    // Only skip if alive AND version 2
    const alreadyExists = existing.find(w =>
      w.EventType === eventType &&
      w.Url === WEBHOOK_URL &&
      w.Status === 'alive' &&
      w.Version === 2
    );
    if (alreadyExists) {
      results.push({ eventType, status: 'already_exists', id: alreadyExists.ID });
      continue;
    }

    // Delete ALL old webhooks for this event type (dead or version 1)
    const old = existing.filter(w => w.EventType === eventType);
    for (const o of old) {
      await fetch(`https://api.mailjet.com/v3/REST/eventcallbackurl/${o.ID}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Basic ${auth}` }
      });
      console.log(`[RegisterWebhook] Deleted old webhook for ${eventType} (ID: ${o.ID}, Status: ${o.Status}, Version: ${o.Version})`);
    }

    // Register fresh webhook as alive, version 2
    const regRes = await fetch('https://api.mailjet.com/v3/REST/eventcallbackurl', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        EventType: eventType,
        Url: WEBHOOK_URL,
        Status: 'alive',
        IsBackup: false,
        Version: 2,
      }),
    });

    const regData = await regRes.json();
    console.log(`[RegisterWebhook] ${eventType}:`, JSON.stringify(regData));
    results.push({ eventType, status: regRes.ok ? 'registered' : 'error', data: regData });
  }

  return Response.json({ success: true, results });
});