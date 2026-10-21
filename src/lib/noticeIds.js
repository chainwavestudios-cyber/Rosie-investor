/**
 * noticeIds.js — Frontend helper for reserving Notice IDs for new contact cards.
 *
 * The counter lives on the server so two people creating cards at the same time
 * can never be handed the same Notice ID.
 */
import { base44 } from '@/api/base44Client';

export async function fetchNoticeIds(count = 1) {
  const res = await base44.functions.invoke('assignNoticeId', { count });
  const ids = res?.data?.ids || res?.ids || [];
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('Could not reserve a Notice ID — please try again.');
  return ids;
}