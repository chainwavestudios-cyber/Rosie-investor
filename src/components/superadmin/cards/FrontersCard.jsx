/**
 * FrontersCard.jsx — Fronter system: who is online right now, their live status,
 * the client they are on the phone with, and how long they have been on it.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { C, rowStyle, emptyStyle, chip, fmtDur, asArray } from '@/components/superadmin/kit';

const LIVE_STATUSES = ['logged_in', 'on_call'];

const STATUS = {
  dialing: { label: 'Dialing', color: C.fronter, icon: '📞' },
  bob_training: { label: 'BOB Training', color: C.purple, icon: '🤖' },
  lunch_break: { label: 'Lunch', color: C.warn, icon: '🍽️' },
  bathroom_break: { label: 'Break', color: C.coach, icon: '🚻' },
  offline: { label: 'Offline', color: C.muted, icon: '⭕' },
};

export default function FrontersCard({ onDial }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    let alive = true;
    base44.entities.DialerSession.filter({ status: { $in: LIVE_STATUSES } }, '-loginAt', 60)
      .then((res) => { if (alive) setSessions(asArray(res)); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => base44.entities.DialerSession.subscribe((event) => {
    if (event.type === 'delete') { setSessions((prev) => prev.filter((s) => s.id !== event.id)); return; }
    const rec = event.data;
    setSessions((prev) => {
      const without = prev.filter((s) => s.id !== rec.id);
      return LIVE_STATUSES.includes(rec.status) ? [rec, ...without] : without;
    });
  }), []);

  const onCall = sessions.filter((s) => s.status === 'on_call' || s.currentCallLeadId);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'Logged in', value: sessions.length, color: C.fronter },
          { label: 'On a call', value: onCall.length, color: C.warn },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: '19px', fontWeight: 'bold' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading && <div style={emptyStyle}>Loading fronter team…</div>}
      {!loading && sessions.length === 0 && <div style={emptyStyle}>No fronters logged in right now.</div>}

      <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {sessions.map((s) => {
          const cfg = STATUS[s.fronterStatus] || STATUS.offline;
          const seconds = s.currentCallStartedAt ? (now - new Date(s.currentCallStartedAt).getTime()) / 1000 : 0;
          return (
            <div key={s.id} style={{ ...rowStyle, borderLeft: `3px solid ${cfg.color}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: C.ink, fontSize: '12px', fontWeight: 'bold' }}>{s.username}</span>
                  <span style={chip(cfg.color)}>{cfg.icon} {cfg.label}</span>
                </div>
                <div style={{ color: C.dim, fontSize: '10px', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.currentCallLeadName
                    ? `👤 ${s.currentCallLeadName} · ${s.currentCallPhone || ''} · ${fmtDur(seconds)}`
                    : `Logged in ${s.loginAt ? new Date(s.loginAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}`}
                </div>
              </div>
              {s.currentCallPhone && onDial && (
                <button onClick={() => onDial(s.currentCallPhone, s.currentCallLeadName || s.username)} style={{ background: `${C.fronter}1a`, color: C.fronter, border: `1px solid ${C.fronter}55`, borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📞</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}