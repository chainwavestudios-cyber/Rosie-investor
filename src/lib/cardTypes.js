/**
 * cardTypes.js — the contact card types used across Debt Call Coach.
 *
 *   campaign — created by a mail import. It exists so the row can be emailed;
 *              it is NOT a prospect until an agent tags it after speaking.
 *   prospect — a card an agent is working.
 *   hot      — a prospect the coach flagged for priority follow-up (its own
 *              tag, shown on top of the card's pipeline type).
 */
export const CAMPAIGN_NOTE_PREFIX = 'Added by the Email Campaign Manager';

export const CARD_TYPES = {
  campaign: { label: 'Campaign', emoji: '📧', color: '#60a5fa' },
  prospect: { label: 'Prospect', emoji: '👤', color: '#10b981' },
  hot: { label: 'Hot Lead', emoji: '🔥', color: '#ef4444' },
};

// Older campaign cards carry the import note but no cardType field.
export function isCampaignCard(lead) {
  return lead?.cardType === 'campaign' || String(lead?.notes || '').startsWith(CAMPAIGN_NOTE_PREFIX);
}

// Pipeline type of a card: campaign until an agent promotes it, otherwise prospect.
export function cardTypeOf(lead) {
  if (lead?.isHotLead) return 'hot';
  if (lead?.isProspect) return 'prospect';
  return isCampaignCard(lead) ? 'campaign' : 'prospect';
}