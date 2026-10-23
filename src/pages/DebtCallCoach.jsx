/**
 * DebtCallCoach.jsx — Standalone debt settlement call coaching platform.
 * Tabs: Live Call (headset coaching + lead card) | Knowledge Base | User Profiles.
 */
import { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { base44 } from '@/api/base44Client';
import DualClockBar from '@/components/shared/DualClockBar';
import PortalNavButtons from '@/components/shared/PortalNavButtons';
import { isComplianceManager } from '@/lib/complianceRoles';
import DebtLiveCall from '@/components/debt/DebtLiveCall';
import DebtCoachAdminPanel from '@/components/debt/DebtCoachAdminPanel';
import DebtKBManager from '@/components/debt/DebtKBManager';
import DebtKBChat from '@/components/debt/DebtKBChat';
import DebtUserProfile from '@/components/debt/DebtUserProfile';
import DebtPitchTab from '@/components/debt/DebtPitchTab';
import DebtEmailsTab from '@/components/debt/DebtEmailsTab';
import EmailCampaignManagerTab from '@/components/campaigns/EmailCampaignManagerTab';
import ProtoFaceTab from '@/components/debt/protoface/ProtoFaceTab';
import DebtBobTrainer from '@/components/debt/DebtBobTrainer';
import CallsTab from '@/components/debt/CallsTab';
import AICreditsTab from '@/components/debt/AICreditsTab';
import AICostReportsTab from '@/components/debt/AICostReportsTab';
import CoachTabBar from '@/components/debt/CoachTabBar';
import useCoachTabOrder from '@/hooks/useCoachTabOrder';
import HotCallAnalytics from '@/components/debt/HotCallAnalytics';
import LeadGenTab from '@/components/debt/LeadGenTab';
import DccMarketingTab from '@/components/debt/marketing/DccMarketingTab';
import NewLeadsTab from '@/components/debt/NewLeadsTab';
import SmartLeadsTab from '@/components/debt/SmartLeadsTab';
import HotLeadsTab from '@/components/debt/HotLeadsTab';
import DebtScriptsPanel from '@/components/debt/DebtScriptsPanel';
import LeadAssignmentPopup from '@/components/debt/LeadAssignmentPopup';
import PopOutTab from '@/components/debt/PopOutTab';
import SmartClose from '@/components/debt/closing/SmartClose';
import ObjectionsEngineTab from '@/components/debt/ObjectionsEngineTab';
import CompliancePortal from '@/pages/CompliancePortal';
import EmailEngagementPage from '@/pages/EmailEngagementPage';
import WCRChecklist from '@/components/debt/WCRChecklist';
import ProfileTimerWatcher from '@/components/debt/ProfileTimerWatcher';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import CreditAlertPopup from '@/components/debt/CreditAlertPopup';
import DealMonitorPopout from '@/components/debt/DealMonitorPopout';
import HeatMapPopout from '@/components/debt/HeatMapPopout';
import PipelineTab from '@/components/debt/PipelineTab';
import MeetingAlertPopup from '@/components/debt/MeetingAlertPopup';
import MissedAppointmentAlert from '@/components/debt/MissedAppointmentAlert';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function DebtCallCoach() {
  const { user, loading, isAuthenticated, logout, isDialerRole, isAdmin, isManager, isSuperManager, isSuperAdmin, canManage, mustResetPassword, isFronter } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('live');
  useEffect(() => { if (isFronter) navigate('/fronter', { replace: true }); }, [isFronter, navigate]);
  const [timerLead, setTimerLead] = useState(null);
  const [hotLead, setHotLead] = useState(null);
  const [closingLeadId, setClosingLeadId] = useState(null);
  const [showCompliance, setShowCompliance] = useState(false);
  const [liveCallActive, setLiveCallActive] = useState(false);
  const [scriptCallContext, setScriptCallContext] = useState({});
  const [dealMonitorVisible, setDealMonitorVisible] = useState(false);
  const [heatMapVisible, setHeatMapVisible] = useState(false);
  const [pipelineLead, setPipelineLead] = useState(null);

  // Two-row tab bar — each user can drag tabs into any order/row; saved per user
  const { rows: tabRows, tabMap, moveTab, reset: resetTabOrder } = useCoachTabOrder({
    username: user?.username, isAdmin, isSuperAdmin, isSuperManager, isDialerRole,
  });

  // Deep link — the ⌘A console (and any link) can open an exact tab: ?tab=<id>
  const location = useLocation();
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('tab');
    if (requested && tabMap[requested]) setTab(requested);
  }, [location.search, tabMap]);

  // Alt+D hotkey → toggle Deal Monitor popout
  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setDealMonitorVisible(prev => !prev);
      }
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setHeatMapVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // The script's "Completed Steps" button opens the Closing Flow for that lead
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.leadId) setClosingLeadId(e.detail.leadId);
      setTab('closing');
    };
    window.addEventListener('debt_open_closing', handler);
    return () => window.removeEventListener('debt_open_closing', handler);
  }, []);

  if (loading) return (
    <div data-debt-coach style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;
  if (mustResetPassword) return <Navigate to="/debt-call-coach-login" replace />;

  return (
    <div data-debt-coach style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', minHeight: '100vh', background: DARK, color: '#e8e0d0', padding: '24px 32px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Dual clock bar — super admins see Eastern + Philippine Time */}
      {isSuperAdmin && (
        <div style={{ marginBottom: '12px' }}>
          <DualClockBar userTimezone="Asia/Manila" isSuperAdmin={true} />
        </div>
      )}

      {/* Header — logo left, user controls right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <img src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/cad8ccab3_UntitledOvalStickerLandscape.png" alt="Settlement IQ — Realtime Call Intelligence" style={{ width: '350px', height: 'auto', objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{user?.username}</span>
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '2px', background: 'rgba(16,185,129,0.15)', color: GOLD, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : user?.role === 'super_manager' ? 'Super Manager' : user?.role === 'manager' ? 'Manager' : user?.role === 'fronter' ? 'Fronter' : 'Dialer'}</span>
          </div>
          {isSuperManager && <button onClick={() => setShowCompliance(true)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🛡 Compliance</button>}
          {(isAdmin || isManager || isSuperManager) && (
            <button onClick={() => navigate('/manager-portal')} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🎛️ Manager Portal</button>
          )}
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.08)', color: '#a8b8d0', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>Logout</button>
        </div>
      </div>

      {/* Cross-portal switcher */}
      <PortalNavButtons current="coach" isAdmin={isAdmin || isSuperAdmin} />

      {/* Tabs — two rows; drag any tab to reorder (saved per user) */}
      <CoachTabBar rows={tabRows} tabMap={tabMap} active={tab} onSelect={setTab} onMove={moveTab} onReset={resetTabOrder} />

      {tab === 'live' && <DebtLiveCall debtCoachUser={user} onScriptContextChange={setScriptCallContext} onCallStart={(callLead) => { setLiveCallActive(true); if (callLead?.id) setClosingLeadId(callLead.id); }} onCallEnd={() => setLiveCallActive(false)} />}
      <PopOutTab storageKey="debt_scripts_tab" title="Scripts" icon="📜" active={tab === 'scripts'} autoPopOut={liveCallActive} defaultSize={{ width: 520, height: 720 }} zIndex={14600}>
        <DebtScriptsPanel username={user?.username} {...scriptCallContext} />
      </PopOutTab>
      <PopOutTab storageKey="closing_tab" title="Closing Flow" icon="🏁" active={tab === 'closing'} defaultSize={{ width: 460, height: 720 }} autoPopOut={liveCallActive} zIndex={14500}>
        <SmartClose leadId={closingLeadId} canEditPhones={!isDialerRole} canEditScripts={!isDialerRole} />
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
      {tab === 'marketing' && isAdmin && <DccMarketingTab username={user?.username} />}
      {tab === 'newleads' && <NewLeadsTab />}
      <PopOutTab storageKey="hotleads_tab" title="Hot Leads" icon="🔥" active={tab === 'hotleads'} defaultSize={{ width: 940, height: 700 }} zIndex={14600}>
        <HotLeadsTab onOpenLead={(lead) => setHotLead(lead)} onOpenHeatMap={() => setHeatMapVisible(true)} />
      </PopOutTab>
      {tab === 'pipeline' && <PipelineTab onOpenLead={(lead) => setPipelineLead(lead)} />}
      {tab === 'bob' && <DebtBobTrainer debtCoachUser={user} />}
      {tab === 'pitches' && <DebtPitchTab canDelete={!isDialerRole} />}
      {tab === 'emails' && <DebtEmailsTab username={user?.username} />}
      {tab === 'protoface' && isAdmin && <ProtoFaceTab />}
      {tab === 'campaigns' && isAdmin && <EmailCampaignManagerTab username={user?.username} />}
      {tab === 'engagement' && isAdmin && <EmailEngagementPage />}
      {tab === 'objections' && <ObjectionsEngineTab readOnly={isDialerRole} />}
      {tab === 'kb' && <DebtKBManager readOnly={isDialerRole} />}
      {tab === 'kbchat' && <DebtKBChat />}
      {tab === 'profile' && <DebtUserProfile debtCoachUser={user} />}
      {tab === 'stats' && <HotCallAnalytics />}
      {tab === 'compliance' && <CompliancePortal onBack={() => setTab('live')} />}
      {tab === 'admin' && isAdmin && <DebtCoachAdminPanel />}
      {tab === 'aicredits' && isSuperAdmin && <AICreditsTab />}
      {tab === 'aireports' && isAdmin && <AICostReportsTab />}

      {/* Floating WCR Checklist — available on all tabs */}
      <WCRChecklist />

      {/* Profile Timer Watcher — shows popup reminders, can reopen profile */}
      <ProfileTimerWatcher onOpenProfile={(lead) => setTimerLead(lead)} />

      {/* Profile opened from timer popup */}
      {timerLead && (
        <ClientProfileModal lead={timerLead} onClose={() => setTimerLead(null)} onSave={() => {}} />
      )}

      {/* Profile opened from Hot Leads tab */}
      {hotLead && (
        <ClientProfileModal lead={hotLead} username={user?.username} onClose={() => setHotLead(null)} onSave={(updated) => setHotLead(updated)} />
      )}

      {/* Profile opened from Pipeline tab or Deal Monitor */}
      {pipelineLead && (
        <ClientProfileModal lead={pipelineLead} username={user?.username} onClose={() => setPipelineLead(null)} onSave={(updated) => setPipelineLead(updated)} />
      )}

      {/* Popup notification when a new lead is assigned to this user */}
      <LeadAssignmentPopup onGoToLeads={() => setTab('newleads')} />
      <CreditAlertPopup />

      {/* Alt+D Deal Monitor — floating popout, not docked */}
      <DealMonitorPopout visible={dealMonitorVisible} username={user?.username} onOpenLead={(lead) => setPipelineLead(lead)} onClose={() => setDealMonitorVisible(false)} />

      {/* Alt+H Heat Map — floating popout showing deal distribution */}
      <HeatMapPopout visible={heatMapVisible} username={user?.username} onOpenLead={(lead) => setPipelineLead(lead)} onClose={() => setHeatMapVisible(false)} />

      {/* Meeting alert — 5 min before a meeting, popup with audible tone */}
      <MeetingAlertPopup />

      {/* Missed appointment alert — checks every 15 min, 10am-10pm ET Mon-Sat (superadmins only) */}
      {isSuperAdmin && <MissedAppointmentAlert onOpenLead={(ev) => {
        // Try to find a matching lead from the event title
        const title = (ev.title || '').toLowerCase();
        base44.entities.DebtLead.filter({ isHotLead: true }, { sort: '-hotLeadTaggedAt', limit: 200 })
          .then(page => {
            const all = page?.items || page || [];
            const match = all.find(l => {
              const name = `${l.firstName} ${l.lastName}`.toLowerCase();
              return title.includes(name) || title.includes((l.firstName || '').toLowerCase());
            });
            if (match) setHotLead(match);
          })
          .catch(() => {});
      }} />}
    </div>
  );
}