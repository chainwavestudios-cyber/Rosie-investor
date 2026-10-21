/**
 * rateDropSchedule.js — Precomputes the send times for a Rate Drop campaign.
 *
 * The whole schedule is decided when the campaign is created, so the engine
 * tick only has to send what is already due: it can never double-send or run
 * past the quota.
 *
 *   all_at_once → everyone at the start time
 *   stagger     → bursts of `batchSize` every `intervalMinutes`
 *   repetitive  → `dailyLimit` per day, every `intervalMinutes`, inside the
 *                 daily window (e.g. 50/day, 1 every 5 min, 8am–8pm)
 */

const MIN_INTERVAL = 5; // the engine ticks every 5 minutes

export function computeSendTimes({
  mode = 'all_at_once',
  startAt,
  count = 0,
  batchSize = 1,
  intervalMinutes = 5,
  dailyLimit = 50,
  windowStart = '08:00',
  windowEnd = '20:00',
} = {}) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const start = startAt ? new Date(startAt) : new Date();
  const gap = Math.max(MIN_INTERVAL, Number(intervalMinutes) || MIN_INTERVAL);
  const times = [];

  if (mode === 'stagger') {
    const batch = Math.max(1, Math.floor(Number(batchSize) || 1));
    for (let i = 0; i < total; i++) {
      const burst = Math.floor(i / batch);
      times.push(new Date(start.getTime() + burst * gap * 60000));
    }
    return times;
  }

  if (mode === 'repetitive') {
    const limit = Math.max(1, Math.floor(Number(dailyLimit) || 50));
    const [sh, sm] = String(windowStart || '08:00').split(':').map((n) => parseInt(n, 10) || 0);
    const [eh, em] = String(windowEnd || '20:00').split(':').map((n) => parseInt(n, 10) || 0);

    let dayStart = new Date(start);
    dayStart.setHours(sh, sm, 0, 0);
    let guard = 0;

    while (times.length < total && guard++ < 4000) {
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(eh, em, 0, 0);
      if (dayEnd.getTime() <= dayStart.getTime()) dayEnd.setHours(dayStart.getHours() + 1, sm, 0, 0);

      let cursor = new Date(Math.max(dayStart.getTime(), start.getTime()));
      let madeToday = 0;
      while (madeToday < limit && cursor.getTime() <= dayEnd.getTime() && times.length < total) {
        times.push(new Date(cursor));
        cursor = new Date(cursor.getTime() + gap * 60000);
        madeToday++;
      }

      dayStart = new Date(dayStart);
      dayStart.setDate(dayStart.getDate() + 1);
      dayStart.setHours(sh, sm, 0, 0);
      if (dayStart.getTime() < start.getTime()) dayStart.setTime(start.getTime());
    }
    return times;
  }

  for (let i = 0; i < total; i++) times.push(new Date(start));
  return times;
}

/** "2026-10-21T13:05:00" — local wall-clock without timezone shifting. */
export function toLocalIso(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}