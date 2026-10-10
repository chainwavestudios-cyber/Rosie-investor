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

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function FronterPage() {
  const { user, loading, isAuthenticated, logout, isFronter, isSuperAdmin } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('leads');
  const [lineAssignment, setLineAssignment] = useState(null);
  const [availableLines, setAvailableLines] = useState([]);
  const [adminLineKey, setAdminLineKey] = useState('');
  const [metrics, setMetrics] = useState({ callsToday: 0, talkTimeSeconds: 0, transferredToday: 0 });

  const isAdmin = isSuperAdmin;
  // Fronter sees leads + scripts; admin sees admin + leads + scripts
  const TABS = isAdmin
    ? [{ id: 'admin', label: '⚙️ Admin' }, { id: 'leads', label: '📋 Leads' }, { id: 'scripts', label: '📜 Scripts' }]
    : [{ id: 'leads', label: '📋 Leads' }, { id: 'scripts', label: '📜 Scripts' }];

  const loadLine = useCallback(async () => {
    if (!user?.username) return;
    try {
      const assignments = await base44.entities.FronterLineAssignment.filter({ username: user.username });
      setLineAssignment(assignments?.[0] || null);
      // Admins with no assignment can pick from all available lines
      if (isAdmin && !(assignments?.[0])) {
        const res = await base44.functions.invoke('twilioGetLines', {});
        const lines = res?.data?.lines || res?.lines || [];
        setAvailableLines(lines);
        if (lines.length > 0) setAdminLineKey(lines[0].key);
      }
    } catch {}
  }, [user?.username, isAdmin]);

  useEffect(() => { loadLine(); }, [loadLine]);

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
          {isAdmin && (
            <button onClick={() => navigate('/debt-call-coach', { replace: true })} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>← Back to Coach</button>
          )}
          <button onClick={() => { logout(); navigate('/debt-call-coach-login', { replace: true }); }} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>Logout</button>
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

        {tab === 'leads' && (
          isFronter ? (
            lineAssignment ? (
              <FronterLeadsTab
                username={user.username}
                lineKey={activeLineKey}
                lineNumber={activeLineNumber}
                isAdmin={false}
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
              />
            ) : (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px', fontSize: '14px' }}>
                No Twilio lines available. Configure lines in the Admin tab.
              </div>
            )
          )
        )}

        {tab === 'scripts' && <FronterScriptsTab />}
      </div>
    </div>
  );
}