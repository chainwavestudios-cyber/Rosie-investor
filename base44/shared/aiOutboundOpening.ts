/**
 * Alex outbound greeting continuity. Reads ONLY the currently saved Step 1
 * script. No hard-coded sales copy or alternative greeting.
 *
 * Handles two deterministic beats:
 *  1) Caller confirms identity -> exact saved opener question.
 *  2) Caller says now is a good time -> exact saved continuation, including
 *     its next question in the SAME spoken turn, without a generic word cap.
 *
 * Other responses fall through to the existing live script/LLM.
 */
const spoken = (m) => String(m?.content || '').trim();
const isCustomer = (m) => String(m?.role || '').toLowerCase() === 'user';
const norm = (value) => String(value || '').toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function splitSavedAlexOpener(savedPrompt) {
  const prompt = String(savedPrompt || '');
  const start = prompt.indexOf('STEP 1 — OPENER');
  if (start === -1) return null;
  const end = prompt.indexOf('QUICK PIVOTS', start + 1);
  if (end === -1) return null;
  const block = prompt.slice(start, end);
  const prefix = '- Say: "';
  const begin = block.indexOf(prefix);
  if (begin === -1) return null;
  const close = block.lastIndexOf('"');
  if (close < begin + prefix.length) return null;
  const line = block.slice(begin + prefix.length, close);
  const pause = line.indexOf('(WAIT FOR A RESPONSE)');
  if (pause === -1) return null;
  const first = line.slice(0, pause).trim();
  const after = line.slice(pause + '(WAIT FOR A RESPONSE)'.length).trim();
  if (!first.endsWith('?') || !after || !after.includes('?')) return null;
  return {first, after};
}

export function nextSavedAlexOpening({conversation=[], savedPrompt='', initialGreeting=''}={}) {
  const messages = Array.isArray(conversation)?conversation.filter(x=>spoken(x)):[];
  if (messages.length < 2 || !isCustomer(messages.at(-1))) return null;
  const lastAgent = [...messages.slice(0,-1)].reverse().find(x=>!isCustomer(x));
  if (!lastAgent) return null;
  const parts = splitSavedAlexOpener(savedPrompt);
  if (!parts) return null;
  const last = norm(spoken(lastAgent));
  const answer = norm(spoken(messages.at(-1)));
  const initial = norm(initialGreeting);
  // An opening "No, this isn't her" must never start the prospect pitch.
  const confirmed = /^(yes|yeah|yep|speaking|this is|that s me|i am|you re speaking to|correct|right|sure|hi yes)\b/.test(answer);
  if (initial && last === initial && confirmed) return parts.first;

  // Honor the original permission question; the customer must first answer.
  // Ambiguous or explicitly busy replies remain with the saved live dialogue.
  if (last === norm(parts.first)) {
    const busy = /\b(busy|can t talk|cannot talk|call back|call me later|bad time|working right now|not a good time|on another call)\b/.test(answer)
      && !/\b(not busy|not a bad time|not working)\b/.test(answer);
    const available = /^(no\b|nope\b|nah\b|go ahead\b|sure\b|yes you can\b|yeah you can\b|i m good\b|i am good\b|it s fine\b|i m fine\b|i am fine\b|now is fine\b|not busy\b|okay\b|ok\b|you haven t\b|you didn t\b)/.test(answer);
    if (available && !busy) return parts.after;
  }
  return null;
}
