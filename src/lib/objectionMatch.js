/**
 * objectionMatch.js — word-level matching for the live objections engine.
 *
 * Objection triggers are written as full sentences ("I am not interested, thank
 * you.") while a caller says "not really interested" — and the live transcript
 * arrives in fragments. Comparing the whole phrase as a substring therefore
 * almost never fires. Instead a phrase is matched on its significant words: any
 * two of them appearing close together, in order, in what the caller just said.
 */

// Function words and filler that carry no objection signal on their own.
const STOP = new Set([
  'the', 'and', 'for', 'you', 'your', 'yours', 'that', 'this', 'these', 'those', 'with', 'have',
  'has', 'had', 'are', 'was', 'were', 'will', 'would', 'could', 'should', 'can', 'but', 'from',
  'what', 'when', 'why', 'how', 'who', 'whom', 'does', 'did', 'doing', 'done', 'about', 'into',
  'over', 'under', 'than', 'then', 'them', 'they', 'their', 'she', 'her', 'his', 'him', 'its',
  'our', 'ours', 'out', 'off', 'just', 'very', 'really', 'much', 'many', 'more', 'most', 'some',
  'any', 'all', 'also', 'too', 'only', 'been', 'being', 'get', 'got', 'getting', 'let', 'lets',
  'make', 'makes', 'made', 'say', 'says', 'said', 'want', 'wants', 'wanted', 'need', 'needs',
  'needed', 'know', 'knows', 'knew', 'think', 'thinks', 'thought', 'like', 'likes', 'liked',
  'going', 'gonna', 'come', 'comes', 'came', 'take', 'takes', 'took', 'give', 'gives', 'gave',
  'people', 'person', 'thing', 'things', 'way', 'ways', 'time', 'times', 'here', 'there',
  'where', 'because', 'before', 'after', 'again', 'still', 'even', 'ever', 'always', 'now',
  'day', 'days', 'please', 'thank', 'thanks', 'hello', 'okay', 'well', 'yes', 'yeah', 'right',
  'sure', 'one', 'two', 'lot', 'look', 'looking', 'mean', 'means', 'call', 'calls', 'called',
]);

// Words that say agreement or courtesy, not an objection — they may sit in a
// trigger phrase but they can never be the word that fires it.
const WEAK = new Set([
  'good', 'great', 'fine', 'nice', 'sound', 'sounds', 'okay', 'right', 'sure', 'thanks',
  'much', 'many', 'very', 'really', 'just', 'actually', 'maybe', 'probably', 'guess',
  'suppose', 'understand', 'mean', 'think', 'thought', 'know', 'knew', 'want', 'need',
  'going', 'gonna', 'coming', 'talking', 'talked', 'told', 'call', 'called', 'hear',
]);

export const isStrongWord = (w) => String(w || '').length >= 5 && !WEAK.has(String(w).toLowerCase());

export function significantWords(text) {
  return String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^a-z0-9$%]/g, ''))
    .filter(w => w.length >= 3 && !STOP.has(w));
}

/**
 * Match a trigger phrase against what the caller said.
 * Returns null when nothing of the phrase is present, otherwise
 * { words, matched, needed, pair, score } where `pair` is the two phrase words
 * that appeared close together, in order, in the caller's words.
 */
export function matchPhrase(text, phrase) {
  const hay = significantWords(text);
  const need = significantWords(phrase);
  if (hay.length === 0 || need.length === 0) return null;
  const words = need.filter(w => hay.includes(w));
  if (words.length === 0) return null;

  const MAX_GAP = 6;
  let pair = null;
  for (let i = 0; i < need.length && !pair; i++) {
    for (let j = i + 1; j < need.length && !pair; j++) {
      const a = need[i];
      const b = need[j];
      for (let k = 0; k < hay.length; k++) {
        if (hay[k] !== a) continue;
        const limit = Math.min(hay.length - 1, k + MAX_GAP + (j - i));
        for (let m = k + 1; m <= limit; m++) {
          if (hay[m] === b) { pair = `${a} ${b}`; break; }
        }
        if (pair) break;
      }
    }
  }
  return { words, matched: words.length, needed: need.length, pair, score: words.length / need.length };
}

export function parsePhrases(json) {
  try {
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr.map(p => String(p || '')).filter(Boolean) : [];
  } catch {
    return [];
  }
}