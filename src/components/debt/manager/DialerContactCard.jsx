import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import LiveCallMonitor from './LiveCallMonitor';
import DialerReports from './DialerReports';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };

const DEFAULT_AI_SETTINGS = {
  liveAIEnabled: true, liveQA: true, liveCoach: true, liveIntent: true,
  bobAIEnabled: true, bobQA: true, bobCoach: true, bobIntent: true,
};

export default function DialerContactCard({ dialer, session, managerUsername, onRefresh, onClose }) {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({ callsToday: 0, timeToday: 0, callsWeek: 0, timeWeek: 0 });
  const [aiSettings, setAiSettings] = useState(DEFAULT_AI_SETTINGS);
  const [savingAI, setSavingAI] = useState(false);
  const [loginDuration, setLoginDuration] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  // Load stats for this dialer
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const transcripts = await base44.entities.DebtCallTranscript.filter({ agentId: dialer.username });
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const weekStart = todayStart - (now.getDay() * 24 * 60 * 60 * 1000);

      const todayTranscripts = (transcripts || []).filter(t => t.callDate && new Date(t.callDate).getTime() >= todayStart);
      const weekTranscripts = (transcripts || []).filter(t => t.callDate && new Date(t.callDate).getTime() >= weekStart);

      setStats({
        callsToday: todayTranscripts.length,
        timeToday: todayTranscripts.reduce((s, t) => s + (t.durationSeconds || 0), 0),
        callsWeek: weekTranscripts.length,
        timeWeek: weekTranscripts.reduce((s, t) => s + (t.durationSeconds || 0), 0),
      });
    } catch {}
    setLoadingStats(false);
  }, [dialer.username]);

  // Load AI settings
  useEffect(() => {
    try { setAiSettings(JSON.parse(dialer.aiSettingsJson || '{}') || DEFAULT_AI_SETTINGS); }
    catch { setAiSettings(DEFAULT_AI_SETTINGS); }
  }, [dialer.aiSettingsJson]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Login duration timer
  useEffect(() => {
    if (!session?.loginAt) { setLoginDuration(0); return; }
    const tick = () => setLoginDuration(Math.floor((Date.now() - new Date(session.loginAt).getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.loginAt]);

  const toggleAISetting = async (key) => {
    const newSettings = { ...aiSettings, [key]: !aiSettings[key] };
    setAiSettings(newSettings);
    setSavingAI(true);
    try {
      await base44.entities.DebtCoachUser.update(dialer.id, { aiSettingsJson: JSON.stringify(newSettings) });
    } catch {}
    setSavingAI(false);
  };

  const formatDuration = (s) => {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const isOnline = !!session;
  const isOnCall = session?.status === 'on_call';

  const TABS = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'live', label: '📞 Live Call' },
    { id: 'ai', label: '🤖 AI Settings' },
    { id: 'reports', label: '📊 Reports' },
  ];

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isOnCall ? '#ef4444' : isOnline ? '#4ade80' : '#4a5568', animation: isOnCall ? 'pulse 1s infinite' : 'none' }} />
          <div>
            <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{dialer.username}</div>
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
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <StatBox label="Calls Today" value={loadingStats ? '…' : stats.callsToday} color="#60a5fa" />
              <StatBox label="Time on Calls Today" value={loadingStats ? '…' : formatDuration(stats.timeToday)} color="#10b981" />
              <StatBox label="Calls This Week" value={loadingStats ? '…' : stats.callsWeek} color="#f59e0b" />
              <StatBox label="Hours This Week" value={loadingStats ? '…' : formatDuration(stats.timeWeek)} color="#a855f7" />
              <StatBox label="Login Time Today" value={session?.loginAt ? new Date(session.loginAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'} color="#60a5fa" />
              <StatBox label="Logged In For" value={isOnline ? formatDuration(loginDuration) : '—'} color={isOnline ? '#4ade80' : '#4a5568'} />
            </div>

            {/* Current call info */}
            {isOnCall && (
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '14px', marginBottom: '12px' }}>
                <div style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>🔴 Current Call</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div><span style={{ color: '#8a9ab8' }}>Name: </span><span style={{ color: '#e8e0d0' }}>{session.currentCallLeadName || '—'}</span></div>
                  <div><span style={{ color: '#8a9ab8' }}>Phone: </span><span style={{ color: '#e8e0d0' }}>{session.currentCallPhone || '—'}</span></div>
                  <div><span style={{ color: '#8a9ab8' }}>Mode: </span><span style={{ color: session.currentCallMode === 'close' ? GOLD : '#60a5fa' }}>{session.currentCallMode || 'open'}</span></div>
                  <div><span style={{ color: '#8a9ab8' }}>Started: </span><span style={{ color: '#e8e0d0' }}>{session.currentCallStartedAt ? new Date(session.currentCallStartedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</span></div>
                </div>
                <button onClick={() => setTab('live')} style={{ marginTop: '10px', background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📞 Monitor This Call →</button>
              </div>
            )}
          </div>
        )}

        {tab === 'live' && (
          <LiveCallMonitor
            dialerUsername={dialer.username}
            session={session}
            managerUsername={managerUsername}
            onTakeover={() => { onRefresh?.(); setTab('overview'); }}
          />
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

        {tab === 'reports' && (
          <DialerReports dialerUsername={dialer.username} managerUsername={managerUsername} />
        )}
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