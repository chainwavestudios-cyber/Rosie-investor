/**
 * etTime.ts — Eastern Time helpers shared by the Debt Call Coach marketing
 * engine and its nightly report. All scheduling rules in this feature are
 * business-hours rules, so everything is resolved in ET (DST-safe).
 */
export const ET = 'America/New_York';

export function etParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute') };
}

/** An ET wall-clock moment as the matching UTC instant. */
export function etToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  for (const offset of [4, 5]) { // EDT, then EST
    const guess = new Date(Date.UTC(year, month - 1, day, hour + offset, minute));
    const back = etParts(guess);
    if (back.year === year && back.month === month && back.day === day && back.hour === hour && back.minute === minute) return guess;
  }
  return new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
}

/** The UTC window covering one ET calendar day (defaults to today in ET). */
export function etDayWindow(dateStr?: string) {
  const anchor = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();
  const { year, month, day } = etParts(anchor);
  const start = etToUtc(year, month, day, 0, 0);
  const end = new Date(etToUtc(year, month, day, 23, 59).getTime() + 59_000);
  const reportDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { start: start.toISOString(), end: end.toISOString(), reportDate };
}