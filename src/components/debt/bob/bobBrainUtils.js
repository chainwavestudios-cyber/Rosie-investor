/**
 * bobBrainUtils.js — Cross-reference & duplicate-detection helpers for BobBrain.
 * Finds duplicate-like statements between newly extracted Q&A and the existing
 * KB so the trainer can resolve conflicts (pick what's preferred).
 */
const STOP_WORDS = new Set(['the','and','you','your','what','how','why','when','who','are','is','was','were','can','could','would','will','do','does','did','have','has','had','a','an','of','to','in','for','on','with','that','this','it','they','them','their','there','here','about','into','from','but','not','or','if','so','be','been','being','am','my','we','our','us','me','at','by','as','like','just','really','very','also','than','then']);

export function tokenize(s) {
  return new Set((s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)));
}

export function jaccard(a, b) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

/**
 * Find duplicate-like existing KB entries for a newly extracted entry.
 * Returns up to 3 best matches above the similarity threshold.
 */
export function findDuplicates(newEntry, existingEntries, threshold = 0.42) {
  const newText = `${newEntry.question || ''} ${newEntry.answer || ''}`;
  const newTokens = tokenize(newText);
  if (newTokens.size === 0) return [];
  const matches = [];
  for (const ex of existingEntries) {
    const exText = `${ex.question || ''} ${ex.answer || ''}`;
    const exTokens = tokenize(exText);
    if (exTokens.size === 0) continue;
    const sim = jaccard(newTokens, exTokens);
    if (sim >= threshold) matches.push({ existing: ex, similarity: sim });
  }
  return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}

/**
 * Cross-reference a batch of new entries against the existing KB.
 * Returns { flagged: [{newEntry, matches}], clean: [newEntry] }.
 */
export function crossReferenceBatch(newEntries, existingEntries) {
  const flagged = [];
  const clean = [];
  for (const ne of newEntries) {
    const dups = findDuplicates(ne, existingEntries);
    if (dups.length > 0) flagged.push({ newEntry: ne, matches: dups });
    else clean.push(ne);
  }
  return { flagged, clean };
}