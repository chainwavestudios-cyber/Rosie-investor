/** Deterministic Rosie corporate founder override. Never route ordinary callers by name alone. */
export function isRosieFounderReferral(utterance) {
  const normalized = String(utterance || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  // Deepgram may transcribe 5526 as digits, separate digits, or spoken words.
  // Require the full override phrase AND its code within the same utterance.
  return /\bsystem override i know the founder and (?:ceo|c e o) chris (?:5526|5 5 2 6|five five two six|five five twenty six|fifty five twenty six)\b/.test(normalized);
}
