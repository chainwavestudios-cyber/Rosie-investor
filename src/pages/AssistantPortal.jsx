import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import AlertCenter from '@/components/assistant/AlertCenter';
import AssistantTasks from '@/components/assistant/AssistantTasks';
import SystemGuide from '@/components/assistant/SystemGuide';
import AssistantCalendar from '@/components/assistant/AssistantCalendar';
import FronterTeam from '@/components/assistant/FronterTeam';
import AssistantDialer from '@/components/assistant/AssistantDialer';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function AssistantPortal() {
  const { user, loading, isAuthenticated, isAdmin, isSuperAdmin, logout, mustResetPassword, resetMyPassword } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('alerts');
  const [dialLead, setDialLead] = useState(null);
  const [pwForm, setPwForm] = useState({ a: '', b: '' });
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  if (loading) return <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div></div>;
  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;
  if (!isAdmin && !isSuperAdmin) return <Navigate to="/debt-call-coach" replace />;

  const doReset = async () => {
    if (pwForm.a !== pwForm.b) { setPwErr('Passwords do not match'); return; }
    if (pwForm.a.length < 6) { setPwErr('Password must be at least 6 characters'); return; }
    setPwBusy(true); setPwErr('');
    try { await resetMyPassword(pwForm.a); } catch (e) { setPwErr(e.message); }
    setPwBusy(false);
  };

  if (mustResetPassword) {
    return (
      <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}33`, borderRadius: '8px', padding: '32px', maxWidth: '380px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/cad8ccab3_UntitledOvalStickerLandscape.png" alt="Settlement IQ" style={{ width: '120px', height: 'auto', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold' }}>Set Your Password</div>
            <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>Welcome, {user?.username}. Please set a new password to continue.</div>
          </div>
          {pwErr && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '10px', textAlign: 'center' }}>{pwErr}</div>}
          <input type="password" value={pwForm.a} onChange={e => setPwForm({ ...pwForm, a: e.target.value })} placeholder="New password" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '12px', color: '#e8e0d0', fontSize: '14px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' }} />
          <input type="password" value={pwForm.b} onChange={e => setPwForm({ ...pwForm, b: e.target.value })} placeholder="Confirm new password" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '12px', color: '#e8e0d0', fontSize: '14px', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' }} />
          <button onClick={doReset} disabled={pwBusy} style={{ width: '100%', background: `linear-gradient(135deg,#10b981,#22c55e)`, color: DARK, border: 'none', borderRadius: '4px', padding: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{pwBusy ? 'Saving…' : 'Set Password & Continue'}</button>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'alerts', label: '🔔 Alert Center' },
    { id: 'tasks', label: '✅ My Tasks' },
    { id: 'calendar', label: '📅 Calendar' },
    { id: 'fronter', label: '👥 Fronter Team' },
    { id: 'dialer', label: '☎️ Dialer' },
    { id: 'guide', label: '📚 System Guide' },
  ];

  return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, color: '#e8e0d0', padding: '20px 32px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/cad8ccab3_UntitledOvalStickerLandscape.png" alt="Settlement IQ" style={{ width: '130px', height: 'auto', objectFit: 'contain' }} />
          <div>
            <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold' }}>Admin Assistant Command Center</div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>Right-hand operations · alerts · appointments · fronter team · dialer</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{user?.username}</div>
            <span style={{ padding: '2px 8px', borderRadius: '2px', background: 'rgba(16,185,129,0.15)', color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
          </div>
          <button onClick={() => navigate('/manager-portal')} style={navBtn()}>Manager</button>
          <button onClick={() => navigate('/debt-call-coach')} style={navBtn()}>Coach</button>
          <button onClick={logout} style={navBtn()}>Logout</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 16px', background: tab === t.id ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: '900px' }}>
        {tab === 'alerts' && <AlertCenter onOpenLead={(a) => { if (a.leadId) { setDialLead(a); setTab('dialer'); } }} />}
        {tab === 'tasks' && <AssistantTasks username={user?.username} />}
        {tab === 'calendar' && <AssistantCalendar onDialLead={(l) => { setDialLead(l); setTab('dialer'); }} />}
        {tab === 'fronter' && <FronterTeam />}
        {tab === 'dialer' && <AssistantDialer username={user?.username} prefilledNumber={dialLead?.phone} prefilledName={dialLead ? `${dialLead.firstName || ''} ${dialLead.lastName || ''}`.trim() : ''} />}
        {tab === 'guide' && <SystemGuide />}
      </div>
    </div>
  );
}

function navBtn() {
  return { background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' };
}