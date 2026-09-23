/**
 * fileDedup.js — File deduplication for debt KB uploads.
 * Computes SHA-256 hashes of files/transcripts and checks against
 * existing KnowledgeBase entries to prevent duplicate uploads.
 */
import { base44 } from '@/api/base44Client';

const DEBT_CATEGORIES = ['debt_kb', 'debt_faq', 'debt_agent', 'debt_customer', 'debt_doc', 'debt_web', 'debt_call'];

/** Compute SHA-256 hash of a File (binary-safe). */
export async function computeFileHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Compute SHA-256 hash of a text string (for pasted transcripts). */
export async function computeTextHash(text) {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a file/text hash already exists in the debt KB.
 * Returns { isDuplicate, count, firstUploadDate, firstUploadSource }.
 */
export async function checkDuplicateHash(hash) {
  const hashTag = `file_hash:${hash}`;
  try {
    const all = await base44.entities.KnowledgeBase.list('-created_date', 500);
    const dupes = (all || []).filter(e =>
      DEBT_CATEGORIES.includes(e.category) && (e.tags || '').includes(hashTag)
    );
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

/** Returns the tag string to store in the KB entry's tags field. */
export function makeHashTag(hash) {
  return `file_hash:${hash}`;
}