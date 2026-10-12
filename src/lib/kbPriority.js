/**
 * kbPriority.js — Shared helper for saving Customer Q&A entries with priority.
 * When priority is checked and the question already exists in the KB, the new
 * answer(s) are PREPENDED to the existing entry's answers and starred (index 0),
 * so they become the very first answer surfaced in Q&A lookups going forward.
 */
import { base44 } from '@/api/base44Client';
import { parseAnswers, serializeAnswers } from '@/components/debt/MultiAnswerEditor';

/**
 * Find an existing KB entry with the same question (case-insensitive).
 * Matches the given category OR the legacy debt_kb / debt_faq categories.
 */
export async function findExistingKBEntry(question, category) {
  const all = await base44.entities.KnowledgeBase.list('-created_date', 500);
  const q = question.trim().toLowerCase();
  return (all || []).find(
    (e) =>
      e.question &&
      e.question.trim().toLowerCase() === q &&
      (e.category === category || e.category === 'debt_kb' || e.category === 'debt_faq')
  );
}

/**
 * Save a single Q&A pair. If priority is true and the question already exists,
 * prepend the new answers and star them (starredAnswerIndex = 0).
 * Returns { merged: boolean, id }.
 */
export async function saveQAWithPriority({
  question,
  answers,
  category,
  priority = false,
  source = 'manual',
  tags = '',
  variations = '',
}) {
  const clean = (answers || []).filter((a) => typeof a === 'string' && a.trim());
  if (!question.trim() || clean.length === 0) return null;

  if (priority) {
    const existing = await findExistingKBEntry(question, category);
    if (existing) {
      const existingAnswers = parseAnswers(existing.answersJson, existing.answer);
      const merged = [...clean, ...existingAnswers];
      await base44.entities.KnowledgeBase.update(existing.id, {
        answer: clean[0],
        answersJson: serializeAnswers(merged),
        starredAnswerIndex: 0,
      });
      return { merged: true, id: existing.id };
    }
  }

  // Create a new entry
  const created = await base44.entities.KnowledgeBase.create({
    question: question.trim(),
    answer: clean[0],
    answersJson: serializeAnswers(clean),
    starredAnswerIndex: 0,
    category,
    kbName: 'Debt Settlement',
    source,
    tags,
    variations,
    created_date: new Date().toISOString(),
  });
  return { merged: false, id: created?.id };
}