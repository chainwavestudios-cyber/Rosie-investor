/**
 * businessHours.ts — the app's working clock.
 *
 * The automatic follow-up email may not chase a lead who has only just been
 * sent their credentials: it waits out the delay below in BUSINESS time — Monday
 * to Friday, 9am to 5pm Eastern — so a Friday-evening click never turns into a
 * Saturday email, and a Monday-morning click still waits a full working day.
 */

export const BUSINESS_HOURS = { startHour: 9, endHour: 17, timeZone: 'America/New_York' };

/** How long the follow-up email has to wait after the credentials email. */
export const FOLLOW_UP_DELAY_BUSINESS_HOURS = 8;

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const easternFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_HOURS.timeZone,
  hourCycle: 'h23',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function easternParts(date: Date) {
  const parts: Record<string, string> = {};
  for (const part of easternFormat.formatToParts(date)) parts[part.type] = part.value;
  return parts;
}

/** Is this minute inside the working week (Mon–Fri, 9am–5pm Eastern)? */
export function isBusinessMinute(date: Date) {
  const parts = easternParts(date);
  const day = DAY_INDEX[parts.weekday] ?? 0;
  const hour = Number(parts.hour);
  return day >= 1 && day <= 5 && hour >= BUSINESS_HOURS.startHour && hour < BUSINESS_HOURS.endHour;
}

/** The instant `hours` business hours after `startIso` — weekends never count. */
export function addBusinessHours(startIso: string, hours: number) {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return new Date().toISOString();

  let remaining = Math.max(0, Math.round(hours * 60));
  const cursor = new Date(start.getTime());
  while (remaining > 0) {
    if (isBusinessMinute(cursor)) remaining -= 1;
    cursor.setTime(cursor.getTime() + 60_000);
  }
  return cursor.toISOString();
}

/** "Tue, Oct 27, 3:00 PM ET" — how a queued wait reads in a contact card note. */
export function formatEastern(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleString('en-US', {
    timeZone: BUSINESS_HOURS.timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} ET`;
}