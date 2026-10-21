/**
 * googleCalendarHelpers.ts — Shared Google Calendar utilities used by
 * autoScheduleAppointment and scheduleFronterMeeting.
 */
export const ET_TZ = 'America/New_York';

export async function getCalendarAuth(base44: any) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

export async function listEvents(authHeader: any, timeMin: string, timeMax: string, maxEvents = 100): Promise<any[]> {
  const items: any[] = [];
  let pageToken = '';
  while (items.length < maxEvents) {
    const page = `&maxResults=${Math.min(250, maxEvents - items.length)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime${page}`;
    const res = await fetch(url, { headers: authHeader });
    if (!res.ok) break;
    const data = await res.json();
    items.push(...(data.items || []));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return items.slice(0, maxEvents);
}

export function hasConflict(events: any[], start: Date, end: Date): boolean {
  for (const ev of events) {
    const evStart = new Date(ev.start?.dateTime || ev.start?.date || '');
    const evEnd = new Date(ev.end?.dateTime || ev.end?.date || '');
    if (start < evEnd && end > evStart) return true;
  }
  return false;
}

export function formatInTz(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}