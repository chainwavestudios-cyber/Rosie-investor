/**
 * campaignQueues.js — one reading of a campaign's sending queues.
 *
 * The schedule step edits them and the monitor reports on them, so both read the
 * same shape here: a list of {label, perBurst, gapMinSeconds, gapMaxSeconds,
 * enabled}. A campaign saved before queues existed has none stored — the single
 * queue its old batch settings describe is used instead, so nothing changes for it.
 */

const positive = (value, fallback) => (Number(value) > 0 ? Number(value) : fallback);

/** The campaign's queues, always at least one. */
export function parseQueues(campaign) {
  let parsed = [];
  try { parsed = JSON.parse(campaign?.queuesJson || '[]'); } catch { parsed = []; }
  const rows = (Array.isArray(parsed) ? parsed : [])
    .filter((row) => row && typeof row === 'object')
    .map((row, index) => {
      const min = Math.max(5, positive(row.gapMinSeconds, 60));
      return {
        label: String(row.label || `Queue ${index + 1}`),
        perBurst: Math.max(1, Math.min(positive(row.perBurst, 1), 100)),
        gapMinSeconds: min,
        gapMaxSeconds: Math.max(min, positive(row.gapMaxSeconds, min)),
        enabled: row.enabled !== false,
      };
    });
  if (rows.length) return rows;
  const min = Math.max(5, positive(campaign?.intervalSeconds, 60));
  return [{
    label: 'Main queue',
    perBurst: Math.max(1, Math.min(positive(campaign?.batchSize, 1), 100)),
    gapMinSeconds: min,
    gapMaxSeconds: Math.max(min, positive(campaign?.intervalMaxSeconds, min)),
    enabled: true,
  }];
}

const wait = (seconds) => (seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds}s`);

/** "1 per send, every 1–5 min" — the pace of one queue, in words. */
export function queueSummary(queue) {
  const gap = queue.gapMinSeconds === queue.gapMaxSeconds
    ? `every ${wait(queue.gapMinSeconds)}`
    : `every ${wait(queue.gapMinSeconds)}–${wait(queue.gapMaxSeconds)}`;
  return `${queue.perBurst} per send, ${gap}`;
}

/** The older batch fields, kept in step with the first queue so nothing else breaks. */
export function mirrorPatch(queues) {
  const first = queues.find((queue) => queue.enabled) || queues[0];
  return first
    ? { batchSize: first.perBurst, intervalSeconds: first.gapMinSeconds, intervalMaxSeconds: first.gapMaxSeconds }
    : {};
}

export const NEW_QUEUE = {
  label: 'Second queue',
  perBurst: 1,
  gapMinSeconds: 60,
  gapMaxSeconds: 300,
  enabled: true,
};