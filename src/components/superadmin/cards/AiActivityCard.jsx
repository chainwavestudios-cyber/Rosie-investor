/**
 * AiActivityCard.jsx — Debt Call Coach system: live inbound / outbound call activity,
 * so the super admin can watch every AI-agent and human call as it lands.
 */
import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { C, rowStyle, emptyStyle, chip, fmtDur, fmtTime, asArray } from '@/components/superadmin/kit';

const STATUS_COLOR = { ringing: C.warn, answered: C.fronter, completed: C.muted, 'no-answer': C.danger, voicemail: C.purple, missed: C.danger };

export default function AiActivityCard() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true;
    base44.entities.CallLog.list('-calledAt', 25)
      .then((res) => { if (alive) setCalls(asArray(res)); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => base44.entities.CallLog.subscribe((event) => {
    if (event.type === 'delete') { setCalls((prev) => prev.filter((c) => c.id !== event.id)); return; }
    setCalls((prev) => [event.data, ...prev.filter((c) => c.id !== event.data.id)].slice(0, 25));
  }), []);

  const todayKey = new Date().toDateString();
  const stats = useMemo(() => {
    const today = calls.filter((c) => c.calledAt && new Date(c.calledAt).toDateString() === todayKey);
    const live = calls.filter((c) => c.status === 'ringing' || c.status === 'answered');
    return {
      inbound: today.filter((c) => c.direction === 'inbound').length,
      outbound: today.filter((c) => c.direction === 'outbound').length,
      live: live.length,
    };
  }, [calls, todayKey]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'Live now', value: stats.live, color: C.fronter },
          { label: 'Inbound today', value: stats.inbound, color: C.purple },
          { label: 'Outbound today', value: stats.outbound, color: C.coach },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: '19px', fontWeight: 'bold' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading && <div style={emptyStyle}>Loading call activity…</div>}
      {!loading && calls.length === 0 && <div style={emptyStyle}>No calls logged yet.</div>}

      <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
        {calls.map((c) => {
          const color = STATUS_COLOR[c.status] || C.muted;
          return (
            <div key={c.id} style={rowStyle}>
              <span style={chip(c.direction === 'inbound' ? C.purple : C.coach)}>{c.direction === 'inbound' ? 'IN' : 'OUT'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.ink, fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.callerName || c.fromNumber || c.toNumber || 'Unknown number'}
                </div>
                <div style={{ color: C.dim, fontSize: '10px' }}>
                  {c.status || 'ringing'} · {c.durationSeconds ? fmtDur(c.durationSeconds) : '—'} · {fmtTime(c.calledAt)}
                </div>
              </div>
              <span style={chip(color)}>{c.status || 'ringing'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}