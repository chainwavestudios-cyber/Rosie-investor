/**
 * transcriptTurn.js — sentence assembly for the live transcript and live Q&A.
 *
 * Deepgram commits a spoken turn as several fragments: once per final chunk and
 * again after every short pause. Used raw, those fragments reach the transcript,
 * the live Q&A and the post-call reports as half sentences.
 *
 * These helpers decide when two same-speaker fragments are really one sentence,
 * join them without repeating the words Deepgram re-emits at the seam, and
 * rebuild the whole trailing turn so Q&A is asked a complete sentence.
 */

const TERMINAL = /[.?!…]["')\]]?$/;

// A fragment that opens with one of these is the middle of the previous
// sentence, not the start of a new one.
const CONTINUATIONS = new Set([
  'and', 'but', 'so', 'because', 'or', 'if', 'then', 'that', 'which', 'when', 'while', 'with',
  'to', 'for', 'of', 'in', 'on', 'at', 'as', 'than', 'though', 'although', 'unless', 'until',
  'since', 'my', 'your', 'his', 'her', 'their', 'our', 'its', 'this', 'these', 'those', 'the',
  'a', 'an', 'i', 'we', 'they', 'he', 'she', 'you', 'it', 'is', 'are', 'was', 'were', 'do',
  'does', 'did', 'can', 'could', 'would', 'should', 'will', 'just', 'really', 'actually',
  'maybe', 'also', 'even', 'not', 'no', 'yeah', 'well', 'like', 'about', 'from', 'have', 'has',
]);

const norm = (w) => String(w || '').toLowerCase().replace(/[^a-z0-9']/g, '');
const squeeze = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export function isTerminalSentence(text) {
  return TERMINAL.test(squeeze(text));
}

/**
 * Is `nextText` a continuation of `prevText` for the same speaker?
 * True when the previous line was mid-sentence, when the two arrived in one
 * rapid burst, or when the new fragment starts mid-sentence (lowercase, or on a
 * word that never opens a sentence).
 */
export function isSameSentence(prevText, nextText, gapMs) {
  const a = squeeze(prevText);
  const b = squeeze(nextText);
  if (!a || !b) return false;
  if (!isTerminalSentence(a)) return true;
  if (gapMs != null && gapMs < 3000) return true;
  if (/[,;:—–-]$/.test(a)) return true;
  if (/^[a-z]/.test(b)) return true;
  return CONTINUATIONS.has(norm(b.split(/\s+/)[0]));
}

/**
 * Join two fragments of the same speaker, dropping the overlap Deepgram repeats
 * at the seam ("...in two weeks" + "two weeks I can pay" → "...in two weeks I can pay").
 */
export function mergeFragments(prevText, nextText) {
  const a = squeeze(prevText);
  const b = squeeze(nextText);
  if (!a) return b;
  if (!b) return a;
  const aw = a.split(/\s+/);
  const bw = b.split(/\s+/);
  const maxOverlap = Math.min(8, aw.length, bw.length);
  let overlap = 0;
  for (let n = maxOverlap; n >= 1; n--) {
    let same = true;
    for (let i = 0; i < n; i++) {
      if (norm(aw[aw.length - n + i]) !== norm(bw[i])) { same = false; break; }
    }
    if (same) { overlap = n; break; }
  }
  return squeeze([...aw, ...bw.slice(overlap)].join(' '));
}

/**
 * The whole trailing turn for one side of the call: every consecutive committed
 * line by that side at the end of the transcript, joined into full sentences.
 * Q&A asks THIS, so a question is never half a sentence.
 *
 * mode 'customer' also accepts the transfer agent's lines (speaker 2), which
 * arrive on the caller's channel before the customer takes over.
 * Long turns keep their most recent `maxChars` characters.
 */
export function trailingTurn(transcript, mode = 'customer', maxChars = 1200) {
  const lines = (transcript || []).filter(l => !l.interim && l.text && String(l.text).trim());
  const isMine = mode === 'agent' ? (speaker) => speaker === 0 : (speaker) => speaker !== 0;
  const parts = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!isMine(lines[i].speaker)) break;
    parts.unshift(String(lines[i].text).trim());
  }
  const joined = squeeze(parts.join(' '));
  if (joined.length <= maxChars) return joined;
  const tail = joined.slice(-maxChars);
  return `… ${tail.slice(Math.max(0, tail.indexOf(' ') + 1))}`;
}