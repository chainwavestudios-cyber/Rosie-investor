/**
 * FronterPage.jsx — Main page for the fronter system.
 * Fronters see: Leads (dial list) + Scripts (popoutable).
 * Super admins additionally see: Admin tab (lines, leads, metrics, monitor, scripts).
 * Fronters can ONLY access this page — all other debt coach pages redirect them here.
 */
import { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { base44 } from '@/api/base44Client';
import FronterLeadsTab from '@/components/fronter/FronterLeadsTab';
import FronterScriptsTab from '@/components/fronter/FronterScriptsTab';
import FronterAdminTab from '@/components/fronter/FronterAdminTab';
import FronterAIPanel from '@/components/fronter/FronterAIPanel';
import FronterSettingsTab from '@/components/fronter/FronterSettingsTab';
import FronterMonitorPanel from '@/components/fronter/FronterMonitorPanel';
import FronterBobTrainer from '@/components/fronter/FronterBobTrainer';
import FronterTimeCardButton from '@/components/fronter/FronterTimeCardButton';
import FronterCallCard from '@/components/fronter/FronterCallCard';
import FronterHRTab from '@/components/fronter/FronterHRTab';
import FronterHeadsUpPopup from '@/components/fronter/FronterHeadsUpPopup';
import FronterFeedbackTab from '@/components/fronter/FronterFeedbackTab';
import FronterOnboarding from '@/components/fronter/FronterOnboarding';
import FronterClosedDealsTab from '@/components/fronter/FronterClosedDealsTab';
import FronterCongratsPopup from '@/components/fronter/FronterCongratsPopup';
import FronterEmergencyScript from '@/components/fronter/FronterEmergencyScript';
import FronterAIAgentTab from '@/components/fronter/FronterAIAgentTab';
import FronterEmailTrackingNotifications from '@/components/fronter/FronterEmailTrackingNotifications';
import FronterContactCard from '@/components/fronter/FronterContactCard';
import FronterAIReportsTab from '@/components/fronter/FronterAIReportsTab';
import FronterReportPopup from '@/components/fronter/FronterReportPopup';
import DualClockBar from '@/components/shared/DualClockBar';
import TimezonePrompt from '@/components/shared/TimezonePrompt';
import EasternTimeReminder from '@/components/shared/EasternTimeReminder';
import { useFronterActivityTracker, clockOutAtTime, logFronterActivity } from '@/hooks/useFronterActivityTracker';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';

export default function FronterPage() {
  const { user, loading, isAuthenticated, logout, isFronter, isSuperAdmin, mustResetPassword } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('leads');
  const [lineAssignment, setLineAssignment] = useState(null);
  const [availableLines, setAvailableLines] = useState([]);
  const [adminLineKey, setAdminLineKey] = useState('');
  const [metrics, setMetrics] = useState({ callsToday: 0, talkTimeSeconds: 0, transferredToday: 0 });
  const [showQA, setShowQA] = useState(false);
  const [showCallCard, setShowCallCard] = useState(false);
  const [autoLoggedOutMsg, setAutoLoggedOutMsg] = useState('');
  const [callActive, setCallActive] = useState(false);
  const [pendingReports, setPendingReports] = useState([]);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [showTzPrompt, setShowTzPrompt] = useState(false);
  const [userTz, setUserTz] = useState(user?.timezone || 'America/New_York');

  // Activity tracker — logs tab navigation, auto-logs-out after 45 min inactivity
  const handleInactive = useCallback(async (lastActivityISO) => {
    // Clock out at the last activity time (not now — 45 min later)
    const clockedOut = await clockOutAtTime(user.username, lastActivityISO);
    await logFronterActivity(user.username, 'auto_logout', `Inactive 45+ min. Last activity: ${new Date(lastActivityISO).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}. ${clockedOut ? 'Clocked out at last activity time.' : 'Was not clocked in.'}`);
    await logout();
    sessionStorage.setItem('fronterAutoLogoutMsg', `You were logged out after 45 minutes of inactivity. Last activity: ${new Date(lastActivityISO).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}.`);
    navigate('/debt-call-coach-login', { replace: true });
  }, [user, logout, navigate]);

  useFronterActivityTracker({ username: user?.username, role: user?.role, tab, onInactive: handleInactive });

  // Show auto-logout message if returning from one
  useEffect(() => {
    const msg = sessionStorage.getItem('fronterAutoLogoutMsg');
    if (msg) { setAutoLoggedOutMsg(msg); sessionStorage.removeItem('fronterAutoLogoutMsg'); setTimeout(() => setAutoLoggedOutMsg(''), 8000); }
  }, []);

  // First-login timezone prompt — show if user hasn't been prompted yet
  useEffect(() => {
    if (user?.id && !user.timezonePrompted) setShowTzPrompt(true);
    if (user?.timezone) setUserTz(user.timezone);
  }, [user?.id, user?.timezonePrompted, user?.timezone]);

  // Alt+C toggles the Call Card
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setShowCallCard(p => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [fronterKbEntries, setFronterKbEntries] = useState([]);
  const [showMonitor, setShowMonitor] = useState(false);
  const [monitorLead, setMonitorLead] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [fronterStatus, setFronterStatus] = useState('dialing');
  const [agreementLoaded, setAgreementLoaded] = useState(false);
  const [agreementNeeded, setAgreementNeeded] = useState(false);

  const isAdmin = isSuperAdmin;
  // Fronter sees leads + scripts; admin sees admin + leads + scripts
  const TABS = [
    ...(isAdmin
      ? [{ id: 'scripts', label: 'Scripts' }, { id: 'admin', label: '⚙️ Admin' }, { id: 'ai_agent', label: '🤖 AI Agent' }, { id: 'prospects', label: '📋 Prospects' }, { id: 'leads', label: '📋 Leads' }, { id: 'closed_deals', label: '💎 Closed Deals' }, { id: 'reports', label: '📊 Reports' }, { id: 'feedback', label: '💬 Feedback' }, { id: 'bob', label: '🤖 BOB Training' }, { id: 'hr', label: '🕐 HR' }, { id: 'settings', label: '🔧 Settings' }]
      : [{ id: 'prospects', label: '📋 Prospects' }, { id: 'leads', label: '📋 Leads' }, { id: 'closed_deals', label: '💎 Closed Deals' }, { id: 'reports', label: '📊 Reports' }, { id: 'feedback', label: '💬 Feedback' }, { id: 'bob', label: '🤖 BOB Training' }, { id: 'hr', label: '🕐 HR' }, { id: 'settings', label: '🔧 Settings' }]),
  ];

  const loadLine = useCallback(async () => {
    if (!user?.username) return;
    try {
      const assignments = await base44.entities.FronterLineAssignment.filter({ username: { $regex: `^${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      setLineAssignment(assignments?.[0] || null);
      // Always load available lines so fronters resolve their current number too
      const res = await base44.functions.invoke('twilioGetLines', {});
      const lines = res?.data?.lines || res?.lines || [];
      setAvailableLines(lines);
      if (isAdmin) {
        setAdminLineKey(prev => prev || (lines.length > 0 ? lines[0].key : ''));
      }
    } catch {}
  }, [user?.username, isAdmin]);

  useEffect(() => {
    loadLine();
    const interval = setInterval(loadLine, 10000);
    return () => clearInterval(interval);
  }, [loadLine]);

  // Track login time for daily reports
  useEffect(() => {
    if (user?.username) {
      const key = `fronter_login_${user.username}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, new Date().toISOString());
      }
    }
  }, [user?.username]);

  // Load FronterKnowledgeBase entries for the Live Q&A popup
  useEffect(() => {
    const loadKb = async () => {
      try {
        const all = await base44.entities.FronterKnowledgeBase.list('-created_date', 500);
        setFronterKbEntries(all || []);
      } catch {}
    };
    loadKb();
    const kbInterval = setInterval(loadKb, 15000);
    return () => clearInterval(kbInterval);
  }, []);

  // Check if fronter has signed their onboarding agreement
  useEffect(() => {
    if (!user?.username || !isFronter) { setAgreementLoaded(true); return; }
    const check = async () => {
      try {
        // Users marked as not requiring a contract skip the agreement entirely
        if (user.contractRequired === false) { setAgreementNeeded(false); setAgreementLoaded(true); return; }
        const existing = await base44.entities.FronterAgreement.filter({ username: { $regex: `^${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
        if (!existing || existing.length === 0) setAgreementNeeded(true);
      } catch {}
      setAgreementLoaded(true);
    };
    check();
  }, [user?.username, isFronter]);

  // Initialize / update DialerSession for fronter status tracking
  useEffect(() => {
    if (!user?.username || !isFronter) return;
    const initSession = async () => {
      try {
        const sessions = await base44.entities.DialerSession.filter({ username: { $regex: `^${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
        if (sessions?.[0]) {
          const s = sessions[0];
          setFronterStatus(s.fronterStatus || 'dialing');
          await base44.entities.DialerSession.update(s.id, {
            status: 'logged_in',
            loginAt: s.loginAt || new Date().toISOString(),
            fronterStatus: s.fronterStatus || 'dialing',
            fronterStatusAt: s.fronterStatusAt || new Date().toISOString(),
          });
        } else {
          await base44.entities.DialerSession.create({
            username: user.username,
            loginAt: new Date().toISOString(),
            status: 'logged_in',
            fronterStatus: 'dialing',
            fronterStatusAt: new Date().toISOString(),
          });
        }
      } catch {}
    };
    initSession();
  }, [user?.username, isFronter]);

  const handleFronterStatusChange = async (newStatus) => {
    setFronterStatus(newStatus);
    if (!user?.username) return;
    try {
      const sessions = await base44.entities.DialerSession.filter({ username: { $regex: `^${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      if (sessions?.[0]) {
        await base44.entities.DialerSession.update(sessions[0].id, {
          fronterStatus: newStatus,
          fronterStatusAt: new Date().toISOString(),
        });
      }
    } catch {}
  };

  // Load per-user daily metrics (calls today, talk time, transferred)
  useEffect(() => {
    if (!user?.username) return;
    const compute = async () => {
      try {
        const all = await base44.entities.FronterLead.filter({ assignedTo: { $regex: `^${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }, '-created_date', 500);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayLeads = (all || []).filter(l => l.lastCalledAt && new Date(l.lastCalledAt) >= today);
        const callsToday = todayLeads.length;
        const talkTimeSeconds = todayLeads.reduce((s, l) => s + (l.lastCallDurationSeconds || 0), 0);
        const transferredToday = (all || []).filter(l => l.status === 'transferred' && l.transferredAt && new Date(l.transferredAt) >= today).length;
        setMetrics({ callsToday, talkTimeSeconds, transferredToday });
      } catch {}
    };
    compute();
    const interval = setInterval(compute, 30000);
    return () => clearInterval(interval);
  }, [user?.username]);

  // Track active call status — popup waits until call ends before showing
  useEffect(() => {
    if (!user?.username) return;
    const check = async () => {
      try {
        const sessions = await base44.entities.DialerSession.filter({ username: user.username });
        setCallActive(sessions?.[0]?.status === 'on_call');
      } catch {}
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [user?.username]);

  // Load unviewed performance reports on mount + subscribe to new ones
  useEffect(() => {
    if (!user?.username) return;
    const loadUnviewed = async () => {
      try {
        const all = await base44.entities.FronterPerformanceReport.filter(
          { fronterUsername: user.username, viewedByFronter: false },
          { sort: '-reportTimestamp', limit: 10 }
        );
        const items = all?.items || all || [];
        if (items.length > 0) setPendingReports(items);
      } catch {}
    };
    loadUnviewed();
    const unsubscribe = base44.entities.FronterPerformanceReport.subscribe((event) => {
      if (event.type === 'create' && event.data?.fronterUsername === user.username && !event.data?.viewedByFronter) {
        setPendingReports(prev => [...prev, event.data]);
      }
    });
    return () => unsubscribe();
  }, [user?.username]);

  // Show popup when call ends and there are pending reports
  useEffect(() => {
    if (!callActive && pendingReports.length > 0 && !showReportPopup) {
      setShowReportPopup(true);
    }
  }, [callActive, pendingReports, showReportPopup]);

  // Mark report as viewed and advance to next pending
  const handleCloseReport = async () => {
    const report = pendingReports[0];
    if (report?.id) {
      try {
        await base44.entities.FronterPerformanceReport.update(report.id, { viewedByFronter: true, viewedAt: new Date().toISOString() });
      } catch {}
    }
    const remaining = pendingReports.slice(1);
    setPendingReports(remaining);
    setShowReportPopup(false);
  };

  // Resolve assignments only against the account's live, voice-capable inventory.
  // A stored number is authoritative; a stale key must not select a different line.
  const assignedLiveLine = lineAssignment
    ? availableLines.find(l => lineAssignment.twilioNumber
      ? l.number === lineAssignment.twilioNumber
      : l.key === lineAssignment.twilioLineKey)
    : null;
  const activeLine = isFronter
    ? assignedLiveLine
    : (assignedLiveLine || availableLines.find(l => l.key === adminLineKey) || null);
  const activeLineKey = activeLine?.key || '';
  const activeLineNumber = activeLine?.number || '';

  if (loading) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;

  // Only fronters and super admins can access this page
  if (!isFronter && !isSuperAdmin) {
    navigate('/debt-call-coach', { replace: true });
    return null;
  }

  // Fronters must complete onboarding (form + signed agreement) before accessing the dashboard
  if (isFronter && !agreementLoaded) {
    return (
      <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
      </div>
    );
  }
  if (isFronter && (mustResetPassword || agreementNeeded)) {
    return <FronterOnboarding username={user.username} mustResetPassword={mustResetPassword} onDone={() => setAgreementNeeded(false)} />;
  }

  const statusColor = fronterStatus === 'dialing' ? GOLD : fronterStatus === 'bob_training' ? '#a78bfa' : fronterStatus === 'lunch_break' ? '#f59e0b' : fronterStatus === 'bathroom_break' ? '#60a5fa' : '#6b7280';

  return (
    <div style={{ minHeight: '100vh', background: DARK, fontFamily: 'Georgia, serif', color: '#e8e0d0' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {autoLoggedOutMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '12px 24px', color: '#ef4444', fontSize: '13px', fontWeight: 'bold', zIndex: 50000, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>⏰ {autoLoggedOutMsg}</div>
      )}

      {/* Dual clock bar — Eastern Time + user's timezone (or PHT for super admins) */}
      <DualClockBar userTimezone={userTz} isSuperAdmin={isAdmin} />

      {/* First-login timezone prompt */}
      {showTzPrompt && user?.id && (
        <TimezonePrompt
          userId={user.id}
          currentTz={userTz}
          onDone={(tz) => { setShowTzPrompt(false); setUserTz(tz); }}
        />
      )}

      {/* Eastern Time communication reminder — shows once per user */}
      <EasternTimeReminder username={user?.username} />

      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>FRONTER</div>
          <span style={{ color: '#6b7280', fontSize: '12px' }}>|</span>
          <span style={{ color: '#8a9ab8', fontSize: '13px' }}>{user?.username}</span>
          {lineAssignment && <span style={{ color: GOLD, fontSize: '11px' }}>· Line: {availableLines.find(l => l.key === lineAssignment.twilioLineKey)?.number || lineAssignment.twilioNumber}</span>}
          {isAdmin && <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(16,185,129,0.15)', color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>Super Admin</span>}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <FronterTimeCardButton username={user.username} />
          {(isFronter || isSuperAdmin) && (
            <select value={fronterStatus} onChange={e => handleFronterStatusChange(e.target.value)} title="My Status" style={{ background: `${statusColor}18`, border: `1px solid ${statusColor}44`, borderRadius: '4px', padding: '5px 8px', color: statusColor, fontSize: '11px', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
              <option value="dialing">📞 Dialing</option>
              <option value="bob_training">🤖 BOB Training</option>
              <option value="lunch_break">🍽️ Lunch Break</option>
              <option value="bathroom_break">🚻 Bathroom Break</option>
              <option value="offline">⭕ Offline</option>
            </select>
          )}
          {/* Daily metrics for this user */}
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '0 14px', borderLeft: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#60a5fa', fontSize: '15px', fontWeight: 'bold' }}>{metrics.callsToday}</div>
              <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Calls Today</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: GOLD, fontSize: '15px', fontWeight: 'bold' }}>{Math.floor(metrics.talkTimeSeconds / 60)}m {metrics.talkTimeSeconds % 60}s</div>
              <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Talk Time</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#a78bfa', fontSize: '15px', fontWeight: 'bold' }}>{metrics.transferredToday}</div>
              <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Transferred</div>
            </div>
          </div>
          <button onClick={() => setTab('leads')} title="Home" style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>🏠</button>
          <button onClick={() => setShowCallCard(p => !p)} title="Call Card (Alt+C)" style={{ background: showCallCard ? `${GOLD}30` : `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>📞</button>
          {isAdmin && (
            <button onClick={() => setShowMonitor(p => !p)} title="Fronter Monitor" style={{ background: showMonitor ? `${BLUE}30` : `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>📡</button>
          )}
          {isAdmin && (
            <button onClick={() => navigate('/debt-call-coach', { replace: true })} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>← Back to Coach</button>
          )}
          <button onClick={() => { if (user?.username) localStorage.setItem(`fronter_logout_${user.username}`, new Date().toISOString()); logout(); navigate('/debt-call-coach-login', { replace: true }); }} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Fronter workspace" style={{ padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '2px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button role="tab" aria-selected={tab === t.id} key={t.id} onClick={() => setTab(t.id)} style={{ padding: '12px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px' }}>
        {tab === 'admin' && isAdmin && <FronterAdminTab adminUsername={user.username} onOpenLead={async (leadId) => { try { const lead = await base44.entities.FronterLead.get(leadId); setMonitorLead(lead); } catch {} }} />}

        {tab === 'ai_agent' && isAdmin && <FronterAIAgentTab adminUsername={user.username} />}

        {['prospects', 'leads'].includes(tab) && (
          isFronter ? (
            assignedLiveLine ? (
              <FronterLeadsTab
                username={user.username}
                lineKey={activeLineKey}
                lineNumber={activeLineNumber}
                isAdmin={false}
                isSuperAdmin={isSuperAdmin}
                mode={tab}
                onCallConnected={() => setShowCallCard(true)}
                onOpenQA={() => setShowCallCard(true)}
                fronterFirstName={user?.firstName}
                onTranscriptChange={setLiveTranscript}
                showCallCard={showCallCard}
                setShowCallCard={setShowCallCard}
                transcript={liveTranscript}
                fronterKbEntries={fronterKbEntries}
              />
            ) : (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px', fontSize: '14px' }}>
                {lineAssignment ? 'Your assigned line is not available in the live Twilio account. Contact your admin to check the assignment.' : 'No Twilio line assigned to you yet. Contact your admin to assign a line.'}
              </div>
            )
          ) : (
            activeLineKey ? (
              <FronterLeadsTab
                username={user.username}
                lineKey={activeLineKey}
                lineNumber={activeLineNumber}
                isAdmin={true}
                isSuperAdmin={isSuperAdmin}
                availableLines={availableLines}
                adminLineKey={adminLineKey}
                onLineChange={setAdminLineKey}
                mode={tab}
                onCallConnected={() => setShowCallCard(true)}
                onOpenQA={() => setShowCallCard(true)}
                fronterFirstName={user?.firstName}
                onTranscriptChange={setLiveTranscript}
                showCallCard={showCallCard}
                setShowCallCard={setShowCallCard}
                transcript={liveTranscript}
                fronterKbEntries={fronterKbEntries}
              />
            ) : (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px', fontSize: '14px' }}>
                No Twilio lines available. Configure lines in the Admin tab.
              </div>
            )
          )
        )}

        {tab === 'closed_deals' && (
          <FronterClosedDealsTab username={user.username} isAdmin={isAdmin} fronterFirstName={user?.firstName} />
        )}

        {tab === 'reports' && (
          <FronterAIReportsTab username={user.username} isAdmin={isAdmin} />
        )}

        {tab === 'feedback' && <FronterFeedbackTab username={user.username} />}

        {tab === 'bob' && <FronterBobTrainer username={user.username} fronterFirstName={user?.firstName} />}

        {tab === 'hr' && <FronterHRTab username={user.username} />}

        {isAdmin && <FronterScriptsTab active={tab === 'scripts'} fronterFirstName={user?.firstName} username={user.username} />}

        {tab === 'settings' && <FronterSettingsTab />}
      </div>

      {/* Live Q&A panel is now inside the Call Card (Alt+C) — removed the docked popup */}

      {/* Fronter Monitor — super admin only */}
      {showMonitor && isAdmin && (
        <FronterMonitorPanel onClose={() => setShowMonitor(false)} adminUsername={user?.username} onOpenLead={async (leadId) => { try { const lead = await base44.entities.FronterLead.get(leadId); setMonitorLead(lead); } catch {} }} />
      )}

      {/* Emergency script — Alt+S */}
      <FronterEmergencyScript />

      {/* Congrats popup — shows when a deal is closed */}
      {isFronter && <FronterCongratsPopup username={user.username} fronterFirstName={user?.firstName} />}

      {/* Email tracking notifications — real-time open/click popups */}
      <FronterEmailTrackingNotifications />

      {/* Heads Up alerts — super admin only */}
      {isAdmin && (
        <FronterHeadsUpPopup
          adminUsername={user?.username}
          onListen={async (alert) => {
            try {
              await base44.functions.invoke('fronterCall', {
                action: 'listen',
                conferenceName: alert.conferenceName,
                adminUsername: user.username,
                lineKey: alert.lineKey || 'TWILIO_FROM_NUMBER',
              });
            } catch (e) { alert('Listen failed: ' + (e?.message || String(e))); }
          }}
          onOpenLead={(leadId) => { setTab('leads'); }}
        />
      )}

      {/* Contact card opened from monitor email alert */}
      {monitorLead && (
        <FronterContactCard
          lead={monitorLead}
          username={user?.username}
          isAdmin={true}
          onClose={() => setMonitorLead(null)}
          onSave={(updated) => setMonitorLead(prev => ({ ...prev, ...updated }))}
        />
      )}

      {/* AI Performance Audit popup — shows after call ends, movable */}
      {showReportPopup && pendingReports[0] && (
        <FronterReportPopup report={pendingReports[0]} onClose={handleCloseReport} />
      )}
    </div>
  );
}