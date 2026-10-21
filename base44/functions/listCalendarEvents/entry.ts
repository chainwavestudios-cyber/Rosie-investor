/**
 * listCalendarEvents — Lists Google Calendar events for a date range
 * (default: next 3 days from now, America/New_York). Used by the Hot Leads
 * tab to show upcoming scheduled calls/appointments alongside hot leads.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getCalendarAuth, listEvents, ET_TZ } from '../../shared/googleCalendarHelpers.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(1, body?.days || 3), 400);
    // pastDays = how far back to look. 0 keeps the original "from today onwards" behaviour
    // used by the hot-lead / alert windows; the calendar asks for a wide past window so
    // appointments that already happened stay visible under the All filter.
    const pastDays = Math.min(Math.max(0, body?.pastDays || 0), 730);

    // Start from midnight ET today so past appointments for the current day are included
    const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: ET_TZ }));
    nowET.setHours(0, 0, 0, 0);
    const timeMin = new Date(nowET.getTime() - pastDays * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const authHeader = await getCalendarAuth(base44);
    const events = await listEvents(authHeader, timeMin, timeMax, 500);

    const formatted = events
      .filter((ev: any) => ev.start?.dateTime || ev.start?.date)
      .map((ev: any) => {
        const startISO = ev.start?.dateTime || ev.start?.date;
        const endISO = ev.end?.dateTime || ev.end?.date;
        const start = new Date(startISO);
        return {
          id: ev.id,
          title: ev.summary || '(No title)',
          startISO,
          endISO,
          startLabel: start.toLocaleString('en-US', { timeZone: ET_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          timeLabel: start.toLocaleTimeString('en-US', { timeZone: ET_TZ, hour: 'numeric', minute: '2-digit' }),
          dayLabel: start.toLocaleDateString('en-US', { timeZone: ET_TZ, weekday: 'long', month: 'short', day: 'numeric' }),
          htmlLink: ev.htmlLink || null,
          attendees: (ev.attendees || []).map((a: any) => a.email).filter(Boolean),
        };
      });

    return Response.json({ events: formatted, days, pastDays, count: formatted.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message, events: [] }, { status: 500 });
  }
}