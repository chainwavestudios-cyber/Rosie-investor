/**
 * Shared knowledge-base search helpers.
 * Used by the admin KB chat (kbChatIngest) and the public website chat (homeQualifyChat).
 */

export function getAnswers(entry: any): string[] {
  const out: string[] = [];
  if (entry?.answersJson) {
    try {
      const arr = JSON.parse(entry.answersJson);
      if (Array.isArray(arr)) for (const a of arr) { if (typeof a === 'string' && a.trim()) out.push(a); }
    } catch {}
  }
  if (out.length === 0 && entry?.answer && String(entry.answer).trim()) out.push(String(entry.answer));
  return out;
}

export function formatAnswers(entry: any): string {
  const answers = getAnswers(entry);
  if (answers.length <= 1) return answers[0] || '';
  return answers.map((a, i) => `${i + 1}. ${a}`).join('\n');
}

export function scoreEntry(qLower: string, words: string[], entry: any): number {
  const haystack = `${entry.question || ''} ${entry.answer || ''} ${entry.answersJson || ''} ${entry.keywords || ''} ${entry.variations || ''} ${entry.alternativeQuestions || ''}`.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (haystack.includes(w)) score += 1;
    if ((entry.question || '').toLowerCase().includes(w)) score += 0.8;
    if ((entry.keywords || '').toLowerCase().includes(w)) score += 0.5;
    if ((entry.variations || '').toLowerCase().includes(w)) score += 0.6;
  }
  const phrases = qLower.match(/\b\w{4,}\s+\w{4,}\b/g) || [];
  for (const phrase of phrases) { if (haystack.includes(phrase)) score += 3; }
  return score;
}

export function findRelevantKB(question: string, kbEntries: any[], topN = 10): any[] {
  if (!kbEntries?.length) return [];
  const qLower = question.toLowerCase();
  const words = qLower.split(/\W+/).filter((w: string) => w.length >= 3);
  return kbEntries
    .filter((e: any) => e.category !== 'raw_document' && e.category !== 'raw_chunk')
    .map((e: any) => ({ ...e, score: scoreEntry(qLower, words, e) }))
    .filter((e: any) => e.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, topN);
}

const STOP_WORDS_Q = new Set(['the','and','for','are','was','were','have','has','had','you','your','our','this','that','from','with','will','can','would','could','should','does','did','not','but','they','them','their','what','when','where','which','how']);

/** An existing KB entry whose question covers >= 80% of this question's significant words. */
export function findSimilarQuestion(question: string, kbEntries: any[]): any | null {
  const qLower = question.toLowerCase().trim();
  const allWords = qLower.split(/\W+/).filter((w: string) => w.length >= 3);
  const sigWords = allWords.filter(w => !STOP_WORDS_Q.has(w));
  if (sigWords.length < 2) return null;
  for (const e of kbEntries) {
    const eqLower = (e.question || '').toLowerCase();
    const matchCount = sigWords.filter(w => eqLower.includes(w)).length;
    if (matchCount / sigWords.length >= 0.8) return e;
  }
  return null;
}