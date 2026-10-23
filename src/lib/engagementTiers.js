/** The look and words of each engagement system, shared by the page and the badge. */
export const SYSTEM_META = {
  coach: {
    key: 'coach',
    label: 'Debt Call Coach',
    short: 'Coach',
    icon: '💳',
    tone: 'coach',
    note: 'Credentials & welcome, DAA cold introduction, follow-up introduction, night-before and reminder emails, notice mailer, Steph and Golden Boy. Only SMTPfast-tracked activity counts, and these scores sit on Debt Call Coach contact cards.',
  },
  fronter: {
    key: 'fronter',
    label: 'Fronter',
    short: 'Fronter',
    icon: '📞',
    tone: 'fronter',
    note: 'The fronter prospecting workspace’s own tracked outreach (never Google-sent mail). Scores here drive prospect → lead promotion and the migrate decision — they do not travel into Debt Call Coach.',
  },
};

/** What a lead starts on in Debt Call Coach the moment it migrates. */
export const MIGRATION_START_SCORE = 20;

/** The credential links in the welcome email, so a feed row can name what was clicked. */
export const CREDENTIAL_LINKS = [
  { key: 'website', match: 'debtadvisorsofamerica.com', label: 'Company website' },
  { key: 'bbb', match: 'bbb.org', label: 'BBB' },
  { key: 'trustpilot', match: 'trustpilot.com', label: 'Trustpilot' },
];

/** Tier look for an engagement score, shared by the contact-card badge and the leaderboard. */
export const TIER_STYLE = {
  hot: { label: 'Hot', icon: '🔥', color: '#ef4444' },
  engaged: { label: 'Engaged', icon: '⚡', color: '#f59e0b' },
  warming: { label: 'Warming', icon: '🌤', color: '#60a5fa' },
  cold: { label: 'Cold', icon: '❄️', color: '#4a5568' },
};

export const tierStyle = (tier) => TIER_STYLE[tier] || TIER_STYLE.cold;

/** The hover text for a scored lead: the number, the band and what produced it. */
export function scoreTooltip(entry, system = 'fronter') {
  const meta = SYSTEM_META[system] || SYSTEM_META.fronter;
  if (!entry) return `${meta.label} engagement — no tracked email activity yet`;
  const style = tierStyle(entry.tier);
  const lines = [`${meta.label} engagement ${entry.score}/100 · ${style.label}`];
  if (entry.hotLead) lines.unshift('🔥 HOT LEAD');
  (entry.reasons || []).forEach((reason) => lines.push(`• ${reason}`));
  if (entry.action) lines.push(entry.action);
  return lines.join('\n');
}