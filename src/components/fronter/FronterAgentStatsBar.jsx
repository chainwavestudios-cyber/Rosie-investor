/**
 * FronterAgentStatsBar.jsx — Horizontal stats bar showing active fronters.
 * Only shows fronters who are currently clocked in AND have status "dialing".
 * Each card shows: Calls 24hr, Fronts 24hr, Calls Week, Fronts Week.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function FronterAgentStatsBar() {
  const [activeFronters, setActiveFronters] = useState([]);
  const [metrics, setMetrics] = useState({});

  const load = useCallback(async () => {
    try {
      const sessions = await base44.entities.DialerSession.filter({ fronterStatus: 'dialing' });
      // Only show fronters who are logged in or on call (clocked in)
      const clockedIn = (sessions || []).filter(s => s.status === 'logged_in' || s.status === 'on_call');
      if (clockedIn.length === 0) { setActiveFronters([]); setMetrics({}); return; }

      setActiveFronters(clockedIn.map(s => ({ username: s.username, status: s.status, currentCallLeadName: s.currentCallLeadName })));

      // Load all leads for these fronters and compute metrics in JS
      const usernames = clockedIn.map(s => s.username);
      const allLeads = await base44.entities.FronterLead.filter({ assignedTo: { $in: usernames } }, '-created_date', 2000);

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const m = {};
      for (const u of usernames) {
        const myLeads = (allLeads || []).filter(l => l.assignedTo === u);
        const calls24 = myLeads.filter(l => l.lastCalledAt && new Date(l.lastCalledAt) >= yesterday).length;
        const fronts24 = myLeads.filter(l => l.status === 'transferred' && l.transferredAt && new Date(l.transferredAt) >= yesterday).length;
        const callsWeek = myLeads.filter(l => l.lastCalledAt && new Date(l.lastCalledAt) >= weekAgo).length;
        const frontsWeek = myLeads.filter(l => l.status === 'transferred' && l.transferredAt && new Date(l.transferredAt) >= weekAgo).length;
        const closedWeek = myLeads.filter(l => l.status === 'closed_deal' && l.closedDealAt && new Date(l.closedDealAt) >= weekAgo).length;
        m[u] = { calls24, fronts24, callsWeek, frontsWeek, closedWeek };
      }
      setMetrics(m);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  if (activeFronters.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
      {activeFronters.map(f => {
        const m = metrics[f.username] || { calls24: 0, fronts24: 0, callsWeek: 0, frontsWeek: 0, closedWeek: 0 };
        const onCall = f.status === 'on_call';
        return (
          <div key={f.username} style={{ background: '#0d1b2a', border: `1px solid ${onCall ? 'rgba(74,222,128,0.3)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '6px', padding: '12px 16px', minWidth: '260px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: onCall ? '#4ade80' : GOLD, animation: 'pulse 1.5s infinite' }} />
              <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{f.username}</span>
              <span style={{ color: onCall ? '#4ade80' : GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginLeft: 'auto' }}>{onCall ? '🔴 On Call' : '📞 Dialing'}</span>
              {m.closedWeek > 0 && <span style={{ padding: '1px 6px', borderRadius: '8px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: '9px', fontWeight: 'bold' }}>💎 {m.closedWeek}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <StatCell label="Calls 24hr" value={m.calls24} color="#60a5fa" />
              <StatCell label="Fronts 24hr" value={m.fronts24} color={GOLD} />
              <StatCell label="Calls Week" value={m.callsWeek} color="#f59e0b" />
              <StatCell label="Fronts Week" value={m.frontsWeek} color="#a78bfa" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCell({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '6px 8px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '16px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
    </div>
  );
}