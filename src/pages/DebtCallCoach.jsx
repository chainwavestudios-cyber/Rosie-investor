/**
 * DebtCallCoach.jsx — Standalone debt settlement call coaching platform.
 * Tabs: Live Call (headset coaching + lead card) | Knowledge Base | User Profiles.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { isComplianceManager } from '@/lib/complianceRoles';
import DebtLiveCall from '@/components/debt/DebtLiveCall';
import DebtCoachAdminPanel from '@/components/debt/DebtCoachAdminPanel';
import DebtKBManager from '@/components/debt/DebtKBManager';
import DebtKBChat from '@/components/debt/DebtKBChat';
import DebtUserProfile from '@/components/debt/DebtUserProfile';
import DebtPitchTab from '@/components/debt/DebtPitchTab';
import DebtBobTrainer from '@/components/debt/DebtBobTrainer';
import CallsTab from '@/components/debt/CallsTab';
import AICreditsTab from '@/components/debt/AICreditsTab';
import HotCallAnalytics from '@/components/debt/HotCallAnalytics';
import LeadGenTab from '@/components/debt/LeadGenTab';
import NewLeadsTab from '@/components/debt/NewLeadsTab';
import SmartLeadsTab from '@/components/debt/SmartLeadsTab';
import LeadAssignmentPopup from '@/components/debt/LeadAssignmentPopup';
import PopOutTab from '@/components/debt/PopOutTab';
import SmartClose from '@/components/debt/closing/SmartClose';
import CompliancePortal from '@/pages/CompliancePortal';
import WCRChecklist from '@/components/debt/WCRChecklist';
import ProfileTimerWatcher from '@/components/debt/ProfileTimerWatcher';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import CreditAlertPopup from '@/components/debt/CreditAlertPopup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function DebtCallCoach() {
  const { user, loading, isAuthenticated, logout, isDialerRole, isAdmin, isManager, isSuperManager, isSuperAdmin, canManage, mustResetPassword } = useDebtCoachAuth();
  const [tab, setTab] = useState('live');
  const [timerLead, setTimerLead] = useState(null);
  const [showCompliance, setShowCompliance] = useState(false);
  const navigate = useNavigate();

  if (loading) return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;
  if (mustResetPassword) return <Navigate to="/debt-call-coach-login" replace />;

  const TABS = [
    { id: 'live', label: '📞 Live Call' },
    { id: 'closing', label: '🏁 Closing' },
    { id: 'calls', label: '📋 Calls' },
    ...(isAdmin ? [{ id: 'leadgen', label: '🎯 Lead Gen' }] : []),
    ...(isAdmin ? [{ id: 'smartleads', label: '🧠 Smart Leads' }] : []),
    { id: 'newleads', label: '📥 New Leads' },
    { id: 'bob', label: '🤖 BOB Training' },
    { id: 'pitches', label: '🎤 Pitches' },
    { id: 'kb', label: '🧠 Knowledge Base' },
    ...(isDialerRole ? [] : [{ id: 'kbchat', label: '💬 AI KB Chat' }]),
    { id: 'profile', label: '👤 Prospects' },
    ...(isDialerRole ? [{ id: 'stats', label: '📊 My Stats' }] : []),
    ...(isSuperManager ? [{ id: 'compliance', label: '🛡 Compliance' }] : []),
    ...(isSuperAdmin ? [{ id: 'aicredits', label: '💳 AI Credits' }] : []),
    ...(isAdmin ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
  ];

  return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, color: '#e8e0d0', padding: '24px 32px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header — logo left, user controls right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <img src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/cad8ccab3_UntitledOvalStickerLandscape.png" alt="Settlement IQ — Realtime Call Intelligence" style={{ width: '350px', height: 'auto', objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{user?.username}</span>
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '2px', background: 'rgba(16,185,129,0.15)', color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : user?.role === 'super_manager' ? 'Super Manager' : user?.role === 'manager' ? 'Manager' : 'Dialer'}</span>
          </div>
          {isSuperManager && <button onClick={() => setShowCompliance(true)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🛡 Compliance</button>}
          {(isAdmin || isManager || isSuperManager) && (
            <button onClick={() => navigate('/manager-portal')} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🎛️ Manager Portal</button>
          )}
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
      <PopOutTab storageKey="closing_tab" title="Closing Flow" icon="🏁" active={tab === 'closing'} defaultSize={{ width: 460, height: 720 }}>
        <SmartClose leadId={timerLead?.id} />
      </PopOutTab>
      <PopOutTab storageKey="calls_tab" title="Calls" icon="📞" active={tab === 'calls'}>
        <CallsTab />
      </PopOutTab>
      <PopOutTab storageKey="leadgen_tab" title="Lead Gen" icon="🎯" active={tab === 'leadgen'}>
        <LeadGenTab />
      </PopOutTab>
      <PopOutTab storageKey="smartleads_tab" title="Smart Leads" icon="🧠" active={tab === 'smartleads'}>
        <SmartLeadsTab />
      </PopOutTab>
      {tab === 'newleads' && <NewLeadsTab />}
      {tab === 'bob' && <DebtBobTrainer debtCoachUser={user} />}
      {tab === 'pitches' && <DebtPitchTab canDelete={!isDialerRole} />}
      {tab === 'kb' && <DebtKBManager readOnly={isDialerRole} />}
      {tab === 'kbchat' && <DebtKBChat />}
      {tab === 'profile' && <DebtUserProfile debtCoachUser={user} />}
      {tab === 'stats' && <HotCallAnalytics />}
      {tab === 'compliance' && <CompliancePortal onBack={() => setTab('live')} />}
      {tab === 'admin' && isAdmin && <DebtCoachAdminPanel />}
      {tab === 'aicredits' && isSuperAdmin && <AICreditsTab />}

      {/* Floating WCR Checklist — available on all tabs */}
      <WCRChecklist />

      {/* Profile Timer Watcher — shows popup reminders, can reopen profile */}
      <ProfileTimerWatcher onOpenProfile={(lead) => setTimerLead(lead)} />

      {/* Profile opened from timer popup */}
      {timerLead && (
        <ClientProfileModal lead={timerLead} onClose={() => setTimerLead(null)} onSave={() => {}} />
      )}

      {/* Popup notification when a new lead is assigned to this user */}
      <LeadAssignmentPopup onGoToLeads={() => setTab('newleads')} />
      <CreditAlertPopup />
    </div>
  );
}