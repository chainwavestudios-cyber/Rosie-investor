/**
 * useAssistantLineStatus.js — Broadcasts the assistant dialpad's status to the /fronter
 * workspace: available while the dialpad is open, on a call (with the client and start
 * time) while connected, offline when it closes. A heartbeat keeps the broadcast fresh, so
 * a closed browser drops to Offline on the fronter side instead of sitting on "On a call".
 */
import { useCallback, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const HEARTBEAT_MS = 60000;
const IDLE = { status: 'available', clientName: '', clientPhone: '', callStartedAt: null };
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function useAssistantLineStatus(username) {
  const rowId = useRef(null);

  const write = useCallback(async (patch) => {
    if (!username) return;
    try {
      let id = rowId.current;
      if (!id) {
        const existing = await base44.entities.AssistantLineStatus.filter({ username: { $regex: `^${esc(username)}$`, $options: 'i' } });
        id = existing?.[0]?.id;
      }
      const payload = { ...patch, updatedAt: new Date().toISOString() };
      if (id) {
        rowId.current = id;
        await base44.entities.AssistantLineStatus.update(id, payload);
      } else {
        rowId.current = (await base44.entities.AssistantLineStatus.create({ username, ...payload }))?.id;
      }
    } catch { /* the broadcast must never break the dialpad */ }
  }, [username]);

  useEffect(() => {
    if (!username) return;
    write(IDLE);
    const heartbeat = setInterval(() => write({}), HEARTBEAT_MS);
    return () => { clearInterval(heartbeat); write({ ...IDLE, status: 'offline' }); };
  }, [username, write]);

  return {
    markAvailable: () => write(IDLE),
    markOnCall: (clientName, clientPhone) => write({ status: 'on_call', clientName: clientName || '', clientPhone: clientPhone || '', callStartedAt: new Date().toISOString() }),
  };
}