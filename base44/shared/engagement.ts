/**
 * engagement.ts — the single engagement model for tracked email activity.
 *
 * Every open, link click and qualification-page visit recorded in
 * EmailTrackingEvent is turned into one 0-100 score here, so the contact-card
 * badge, the follow-up ranking and the campaign table all read the same number.
 * Pure functions only — no SDK, no I/O.
 */

/** A brand-new event is ignored this long: mail preview crawlers open instantly. */
export const BOT_FILTER_MS = 30_000;

/** The credential links in the welcome email, and the one that is not one of them
 *  (any other link is the personal welcome-message link). */
export const CREDENTIAL_LINKS = [
  { key: 'website', match: 'debtadvisorsofamerica.com', label: 'Company website' },
  { key: 'bbb', match: 'bbb.org', label: 'BBB' },
  { key: 'trustpilot', match: 'trustpilot.com', label: 'Trustpilot' },
];

const HOUR = 3_600_000;

export interface LeadSignals {
  leadId: string;
  opens: number;
  clicks: number;
  distinctUrls: number;
  linkKeys: string[];
  welcomeAudioAt: string | null;
  qualifyAt: string | null;
  firstAt: string | null;
  lastAt: string | null;
  templates: string[];
}

/**
 * Everything one lead's events say, with the bot filter applied.
 * `events` may hold other leads' rows — pass a leadId to narrow it.
 */
export function signalsForLead(leadId: string, events: any[], nowMs: number): LeadSignals {
  const cutoff = nowMs - BOT_FILTER_MS;
  const urls = new Set<string>();
  const linkKeys = new Set<string>();
  const templates = new Set<string>();
  const signals: LeadSignals = {
    leadId: String(leadId),
    opens: 0,
    clicks: 0,
    distinctUrls: 0,
    linkKeys: [],
    welcomeAudioAt: null,
    qualifyAt: null,
    firstAt: null,
    lastAt: null,
    templates: [],
  };

  for (const event of events || []) {
    if (!event || (leadId && String(event.leadId) !== String(leadId))) continue;
    const type = String(event.eventType || '');
    if (type !== 'open' && type !== 'click' && type !== 'qualify_visit') continue;
    const at = event.trackedAt || event.created_date || null;
    const time = at ? new Date(at).getTime() : 0;
    if (time && time > cutoff) continue;

    const url = String(event.url || '');
    if (type === 'open') {
      signals.opens += 1;
    } else if (type === 'qualify_visit') {
      if (!signals.qualifyAt || time > new Date(signals.qualifyAt).getTime()) signals.qualifyAt = at;
    } else {
      signals.clicks += 1;
      if (url) urls.add(url);
      const hit = CREDENTIAL_LINKS.find((link) => url.includes(link.match));
      if (hit) linkKeys.add(hit.key);
      else if (!signals.welcomeAudioAt) signals.welcomeAudioAt = at;
    }

    if (event.templateName) templates.add(String(event.templateName));
    if (at && (!signals.firstAt || time < new Date(signals.firstAt).getTime())) signals.firstAt = at;
    if (at && (!signals.lastAt || time > new Date(signals.lastAt).getTime())) signals.lastAt = at;
  }

  signals.distinctUrls = urls.size;
  signals.linkKeys = [...linkKeys];
  signals.templates = [...templates];
  return signals;
}

export interface EngagementScore {
  score: number;
  tier: 'hot' | 'engaged' | 'warming' | 'cold';
  tierLabel: string;
  action: string;
  reasons: string[];
}

function relative(iso: string | null, nowMs: number): string {
  if (!iso) return 'no activity yet';
  const mins = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * 0-100 engagement score.
 *   opens            8 for the first, 6 for the second, 4 for the third, +2 each after (max 20)
 *   link clicks      10 per distinct link (max 30)
 *   depth            +10 when two or more credential links were opened
 *   welcome message  +12 when the personal welcome link was opened
 *   qualification    +28 when the video qualification page was reached
 *   recency          +12 / +8 / +5 / +2 for activity inside 24h / 3d / 7d / 30d
 */
export function scoreSignals(signals: LeadSignals, nowMs: number): EngagementScore {
  const reasons: string[] = [];
  let score = 0;

  if (signals.opens > 0) {
    const openPoints = Math.min(20, 8 + (signals.opens >= 2 ? 6 : 0) + (signals.opens >= 3 ? 4 : 0) + Math.max(0, signals.opens - 3) * 2);
    score += openPoints;
    reasons.push(signals.opens === 1 ? 'Opened the email' : `Opened the email ${signals.opens}×`);
  }
  if (signals.distinctUrls > 0) {
    score += Math.min(30, signals.distinctUrls * 10);
    reasons.push(`Clicked ${signals.distinctUrls} link${signals.distinctUrls === 1 ? '' : 's'}`);
  }
  if (signals.linkKeys.length >= 2) {
    score += 10;
    const names = CREDENTIAL_LINKS.filter((link) => signals.linkKeys.includes(link.key)).map((link) => link.label);
    reasons.push(`Vetted us on ${names.join(' + ')}`);
  }
  if (signals.welcomeAudioAt) {
    score += 12;
    reasons.push('Opened the welcome message');
  }
  if (signals.qualifyAt) {
    score += 28;
    reasons.push('Reached the qualification page');
  }
  if (signals.lastAt) {
    const hours = (nowMs - new Date(signals.lastAt).getTime()) / HOUR;
    if (hours <= 24) { score += 12; reasons.push(`Active ${relative(signals.lastAt, nowMs)}`); }
    else if (hours <= 72) score += 8;
    else if (hours <= 168) score += 5;
    else if (hours <= 720) score += 2;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = score >= 55 ? 'hot' : score >= 25 ? 'engaged' : score >= 5 ? 'warming' : 'cold';
  const tierLabel = { hot: 'Hot', engaged: 'Engaged', warming: 'Warming', cold: 'Cold' }[tier];

  let action = 'No tracked email engagement yet — send the credentials email';
  if (signals.qualifyAt) action = 'Call now — they reached the qualification page';
  else if (signals.welcomeAudioAt && signals.linkKeys.length >= 2) action = 'Call now — welcome message opened and 2+ credential links clicked';
  else if (signals.linkKeys.length >= 2) action = 'Call now — they vetted us on two or more sites';
  else if (signals.distinctUrls > 0 || signals.opens > 0) action = 'Send the follow-up — they are reading but have not vetted us yet';
  else if (signals.opens > 0) action = 'Send the follow-up — the email was opened';

  return { score, tier, tierLabel, action, reasons: reasons.slice(0, 5) };
}

/** One call: signals plus the score for a lead's events. */
export function engagementForLead(leadId: string, events: any[], nowMs: number) {
  const signals = signalsForLead(leadId, events, nowMs);
  return { signals, ...scoreSignals(signals, nowMs) };
}