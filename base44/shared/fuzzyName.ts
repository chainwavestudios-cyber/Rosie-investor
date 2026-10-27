// Name matching that forgives the way real people spell names on a call floor:
// "Tonya Morris" is found when someone types "Tanya Morris", "Moris", "Tonya M".
// Used by the ACE command console's contact lookup so a near miss never returns
// "no such person".

export function normalizeName(value: any) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 — 1 is identical, tolerating a couple of letters off on longer strings. */
export function similarity(a: string, b: string) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length > 3 && y.includes(x)) return 0.92;
  if (y.length > 3 && x.includes(y)) return 0.92;
  return Math.max(0, 1 - levenshtein(x, y) / Math.max(x.length, y.length));
}

/**
 * How well one record's name answers the typed query, 0..1.
 * Every word of the query has to land near a name word, so "Tanya Morris"
 * scores the real Tonya Morris highly but never a random Tony Smith.
 */
export function contactScore(query: string, record: any) {
  const first = normalizeName(record?.firstName);
  const last = normalizeName(record?.lastName);
  const full = [first, last].filter(Boolean).join(' ');
  if (!full) return 0;

  const q = normalizeName(query);
  const tokens = q.split(' ').filter(Boolean);
  if (!tokens.length) return 0;

  const nameTokens = full.split(' ');
  let covered = 0;
  for (const token of tokens) {
    const best = nameTokens.reduce((max, n) => Math.max(max, similarity(token, n)), 0);
    if (best >= 0.62) covered += 1;
  }
  const coverage = covered / tokens.length;
  if (coverage < 0.5) return 0;

  return Math.round((similarity(q, full) * 0.7 + coverage * 0.3) * 100) / 100;
}