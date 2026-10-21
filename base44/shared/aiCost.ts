// Anthropic per-token pricing (USD per token) and Eastern-time helpers.
// Shared by the AI usage tracker in liveAssistantAI (which stamps an exact
// cost on every Anthropic call) and by the nightly AI cost report.

export const PRICING_USD_PER_TOKEN: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-haiku-4-5': { input: 1 / 1e6, output: 5 / 1e6, cacheRead: 0.1 / 1e6, cacheWrite: 1.25 / 1e6 },
};

const FALLBACK_PRICING = PRICING_USD_PER_TOKEN['claude-haiku-4-5'];

export function resolvePricing(model: string) {
  const m = (model || '').toLowerCase();
  for (const key of Object.keys(PRICING_USD_PER_TOKEN)) {
    if (m.startsWith(key)) return PRICING_USD_PER_TOKEN[key];
  }
  return FALLBACK_PRICING;
}

// Exact cost of one Anthropic call from its real token counts.
export function computeCostUsd({ model, inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0 }: any) {
  const p = resolvePricing(model);
  const usd = (inputTokens || 0) * p.input
    + (outputTokens || 0) * p.output
    + (cacheReadTokens || 0) * p.cacheRead
    + (cacheWriteTokens || 0) * p.cacheWrite;
  return Math.round(usd * 1e6) / 1e6;
}

// ── Eastern time helpers (the business runs on America/New_York) ────────────
function etParts(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const out: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) out[part.type] = part.value;
  return out;
}

function etOffsetMs(date: Date) {
  const p = etParts(date);
  const hour = p.hour === '24' ? 0 : Number(p.hour);
  const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
  return asUTC - date.getTime();
}

// UTC instants covering the given Eastern calendar day (YYYY-MM-DD).
export function etDayRange(dateStr: string) {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  const offset = etOffsetMs(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
  const start = new Date(Date.UTC(y, m - 1, d) - offset);
  return { startISO: start.toISOString(), endISO: new Date(start.getTime() + 86400000).toISOString() };
}

// Eastern calendar date (YYYY-MM-DD), optionally shifted by whole days.
export function etDayString(date = new Date(), dayOffset = 0) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(date);
  if (!dayOffset) return today;
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dayOffset)).toISOString().slice(0, 10);
}