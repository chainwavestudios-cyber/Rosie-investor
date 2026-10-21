/**
 * noticeId.ts — Notice ID allocation for contact cards.
 *
 * Every contact card carries one Notice ID: 3 letters, a 5-digit group and a
 * 3-digit group — NFS-99999-999 — and no two cards ever share one. The series
 * is driven by a single persisted counter (SuperAdminConfig.noticeIdSeq), so
 * allocation is sequential and cannot restart or repeat.
 */

/** First Notice ID issued: NFS-99999-999. */
export const NOTICE_ID_START = 99999999;
const NOTICE_ID_PREFIX = 'NFS';
const MAX_BATCH = 500;

/** 99999999 → NFS-99999-999, 100000000 → NFS-100000-000 */
export function formatNoticeId(value: number): string {
  const n = Math.max(NOTICE_ID_START, Math.floor(Number(value) || 0));
  const digits = String(n);
  return `${NOTICE_ID_PREFIX}-${digits.slice(0, -3)}-${digits.slice(-3)}`;
}

/**
 * Reserves the next `count` Notice IDs and advances the counter.
 * Returns them in order, so the caller can hand one to each new contact card.
 */
export async function assignNoticeIds(base44: any, count = 1): Promise<string[]> {
  const total = Math.min(MAX_BATCH, Math.max(1, Math.floor(Number(count) || 1)));

  const rows = await base44.asServiceRole.entities.SuperAdminConfig.filter({ configName: 'default' });
  const config = Array.isArray(rows) ? rows[0] : (rows?.items || [])[0];
  const last = Number(config?.noticeIdSeq) || NOTICE_ID_START - 1;

  const ids: string[] = [];
  for (let i = 1; i <= total; i++) ids.push(formatNoticeId(last + i));

  const noticeIdSeq = last + total;
  if (config) await base44.asServiceRole.entities.SuperAdminConfig.update(config.id, { noticeIdSeq });
  else await base44.asServiceRole.entities.SuperAdminConfig.create({ configName: 'default', noticeIdSeq });

  return ids;
}