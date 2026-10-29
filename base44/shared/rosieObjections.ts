/**
 * rosieObjections.ts — Rosie's objection-handling skill.
 *
 * On the video call the prospect pushes back ("I'm not interested", "I can't afford
 * it", "I need to think about it") and she used to push straight on to the phone
 * number. This gives her the app's own Objections library — the same one the live
 * dialer engine fires from — and a way to answer it in her own voice, then come back
 * to the scripted path.
 *
 * Matching is word-level rather than substring, because a trigger written as
 * "I am not interested, thank you." almost never appears verbatim in speech while its
 * significant words do. (The browser copy of this matcher lives in
 * src/lib/objectionMatch.js; backend functions cannot import frontend code.)
 */

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

const WEAK = new Set([
  'good', 'great', 'fine', 'nice', 'sound', 'sounds', 'okay', 'right', 'sure', 'thanks',
  'much', 'many', 'very', 'really', 'just', 'actually', 'maybe', 'probably', 'guess',
  'suppose', 'understand', 'mean', 'think', 'thought', 'know', 'knew', 'want', 'need',
  'going', 'gonna', 'coming', 'talking', 'talked', 'told', 'call', 'called', 'hear',
]);

const MAX_GAP = 6;

export function significantWords(text: any): string[] {
  return String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9$%]/g, ''))
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

export function parsePhrases(json: any): string[] {
  try {
    const parsed = JSON.parse(String(json || '[]'));
    return Array.isArray(parsed) ? parsed.map((p: any) => String(p || '')).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** The two significant words of a phrase that appear, in order, in what was said. */
export function matchPhrase(text: any, phrase: any): { matched: number; needed: number; pair: string } | null {
  const hay = significantWords(text);
  const need = significantWords(phrase);
  if (!hay.length || !need.length) return null;
  const words = need.filter((w) => hay.includes(w));
  if (!words.length) return null;

  // A one-word trigger only fires on a word that carries weight on its own.
  const strong = words.some((w) => w.length >= 5 && !WEAK.has(w));
  if (need.length === 1 && !strong) return null;

  let pair = '';
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
  return { matched: words.length, needed: need.length, pair };
}

/** Every enabled objection in the library, ready to match against a spoken line. */
export async function loadObjections(service: any): Promise<any[]> {
  const rows = await service.entities.Objection.list('-created_date', 300).catch(() => []);
  return (rows || [])
    .filter((row: any) => row && row.responseText && row.enabled !== false)
    .sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * The objections that fit what the prospect just said, most fitting first. Several
 * can fire — "I can't afford it, I'm not interested" is two — and she answers one
 * at a time.
 */
export function matchObjections(text: any, objections: any[], limit = 3): any[] {
  const scored = (objections || [])
    .map((objection: any) => {
      const phrases = parsePhrases(objection.triggerPhrases);
      let best = 0;
      for (const phrase of phrases) {
        const hit = matchPhrase(text, phrase);
        if (hit && hit.matched > best) best = hit.matched;
      }
      return { objection, matched: best };
    })
    .filter((row) => row.matched >= 2)
    .sort((a, b) => b.matched - a.matched
      || (PRIORITY_RANK[String(b.objection.priority || 'medium')] || 2) - (PRIORITY_RANK[String(a.objection.priority || 'medium')] || 2));
  return scored.slice(0, limit).map((row) => row.objection);
}

/** The rules she follows whenever someone pushes back, on any engine. */
export const OBJECTION_RULES = `OBJECTION HANDLING (a skill you have)
- When the prospect pushes back, do not move to the next step of the script and do not ask for their number again. Answer the objection first.
- Name the feeling in one short breath ("That's a fair worry."), then reply with the substance from the objection list below, then ask one small question that moves forward.
- Use their own words and the list's meaning, never its exact wording. One or two sentences, same as always.
- Never argue, never correct them, never stack two answers into one reply. One objection at a time.
- If they raise the same objection twice, stop pitching: offer to have a specialist call them and go for the phone number.
- Affordability, distrust, "I need to think about it" and "I've been burned before" are not a no. Silence, a flat no twice, and "take me off your list" are.`;

/** The section that sits in the prompt for a visitor's line. */
export function objectionPromptSection(text: any, objections: any[]): string {
  const matches = matchObjections(text, objections);
  if (!matches.length) {
    return `${OBJECTION_RULES}

OBJECTIONS ON FILE
${libraryBriefing(objections, 10) || '(the objection library is empty)'}

Nothing in the list matched what they just said. If this is pushback, answer it warmly in your own words from the knowledge base and stay on the current step.`;
  }

  const answered = matches
    .map((objection: any, index: number) => {
      const goal = String(objection.goal || '').trim();
      const mindset = String(objection.mindset || '').trim();
      return `${index + 1}) ${String(objection.title || 'Objection').trim()}
${mindset ? `   What is behind it: ${mindset}\n` : ''}${goal ? `   What you want from this exchange: ${goal}\n` : ''}   The substance to say, in your own words: ${String(objection.responseText || '').trim().slice(0, 700)}`;
    })
    .join('\n');

  return `${OBJECTION_RULES}

WHAT THEY JUST RAISED — answer the first one now, hold the rest for later
${answered}`;
}

/** A compact list of the library for a prompt that cannot fetch per line. */
export function objectionSkillForPrompt(objections: any[], limit = 12): string {
  return `${OBJECTION_RULES}

OBJECTIONS YOU KNOW HOW TO HANDLE
${libraryBriefing(objections, limit) || '(the objection library is empty)'}`;
}

export function libraryBriefing(objections: any[], limit = 12): string {
  return (objections || [])
    .slice()
    .sort((a: any, b: any) => (PRIORITY_RANK[String(b.priority || 'medium')] || 2) - (PRIORITY_RANK[String(a.priority || 'medium')] || 2))
    .slice(0, limit)
    .map((objection: any) => {
      const triggers = parsePhrases(objection.triggerPhrases).slice(0, 3).join(' / ');
      return `- If they say something like "${triggers || objection.title}" then say, in your own words: ${String(objection.responseText || '').trim().slice(0, 320)}`;
    })
    .join('\n');
}