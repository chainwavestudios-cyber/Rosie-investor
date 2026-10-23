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
export function scoreTooltip(entry) {
  if (!entry) return 'Engagement score — no tracked email activity yet';
  const style = tierStyle(entry.tier);
  const lines = [`Engagement ${entry.score}/100 · ${style.label}`];
  (entry.reasons || []).forEach((reason) => lines.push(`• ${reason}`));
  if (entry.action) lines.push(entry.action);
  return lines.join('\n');
}