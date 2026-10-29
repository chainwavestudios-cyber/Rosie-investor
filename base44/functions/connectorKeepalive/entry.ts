import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { automationGate } from '../../shared/automationRules.ts';

// Keeps the shared Google connections warm.
// Each run asks the platform for a live access token (which performs the OAuth
// refresh-token exchange) and then makes one lightweight authenticated call, so
// the underlying Google grant is never left idle long enough to expire.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const gate = await automationGate(base44, 'connector_keepalive');
    if (!gate.run) return Response.json({ skipped: true, automation: 'connector_keepalive', reason: gate.reason });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const checkedAt = new Date().toISOString();

    // ── Google Calendar ────────────────────────────────────────────────
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1',
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) }
      );
      results.googlecalendar = { healthy: res.ok, status: res.status, needsReconnect: res.status === 401 };
    } catch (e) {
      results.googlecalendar = { healthy: false, error: e.message };
    }

    // ── Gmail ──────────────────────────────────────────────────────────
    // The app holds send-only scope, so this endpoint can answer 403. Any real
    // answer other than 401 still proves the grant was refreshed and is alive.
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const res = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) }
      );
      results.gmail = {
        healthy: res.ok || res.status === 403,
        status: res.status,
        needsReconnect: res.status === 401,
      };
    } catch (e) {
      results.gmail = { healthy: false, error: e.message };
    }

    // Alert the team when a connection has dropped, instead of letting the next
    // send or calendar write fail with a silent 500.
    const labels = { googlecalendar: 'Google Calendar', gmail: 'Gmail' };
    for (const key of Object.keys(labels)) {
      const state = results[key];
      if (!state || state.healthy) continue;
      const title = `${labels[key]} connection needs reconnecting`;
      const existing = await base44.asServiceRole.entities.AppNotification.filter({ title, read: false }, '-created_date', 1);
      if (existing.length > 0) continue;
      await base44.asServiceRole.entities.AppNotification.create({
        title,
        body: state.error || `The connection is no longer valid (status ${state.status}). Emails and calendar events will fail until it is reconnected.`,
        type: 'system',
        source: 'Connection health check',
        linkPath: '/',
      });
    }

    return Response.json({ checkedAt, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}