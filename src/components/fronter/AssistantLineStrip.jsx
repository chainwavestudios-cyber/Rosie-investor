/**
 * AssistantLineStrip.jsx — Live strip at the top of the fronter workspace showing the
 * admin assistant's dialpad status: available, on a call (with the client and a running
 * call timer) or offline. Updates live; a broadcast older than the heartbeat window is
 * treated as offline.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const AMBER = '#f59e0b';
const STALE_MS = 3 * 60 * 1000;

const STATUS = {
  available: { label: 'Available', color: GOLD, icon: '🟢' },
  on_call: { label: 'On a call', color: AMBER, icon: '📞' },
  offline: { label: 'Offline', color: '#6b7280', icon: '⭕' },
};

const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export default function AssistantLineStrip() {
  const [rows, setRows] = useState([]);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try { setRows((await base44.entities.AssistantLineStatus.list('-updatedAt', 10)) || []); } catch { /* strip is optional */ }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const unsubscribe = base44.entities.AssistantLineStatus.subscribe(() => load());
    return () => { clearInterval(poll); clearInterval(tick); unsubscribe?.(); };
  }, [load]);

  const lines = rows.filter(r => r.username).map(r => {
    const stale = !r.updatedAt || now - new Date(r.updatedAt).getTime() > STALE_MS;
    const status = stale ? 'offline' : (r.status || 'offline');
    return {
      ...r,
      status,
      cfg: STATUS[status] || STATUS.offline,
      seconds: status === 'on_call' && r.callStartedAt ? Math.max(0, Math.floor((now - new Date(r.callStartedAt).getTime()) / 1000)) : null,
    };
  });

  if (lines.length === 0) return null;

  return (
    <div style={{ padding: '8px 24px', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <span style={{ color: '#6b7280', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' }}>Admin Assistant Line</span>
      {lines.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '12px', background: `${r.cfg.color}18`, border: `1px solid ${r.cfg.color}33` }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.cfg.color, boxShadow: r.status === 'on_call' ? `0 0 8px ${r.cfg.color}` : 'none' }} />
          <span style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold' }}>{r.username}</span>
          <span style={{ color: r.cfg.color, fontSize: '10px', fontWeight: 'bold' }}>{r.cfg.icon} {r.cfg.label}</span>
          {r.clientName && <span style={{ color: '#8a9ab8', fontSize: '10px' }}>· {r.clientName}</span>}
          {r.seconds !== null && <span style={{ color: AMBER, fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold' }}>{fmt(r.seconds)}</span>}
        </div>
      ))}
    </div>
  );
}