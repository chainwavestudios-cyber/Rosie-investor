/**
 * bridgeKeepalive — Pings the Render WS Bridge /health endpoint.
 *
 * Called by a scheduled workflow every 10 minutes to prevent the Render free-tier
 * service from spinning down. When the bridge is asleep, Twilio's Media Stream
 * WebSocket times out during cold start (30-60s), causing AI agent calls to
 * disconnect immediately when the prospect answers.
 */
import { secrets } from 'base44:runtime';

export default async function(req: Request): Promise<Response> {
  const bridgeUrl = (secrets.get('WS_BRIDGE_URL') || '').replace(/\/$/, '');
  if (!bridgeUrl) {
    return Response.json({ ok: false, error: 'WS_BRIDGE_URL not set' });
  }
  try {
    const res = await fetch(`${bridgeUrl}/health`, { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    console.log('[bridgeKeepalive] ping', bridgeUrl, '→', res.status, JSON.stringify(data));
    return Response.json({ ok: res.ok, bridge: data });
  } catch (e) {
    console.error('[bridgeKeepalive] ping failed:', e?.message);
    return Response.json({ ok: false, error: e?.message || String(e) });
  }
}