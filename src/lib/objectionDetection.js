/**
 * Pure live objection detection helpers.
 * Only look at the customer's current conversational turn, not unrelated older
 * customer lines from across a call. No model request is needed in the hot path.
 */
import { isStrongWord, matchPhrase, parsePhrases } from './objectionMatch';

const ALIASES = [
  [/scam|trust|fraud|legit|too good to be true/i, 'trust'],
  [/credit|score|soft pull|hard pull/i, 'credit'],
  [/not interested|i.m good|all set/i, 'interest'],
  [/snowball/i, 'snowball'],
  [/heloc|home equity/i, 'heloc'],
  [/loan/i, 'loan'],
];
export function objectionFamily(objection) {
  const name = String(objection?.title || '').trim();
  return ALIASES.find(([pattern]) => pattern.test(name))?.[1] || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
function isCustomerSpeaker(value) {
  return value === 1 || value === '1' || value === 'customer' || value === 'bob';
}
function isCommitted(line) {
  return !!line && !line.interim && String(line.text || '').trim().length > 0;
}
export function recentCustomerTurn(transcript, maxGapMs = 8000) {
  if (!Array.isArray(transcript)) return null;
  const committed = transcript.filter(isCommitted);
  const latest = committed[committed.length - 1];
  if (!latest || !isCustomerSpeaker(latest.speaker)) return null;
  const result = [latest];
  let newest = Date.parse(latest.time || '') || 0;
  for (let i = committed.length - 2; i >= 0 && result.length < 3; i--) {
    const line = committed[i];
    if (!isCustomerSpeaker(line.speaker)) break;
    const ts = Date.parse(line.time || '') || 0;
    if (ts && newest && newest - ts > maxGapMs) break;
    result.unshift(line);
    newest = ts || newest;
  }
  return { latest, text: result.map(line => line.text).join(' '), lines: result };
}
function normalize(text) {
  return String(text || '').toLowerCase()
    .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function phraseConfidence(text, phrase) {
  const m = matchPhrase(text, phrase);
  if (!m) return null;
  const utterance = normalize(text);
  const trigger = normalize(phrase);
  const exact = trigger.length >= 8 && ((' ' + utterance + ' ').includes(' ' + trigger + ' '));
  if (exact) return { ...m, score: 1, exact: true };
  // Distinctive negative phrases are useful in short utterances; weak isolated
  // words like "good" cannot trigger an objection on their own.
  const short = trigger.split(' ').length <= 3 && /\b(not interested|im good|no thanks|dont trust|too expensive)\b/.test(trigger);
  if (short && (' ' + utterance + ' ').includes(' ' + trigger + ' ')) {
    return { ...m, score: 1, exact: true };
  }
  // Fuzzy matching needs two significant words IN ORDER and enough overlap.
  // Two incidental words in a 20-word training phrase must not fire a popup.
  if (!m.pair || m.needed < 2 || m.score < 0.43) return null;
  if (!String(m.pair).split(' ').some(isStrongWord)) return null;
  return { ...m, exact: false };
}
export function findObjectionMatches(text, objections, firedAt = {}, now = Date.now(), cooldownMs = 90000) {
  const matched = [];
  for (const objection of objections || []) {
    if (objection.enabled === false) continue;
    const family = objectionFamily(objection);
    if (now - (firedAt[family] || 0) < cooldownMs) continue;
    let best = null;
    for (const phrase of parsePhrases(objection.triggerPhrases)) {
      const m = phraseConfidence(text, phrase);
      if (m && (!best || m.score > best.score)) best = { ...m, phrase };
    }
    if (best) matched.push({ objection, family, ...best });
  }
  const priority = { high: 0, medium: 1, low: 2 };
  matched.sort((a,b) =>
    (priority[a.objection.priority] ?? 1) - (priority[b.objection.priority] ?? 1) ||
    b.score - a.score ||
    (Number(a.objection.sortOrder) || 0) - (Number(b.objection.sortOrder) || 0));
  return matched;
}
