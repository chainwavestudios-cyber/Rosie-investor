/**
 * aceConsole.js — opens the ⌘A AI console from anywhere, optionally scoped to
 * the contact card the user launched it from.
 */
export const ACE_OPEN_EVENT = 'ace:open';

export function openAceConsole(focus = null) {
  window.dispatchEvent(new CustomEvent(ACE_OPEN_EVENT, { detail: focus }));
}

export function contactFocus({ id, firstName, lastName, kind = 'debt' }) {
  const leadName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return { leadId: kind === 'debt' ? id || null : null, leadName, kind };
}