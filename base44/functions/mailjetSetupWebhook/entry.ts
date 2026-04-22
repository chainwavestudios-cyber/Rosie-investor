/**
 * Run this ONCE to register the mailjetWebhook endpoint with Mailjet.
 * Call it from dashboard > code > functions > mailjetSetupWebhook
 * Pass payload: { webhookUrl: "https://YOUR_APP_URL/functions/mailjetWebhook" }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_API_KEY = Deno.env.get('MAILJET_API_KEY');
const MJ_API_SECRET = Deno.env.get('MAILJET_API_SECRET');

const EVENT_TYPES = ['open', 'click', 'bounce', 'sent'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { webhookUrl } = await req.json();
    if (!webhookUrl) {
      return Response.json({ error: 'webhookUrl is required. Pass the full URL of your mailjetWebhook function.' }, { status: 400 });
    }

    const results = [];

    for (const eventType of EVENT_TYPES) {
      // Check if already registered
      const existing = await fetch(`https://api.mailjet.com/v3/REST/eventcallbackurl?EventType=${eventType}`, {
        headers: { 'Authorization': 'Basic ' + btoa(`${MJ_API_KEY}:${MJ_API_SECRET}`) },
      });
      const existingData = await existing.json();
      const already = existingData.Data?.find(e => e.Url === webhookUrl);

      if (already) {
        results.push({ event: eventType, status: 'already_registered', id: already.ID });
        continue;
      }

      // Register
      const res = await fetch('https://api.mailjet.com/v3/REST/eventcallbackurl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`${MJ_API_KEY}:${MJ_API_SECRET}`),
        },
        body: JSON.stringify({
          EventType: eventType,
          Url: webhookUrl,
          IsBackup: false,
          Status: 'alive',
        }),
      });
      const data = await res.json();
      results.push({ event: eventType, status: res.ok ? 'registered' : 'error', data });
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});