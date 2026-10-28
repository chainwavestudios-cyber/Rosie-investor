/**
 * engagement.ts — the engagement model for tracked email activity.
 *
 * TWO systems, TWO scores, never mixed:
 *
 *   • coach   — Debt Call Coach email: credentials & welcome, the DAA cold
 *               introduction, the follow-up introduction, the appointment
 *               reminders, the notice mailer, Steph and the Golden Boy outreach.
 *               These scores sit on Debt Call Coach contact cards, and a Hot Lead
 *               here is the top of the ladder in either system.
 *
 *   • fronter — the fronter prospecting workspace's own tracked outreach. These
 *               scores sit on fronter prospect / lead cards and drive the
 *               prospect → lead promotion and the migrate decision.
 *
 * A fronter score NEVER travels into Debt Call Coach: a lead that migrates starts
 * at MIGRATION_START_SCORE and re-earns its coach score from coach email only.
 *
 * Pure functions only — no SDK, no I/O.
 */

/** A brand-new event is ignored this long: mail preview crawlers open instantly. */
export const BOT_FILTER_MS = 30_000;

/** What every lead starts on in Debt Call Coach the moment it migrates. */
export const MIGRATION_START_SCORE = 20;

export const HOT_SCORE = 70;
export const ENGAGED_SCORE = 45;
export const WARMING_SCORE = MIGRATION_START_SCORE;

/** The credential links in the welcome email, and the one that is not one of them
 *  (any other link is the personal welcome-message link). */
export const CREDENTIAL_LINKS = [
  { key: 'website', match: 'debtadvisorsofamerica.com', label: 'Company website' },
  { key: 'bbb', match: 'bbb.org', label: 'BBB' },
  { key: 'trustpilot', match: 'trustpilot.com', label: 'Trustpilot' },
];

/** A click on our own site counts on its own, whichever email carried it. */
export const COMPANY_URL_MATCH = 'debtadvisorsofamerica.com';

export type SystemKey = 'coach' | 'fronter';

interface Weights {
  open: number;
  repeat: number;
  click: number;
  depth: number;
  welcome: number;
  qualify: number;
  site: number;
}

export interface EmailCategory {
  key: string;
  label: string;
  system: SystemKey;
  weights: Weights;
  match: string[];
}

const W = (open: number, repeat: number, click: number, depth: number, welcome: number, qualify: number, site: number): Weights =>
  ({ open, repeat, click, depth, welcome, qualify, site });

/**
 * The email families and what one lead's behaviour in each is worth.
 *   open     points for the first open
 *   repeat   points for each open after the first
 *   click    points per distinct link clicked
 *   depth    points when two or more vetted links were opened
 *   welcome  points for opening the personal welcome message
 *   qualify  points for reaching the qualification page
 *   site     points for visiting our own site
 *
 * Order matters: the first family whose keyword appears in the email's name wins.
 */
export const CATEGORIES: EmailCategory[] = [
  { key: 'creds_welcome', label: 'Credentials & Welcome Message', system: 'coach', weights: W(14, 8, 12, 12, 18, 30, 12), match: ['cred', 'welcome'] },
  { key: 'cold_intro', label: 'DAA Cold Outreach Introduction', system: 'coach', weights: W(10, 6, 12, 8, 0, 25, 10), match: ['cold', 'introduction 1', 'intro email 1', 'intro 1'] },
  { key: 'followup_intro', label: 'Follow-Up Introduction', system: 'coach', weights: W(9, 5, 12, 8, 0, 25, 10), match: ['follow', 'introduction 2', 'intro 2'] },
  { key: 'reminder_night', label: 'Night-Before Reminder', system: 'coach', weights: W(7, 3, 10, 6, 0, 20, 8), match: ['night'] },
  { key: 'reminder_hour', label: 'Reminder (1-hour / 5-minute)', system: 'coach', weights: W(5, 2, 8, 6, 0, 20, 8), match: ['hour', '5 min', 'reminder'] },
  { key: 'notice', label: 'Notice / Rate-Drop Mailer', system: 'coach', weights: W(9, 5, 12, 10, 0, 24, 12), match: ['notice', 'rate drop', 'mailer'] },
  { key: 'steph', label: 'Steph (video avatar)', system: 'coach', weights: W(10, 5, 14, 10, 0, 28, 12), match: ['steph'] },
  { key: 'golden', label: 'Golden Boy final outreach', system: 'coach', weights: W(12, 6, 16, 12, 0, 28, 12), match: ['golden'] },
];

/** Everything that is not one of the coach families is fronter prospecting outreach. */
export const FRONTER_CATEGORY: EmailCategory = {
  key: 'fronter_outreach', label: 'Fronter cold outreach', system: 'fronter',
  weights: W(8, 4, 12, 8, 0, 20, 10), match: [],
};

const ALL_CATEGORIES = [...CATEGORIES, FRONTER_CATEGORY];

export const categoryByKey = (key: string): EmailCategory =>
  ALL_CATEGORIES.find((category) => category.key === key) || FRONTER_CATEGORY;

// ── The editable rule set ────────────────────────────────────────────────────
// Every number above is a built-in default. The Automations & Scoring screen
// stores its own values in the ScoringConfig record, and the whole model is
// resolved here from that record — an unset (or missing) value keeps its default.

export interface PatternRules {
  /** Opened both the night-before and the reminder email. */
  bothReminders: number;
  /** Follow-up introduction: 2+ links clicked. */
  followUpTwoLinks: number;
  /** Credentials email opened again and again — the hot pattern. */
  credsRepeatPattern: number;
  /** Opens on the credentials email that count as the repeat pattern. */
  credsRepeatOpens: number;
  /** Opens that count when they also visited our own site. */
  credsOpensWithSite: number;
  /** Reaching the qualification page off the credentials email makes them hot. */
  credsQualifyIsHot: boolean;
  /** Golden Boy opened and the avatar watched. */
  goldenAvatar: number;
  /** Fronter: clicked a link in the cold outreach. */
  fronterClick: number;
  /** Fronter: opened the cold outreach more than once. */
  fronterRepeatOpens: number;
}

export interface ScoreRules {
  hotScore: number;
  engagedScore: number;
  warmingScore: number;
  migrationStartScore: number;
  botFilterSeconds: number;
  weights: Record<string, Weights>;
  patterns: PatternRules;
}

const DEFAULT_PATTERNS: PatternRules = {
  bothReminders: 18,
  followUpTwoLinks: 20,
  credsRepeatPattern: 12,
  credsRepeatOpens: 3,
  credsOpensWithSite: 2,
  credsQualifyIsHot: true,
  goldenAvatar: 12,
  fronterClick: 8,
  fronterRepeatOpens: 6,
};

export const DEFAULT_SCORING: ScoreRules = {
  hotScore: HOT_SCORE,
  engagedScore: ENGAGED_SCORE,
  warmingScore: WARMING_SCORE,
  migrationStartScore: MIGRATION_START_SCORE,
  botFilterSeconds: BOT_FILTER_MS / 1000,
  weights: Object.fromEntries(ALL_CATEGORIES.map((category) => [category.key, { ...category.weights }])),
  patterns: DEFAULT_PATTERNS,
};

const num = (value: any, fallback: number) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const flag = (value: any, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

function parseJson(raw: any, fallback: any) {
  try {
    const parsed = JSON.parse(String(raw || ''));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Merge a stored ScoringConfig record (or raw weights/patterns) over the built-in model. */
export function resolveScoring(raw?: any): ScoreRules {
  const record = Array.isArray(raw) ? raw[0] : raw;
  if (!record) return DEFAULT_SCORING;

  const weightsJson = parseJson(record.weightsJson, []);
  const stored: Record<string, any> = Array.isArray(weightsJson)
    ? Object.fromEntries(weightsJson.filter((row: any) => row && row.key).map((row: any) => [String(row.key), row]))
    : weightsJson;
  const patterns = parseJson(record.patternsJson, {});

  const weights: Record<string, Weights> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_SCORING.weights)) {
    const given = stored[key] || {};
    weights[key] = {
      open: num(given.open, fallback.open),
      repeat: num(given.repeat, fallback.repeat),
      click: num(given.click, fallback.click),
      depth: num(given.depth, fallback.depth),
      welcome: num(given.welcome, fallback.welcome),
      qualify: num(given.qualify, fallback.qualify),
      site: num(given.site, fallback.site),
    };
  }

  return {
    hotScore: num(record.hotScore, HOT_SCORE),
    engagedScore: num(record.engagedScore, ENGAGED_SCORE),
    warmingScore: num(record.warmingScore, WARMING_SCORE),
    migrationStartScore: num(record.migrationStartScore, MIGRATION_START_SCORE),
    botFilterSeconds: Math.max(0, num(record.botFilterSeconds, BOT_FILTER_MS / 1000)),
    weights,
    patterns: {
      bothReminders: num(patterns.bothReminders, DEFAULT_PATTERNS.bothReminders),
      followUpTwoLinks: num(patterns.followUpTwoLinks, DEFAULT_PATTERNS.followUpTwoLinks),
      credsRepeatPattern: num(patterns.credsRepeatPattern, DEFAULT_PATTERNS.credsRepeatPattern),
      credsRepeatOpens: num(patterns.credsRepeatOpens, DEFAULT_PATTERNS.credsRepeatOpens),
      credsOpensWithSite: num(patterns.credsOpensWithSite, DEFAULT_PATTERNS.credsOpensWithSite),
      credsQualifyIsHot: flag(patterns.credsQualifyIsHot, DEFAULT_PATTERNS.credsQualifyIsHot),
      goldenAvatar: num(patterns.goldenAvatar, DEFAULT_PATTERNS.goldenAvatar),
      fronterClick: num(patterns.fronterClick, DEFAULT_PATTERNS.fronterClick),
      fronterRepeatOpens: num(patterns.fronterRepeatOpens, DEFAULT_PATTERNS.fronterRepeatOpens),
    },
  };
}

/** Which family an email belongs to, from its name (or its subject as a fallback). */
export function categoryFor(templateName?: string, fallbackName?: string): EmailCategory {
  const hay = `${templateName || ''} ${fallbackName || ''}`.toLowerCase();
  return CATEGORIES.find((category) => category.match.some((needle) => hay.includes(needle))) || FRONTER_CATEGORY;
}

export interface CategoryActivity {
  key: string;
  label: string;
  system: SystemKey;
  opens: number;
  clicks: number;
  urls: string[];
  qualify: boolean;
  siteVisit: boolean;
  lastAt: string | null;
}

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
  categories: CategoryActivity[];
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
  const byCategory = new Map<string, CategoryActivity>();

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
    categories: [],
  };

  for (const event of events || []) {
    if (!event || (leadId && String(event.leadId) !== String(leadId))) continue;
    const type = String(event.eventType || '');
    if (type !== 'open' && type !== 'click' && type !== 'qualify_visit') continue;
    const at = event.trackedAt || event.created_date || null;
    const time = at ? new Date(at).getTime() : 0;
    if (time && time > cutoff) continue;

    const spec = categoryFor(event.templateName, event.subject);
    if (!byCategory.has(spec.key)) {
      byCategory.set(spec.key, { key: spec.key, label: spec.label, system: spec.system, opens: 0, clicks: 0, urls: [], qualify: false, siteVisit: false, lastAt: null });
    }
    const activity = byCategory.get(spec.key)!;
    if (at && (!activity.lastAt || time > new Date(activity.lastAt).getTime())) activity.lastAt = at;

    const url = String(event.url || '');
    if (type === 'open') {
      signals.opens += 1;
      activity.opens += 1;
    } else if (type === 'qualify_visit') {
      activity.qualify = true;
      if (!signals.qualifyAt || time > new Date(signals.qualifyAt).getTime()) signals.qualifyAt = at;
    } else {
      signals.clicks += 1;
      activity.clicks += 1;
      if (url) {
        urls.add(url);
        activity.urls.push(url);
        if (url.includes(COMPANY_URL_MATCH)) activity.siteVisit = true;
      }
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
  signals.categories = [...byCategory.values()];
  return signals;
}

export interface SystemScore {
  system: SystemKey;
  score: number;
  tier: 'hot' | 'engaged' | 'warming' | 'cold';
  tierLabel: string;
  hotLead: boolean;
  action: string;
  reasons: string[];
  lastAt: string | null;
}

function relative(iso: string | null, nowMs: number): string {
  if (!iso) return 'no activity yet';
  const mins = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const cap = (value: number, max: number) => Math.min(max, value);

/**
 * One system's 0-100 score for a lead, plus why and what to do next.
 * Coach scores start on MIGRATION_START_SCORE — the fronter score never carries over.
 */
export function scoreSignals(signals: LeadSignals, system: SystemKey, nowMs: number, rules: ScoreRules = DEFAULT_SCORING): SystemScore {
  const reasons: string[] = [];
  let score = 0;
  let forcedHot = false;

  const inSystem = signals.categories.filter((activity) => activity.system === system);
  const byKey = new Map(inSystem.map((activity) => [activity.key, activity]));

  for (const activity of inSystem) {
    const weights = categoryByKey(activity.key).weights;
    if (activity.opens > 0) {
      score += weights.open + cap(activity.opens - 1, 3) * weights.repeat;
      reasons.push(`${activity.label} opened${activity.opens > 1 ? ` ${activity.opens}×` : ''}`);
    }
    if (activity.clicks > 0) {
      score += cap(activity.clicks, 3) * weights.click;
      const hosts = [...new Set(activity.urls.map((url) => hostOf(url)).filter(Boolean))];
      reasons.push(`${activity.label}: clicked ${hosts.slice(0, 2).join(', ') || `${activity.clicks} link`}`);
    }
    if (signals.linkKeys.length >= 2) { score += weights.depth; }
    if (signals.welcomeAudioAt) { score += weights.welcome; }
    if (activity.qualify) score += weights.qualify;
    if (activity.siteVisit) score += weights.site;
  }

  if (signals.welcomeAudioAt) reasons.push('Opened the personal welcome message');
  if (signals.linkKeys.length >= 2) {
    const names = CREDENTIAL_LINKS.filter((link) => signals.linkKeys.includes(link.key)).map((link) => link.label);
    reasons.push(`Vetted us on ${names.join(' + ')}`);
  }
  if (signals.qualifyAt) reasons.push('Reached the qualification page');

  // ── Patterns: the combinations that mean more than the sum of their opens ──
  const night = byKey.get('reminder_night');
  const hour = byKey.get('reminder_hour');
  if (night?.opens && hour?.opens) {
    score += 18;
    reasons.push('Opened both the night-before and the reminder email');
  }
  const followUp = byKey.get('followup_intro');
  if (followUp && (followUp.clicks >= 2 || followUp.clicks + followUp.opens >= 3)) {
    score += 20;
    reasons.push('Follow-up introduction: 2+ links — Introduction 2 is due');
  }
  const creds = byKey.get('creds_welcome');
  if (creds) {
    // Repeat opens, and coming back the next morning, are the pattern that makes a hot lead.
    const repeatPattern = creds.opens >= 3 || (creds.opens >= 2 && creds.siteVisit);
    if (repeatPattern || (creds.opens >= 1 && creds.qualify)) forcedHot = true;
    if (repeatPattern) {
      score += 12;
      reasons.push(`Credentials email opened ${creds.opens}× — hot pattern`);
    }
  }
  const golden = byKey.get('golden');
  if (golden && golden.qualify) { score += 12; reasons.push('Golden Boy opened and watched the avatar — Golden A Buy'); }

  if (system === 'fronter') {
    if (signals.clicks > 0) { score += 8; reasons.push('Engaged with the cold outreach'); }
    else if (signals.opens >= 2) { score += 6; reasons.push('Opened the cold outreach more than once'); }
  }

  const floor = system === 'coach' ? MIGRATION_START_SCORE : 0;
  score = Math.max(floor, Math.min(100, Math.round(score)));

  // The pattern rule outranks the number: a lead the credential/welcome behaviour
  // has tagged hot reads hot on the badge, the banner and the leaderboard alike.
  const hotLead = score >= HOT_SCORE || forcedHot;
  const tier = hotLead ? 'hot' : score >= ENGAGED_SCORE ? 'engaged' : score >= WARMING_SCORE ? 'warming' : 'cold';
  const tierLabel = { hot: 'Hot', engaged: 'Engaged', warming: 'Warming', cold: 'Cold' }[tier];

  if (signals.lastAt) {
    const hours = (nowMs - new Date(signals.lastAt).getTime()) / 3_600_000;
    if (hours <= 24) reasons.push(`Active ${relative(signals.lastAt, nowMs)}`);
  }

  return { system, score, tier, tierLabel, hotLead, action: actionFor(signals, system, hotLead), reasons: reasons.slice(0, 6), lastAt: signals.lastAt };
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function actionFor(signals: LeadSignals, system: SystemKey, hotLead: boolean): string {
  const byKey = new Map(signals.categories.map((activity) => [activity.key, activity]));
  if (system === 'fronter') {
    if (signals.qualifyAt) return 'Call now — they reached the qualification page';
    if (hotLead || signals.clicks > 0) return 'Call now — working the cold outreach, promote to a lead card';
    if (signals.opens >= 2) return 'Call now — repeat opens on the cold outreach';
    if (signals.opens > 0) return 'Follow up — the prospect opened the email';
    return 'No fronter email activity yet — send the cold outreach';
  }
  if (signals.qualifyAt) return 'Call now — HOT LEAD: they reached the qualification page';
  if (byKey.get('reminder_night')?.opens && byKey.get('reminder_hour')?.opens) return 'Call now — they opened both reminders for the appointment';
  if ((byKey.get('followup_intro')?.clicks || 0) >= 2) return 'Send Introduction 2 — they clicked 2+ links';
  if (hotLead) return 'Call now — HOT LEAD: repeat behaviour on the credentials email';
  if (signals.welcomeAudioAt) return 'Call now — they listened to the welcome message';
  if (signals.clicks > 0) return 'Call now — they are clicking through the email';
  if (signals.opens > 0) return 'Send the follow-up — reading but not clicking yet';
  return 'No coach email activity yet — start with the credentials email';
}

/** One call: a lead's signals plus its score in one system. */
export function scoreForSystem(leadId: string, events: any[], system: SystemKey, nowMs: number) {
  const signals = signalsForLead(leadId, events, nowMs);
  return { signals, ...scoreSignals(signals, system, nowMs) };
}

/** Both systems at once — a lead can only score in the one it lives in. */
export function engagementForLead(leadId: string, events: any[], nowMs: number) {
  const signals = signalsForLead(leadId, events, nowMs);
  return { signals, coach: scoreSignals(signals, 'coach', nowMs), fronter: scoreSignals(signals, 'fronter', nowMs) };
}