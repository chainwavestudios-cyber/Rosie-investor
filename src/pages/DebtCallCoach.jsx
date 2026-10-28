/**
 * DebtCallCoach.jsx — Standalone debt settlement call coaching platform.
 * Tabs: Live Call (headset coaching + lead card) | Knowledge Base | User Profiles.
 */
import { useState, useEffect } from 'react';
import { ClipboardCheck, ShieldCheck, LogOut, LayoutDashboard, Radio } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { base44 } from '@/api/base44Client';
import DualClockBar from '@/components/shared/DualClockBar';
import PortalNavButtons from '@/components/shared/PortalNavButtons';
import DebtLiveCall from '@/components/debt/DebtLiveCall';
import DebtCoachAdminPanel from '@/components/debt/DebtCoachAdminPanel';
import DebtKBManager from '@/components/debt/DebtKBManager';
import DebtKBChat from '@/components/debt/DebtKBChat';
import DebtUserProfile from '@/components/debt/DebtUserProfile';
import DebtPitchTab from '@/components/debt/DebtPitchTab';
import DebtEmailsTab from '@/components/debt/DebtEmailsTab';
import EmailCampaignManagerTab from '@/components/campaigns/EmailCampaignManagerTab';
import EmailFinderTab from '@/components/debt/EmailFinderTab';
import ProtoFaceTab from '@/components/debt/protoface/ProtoFaceTab';

import CallIntelligenceTab from '@/components/debt/CallIntelligenceTab';
import AICreditsTab from '@/components/debt/AICreditsTab';
import AICostReportsTab from '@/components/debt/AICostReportsTab';
import CoachTabBar from '@/components/debt/CoachTabBar';
import useCoachTabOrder from '@/hooks/useCoachTabOrder';
import HotCallAnalytics from '@/components/debt/HotCallAnalytics';
import LeadGenTab from '@/components/debt/LeadGenTab';
import NewLeadsTab from '@/components/debt/NewLeadsTab';
import SmartLeadsTab from '@/components/debt/SmartLeadsTab';
import HotLeadsTab from '@/components/debt/HotLeadsTab';
import DebtScriptsPanel from '@/components/debt/DebtScriptsPanel';
import LeadAssignmentPopup from '@/components/debt/LeadAssignmentPopup';
import PopOutTab from '@/components/debt/PopOutTab';
import SmartClose from '@/components/debt/closing/SmartClose';
import ObjectionsEngineTab from '@/components/debt/ObjectionsEngineTab';
import CompliancePortal from '@/pages/CompliancePortal';
import DebtCoachGmailEngagementPanel from '@/components/debt/DebtCoachGmailEngagementPanel';
import DebtGmailGoldMilestoneWatcher from '@/components/debt/DebtGmailGoldMilestoneWatcher';
import WCRChecklist from '@/components/debt/WCRChecklist';
import ProfileTimerWatcher from '@/components/debt/ProfileTimerWatcher';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import CreditAlertPopup from '@/components/debt/CreditAlertPopup';
import DealMonitorPopout from '@/components/debt/DealMonitorPopout';
import HeatMapPopout from '@/components/debt/HeatMapPopout';
import PipelineTab from '@/components/debt/PipelineTab';
import MeetingAlertPopup from '@/components/debt/MeetingAlertPopup';
import MissedAppointmentAlert from '@/components/debt/MissedAppointmentAlert';
import AppointmentTimersBar from '@/components/debt/AppointmentTimersBar';
import '@/components/debt/DebtCoachPolish.css';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const friendlyTab = (label='') => label.replace(/^[^ ]+\s+/u,'').trim() || 'Workspace';

export default function DebtCallCoach() {
  const { user, loading, isAuthenticated, logout, isDialerRole, isAdmin, isManager, isSuperManager, isSuperAdmin, canManage, mustResetPassword, isFronter } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('live');
  const [liveLaunch, setLiveLaunch] = useState(null);
  // Contact cards request listening or an outbound Twilio-assisted call.
  // The Live Call workspace owns both flows and the shared Q&A/Coach UI.
  useEffect(() => {
    const launch = (event) => {
      const { leadId, mode } = event.detail || {};
      if (!leadId || !['listen','dial','office'].includes(mode)) return;
      setLiveLaunch({ leadId, mode, token: Date.now() });
      setTab('live');
    };
    window.addEventListener('debt_launch_live', launch);
    return () => window.removeEventListener('debt_launch_live', launch);
  }, []);
  useEffect(() => { if (isFronter) navigate('/fronter', { replace: true }); }, [isFronter, navigate]);
  const [timerLead, setTimerLead] = useState(null);
  const [hotLead, setHotLead] = useState(null);
  const [closingLeadId, setClosingLeadId] = useState(null);
  const [liveCallActive, setLiveCallActive] = useState(false);
  const [twilioSessionActive, setTwilioSessionActive] = useState(false);
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
    // Old Marketing bookmarks now open the unified Email Campaigns workspace.
    const destination = requested === 'marketing' ? 'campaigns' : requested;
    if (destination === 'bob') { navigate('/bob/internal', {replace: true}); return; }
    if (destination && tabMap[destination]) setTab(destination);
  }, [location.search, tabMap, navigate]);

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

  // Smart Close's search picker selects the same lead used throughout Closing.
  useEffect(() => {
    const selectLead = (event) => {
      const id = typeof event.detail === 'string' ? event.detail : event.detail?.leadId;
      if (id) { setClosingLeadId(id); setTab('closing'); }
    };
    window.addEventListener('smart_close_select_lead', selectLead);
    return () => window.removeEventListener('smart_close_select_lead', selectLead);
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
    <div data-debt-coach className="dcc-shell" style={{ fontFamily:'system-ui,-apple-system,BlinkMacSystemFont,sans-serif',minHeight:'100vh',background:'radial-gradient(ellipse at 70% -8%,rgba(27,77,66,.16),transparent 55%),#080f19',color:'#e8eae3',padding:'clamp(10px,1.55vw,22px)' }}>

      {/* Quiet admin-only milestone watcher: confetti only for newly completed audio. */}
      {isAdmin && <DebtGmailGoldMilestoneWatcher/>}

      {/* Dual clock bar — super admins see Eastern + Philippine Time */}
      {isSuperAdmin && (
        <div style={{ marginBottom: '12px' }}>
          <DualClockBar userTimezone="Asia/Manila" isSuperAdmin={true} />
        </div>
      )}

      {/* One compact, consistent header across every tab. No startup pop-outs. */}
      <header className="dcc-header">
        <div className="dcc-header-brand">
          <div className="dcc-logo-plaque">
            <img className="dcc-header-logo" src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/cad8ccab3_UntitledOvalStickerLandscape.png" alt="Settlement IQ — Realtime Call Intelligence" />
          </div>
          <div className="dcc-header-copy">
            <div className="dcc-header-eyebrow">Rosie AI · Agent workspace</div>
            <div className="dcc-header-name">Debt Call Coach</div>
            <div className="dcc-header-description">Sales intelligence &amp; follow-up</div>
          </div>
        </div>
        <div className="dcc-header-actions">
          <span className={'dcc-header-status'+(liveCallActive?' is-live':'')} title={liveCallActive?'Call session active':'Workspace ready for use'}>
            <Radio size={13} aria-hidden="true"/>{liveCallActive?'LIVE CALL':'READY'}
          </span>
          <button type="button" className="dcc-header-action" onClick={()=>window.dispatchEvent(new Event('coach_open_wcr'))} title="Open Welcome Call Review checklist"><ClipboardCheck size={14}/> WCR</button>
          {isSuperManager && <button type="button" className="dcc-header-action is-sensitive" onClick={()=>setTab('compliance')}><ShieldCheck size={14}/> Compliance</button>}
          {(isAdmin||isManager||isSuperManager) && <button type="button" className="dcc-header-action" onClick={()=>navigate('/manager-portal')}><LayoutDashboard size={14}/> Manager</button>}
          <div className="dcc-header-user" title={user?.username||''}>
            <span className="dcc-header-username">{user?.username}</span>
            <span className="dcc-header-role">{user?.role === 'super_admin'?'Super Admin':user?.role === 'admin'?'Admin':user?.role === 'super_manager'?'Super Manager':user?.role === 'manager'?'Manager':user?.role === 'fronter'?'Fronter':'Dialer'}</span>
          </div>
          <button type="button" className="dcc-header-action is-quiet" onClick={logout} title="Log out of Debt Call Coach"><LogOut size={14}/> Log out</button>
        </div>
      </header>

      {/* Every upcoming appointment, counting down live */}
      <AppointmentTimersBar onOpenLead={(lead) => setPipelineLead(lead)} />

      {/* Cross-portal switcher */}
      <PortalNavButtons current="coach" isAdmin={isAdmin || isSuperAdmin} compact />

      {/* Tabs — two rows; drag any tab to reorder (saved per user) */}
      <CoachTabBar rows={tabRows} tabMap={tabMap} active={tab} onSelect={(nextTab)=>nextTab==='bob'?navigate('/bob/internal'):setTab(nextTab)} onMove={moveTab} onReset={resetTabOrder} />

      <div className="dcc-current-section" aria-live="polite"><span className="dcc-path">Debt Call Coach /</span><strong>{friendlyTab(tabMap[tab]?.label||'Live Call')}</strong></div>
      <main className="dcc-workspace-body" aria-label={friendlyTab(tabMap[tab]?.label||'Live Call')}>
      {(tab === 'live' || liveCallActive || twilioSessionActive) && <div style={{display:tab==='live'?'contents':'none'}}>
        <DebtLiveCall launchAction={liveLaunch} debtCoachUser={user} onTwilioPresenceChange={setTwilioSessionActive} onScriptContextChange={setScriptCallContext} onCallStart={(callLead) => { setLiveCallActive(true); if (callLead?.id) setClosingLeadId(callLead.id); }} onCallEnd={() => setLiveCallActive(false)} />
      </div>}
      <PopOutTab storageKey="debt_scripts_tab" title="Scripts" icon="📜" active={tab === 'scripts'} defaultSize={{ width: 520, height: 720 }} zIndex={14600}>
        <DebtScriptsPanel username={user?.username} {...scriptCallContext} />
      </PopOutTab>
      <PopOutTab storageKey="closing_tab" title="Smart Close" icon="🏁" active={tab === 'closing'} autoPopOut={liveCallActive} defaultSize={{ width: 460, height: 720 }} zIndex={14500}>
        <SmartClose key={closingLeadId || 'no-lead'} leadId={closingLeadId} liveTranscript={scriptCallContext.lead?.id === closingLeadId && scriptCallContext.phase === 'live' ? scriptCallContext.liveTranscript : undefined} intentScore={scriptCallContext.lead?.id === closingLeadId ? scriptCallContext.intentScore : undefined} animalType={scriptCallContext.lead?.id === closingLeadId ? scriptCallContext.animalType : undefined} canEditPhones={!isDialerRole} canEditScripts={!isDialerRole} />
      </PopOutTab>
      <PopOutTab storageKey="calls_tab" title="Call Intelligence" icon="📞" active={tab === 'calls'} defaultSize={{ width: 1120, height: 820 }}>
        <CallIntelligenceTab />
      </PopOutTab>
      <PopOutTab storageKey="leadgen_tab" title="Lead Gen" icon="🎯" active={tab === 'leadgen'}>
        <LeadGenTab />
      </PopOutTab>
      <PopOutTab storageKey="smartleads_tab" title="Smart Leads" icon="🧠" active={tab === 'smartleads'}>
        <SmartLeadsTab />
      </PopOutTab>
      {tab === 'newleads' && <NewLeadsTab />}
      <PopOutTab storageKey="hotleads_tab" title="Hot Leads" icon="🔥" active={tab === 'hotleads'} defaultSize={{ width: 1180, height: 780 }} zIndex={14600}>
        <HotLeadsTab onOpenLead={(lead) => setHotLead(lead)} onOpenHeatMap={() => setHeatMapVisible(true)} />
      </PopOutTab>
      {tab === 'pipeline' && <PipelineTab onOpenLead={(lead) => setPipelineLead(lead)} />}

      {tab === 'pitches' && <DebtPitchTab canDelete={!isDialerRole} />}
      {tab === 'emails' && <DebtEmailsTab username={user?.username} />}
      {tab === 'protoface' && isAdmin && <ProtoFaceTab />}
      {tab === 'campaigns' && isAdmin && <EmailCampaignManagerTab username={user?.username} />}
      {tab === 'emailfinder' && isAdmin && <EmailFinderTab />}
      {tab === 'engagement' && isAdmin && <DebtCoachGmailEngagementPanel />}
      {tab === 'objections' && <ObjectionsEngineTab readOnly={isDialerRole} />}
      {tab === 'kb' && <DebtKBManager readOnly={isDialerRole} />}
      {tab === 'kbchat' && <DebtKBChat />}
      {tab === 'profile' && <DebtUserProfile debtCoachUser={user} onGoToCalls={() => setTab('calls')} />}
      {tab === 'stats' && <HotCallAnalytics />}
      {tab === 'compliance' && <CompliancePortal onBack={() => setTab('live')} />}
      {tab === 'admin' && isAdmin && <DebtCoachAdminPanel />}
      {tab === 'aicredits' && isSuperAdmin && <AICreditsTab />}
      {tab === 'aireports' && isAdmin && <AICostReportsTab />}
      </main>

      {/* WCR checklist accessible from header, no floating launcher */}
      <WCRChecklist username={user?.username} showLauncher={false} />

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