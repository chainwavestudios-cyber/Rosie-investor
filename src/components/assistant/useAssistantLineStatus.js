/**
 * useAssistantLineStatus.js — Broadcasts the assistant's line status to the /fronter
 * workspace (available / on a call / offline), so fronters see it live while they dial.
 *
 * The manual control in the assistant portal owns presence: it marks the line available
 * when it opens and offline when it closes, and keeps a heartbeat so a closed browser
 * drops to offline on the fronter side. The in-app dialpad reuses this only for its call
 * transitions (autoRegister: false) so it never resets a status set by hand.
 */
import { useCallback, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const HEARTBEAT_MS = 60000;
const FRESH_MS = 3 * 60 * 1000;
const IDLE = { status: 'available', clientName: '', clientPhone: '', callStartedAt: null };
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The assistant's existing broadcast row, if any. */
export async function findAssistantLine(username) {
  if (!username) return null;
  const rows = await base44.entities.AssistantLineStatus.filter({ username: { $regex: `^${esc(username)}$`, $options: 'i' } });
  return rows?.[0] || null;
}

export default function useAssistantLineStatus(username, { autoRegister = true } = {}) {
  const rowId = useRef(null);

  const write = useCallback(async (patch) => {
    if (!username) return;
    try {
      let id = rowId.current;
      if (!id) id = (await findAssistantLine(username))?.id;
      const payload = { ...patch, updatedAt: new Date().toISOString() };
      if (id) {
        rowId.current = id;
        await base44.entities.AssistantLineStatus.update(id, payload);
      } else {
        rowId.current = (await base44.entities.AssistantLineStatus.create({ username, ...payload }))?.id;
      }
    } catch { /* the broadcast must never break the portal */ }
  }, [username]);

  useEffect(() => {
    if (!username) return;
    if (autoRegister) {
      // Mark available — unless a call is already being broadcast, so reopening or refreshing
      // the portal does not wipe a status the assistant set while on an outside dialpad call.
      findAssistantLine(username).then(row => {
        const fresh = row?.updatedAt && Date.now() - new Date(row.updatedAt).getTime() < FRESH_MS;
        if (!(fresh && row.status === 'on_call')) write(IDLE);
      }).catch(() => write(IDLE));
    }
    const heartbeat = setInterval(() => write({}), HEARTBEAT_MS);
    return () => { clearInterval(heartbeat); if (autoRegister) write({ ...IDLE, status: 'offline' }); };
  }, [username, write, autoRegister]);

  return {
    markAvailable: () => write(IDLE),
    markOnCall: (clientName, clientPhone) => write({ status: 'on_call', clientName: clientName || '', clientPhone: clientPhone || '', callStartedAt: new Date().toISOString() }),
    markOffline: () => write({ ...IDLE, status: 'offline' }),
  };
}