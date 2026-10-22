/**
 * protofaceId.ts — Per-lead Protoface IDs.
 *
 * Every distributed lead is tagged with its own Protoface ID: "pf_" plus ten
 * characters. The ID is stamped on the contact card and on the vault record the
 * lead came from, and it is the token a per-lead video qualification link
 * carries, so the video widget opens already knowing which lead is on the page.
 */

const PREFIX = 'pf_';
/** No look-alikes (no I, O, 0 or 1) so an ID can be read out loud or typed. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BODY_LENGTH = 10;

export const PROTOFACE_ID_RE = /^pf_[A-Z0-9]{10}$/;

export function formatProtofaceId(): string {
  const bytes = new Uint8Array(BODY_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < BODY_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${PREFIX}${out}`;
}

/** One unique Protoface ID per lead, in order. */
export function assignProtofaceIds(count = 1): string[] {
  const total = Math.max(1, Math.floor(Number(count) || 1));
  const ids = new Set<string>();
  while (ids.size < total) ids.add(formatProtofaceId());
  return [...ids];
}