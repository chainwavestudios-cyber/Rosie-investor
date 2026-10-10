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
import FronterQAPopup from '@/components/fronter/FronterQAPopup';
import FronterSettingsTab from '@/components/fronter/FronterSettingsTab';
import FronterMonitorPanel from '@/components/fronter/FronterMonitorPanel';
import FronterBobTrainer from '@/components/fronter/FronterBobTrainer';
import FronterClockBar from '@/components/fronter/FronterClockBar';
import FronterHRTab from '@/components/fronter/FronterHRTab';
import FronterHeadsUpPopup from '@/components/fronter/FronterHeadsUpPopup';
import FronterFeedbackTab from '@/components/fronter/FronterFeedbackTab';
import FronterChatBox from '@/components/fronter/FronterChatBox';
import FronterOnboarding from '@/components/fronter/FronterOnboarding';
import FronterClosedDealsTab from '@/components/fronter/FronterClosedDealsTab';
import FronterCongratsPopup from '@/components/fronter/FronterCongratsPopup';

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
  const [showMonitor, setShowMonitor] = useState(false);
  const [fronterStatus, setFronterStatus] = useState('dialing');
  const [agreementLoaded, setAgreementLoaded] = useState(false);
  const [agreementNeeded, setAgreementNeeded] = useState(false);

  const isAdmin = isSuperAdmin;
  // Fronter sees leads + scripts; admin sees admin + leads + scripts
  const TABS = isAdmin
    ? [{ id: 'admin', label: '⚙️ Admin' }, { id: 'prospects', label: '📋 Prospects' }, { id: 'leads', label: '📋 Leads' }, { id: 'closed_deals', label: '💎 Closed Deals' }, { id: 'feedback', label: '💬 Feedback' }, { id: 'bob', label: '🤖 BOB Training' }, { id: 'hr', label: '🕐 HR' }, { id: 'scripts', label: '📜 Scripts' }, { id: 'settings', label: '🔧 Settings' }]
    : [{ id: 'prospects', label: '📋 Prospects' }, { id: 'leads', label: '📋 Leads' }, { id: 'closed_deals', label: '💎 Closed Deals' }, { id: 'feedback', label: '💬 Feedback' }, { id: 'bob', label: '🤖 BOB Training' }, { id: 'hr', label: '🕐 HR' }, { id: 'scripts', label: '📜 Scripts' }, { id: 'settings', label: '🔧 Settings' }];

  const loadLine = useCallback(async () => {
    if (!user?.username) return;
    try {
      const assignments = await base44.entities.FronterLineAssignment.filter({ username: user.username });
      setLineAssignment(assignments?.[0] || null);
      // Admins can always pick from all available lines
      if (isAdmin) {
        const res = await base44.functions.invoke('twilioGetLines', {});
        const lines = res?.data?.lines || res?.lines || [];
        setAvailableLines(lines);
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

  // Check if fronter has signed their onboarding agreement
  useEffect(() => {
    if (!user?.username || !isFronter) { setAgreementLoaded(true); return; }
    const check = async () => {
      try {
        const existing = await base44.entities.FronterAgreement.filter({ username: user.username });
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
        const sessions = await base44.entities.DialerSession.filter({ username: user.username });
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
      const sessions = await base44.entities.DialerSession.filter({ username: user.username });
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
        const all = await base44.entities.FronterLead.filter({ assignedTo: user.username }, '-created_date', 500);
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

  // Resolve the line to use for the leads tab
  const activeLine = isFronter
    ? lineAssignment
    : (lineAssignment || availableLines.find(l => l.key === adminLineKey) || null);
  const activeLineKey = activeLine?.twilioLineKey || activeLine?.key || '';
  const activeLineNumber = activeLine?.twilioNumber || activeLine?.number || '';

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

  return (
    <div style={{ minHeight: '100vh', background: DARK, fontFamily: 'Georgia, serif', color: '#e8e0d0' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>FRONTER</div>
          <span style={{ color: '#6b7280', fontSize: '12px' }}>|</span>
          <span style={{ color: '#8a9ab8', fontSize: '13px' }}>{user?.username}</span>
          {lineAssignment && <span style={{ color: GOLD, fontSize: '11px' }}>· Line: {lineAssignment.twilioNumber}</span>}
          {isAdmin && <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(16,185,129,0.15)', color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>Super Admin</span>}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isFronter && <FronterClockBar username={user.username} />}
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
          <button onClick={() => setShowQA(p => !p)} title="Live Q&A" style={{ background: showQA ? `${GOLD}30` : `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>💬</button>
          {isAdmin && (
            <button onClick={() => setShowMonitor(p => !p)} title="Fronter Monitor" style={{ background: showMonitor ? `${BLUE}30` : `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>📡</button>
          )}
          {isFronter && (
            <select value={fronterStatus} onChange={e => handleFronterStatusChange(e.target.value)} title="My Status" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${fronterStatus === 'dialing' ? GOLD + '44' : fronterStatus === 'lunch_break' ? '#f59e0b44' : fronterStatus === 'bathroom_break' ? '#60a5fa44' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '5px 8px', color: fronterStatus === 'dialing' ? GOLD : fronterStatus === 'lunch_break' ? '#f59e0b' : fronterStatus === 'bathroom_break' ? '#60a5fa' : '#8a9ab8', fontSize: '11px', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
              <option value="dialing">📞 Dialing</option>
              <option value="lunch_break">🍽️ Lunch Break</option>
              <option value="bathroom_break">🚻 Bathroom Break</option>
            </select>
          )}
          {isAdmin && (
            <button onClick={() => navigate('/debt-call-coach', { replace: true })} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>← Back to Coach</button>
          )}
          <button onClick={() => { if (user?.username) localStorage.setItem(`fronter_logout_${user.username}`, new Date().toISOString()); logout(); navigate('/debt-call-coach-login', { replace: true }); }} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '2px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '12px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.id ? 'bold' : 'normal' }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px' }}>
        {tab === 'admin' && isAdmin && <FronterAdminTab adminUsername={user.username} />}

        {['prospects', 'leads'].includes(tab) && (
          isFronter ? (
            lineAssignment ? (
              <FronterLeadsTab
                username={user.username}
                lineKey={activeLineKey}
                lineNumber={activeLineNumber}
                isAdmin={false}
                mode={tab}
                onCallConnected={() => setShowQA(true)}
                fronterFirstName={user?.firstName}
              />
            ) : (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px', fontSize: '14px' }}>
                No Twilio line assigned to you yet. Contact your admin to assign a line.
              </div>
            )
          ) : (
            activeLineKey ? (
              <FronterLeadsTab
                username={user.username}
                lineKey={activeLineKey}
                lineNumber={activeLineNumber}
                isAdmin={true}
                availableLines={availableLines}
                adminLineKey={adminLineKey}
                onLineChange={setAdminLineKey}
                mode={tab}
                onCallConnected={() => setShowQA(true)}
                fronterFirstName={user?.firstName}
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

        {tab === 'feedback' && <FronterFeedbackTab username={user.username} />}

        {tab === 'bob' && <FronterBobTrainer username={user.username} fronterFirstName={user?.firstName} />}

        {tab === 'hr' && <FronterHRTab username={user.username} />}

        {tab === 'scripts' && <FronterScriptsTab fronterFirstName={user?.firstName} />}

        {tab === 'settings' && <FronterSettingsTab />}
      </div>

      {/* Live Q&A popup — available on all tabs */}
      {showQA && (
        <FronterQAPopup username={user?.username} onClose={() => setShowQA(false)} />
      )}

      {/* Fronter Monitor — super admin only */}
      {showMonitor && isAdmin && (
        <FronterMonitorPanel onClose={() => setShowMonitor(false)} adminUsername={user?.username} />
      )}

      {/* Chat box — fronter chats with admin, admin chats with fronters */}
      <FronterChatBox username={user?.username} role={isAdmin ? 'admin' : 'fronter'} adminUsername="chris" />

      {/* Congrats popup — shows when a deal is closed */}
      {isFronter && <FronterCongratsPopup username={user.username} fronterFirstName={user?.firstName} />}

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
    </div>
  );
}