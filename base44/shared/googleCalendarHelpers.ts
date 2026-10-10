/**
 * googleCalendarHelpers.ts — Shared Google Calendar utilities used by
 * autoScheduleAppointment and scheduleFronterMeeting.
 */
export const ET_TZ = 'America/New_York';

export async function getCalendarAuth(base44: any) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

export async function listEvents(authHeader: any, timeMin: string, timeMax: string): Promise<any[]> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=100&orderBy=startTime`;
  const res = await fetch(url, { headers: authHeader });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
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