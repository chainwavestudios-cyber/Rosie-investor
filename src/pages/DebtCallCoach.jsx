/**
 * DebtCallCoach.jsx — Standalone debt settlement call coaching platform.
 * Tabs: Live Call (headset coaching + lead card) | Knowledge Base | User Profiles.
 */
import { useState, useEffect } from 'react';
import { Headphones, ClipboardCheck, ShieldCheck, LogOut, LayoutDashboard, Radio, Layers3 } from 'lucide-react';
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
import EmailFinderTab from '@/components/debt/EmailFinderTab';
import ProtoFaceTab from '@/components/debt/protoface/ProtoFaceTab';
import DebtBobTrainer from '@/components/debt/DebtBobTrainer';
import CallIntelligenceTab from '@/components/debt/CallIntelligenceTab';
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

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const headerBtn = {display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,padding:'9px 12px',borderRadius:8,fontSize:11,fontWeight:750,cursor:'pointer',whiteSpace:'nowrap'};

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
    <div data-debt-coach className="dcc-shell" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', minHeight: '100vh', background: 'radial-gradient(ellipse at 70% -8%,rgba(26,73,64,.23),transparent 53%),#080f1b', color: '#e8e0d0', padding: 'clamp(12px,2vw,26px)' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .dcc-shell button:focus-visible,.dcc-shell a:focus-visible{outline:2px solid #d9bb7a;outline-offset:3px}
        .dcc-shell .dcc-header{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;padding:16px 22px;border:1px solid rgba(154,198,188,.19);border-radius:15px;background:linear-gradient(115deg,#112331,#102b29 53%,#101b2b);box-shadow:0 12px 38px rgba(0,0,0,.15)}
        @media(max-width:720px){.dcc-shell .dcc-header{padding:14px}.dcc-shell .dcc-header-actions{width:100%;justify-content:flex-start!important}}
        @media(prefers-reduced-motion:reduce){.dcc-shell *{scroll-behavior:auto!important;animation-duration:.01ms!important}}
      `}</style>

      {/* Quiet admin-only milestone watcher: confetti only for newly completed audio. */}
      {isAdmin && <DebtGmailGoldMilestoneWatcher/>}

      {/* Dual clock bar — super admins see Eastern + Philippine Time */}
      {isSuperAdmin && (
        <div style={{ marginBottom: '12px' }}>
          <DualClockBar userTimezone="Asia/Manila" isSuperAdmin={true} />
        </div>
      )}

      {/* Calm, compact command header. No tools open automatically. */}
      <header className="dcc-header">
        <div style={{display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',minWidth:0}}>
          <img src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/cad8ccab3_UntitledOvalStickerLandscape.png" alt="Settlement IQ — Realtime Call Intelligence" style={{ width:'clamp(175px,20vw,260px)',maxWidth:'100%', height:'auto', objectFit:'contain' }} />
          <div style={{borderLeft:'1px solid rgba(224,193,126,.28)',paddingLeft:17}}>
            <div style={{color:'#dab879',fontWeight:800,letterSpacing:2,fontSize:10,textTransform:'uppercase'}}>Rosie AI · Agent workspace</div>
            <div style={{font:'normal clamp(18px,2vw,24px) Georgia,serif',color:'#f6f5ef',margin:'5px 0 3px'}}>Debt Call Coach</div>
            <span style={{fontSize:11,color:'#9cb7b2'}}>Live call intelligence &amp; follow-up</span>
          </div>
        </div>
        <div className="dcc-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap:'wrap',justifyContent:'flex-end' }}>
          <span title={liveCallActive?'Active live session':'Waiting for a live call'} style={{display:'inline-flex',alignItems:'center',gap:7,padding:'7px 11px',border:'1px solid '+(liveCallActive?'rgba(238,131,116,.46)':'rgba(83,161,138,.3)'),borderRadius:99,background:liveCallActive?'rgba(126,35,35,.2)':'rgba(26,90,75,.18)',color:liveCallActive?'#ffb19f':'#93ddc1',fontSize:10,fontWeight:800}}><Radio size={13}/>{liveCallActive?'LIVE SESSION':'WORKSPACE READY'}</span>
          <button onClick={() => window.dispatchEvent(new Event('coach_open_wcr'))} title="Open Welcome Call Review checklist" style={{...headerBtn,border:'1px solid #3a635b',background:'#203e38',color:'#c4ebd8'}}><ClipboardCheck size={15}/> WCR Checklist</button>
          <div style={{ textAlign: 'right',padding:'0 6px' }}>
            <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{user?.username}</span>
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '2px', background: 'rgba(16,185,129,0.15)', color: GOLD, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : user?.role === 'super_manager' ? 'Super Manager' : user?.role === 'manager' ? 'Manager' : user?.role === 'fronter' ? 'Fronter' : 'Dialer'}</span>
          </div>
          {isSuperManager && <button onClick={() => setShowCompliance(true)} style={{...headerBtn, background:'rgba(239,68,68,.09)',color:'#f3a69f',border:'1px solid rgba(239,68,68,.35)'}}><ShieldCheck size={14}/> Compliance</button>}
          {(isAdmin || isManager || isSuperManager) && (
            <button onClick={() => navigate('/manager-portal')} style={{...headerBtn,background:'rgba(77,163,135,.14)',color:'#a8eacc',border:'1px solid rgba(72,184,149,.39)'}}><LayoutDashboard size={14}/> Manager Portal</button>
          )}
          <button onClick={logout} style={{...headerBtn,background:'rgba(255,255,255,.035)',color:'#b3c4d0',border:'1px solid rgba(255,255,255,.15)'}}><LogOut size={14}/> Logout</button>
        </div>
      </header>

      {/* Every upcoming appointment, counting down live */}
      <AppointmentTimersBar onOpenLead={(lead) => setPipelineLead(lead)} />

      {/* Cross-portal switcher */}
      <PortalNavButtons current="coach" isAdmin={isAdmin || isSuperAdmin} />

      {/* Tabs — two rows; drag any tab to reorder (saved per user) */}
      <CoachTabBar rows={tabRows} tabMap={tabMap} active={tab} onSelect={setTab} onMove={moveTab} onReset={resetTabOrder} />

      {tab === 'live' && <DebtLiveCall debtCoachUser={user} onScriptContextChange={setScriptCallContext} onCallStart={(callLead) => { setLiveCallActive(true); if (callLead?.id) setClosingLeadId(callLead.id); }} onCallEnd={() => setLiveCallActive(false)} />}
      <PopOutTab storageKey="debt_scripts_tab" title="Scripts" icon="📜" active={tab === 'scripts'} defaultSize={{ width: 520, height: 720 }} zIndex={14600}>
        <DebtScriptsPanel username={user?.username} {...scriptCallContext} />
      </PopOutTab>
      <PopOutTab storageKey="closing_tab" title="Closing Flow" icon="🏁" active={tab === 'closing'} defaultSize={{ width: 460, height: 720 }} autoPopOut={liveCallActive} zIndex={14500}>
        <SmartClose leadId={closingLeadId} canEditPhones={!isDialerRole} canEditScripts={!isDialerRole} />
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
      {tab === 'emailfinder' && isAdmin && <EmailFinderTab />}
      {tab === 'engagement' && isAdmin && <DebtCoachGmailEngagementPanel />}
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