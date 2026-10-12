/**
 * FronterActivityLogTab — Admin view of fronter activity.
 * Shows a per-fronter timeline of navigation, login/logout, calls, and time spent.
 * Also shows current online status and last-activity time.
 */
import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GREEN = '#4ade80';

const ACTIVITY_META = {
  login: { label: 'Login', color: GREEN, icon: '🔑' },
  logout: { label: 'Logout', color: '#8a9ab8', icon: '🚪' },
  auto_logout: { label: 'Auto-Logout (45min inactive)', color: RED, icon: '⏰' },
  tab_change: { label: 'Navigated', color: BLUE, icon: '📍' },
  call_start: { label: 'Call Started', color: GOLD, icon: '📞' },
  call_end: { label: 'Call Ended', color: '#8a9ab8', icon: '📞' },
  clock_in: { label: 'Clocked In', color: GREEN, icon: '🕐' },
  clock_out: { label: 'Clocked Out', color: AMBER, icon: '⏹' },
  status_change: { label: 'Status Changed', color: PURPLE, icon: '🔄' },
};

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit' });
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDuration(s) {
  if (!s) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60), min = m % 60;
  return `${h}h ${min}m`;
}
function fmtAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FronterActivityLogTab() {
  const [fronters, setFronters] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedFronter, setSelectedFronter] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));

  // Load fronters + active sessions
  useEffect(() => {
    const load = async () => {
      try {
        const [users, sess] = await Promise.all([
          base44.entities.DebtCoachUser.list('-created_date', 500).catch(() => []),
          base44.entities.DialerSession.filter({ status: { $in: ['logged_in', 'on_call'] } }).catch(() => []),
        ]);
        const f = (users || []).filter(u => u.role === 'fronter' && u.isActive);
        setFronters(f);
        setSessions(sess || []);
        if (f.length > 0 && !selectedFronter) setSelectedFronter(f[0].username);
      } catch {}
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  // Load activity logs for selected fronter
  useEffect(() => {
    if (!selectedFronter) return;
    const load = async () => {
      try {
        const startOfDay = new Date(`${filterDate}T00:00:00`).toISOString();
        const endOfDay = new Date(`${filterDate}T23:59:59`).toISOString();
        const rows = await base44.entities.FronterActivityLog.filter(
          { username: { $regex: `^${selectedFronter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, created_date: { $gte: startOfDay, $lte: endOfDay } },
          '-created_date',
          500
        );
        setLogs(rows || []);
      } catch { setLogs([]); }
    };
    load();
  }, [selectedFronter, filterDate]);

  // Compute time-per-tab from logs (reverse chronological → chronological)
  const tabTimeSummary = useMemo(() => {
    const chrono = [...logs].reverse();
    const byTab = {};
    for (const log of chrono) {
      if (log.activityType === 'tab_change' && log.durationSeconds) {
        byTab[log.tabName] = (byTab[log.tabName] || 0) + log.durationSeconds;
      }
    }
    return Object.entries(byTab).sort((a, b) => b[1] - a[1]);
  }, [logs]);

  const totalActiveTime = useMemo(() => {
    return tabTimeSummary.reduce((s, [, sec]) => s + sec, 0);
  }, [tabTimeSummary]);

  const sessionMap = useMemo(() => {
    const m = {};
    for (const s of sessions) m[s.username] = s;
    return m;
  }, [sessions]);

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>📊 Fronter Activity Log</div>

      {/* Online fronters summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {fronters.map(f => {
          const sess = sessionMap[f.username];
          const isOnline = !!sess;
          const lastAct = sess?.lastActivityAt || sess?.fronterStatusAt;
          const inactiveMin = lastAct ? Math.floor((Date.now() - new Date(lastAct).getTime()) / 60000) : null;
          const nearTimeout = inactiveMin != null && inactiveMin >= 40 && isOnline;
          return (
            <div key={f.id} style={{ background: isOnline ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isOnline ? (nearTimeout ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.2)') : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px', padding: '12px', cursor: 'pointer', transition: 'border-color 0.2s' }} onClick={() => setSelectedFronter(f.username)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{f.firstName} {f.lastName}</span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? (nearTimeout ? RED : GREEN) : '#4a5568', animation: isOnline ? 'pulse 1.5s infinite' : 'none' }} />
              </div>
              <div style={{ color: '#6b7280', fontSize: '10px' }}>{f.username}</div>
              {isOnline ? (
                <div style={{ marginTop: '6px', display: 'flex', gap: '8px', fontSize: '10px' }}>
                  <span style={{ color: GOLD }}>{sess.fronterStatus || 'dialing'}</span>
                  <span style={{ color: nearTimeout ? RED : '#6b7280' }}>· last active {fmtAgo(lastAct)}</span>
                </div>
              ) : (
                <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px' }}>Offline</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select value={selectedFronter} onChange={e => setSelectedFronter(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', fontFamily: 'Georgia, serif', outline: 'none' }}>
          {fronters.map(f => <option key={f.id} value={f.username}>{f.firstName} {f.lastName} ({f.username})</option>)}
        </select>
        <label style={{ color: '#8a9ab8', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          Date:
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', fontFamily: 'Georgia, serif', outline: 'none' }} />
        </label>
      </div>

      {/* Time-per-tab summary */}
      {tabTimeSummary.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>⏱️ Time per Tab</span>
            <span style={{ color: GREEN, fontSize: '12px', fontWeight: 'bold' }}>Total active: {fmtDuration(totalActiveTime)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {tabTimeSummary.map(([tabName, sec]) => {
              const pct = totalActiveTime > 0 ? (sec / totalActiveTime) * 100 : 0;
              return (
                <div key={tabName} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#8a9ab8', fontSize: '11px', minWidth: '120px' }}>{tabName}</span>
                  <div style={{ flex: 1, height: '18px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${BLUE}, ${GOLD})`, borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', minWidth: '60px', textAlign: 'right' }}>{fmtDuration(sec)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>
          Activity Timeline — {logs.length} events
        </div>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568', fontSize: '13px' }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568', fontSize: '13px' }}>No activity recorded for this date.</div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {logs.map((log, i) => {
              const meta = ACTIVITY_META[log.activityType] || { label: log.activityType, color: '#8a9ab8', icon: '•' };
              return (
                <div key={log.id || i} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: meta.color, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{meta.label}</span>
                      {log.tabName && <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>→ {log.tabName}</span>}
                      {log.durationSeconds > 0 && <span style={{ color: BLUE, fontSize: '10px', background: 'rgba(96,165,250,0.1)', padding: '1px 6px', borderRadius: '3px' }}>spent {fmtDuration(log.durationSeconds)}</span>}
                    </div>
                    {log.details && <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '2px' }}>{log.details}</div>}
                    <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '2px' }}>{fmtDate(log.created_date)} · {fmtTime(log.created_date)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}