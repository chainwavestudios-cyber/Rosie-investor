/**
 * fileDedup.js — Deduplication for KB uploads across all knowledge bases.
 * Computes SHA-256 hashes of files/text and checks against existing
 * KnowledgeBase entries to prevent duplicate uploads.
 */
import { base44 } from '@/api/base44Client';

/** Compute SHA-256 hash of a File (binary-safe). */
export async function computeFileHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Compute SHA-256 hash of a text string (for pasted transcripts/bulk Q&A). */
export async function computeTextHash(text) {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a file/text hash already exists in ANY KB entry (all KBs, all categories).
 * Returns { isDuplicate, count, firstUploadDate, firstUploadSource }.
 */
export async function checkDuplicateHash(hash) {
  const hashTag = `file_hash:${hash}`;
  try {
    const all = await base44.entities.KnowledgeBase.list('-created_date', 1000);
    const dupes = (all || []).filter(e => (e.tags || '').includes(hashTag));
    return {
      isDuplicate: dupes.length > 0,
      count: dupes.length,
      firstUploadDate: dupes[0]?.created_date,
      firstUploadSource: dupes[0]?.source,
    };
  } catch {
    return { isDuplicate: false, count: 0, firstUploadDate: null, firstUploadSource: null };
  }
}

/**
 * Check if entries from a given URL already exist (by source field match).
 * Returns { isDuplicate, count, firstUploadDate }.
 */
export async function checkDuplicateUrl(url) {
  try {
    const all = await base44.entities.KnowledgeBase.list('-created_date', 1000);
    const dupes = (all || []).filter(e => (e.source || '') === url);
    return {
      isDuplicate: dupes.length > 0,
      count: dupes.length,
      firstUploadDate: dupes[0]?.created_date,
    };
  } catch {
    return { isDuplicate: false, count: 0, firstUploadDate: null };
  }
}

/**
 * Check if a question already exists in the specified KB (case-insensitive exact match).
 * Pass kbName='' for the Default KB.
 * Returns { isDuplicate, count, existingAnswer }.
 */
export async function checkDuplicateQuestion(question, kbName) {
  try {
    const all = await base44.entities.KnowledgeBase.list('-created_date', 1000);
    const qLower = question.trim().toLowerCase();
    const dupes = (all || []).filter(e => {
      const eKb = e.kbName || '';
      const matchesKb = kbName ? eKb === kbName : !eKb;
      return (e.question || '').trim().toLowerCase() === qLower && matchesKb;
    });
    return {
      isDuplicate: dupes.length > 0,
      count: dupes.length,
      existingAnswer: dupes[0]?.answer,
    };
  } catch {
    return { isDuplicate: false, count: 0, existingAnswer: null };
  }
}

/** Returns the tag string to store in the KB entry's tags field. */
export function makeHashTag(hash) {
  return `file_hash:${hash}`;
}