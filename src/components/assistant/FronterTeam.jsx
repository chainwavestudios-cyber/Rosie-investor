import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const CYAN = '#22d3ee';

const STATUS_COLORS = { prospect: '#8a9ab8', lead: BLUE, transferred: GOLD, booked: '#22c55e', closed_deal: GOLD, removed: '#6b7280', migrated: CYAN };

export default function FronterTeam() {
  const [leads, setLeads] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('queue');
  const [monitorBusy, setMonitorBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, liveRes, statsRes] = await Promise.all([
        base44.entities.FronterLead.filter({ status: { $in: ['prospect', 'lead'] } }, { sort: '-created_date', limit: 50, fields: ['firstName', 'lastName', 'phone', 'status', 'assignedTo', 'callCount', 'lastCalledAt', 'lastCallResult', 'debtAmount'] }),
        base44.entities.DialerSession.filter({ status: 'on_call' }, { sort: '-currentCallStartedAt', limit: 30 }),
        base44.entities.FronterLead.aggregate({ groupBy: 'status', count: true }),
      ]);
      setLeads(queueRes.items || queueRes);
      setSessions(liveRes.items || liveRes);
      setStats(statsRes);
    } catch (e) { console.error('fronter team load', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  const monitor = async (s, mode) => {
    setMonitorBusy(s.id + mode);
    try {
      await base44.functions.invoke('managerCallControl', { action: mode, conferenceName: s.currentCallConferenceName, managerUsername: 'msxyc', lineKey: s.currentCallPhone });
      if (mode === 'listen') alert(`Listening in on ${s.username}'s call with ${s.currentCallLeadName}.`);
    } catch (e) { alert('Monitor failed: ' + e.message); }
    setMonitorBusy('');
  };

  const rows = stats?.rows || [];
  const total = rows.reduce((a, r) => a + (r.count || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold' }}>👥 Fronter Team</div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>Queue, live calls (listen/whisper/barge), and analytics. Auto-refreshes every 30s.</div>
        </div>
        <button onClick={load} style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>↻ Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: '2px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[['queue', '📋 Queue'], ['live', `🔴 Live Calls (${sessions.length})`], ['analytics', '📊 Analytics']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === id ? GOLD : 'transparent'}`, color: tab === id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: tab === id ? 'bold' : 'normal' }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Loading…</div>
      ) : tab === 'queue' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {leads.length === 0 ? <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>No active fronter leads in the queue.</div> :
            leads.map(l => (
              <div key={l.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{l.firstName} {l.lastName} <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'normal' }}>· {l.phone}</span></div>
                  <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '2px' }}>Assigned: {l.assignedTo || 'unassigned'} · Calls: {l.callCount || 0} {l.debtAmount ? `· $${l.debtAmount.toLocaleString()}` : ''}</div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', background: `${(STATUS_COLORS[l.status] || '#8a9ab8')}22`, color: STATUS_COLORS[l.status] || '#8a9ab8' }}>{l.status}</span>
              </div>
            ))}
        </div>
      ) : tab === 'live' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sessions.length === 0 ? <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>No fronter calls in progress right now.</div> :
            sessions.map(s => (
              <div key={s.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${RED}44`, borderLeft: `3px solid ${RED}`, borderRadius: '4px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>🔴 {s.username} → {s.currentCallLeadName || 'Unknown'}</div>
                    <div style={{ color: '#8a9ab8', fontSize: '11px' }}>{s.currentCallPhone} · started {s.currentCallStartedAt ? new Date(s.currentCallStartedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', background: `${RED}22`, color: RED }}>ON CALL</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => monitor(s, 'listen')} disabled={!!monitorBusy} style={{ background: `${BLUE}22`, color: BLUE, border: `1px solid ${BLUE}55`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{monitorBusy === s.id + 'listen' ? '⏳' : '🎧 Listen'}</button>
                  <button onClick={() => monitor(s, 'whisper')} disabled={!!monitorBusy} style={{ background: `${PURPLE}22`, color: PURPLE, border: `1px solid ${PURPLE}55`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}> Whisper</button>
                  <button onClick={() => monitor(s, 'barge')} disabled={!!monitorBusy} style={{ background: `${RED}22`, color: RED, border: `1px solid ${RED}55`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}> Barge</button>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '16px 20px', minWidth: '120px' }}>
              <div style={{ color: '#6b7280', fontSize: '11px' }}>TOTAL LEADS</div>
              <div style={{ color: GOLD, fontSize: '28px', fontWeight: 'bold' }}>{total}</div>
            </div>
            {rows.map(r => (
              <div key={r.status} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '16px 20px', minWidth: '120px' }}>
                <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>{r.status}</div>
                <div style={{ color: STATUS_COLORS[r.status] || '#e8e0d0', fontSize: '28px', fontWeight: 'bold' }}>{r.count}</div>
              </div>
            ))}
          </div>
          <div style={{ color: '#8a9ab8', fontSize: '12px' }}>Live transfer & booking counts come from the fronter performance reports (FronterPerformanceReport). Open the Manager Portal → Employees for per-fronter coaching breakdowns.</div>
        </div>
      )}
    </div>
  );
}