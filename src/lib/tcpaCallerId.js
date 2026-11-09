/**
 * tcpaCallerId.js — picks the line a lead may be dialed from.
 *
 * Consent is tied to the number a lead registered under, so when the card
 * carries one, that number is the only line it may go out on. It is matched
 * against the live Twilio inventory: a number that is no longer in the
 * account stops the call rather than quietly falling back to the agent's
 * own line, which would break the consent record.
 */

const digits = (value) => String(value || '').replace(/[^\d+]/g, '');

export function resolveCallerLine(lead, liveLines, fallbackLine) {
  const consented = digits(lead?.tcpaCallerId);
  if (!consented) return { line: fallbackLine, error: '' };
  const match = (liveLines || []).find((l) => digits(l.number) === consented);
  if (!match) {
    return {
      line: null,
      error: `This lead consented to be called from ${lead.tcpaCallerId}, which is not a live voice number in the Twilio account. Not dialing.`,
    };
  }
  return { line: match, error: '' };
}