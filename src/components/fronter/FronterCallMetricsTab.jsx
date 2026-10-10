/**
 * FronterCallMetricsTab.jsx — Real-time call metrics for the admin.
 * Shows all-users or per-user call stats: calls today, talk time, transferred,
 * and breakdown by call result. Polls every 10 seconds for live updates.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

function fmtDuration(seconds) {
  if (!seconds) return '0m 0s';
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function isToday(iso) {
  if (!iso) return false;
  return new Date(iso) >= new Date(new Date().setHours(0, 0, 0, 0));
}

export default function FronterCallMetricsTab({ fronters }) {
  const [selectedUser, setSelectedUser] = useState('');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveSessions, setLiveSessions] = useState([]);

  const load = useCallback(async () => {
    try {
      const all = selectedUser
        ? await base44.entities.FronterLead.filter({ assignedTo: selectedUser }, '-created_date', 500)
        : await base44.entities.FronterLead.list('-created_date', 1000);
      setLeads(all || []);
    } catch {}
    setLoading(false);
  }, [selectedUser]);

  const loadSessions = useCallback(async () => {
    try {
      const sessions = await base44.entities.DialerSession.filter({ status: 'on_call' });
      const fronterUsernames = new Set(fronters.map(f => f.username));
      setLiveSessions((sessions || []).filter(s => fronterUsernames.has(s.username)));
    } catch {}
  }, [fronters]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  const todayLeads = leads.filter(l => isToday(l.lastCalledAt));
  const callsToday = todayLeads.length;
  const talkTimeSeconds = todayLeads.reduce((s, l) => s + (l.lastCallDurationSeconds || 0), 0);
  const transferredToday = leads.filter(l => l.status === 'transferred' && isToday(l.transferredAt)).length;
  const connectedToday = todayLeads.filter(l => l.lastCallResult === 'connected').length;
  const voicemailToday = todayLeads.filter(l => l.lastCallResult === 'voicemail').length;
  const noAnswerToday = todayLeads.filter(l => l.lastCallResult === 'no_answer').length;
  const hungUpToday = todayLeads.filter(l => l.lastCallResult === 'hung_up').length;
  const notInterestedToday = todayLeads.filter(l => l.lastCallResult === 'not_interested').length;

  const userMetrics = fronters.map(f => {
    const fLeads = leads.filter(l => l.assignedTo === f.username);
    const fToday = fLeads.filter(l => isToday(l.lastCalledAt));
    return {
      username: f.username,
      callsToday: fToday.length,
      talkTimeSeconds: fToday.reduce((s, l) => s + (l.lastCallDurationSeconds || 0), 0),
      transferredToday: fLeads.filter(l => l.status === 'transferred' && isToday(l.transferredAt)).length,
      connectedToday: fToday.filter(l => l.lastCallResult === 'connected').length,
      onCall: liveSessions.some(s => s.username === f.username),
    };
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📈 Call Metrics — Live</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>User:</span>
          <select value={selectedUser} onChange={e => { setLoading(true); setSelectedUser(e.target.value); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif' }}>
            <option value="">All Users</option>
            {fronters.map(f => <option key={f.id} value={f.username}>{f.username}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <MetricCard label="Calls Today" value={callsToday} color="#60a5fa" />
            <MetricCard label="Talk Time" value={fmtDuration(talkTimeSeconds)} color={GOLD} />
            <MetricCard label="Transferred" value={transferredToday} color="#a78bfa" />
            <MetricCard label="Connected" value={connectedToday} color="#4ade80" />
            <MetricCard label="Voicemail" value={voicemailToday} color="#f59e0b" />
            <MetricCard label="No Answer" value={noAnswerToday} color="#8a9ab8" />
            <MetricCard label="Hung Up" value={hungUpToday} color="#ef4444" />
            <MetricCard label="Not Interested" value={notInterestedToday} color="#ef4444" />
          </div>

          {!selectedUser && (
            <div>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Per-User Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr auto', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                  <span style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Fronter</span>
                  <span style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Calls</span>
                  <span style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Talk Time</span>
                  <span style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Connected</span>
                  <span style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Transferred</span>
                  <span style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Status</span>
                </div>
                {userMetrics.map(u => (
                  <div key={u.username} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr auto', gap: '8px', padding: '10px 12px', background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', alignItems: 'center' }}>
                    <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{u.username}</span>
                    <span style={{ color: '#60a5fa', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' }}>{u.callsToday}</span>
                    <span style={{ color: GOLD, fontSize: '13px', textAlign: 'center' }}>{fmtDuration(u.talkTimeSeconds)}</span>
                    <span style={{ color: '#4ade80', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' }}>{u.connectedToday}</span>
                    <span style={{ color: '#a78bfa', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' }}>{u.transferredToday}</span>
                    <span style={{ textAlign: 'center' }}>
                      {u.onCall ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1s infinite' }} />
                          <span style={{ color: '#4ade80', fontSize: '10px', fontWeight: 'bold' }}>LIVE</span>
                        </span>
                      ) : (
                        <span style={{ color: '#4a5568', fontSize: '10px' }}>—</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${color}33`, borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '24px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}