/**
 * DebtCallCoach.jsx — Standalone debt settlement call coaching platform.
 * Tabs: Live Call (headset coaching + lead card) | Knowledge Base | User Profiles.
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import DebtLiveCall from '@/components/debt/DebtLiveCall';
import DebtCoachAdminPanel from '@/components/debt/DebtCoachAdminPanel';
import DebtKBManager from '@/components/debt/DebtKBManager';
import DebtKBChat from '@/components/debt/DebtKBChat';
import DebtUserProfile from '@/components/debt/DebtUserProfile';
import DebtPitchTab from '@/components/debt/DebtPitchTab';
import DebtBobTrainer from '@/components/debt/DebtBobTrainer';
import CallsTab from '@/components/debt/CallsTab';
import WCRChecklist from '@/components/debt/WCRChecklist';
import ProfileTimerWatcher from '@/components/debt/ProfileTimerWatcher';
import ClientProfileModal from '@/components/debt/ClientProfileModal';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function DebtCallCoach() {
  const { user, loading, isAuthenticated, logout, isDialer, isAdmin, isManager, canManage, mustResetPassword } = useDebtCoachAuth();
  const [tab, setTab] = useState('live');
  const [timerLead, setTimerLead] = useState(null);

  if (loading) return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;
  if (mustResetPassword) return <Navigate to="/debt-call-coach-login" replace />;

  const TABS = [
    { id: 'live', label: '📞 Live Call' },
    { id: 'calls', label: '📋 Calls' },
    { id: 'bob', label: '🤖 BOB Training' },
    { id: 'pitches', label: '🎤 Pitches' },
    { id: 'kb', label: '🧠 Knowledge Base' },
    ...(isDialer ? [] : [{ id: 'kbchat', label: '💬 AI KB Chat' }]),
    { id: 'profile', label: '👤 User Profiles' },
    ...(isAdmin ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
  ];

  return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, color: '#e8e0d0', padding: '24px 32px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'normal', color: '#e8e0d0' }}>💳 Debt Settlement Call Coach</h1>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>
            Live Headset Coaching · Deepgram AI · Debt Settlement KB
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{user?.username}</span>
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '2px', background: 'rgba(16,185,129,0.15)', color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : user?.role === 'manager' ? 'Manager' : 'Dialer'}</span>
          </div>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 18px', background: tab === t.id ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'live' && <DebtLiveCall debtCoachUser={user} />}
      {tab === 'calls' && <CallsTab />}
      {tab === 'bob' && <DebtBobTrainer debtCoachUser={user} />}
      {tab === 'pitches' && <DebtPitchTab canDelete={!isDialer} />}
      {tab === 'kb' && <DebtKBManager readOnly={isDialer} />}
      {tab === 'kbchat' && <DebtKBChat />}
      {tab === 'profile' && <DebtUserProfile debtCoachUser={user} />}
      {tab === 'admin' && isAdmin && <DebtCoachAdminPanel />}

      {/* Floating WCR Checklist — available on all tabs */}
      <WCRChecklist />

      {/* Profile Timer Watcher — shows popup reminders, can reopen profile */}
      <ProfileTimerWatcher onOpenProfile={(lead) => setTimerLead(lead)} />

      {/* Profile opened from timer popup */}
      {timerLead && (
        <ClientProfileModal lead={timerLead} onClose={() => setTimerLead(null)} onSave={() => {}} />
      )}
    </div>
  );
}