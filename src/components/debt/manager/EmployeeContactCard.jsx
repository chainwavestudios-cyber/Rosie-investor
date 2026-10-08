/**
 * EmployeeContactCard.jsx — Contact card for any employee (dialer, manager, super_manager, admin).
 * NOT for super_admin. Replaces the old DialerContactCard.
 * Tabs: Overview | Live Call | AI Settings | Reports | Compliance (super_manager+ only)
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { canMonitor } from '@/lib/complianceRoles';
import LiveCallMonitor from './LiveCallMonitor';
import DialerReports from './DialerReports';
import EmployeeComplianceTab from './EmployeeComplianceTab';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };

const DEFAULT_AI_SETTINGS = {
  liveAIEnabled: true, liveQA: true, liveCoach: true, liveIntent: true,
  bobAIEnabled: true, bobQA: true, bobCoach: true, bobIntent: true,
};

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin', super_manager: 'Super Manager', manager: 'Manager', dialer: 'Dialer', fronter: 'Fronter' };
const ROLE_COLORS = { super_admin: '#f472b6', admin: '#60a5fa', super_manager: '#34d399', manager: '#a78bfa', dialer: '#f59e0b', fronter: '#22d3ee' };

export default function EmployeeContactCard({ employee, session, managerUsername, managerRole, onRefresh, onClose }) {
  const { user } = useDebtCoachAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({ callsToday: 0, timeToday: 0, callsWeek: 0, timeWeek: 0, teamCount: 0 });
  const [aiSettings, setAiSettings] = useState(DEFAULT_AI_SETTINGS);
  const [savingAI, setSavingAI] = useState(false);
  const [loginDuration, setLoginDuration] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  const viewerRole = managerRole || user?.role;
  const canViewCompliance = canMonitor(viewerRole, employee.role);

  // Load stats — role-specific
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const transcripts = await base44.entities.DebtCallTranscript.filter({ agentId: employee.username });
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const weekStart = todayStart - (now.getDay() * 24 * 60 * 60 * 1000);
      const today = (transcripts || []).filter(t => t.callDate && new Date(t.callDate).getTime() >= todayStart);
      const week = (transcripts || []).filter(t => t.callDate && new Date(t.callDate).getTime() >= weekStart);

      let teamCount = 0;
      if (employee.role !== 'dialer') {
        const users = await base44.entities.DebtCoachUser.list('-created_date', 500);
        teamCount = (users || []).filter(u => u.role === 'dialer' && u.isActive).length;
      }
      setStats({
        callsToday: today.length,
        timeToday: today.reduce((s, t) => s + (t.durationSeconds || 0), 0),
        callsWeek: week.length,
        timeWeek: week.reduce((s, t) => s + (t.durationSeconds || 0), 0),
        teamCount,
      });
    } catch {}
    setLoadingStats(false);
  }, [employee.username, employee.role]);

  useEffect(() => {
    try { setAiSettings(JSON.parse(employee.aiSettingsJson || '{}') || DEFAULT_AI_SETTINGS); }
    catch { setAiSettings(DEFAULT_AI_SETTINGS); }
  }, [employee.aiSettingsJson]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (!session?.loginAt) { setLoginDuration(0); return; }
    const tick = () => setLoginDuration(Math.floor((Date.now() - new Date(session.loginAt).getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.loginAt]);

  const toggleAISetting = async (key) => {
    const next = { ...aiSettings, [key]: !aiSettings[key] };
    setAiSettings(next);
    setSavingAI(true);
    try { await base44.entities.DebtCoachUser.update(employee.id, { aiSettingsJson: JSON.stringify(next) }); } catch {}
    setSavingAI(false);
  };

  const formatDuration = (s) => {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const isOnline = !!session;
  const isOnCall = session?.status === 'on_call';
  const rc = ROLE_COLORS[employee.role] || '#6b7280';

  const TABS = [
    { id: 'overview', label: '📋 Overview' },
    ...(employee.role === 'dialer' ? [{ id: 'live', label: '📞 Live Call' }] : []),
    { id: 'ai', label: '🤖 AI Settings' },
    { id: 'reports', label: '📊 Reports' },
    ...(canViewCompliance ? [{ id: 'compliance', label: '🛡 Compliance' }] : []),
  ];

  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${rc}33`, borderRadius: '6px' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isOnCall ? '#ef4444' : isOnline ? '#4ade80' : '#4a5568', animation: isOnCall ? 'pulse 1s infinite' : 'none' }} />
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{employee.username}</span>
              <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${rc}18`, color: rc, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{ROLE_LABELS[employee.role]}</span>
            </div>
            <div style={{ color: '#6b7280', fontSize: '10px' }}>
              {isOnCall ? '🔴 On a call' : isOnline ? '🟢 Online' : '⚫ Offline'}
              {session?.loginAt && ` · Logged in ${new Date(session.loginAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px', padding: '0 4px' }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: tab === t.id ? 'bold' : 'normal' }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '18px' }}>
        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <StatBox label="Calls Today" value={loadingStats ? '…' : stats.callsToday} color="#60a5fa" />
              <StatBox label="Time on Calls Today" value={loadingStats ? '…' : formatDuration(stats.timeToday)} color="#10b981" />
              <StatBox label="Calls This Week" value={loadingStats ? '…' : stats.callsWeek} color="#f59e0b" />
              <StatBox label="Hours This Week" value={loadingStats ? '…' : formatDuration(stats.timeWeek)} color="#a855f7" />
              <StatBox label="Login Time Today" value={session?.loginAt ? new Date(session.loginAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'} color="#60a5fa" />
              <StatBox label="Logged In For" value={isOnline ? formatDuration(loginDuration) : '—'} color={isOnline ? '#4ade80' : '#4a5568'} />
              {employee.role !== 'dialer' && <StatBox label="Team Dialers" value={loadingStats ? '…' : stats.teamCount} color="#34d399" />}
            </div>

            {isOnCall && (
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '14px', marginBottom: '12px' }}>
                <div style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>🔴 Current Call</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div><span style={{ color: '#8a9ab8' }}>Name: </span><span style={{ color: '#e8e0d0' }}>{session.currentCallLeadName || '—'}</span></div>
                  <div><span style={{ color: '#8a9ab8' }}>Phone: </span><span style={{ color: '#e8e0d0' }}>{session.currentCallPhone || '—'}</span></div>
                  <div><span style={{ color: '#8a9ab8' }}>Mode: </span><span style={{ color: session.currentCallMode === 'close' ? GOLD : '#60a5fa' }}>{session.currentCallMode || 'open'}</span></div>
                  <div><span style={{ color: '#8a9ab8' }}>Started: </span><span style={{ color: '#e8e0d0' }}>{session.currentCallStartedAt ? new Date(session.currentCallStartedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</span></div>
                </div>
                {employee.role === 'dialer' && <button onClick={() => setTab('live')} style={{ marginTop: '10px', background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📞 Monitor This Call →</button>}
              </div>
            )}
          </div>
        )}

        {tab === 'live' && employee.role === 'dialer' && (
          <LiveCallMonitor dialerUsername={employee.username} session={session} managerUsername={managerUsername} onTakeover={() => { onRefresh?.(); setTab('overview'); }} />
        )}

        {tab === 'ai' && (
          <div>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🤖 AI Helper Settings {savingAI && <span style={{ color: '#f59e0b' }}>· Saving…</span>}</div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>📞 Live Call AI</div>
              <ToggleRow label="AI Assistant (Master)" checked={aiSettings.liveAIEnabled !== false} onChange={() => toggleAISetting('liveAIEnabled')} />
              <ToggleRow label="Q&A Engine" checked={aiSettings.liveQA !== false} onChange={() => toggleAISetting('liveQA')} />
              <ToggleRow label="Coach Engine" checked={aiSettings.liveCoach !== false} onChange={() => toggleAISetting('liveCoach')} />
              <ToggleRow label="Intent Engine" checked={aiSettings.liveIntent !== false} onChange={() => toggleAISetting('liveIntent')} />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '14px' }}>
              <div style={{ color: '#a855f7', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>🤖 BOB Training AI</div>
              <ToggleRow label="AI Assistant (Master)" checked={aiSettings.bobAIEnabled !== false} onChange={() => toggleAISetting('bobAIEnabled')} />
              <ToggleRow label="Q&A Engine" checked={aiSettings.bobQA !== false} onChange={() => toggleAISetting('bobQA')} />
              <ToggleRow label="Coach Engine" checked={aiSettings.bobCoach !== false} onChange={() => toggleAISetting('bobCoach')} />
              <ToggleRow label="Intent Engine" checked={aiSettings.bobIntent !== false} onChange={() => toggleAISetting('bobIntent')} />
            </div>
          </div>
        )}

        {tab === 'reports' && <DialerReports dialerUsername={employee.username} managerUsername={managerUsername} />}

        {tab === 'compliance' && canViewCompliance && <EmployeeComplianceTab employee={employee} session={session} monitorRole={viewerRole} />}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '16px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color: '#c4cdd8', fontSize: '12px' }}>{label}</span>
      <button onClick={onChange} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: checked ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: '2px', left: checked ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: checked ? '#10b981' : '#6b7280', transition: 'left 0.2s' }} />
      </button>
    </div>
  );
}