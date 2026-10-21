// Schedule math for Debt Call Coach marketing campaigns.
// Turns the four schedule inputs (start, finish, daily window, frequency) into
// the exact list of send moments, so the builder can show how many leads a
// campaign needs before it is created.

const MAX_SENDS = 5000;

export function parseTime(value, fallbackMinutes) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return fallbackMinutes;
  return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]));
}

/** How many send moments fit inside one day's window. */
export function slotsPerDay(windowStart, windowEnd, intervalMinutes) {
  const start = parseTime(windowStart, 8 * 60);
  const end = parseTime(windowEnd, 20 * 60);
  const step = Math.max(5, Number(intervalMinutes) || 5);
  if (end <= start) return 0;
  return Math.floor((end - start) / step) + 1;
}

/**
 * Every send moment between startAt and endAt, inside the daily window.
 * Returns ISO strings. Each moment sends `emailsPerSend` emails.
 */
export function buildSchedule({ startAt, endAt, windowStart, windowEnd, intervalMinutes, emailsPerSend }) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (isNaN(start) || isNaN(end) || end < start) return [];

  const stepMs = Math.max(5, Number(intervalMinutes) || 5) * 60000;
  const perSend = Math.max(1, Number(emailsPerSend) || 1);
  const startMinutes = parseTime(windowStart, 8 * 60);
  const endMinutes = parseTime(windowEnd, 20 * 60);

  const times = [];
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (day <= lastDay && times.length < MAX_SENDS) {
    const windowOpen = new Date(day); windowOpen.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    const windowClose = new Date(day); windowClose.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    let t = new Date(Math.max(windowOpen.getTime(), start.getTime()));
    const stop = Math.min(windowClose.getTime(), end.getTime());

    while (t.getTime() <= stop && times.length < MAX_SENDS) {
      const iso = t.toISOString();
      for (let i = 0; i < perSend && times.length < MAX_SENDS; i++) times.push(iso);
      t = new Date(t.getTime() + stepMs);
    }
    day.setDate(day.getDate() + 1);
  }

  return times;
}

/** Short human summary of a schedule: days covered, emails per day, total. */
export function scheduleSummary(times) {
  const days = new Set(times.map((t) => new Date(t).toDateString()));
  const dayCount = days.size || 1;
  return { total: times.length, days: days.size, perDay: Math.round(times.length / dayCount) };
}