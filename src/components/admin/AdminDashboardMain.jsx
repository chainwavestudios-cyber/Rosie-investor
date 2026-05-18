/**
 * AdminDashboardMain — the main AdminDashboard component.
 * Split out to keep AdminDashboard page under the 2000-line limit.
 * Contains: VIEWS list, AdminDashboard default export.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import { useTwilioDevice } from '@/lib/TwilioDeviceContext';
import analytics from '@/lib/analytics';
import ReminderPopup from '@/components/ReminderPopup';
import { useReminders } from '@/hooks/useReminders';
import { loadPortalSettings } from '@/lib/portalSettings';
import { SignNowRequestDB } from '@/api/entities';
import { getScoreColor, getScoreLabel } from '@/lib/engagementScore';
import LeadsTab from '@/components/leads/LeadsTab';
import TwilioDialer from '@/components/leads/TwilioDialer';
import ProspectPipeline from '@/components/admin/ProspectPipeline';
import UpcomingReminders from '@/components/admin/UpcomingReminders';
import RecentInvestorEvents from '@/components/admin/RecentInvestorEvents';
import ContactCardModal from '@/components/admin/ContactCardModal';
import { base44 } from '@/api/base44Client';
import MarketingTab from '@/components/leads/MarketingTab';
import KnowledgeBaseManagerComponent from '@/components/admin/KnowledgeBaseManager';
import GlobalCalendar from '@/components/admin/GlobalCalendar';
import BobTab from '@/components/admin/BobTab';
import IncomingCallPopup from '@/components/shared/IncomingCallPopup';
import CallLogPanel from '@/components/admin/CallLogPanel';
import AdminChatWindow from '@/components/admin/AdminChatWindow';
import AdminAlertPopup from '@/components/admin/AdminAlertPopup';
import { MOCK_LEADS, MOCK_INVESTORS } from '@/lib/mockData';

// These are passed in as props from the page (to avoid duplication)
// Props: { AddUserForm, SignNowRequestsView, SignNowSettings, PortalControls, AdminSettings, AudioRecorderManager, IntentEngineTuner, CoachRulesTuner }

const LOGO = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png';
const GOLD = '#b8933a';
const DARK = '#0a0f1e';

function StatusBadge({ status }) {
  const isInvestor = status === 'investor';
  return (
    <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:'2px', background:isInvestor?'rgba(74,222,128,0.12)':'rgba(167,139,250,0.12)', color:isInvestor?'#4ade80':'#a78bfa', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', whiteSpace:'nowrap' }}>
      {isInvestor ? '✅ Investor' : '🔷 Potential Investor'}
    </span>
  );
}

const VIEWS = [
  { id:'users',    label:'CRM / Clients' },
  { id:'leads',    label:'Leads' },
  { id:'calendar', label:'Calendar' },
  { id:'analytics',label:'Analytics' },
  { id:'activity', label:'Recent Activity' },
  { id:'marketing', label:'📣 Marketing' },
  { id:'kb',       label:'🧠 Knowledge Base' },
  { id:'signnow',  label:'SignNow Requests' },
  { id:'portal',   label:'Portal Controls' },
  { id:'signnow-settings', label:'SignNow Settings' },
  { id:'settings', label:'Admin Settings' },
  { id:'bob', label:'🤖 B.O.B.' },
];

export default function AdminDashboardMain({
  AddUserForm, SignNowRequestsView, SignNowSettings, PortalControls, AdminSettings,
  IntentEngineTuner, CoachRulesTuner,
}) {
  const { portalUser, isAdmin, isPortalLoading, portalLogout, getAllUsers, removeUser, changeAdminPassword, changeAdminUsername } = usePortalAuth();
  const { registerIncomingHandler } = useTwilioDevice();
  const [view, setView]           = useState(() => localStorage.getItem('admin_view') || 'users');
  const [users, setUsers]         = useState([]);
  const [showAdd, setShowAdd]     = useState(false);
  const { dueReminder, dismissReminder } = useReminders();
  const [contactCard, setContactCard] = useState(null);
  const [openLeadId,  setOpenLeadId]  = useState(null);
  const [allSessions, setAllSessions] = useState([]);
  const [globalStats, setGlobalStats] = useState({ totalSessions:0, totalTime:0, totalDownloads:0, totalDocViews:0 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDisposition, setFilterDisposition] = useState('active');
  const [portalSettings, setPortalSettings] = useState({});
  const [dialerLead, setDialerLead] = useState(null);
  const [showDialer, setShowDialer] = useState(false);
  const [crmSidebar, setCrmSidebar] = useState('investors');
  const [activityFilter, setActivityFilter] = useState('all');
  const [newSignNowCount, setNewSignNowCount] = useState(0);
  const [signNowAlertDismissed, setSignNowAlertDismissed] = useState(() => parseInt(localStorage.getItem('sn_dismissed_count') || '0'));
  const [showCallLog, setShowCallLog] = useState(false);
  const [callLogBadge, setCallLogBadge] = useState({ vm: 0, missed: 0 });
  const [showChat, setShowChat] = useState(false);
  const navigate = useNavigate();

  const currentUsername = portalUser?.username || 'admin';

  const handleViewChange = (v) => { setView(v); localStorage.setItem('admin_view', v); };

  const matchesUser = useCallback((session, user) => {
    const n = v => (v||'').toLowerCase().trim();
    return (n(user.email) && n(session.userEmail) && n(session.userEmail)===n(user.email))
        || (n(user.username) && n(session.username) && n(session.username)===n(user.username));
  }, []);

  const isMockUser = !!portalUser?.isMockUser;

  const load = useCallback(async () => {
    if (isMockUser) { setUsers(MOCK_INVESTORS); setPortalSettings({}); return; }
    try {
      const [usersData, sessions, ps] = await Promise.all([getAllUsers(), analytics.getAllSessions(), loadPortalSettings()]);
      setUsers(usersData); setAllSessions(sessions); setPortalSettings(ps);
      const global = await analytics.computeGlobalStats(sessions); setGlobalStats(global);
      try {
        const snReqs = await SignNowRequestDB.listAll();
        const dismissed = parseInt(localStorage.getItem('sn_dismissed_count') || '0');
        setNewSignNowCount(Math.max(0, snReqs.length - dismissed));
      } catch {}
      try {
        const callLogs = await base44.entities.CallLog.list('-calledAt', 100);
        const vmCount = (callLogs || []).filter(l => l.vmRecordingUrl && !l.vmListened).length;
        const missedCount = (callLogs || []).filter(l => (l.status === 'missed' || l.status === 'no-answer') && !l.dismissed).length;
        setCallLogBadge({ vm: vmCount, missed: missedCount });
      } catch {}
    } catch(e) { console.error('[Admin] load error:', e); }
  }, [getAllUsers, isMockUser]);

  useEffect(() => {
    if (isPortalLoading) return;
    if (!portalUser || !isAdmin) { navigate('/admin-login'); return; }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [portalUser, isAdmin, isPortalLoading, load]);

  useEffect(() => {
    registerIncomingHandler(() => {});
  }, [registerIncomingHandler]);

  if (isPortalLoading) return (
    <div style={{ minHeight:'100vh', background:'#060c18', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'32px', height:'32px', border:'3px solid rgba(184,147,58,0.2)', borderTop:'3px solid #b8933a', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!portalUser || !isAdmin) return null;

  const nonAdminUsers  = users.filter(u => u.role !== 'admin');
  const filteredUsers  = nonAdminUsers.filter(u => {
    const statusMatch = filterStatus === 'all' || (u.status||'prospect') === filterStatus;
    const disp = u.disposition || 'active';
    const dispMatch = filterDisposition === 'all' || disp === filterDisposition;
    return statusMatch && dispMatch;
  });
  const recentSessions = allSessions.filter(s=>s.startTime).sort((a,b)=>new Date(b.startTime)-new Date(a.startTime)).slice(0,15);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const openInvestorById = (investorId) => {
    const u = users.find(u => u.id === investorId);
    if (u) setContactCard(u);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#060c18', fontFamily:'Georgia, serif', color:'#e8e0d0' }}>
      <nav style={{ background:DARK, borderBottom:'1px solid rgba(184,147,58,0.2)', position:'sticky', top:0, zIndex:200 }}>
        <div style={{ padding:isMobile ? '0 12px' : '0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px', gap:'8px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
            <img src={LOGO} alt="Rosie AI" style={{ height:'28px', width:'auto' }} />
            {!isMobile && <><div style={{ width:'1px', height:'16px', background:'rgba(184,147,58,0.3)' }} /><span style={{ color:GOLD, fontSize:'8px', letterSpacing:'3px', textTransform:'uppercase' }}>Admin Dashboard</span></>}
          </div>
          {!isMobile && (
            <div style={{ display:'flex', alignItems:'center', gap:'0', flex:1, justifyContent:'center' }}>
              {[
                { label:'Clients',   value:nonAdminUsers.length,                                                icon:'👥', color:GOLD      },
                { label:'Investors', value:nonAdminUsers.filter(u=>u.status==='investor').length,               icon:'✅', color:'#4ade80' },
                { label:'Prospects', value:nonAdminUsers.filter(u=>(u.status||'prospect')==='prospect').length, icon:'🔷', color:'#a78bfa' },
                { label:'Sessions',  value:globalStats.totalSessions,                                           icon:'🔐', color:'#f59e0b' },
                { label:'Time',      value:analytics.formatDuration(globalStats.totalTime),                     icon:'⏱',  color:'#a78bfa' },
              ].map(({label,value,icon,color}) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 12px', borderRight:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
                  <span style={{ fontSize:'11px' }}>{icon}</span>
                  <div>
                    <div style={{ color, fontSize:'13px', fontWeight:'bold', lineHeight:1.1 }}>{value}</div>
                    <div style={{ color:'#4a5568', fontSize:'7px', letterSpacing:'1px', textTransform:'uppercase' }}>{label}</div>
                  </div>
                </div>
              ))}
              {/* SignNow */}
              <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 12px', flexShrink:0, background: newSignNowCount > 0 ? 'rgba(245,158,11,0.1)' : 'transparent', borderRadius:'3px' }}>
                <span style={{ fontSize:'11px' }}>✍️</span>
                <div>
                  <div style={{ color: newSignNowCount > 0 ? '#f59e0b' : '#4a5568', fontSize:'13px', fontWeight:'bold', lineHeight:1.1 }}>{newSignNowCount}</div>
                  <div style={{ color:'#4a5568', fontSize:'7px', letterSpacing:'1px', textTransform:'uppercase' }}>SignNow</div>
                </div>
                {newSignNowCount > 0 && (
                  <button onClick={() => { SignNowRequestDB.listAll().then(reqs => { localStorage.setItem('sn_dismissed_count', reqs.length); setNewSignNowCount(0); setSignNowAlertDismissed(reqs.length); }); }}
                    style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'2px', padding:'1px 5px', cursor:'pointer', fontSize:'7px', marginLeft:'2px' }}>
                    Clear
                  </button>
                )}
              </div>
              {/* Call Log */}
              <div onClick={() => setShowCallLog(v => !v)}
                style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 12px', flexShrink:0, cursor:'pointer', background: showCallLog ? 'rgba(96,165,250,0.12)' : (callLogBadge.vm > 0 || callLogBadge.missed > 0) ? 'rgba(239,68,68,0.08)' : 'transparent', borderRadius:'3px', border: showCallLog ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent', transition:'all 0.15s' }}>
                <span style={{ fontSize:'11px' }}>📋</span>
                <div>
                  <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                    {callLogBadge.vm > 0 && <span style={{ background:'rgba(245,158,11,0.2)', color:'#f59e0b', fontSize:'9px', padding:'0px 4px', borderRadius:'8px', fontWeight:'bold' }}>📩{callLogBadge.vm}</span>}
                    {callLogBadge.missed > 0 && <span style={{ background:'rgba(239,68,68,0.2)', color:'#ef4444', fontSize:'9px', padding:'0px 4px', borderRadius:'8px', fontWeight:'bold' }}>📵{callLogBadge.missed}</span>}
                    {callLogBadge.vm === 0 && callLogBadge.missed === 0 && <span style={{ color:'#4a5568', fontSize:'13px', fontWeight:'bold', lineHeight:1.1 }}>0</span>}
                  </div>
                  <div style={{ color:'#4a5568', fontSize:'7px', letterSpacing:'1px', textTransform:'uppercase' }}>Calls</div>
                </div>
              </div>
              {/* 💬 Chat button */}
              <div onClick={() => setShowChat(v => !v)}
                style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 12px', flexShrink:0, cursor:'pointer', background: showChat ? 'rgba(184,147,58,0.15)' : 'transparent', borderRadius:'3px', border: showChat ? `1px solid rgba(184,147,58,0.4)` : '1px solid transparent', transition:'all 0.15s' }}>
                <span style={{ fontSize:'11px' }}>💬</span>
                <div>
                  <div style={{ color: showChat ? GOLD : '#4a5568', fontSize:'13px', fontWeight:'bold', lineHeight:1.1 }}>Chat</div>
                  <div style={{ color:'#4a5568', fontSize:'7px', letterSpacing:'1px', textTransform:'uppercase' }}>Internal</div>
                </div>
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
            <button onClick={load} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'10px' }}>↻</button>
            <button onClick={() => navigate('/portal')} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'10px' }}>Portal</button>
            <button onClick={() => { portalLogout(); navigate('/'); }} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'10px' }}>Logout</button>
          </div>
        </div>
        <div style={{ display:'flex', overflowX:'auto', borderTop:'1px solid rgba(255,255,255,0.05)', scrollbarWidth:'none' }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => handleViewChange(v.id)}
              style={{ background:'none', border:'none', borderBottom:view===v.id?`2px solid ${GOLD}`:'2px solid transparent', color:view===v.id?GOLD:'#6b7280', padding:isMobile?'8px 10px':'10px 18px', cursor:'pointer', fontSize:isMobile?'9px':'11px', letterSpacing:'1px', whiteSpace:'nowrap', flexShrink:0, transition:'color 0.15s' }}>
              {v.label}
            </button>
          ))}
        </div>
      </nav>

      {isMockUser && (
        <div style={{ background:'rgba(99,102,241,0.1)', borderBottom:'1px solid rgba(99,102,241,0.25)', padding:'7px 32px', display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'13px' }}>💡</span>
          <span style={{ color:'#818cf8', fontSize:'11px', letterSpacing:'0.5px' }}>NB Tech Demo Mode — displaying sample data only.</span>
        </div>
      )}

      <div style={{ maxWidth:'1600px', margin:'0 auto', padding:isMobile?'12px 16px':'24px 32px' }}>
        {view === 'users' && (
          <UpcomingReminders
            onOpenLeadCard={(lead) => { handleViewChange('leads'); setOpenLeadId(lead.id); }}
            onOpenUserCard={(investorId) => openInvestorById(investorId)}
            onOpenDialer={(lead) => { setDialerLead(lead); setShowDialer(true); }}
          />
        )}

        {showAdd && <AddUserForm onAdd={load} onClose={() => setShowAdd(false)} />}
        {contactCard && (
          <ContactCardModal
            user={contactCard}
            onClose={() => setContactCard(null)}
            onSave={load}
            allSessions={allSessions}
            matchesUser={matchesUser}
          />
        )}
        {showDialer && (
          <TwilioDialer
            initialLead={dialerLead}
            onClose={() => { setShowDialer(false); setDialerLead(null); }}
            onCallLogged={() => {}}
          />
        )}

        {/* ── CRM ── */}
        {view === 'users' && (
          <div style={{ display:'flex', gap:'0' }}>
            <div style={{ width:'190px', flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ padding:'0 0 12px 0' }}>
                {[{ id:'investors', icon:'👥', label:'Investors' }, { id:'activity', icon:'⚡', label:'Investor Activity' }].map(item => (
                  <button key={item.id} onClick={() => setCrmSidebar(item.id)}
                    style={{ display:'block', width:'100%', textAlign:'left', background: crmSidebar===item.id ? 'rgba(184,147,58,0.1)' : 'transparent', border:'none', borderLeft: crmSidebar===item.id ? `3px solid ${GOLD}` : '3px solid transparent', padding:'10px 14px', color: crmSidebar===item.id ? GOLD : '#6b7280', fontSize:'12px', cursor:'pointer', letterSpacing:'0.5px', transition:'all 0.15s' }}>
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
              {crmSidebar === 'activity' && (
                <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>Filter</div>
                  {[['all','All Activity'],['login','🔐 Portal Logins'],['rosie','🤖 Rosie AI'],['download','📥 Downloads'],['offering','📄 Offering Read'],['sub_agreement','✍️ Sub Agreement'],['questionnaire','📋 Questionnaire']].map(([id, label]) => (
                    <button key={id} onClick={() => setActivityFilter(id)}
                      style={{ display:'block', width:'100%', textAlign:'left', background: activityFilter===id ? 'rgba(255,255,255,0.06)' : 'transparent', border:'none', borderRadius:'2px', padding:'6px 10px', color: activityFilter===id ? '#e8e0d0' : '#4a5568', fontSize:'11px', cursor:'pointer', marginBottom:'2px' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex:1, paddingLeft:'24px', minWidth:0 }}>
              {crmSidebar === 'investors' && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
                    <div />
                    <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                        {[['all','All'],['prospect','Potential Investors'],['investor','Investors']].map(([s,l]) => (
                          <button key={s} onClick={() => setFilterStatus(s)}
                            style={{ padding:'7px 14px', background:filterStatus===s?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.05)', border:`1px solid ${filterStatus===s?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', color:filterStatus===s?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>{l}</button>
                        ))}
                        <div style={{ width:'1px', background:'rgba(255,255,255,0.08)', margin:'0 4px' }} />
                        {[['active','Active'],['callback','📅 Callbacks'],['not_interested','🚫 Not Interested'],['all','Show All']].map(([d,l]) => (
                          <button key={d} onClick={() => setFilterDisposition(d)}
                            style={{ padding:'7px 14px', background:filterDisposition===d?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.05)', border:`1px solid ${filterDisposition===d?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', color:filterDisposition===d?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>{l}</button>
                        ))}
                      </div>
                      {filterStatus !== 'prospect' && (
                        <button onClick={() => setShowAdd(true)} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'8px 18px', cursor:'pointer', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', fontWeight:'700' }}>+ Add Client</button>
                      )}
                    </div>
                  </div>
                  {filterStatus === 'prospect' ? (
                    <ProspectPipeline
                      users={nonAdminUsers.filter(u => (u.status||'prospect') === 'prospect')}
                      onOpenCard={(user) => setContactCard(user)}
                      onOpenDialer={(user) => { setDialerLead({ firstName: user.name, lastName: '', phone: user.phone, id: user.id }); setShowDialer(true); }}
                      onAddExisting={() => setShowAdd(true)}
                      onRefresh={load}
                    />
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                        <thead>
                          <tr style={{ borderBottom:'2px solid rgba(184,147,58,0.3)' }}>
                            {['Status','Name','Score','Contact','Sessions','Last Active',''].map(h => (
                              <th key={h} style={{ color:GOLD, padding:'10px 12px', textAlign:'left', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.map(user => {
                            const us = allSessions.filter(s => matchesUser(s, user));
                            const st = analytics.computeUserStats(us);
                            const status = user.status || 'prospect';
                            return (
                              <tr key={user.username||user.email} onClick={() => setContactCard(user)}
                                style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', transition:'background 0.1s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td style={{ padding:'14px 12px' }}>
                                  <StatusBadge status={status} />
                                  {user.disposition === 'not_interested' && <div style={{ marginTop:'4px', color:'#ef4444', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase' }}>🚫 Not Interested</div>}
                                  {user.disposition === 'callback' && user.callbackAt && <div style={{ marginTop:'4px', color:'#f59e0b', fontSize:'9px', letterSpacing:'1px' }}>📅 {new Date(user.callbackAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>}
                                </td>
                                <td style={{ padding:'14px 12px' }}>
                                  <div style={{ color:'#e8e0d0', fontWeight:'bold' }}>{user.name}</div>
                                  <div style={{ color:'#4a5568', fontSize:'11px', fontFamily:'monospace' }}>@{user.username}</div>
                                </td>
                                <td style={{ padding:'14px 12px' }}>
                                  {(() => {
                                    const sc = user.engagementScore || 0;
                                    const col = getScoreColor(sc);
                                    return (
                                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                        <div style={{ width:'28px', height:'28px', borderRadius:'50%', border:`2px solid ${col}`, display:'flex', alignItems:'center', justifyContent:'center', background:`${col}15` }}>
                                          <span style={{ color:col, fontSize:'10px', fontWeight:'bold' }}>{sc}</span>
                                        </div>
                                        <span style={{ color:col, fontSize:'11px' }}>{getScoreLabel(sc)}</span>
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td style={{ padding:'14px 12px' }}>
                                  <div style={{ color:'#8a9ab8', fontSize:'12px' }}>{user.email||'—'}</div>
                                  {user.phone ? (
                                    <button onClick={e => { e.stopPropagation(); setDialerLead({ firstName: user.name, lastName: '', phone: user.phone, id: user.id }); setShowDialer(true); }}
                                      style={{ background:'rgba(74,222,128,0.08)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.2)', borderRadius:'2px', padding:'2px 8px', cursor:'pointer', fontSize:'11px', fontFamily:'monospace', marginTop:'2px' }}>
                                      📞 {user.phone}
                                    </button>
                                  ) : <div style={{ color:'#6b7280', fontSize:'12px' }}>—</div>}
                                </td>
                                <td style={{ padding:'14px 12px', color:'#60a5fa', fontWeight:'bold' }}>{st.sessionCount}</td>
                                <td style={{ padding:'14px 12px', color:'#6b7280', fontSize:'12px' }}>{analytics.formatDate(st.lastSeen)}</td>
                                <td style={{ padding:'14px 12px' }}>
                                  <div style={{ display:'flex', gap:'6px' }}>
                                    <button onClick={e => { e.stopPropagation(); setContactCard(user); }} style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', padding:'5px 12px', cursor:'pointer', fontSize:'11px' }}>Open Card →</button>
                                    {user.role !== 'admin' && <button onClick={e => { e.stopPropagation(); if(window.confirm(`Remove ${user.name}?`)){ removeUser(user.email||user.username); load(); } }} style={{ background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'11px' }}>✕</button>}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredUsers.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No clients found.</p>}
                    </div>
                  )}
                </div>
              )}
              {crmSidebar === 'activity' && (
                <RecentInvestorEvents filter={activityFilter} onOpenUserCard={openInvestorById} />
              )}
            </div>
          </div>
        )}

        {view === 'calendar' && <GlobalCalendar users={users} setContactCard={setContactCard} setView={handleViewChange} setOpenLeadId={setOpenLeadId} />}

        {view === 'analytics' && (() => {
          const ranked = nonAdminUsers.map(user => {
            const us = allSessions.filter(s => matchesUser(s, user));
            const st = analytics.computeUserStats(us);
            return { user, us, st, score: user.engagementScore || 0 };
          }).sort((a, b) => b.score - a.score);
          const top10 = ranked.slice(0, 10);
          return (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
                <div>
                  <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>Engagement Analytics</h2>
                  <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>Top 10 most active investors ranked by engagement score.</p>
                </div>
              </div>
              {nonAdminUsers.length === 0 ? <p style={{ color:'#4a5568', textAlign:'center', padding:'60px' }}>No users yet.</p> :
                top10.map(({ user, us, st, score }, rank) => {
                  const col = getScoreColor(score);
                  const medals = ['🥇','🥈','🥉'];
                  return (
                    <div key={user.username||user.email}
                      style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${rank===0?'rgba(184,147,58,0.35)':'rgba(255,255,255,0.08)'}`, borderRadius:'4px', padding:'18px 22px', marginBottom:'10px', cursor:'pointer', transition:'background 0.15s' }}
                      onClick={() => setContactCard(user)}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                          <div style={{ width:'32px', textAlign:'center', fontSize:'20px', flexShrink:0 }}>{medals[rank] || <span style={{ color:'#4a5568', fontSize:'14px', fontWeight:'bold' }}>#{rank+1}</span>}</div>
                          <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:`${col}20`, border:`2px solid ${col}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>{(user.name||'?')[0].toUpperCase()}</div>
                          <div>
                            <div style={{ color:'#e8e0d0', fontSize:'15px', fontWeight:'bold' }}>{user.name}</div>
                            <div style={{ color:'#4a5568', fontSize:'11px' }}>@{user.username} · {analytics.formatDate(st.lastSeen)}</div>
                          </div>
                          <StatusBadge status={user.status||'prospect'} />
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', background:`${col}15`, border:`1px solid ${col}44`, borderRadius:'20px', padding:'6px 14px' }}>
                          <div style={{ width:'26px', height:'26px', borderRadius:'50%', border:`2px solid ${col}`, display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:col, fontSize:'10px', fontWeight:'bold' }}>{score}</span></div>
                          <span style={{ color:col, fontSize:'13px', fontWeight:'bold' }}>{getScoreLabel(score)}</span>
                        </div>
                        <div style={{ display:'flex', gap:'20px' }}>
                          {[[st.sessionCount,'Logins',GOLD],[analytics.formatDuration(st.totalTime),'Time','#4ade80'],[st.totalDownloads,'Downloads','#60a5fa'],[st.totalDocViews,'Doc Views','#f59e0b']].map(([v,l,c]) => (
                            <div key={l} style={{ textAlign:'center' }}>
                              <div style={{ color:c, fontWeight:'bold', fontSize:'16px' }}>{v}</div>
                              <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginTop:'1px' }}>{l}</div>
                            </div>
                          ))}
                        </div>
                        <span style={{ color:GOLD, fontSize:'11px' }}>Open Card →</span>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          );
        })()}

        {view === 'activity' && (
          <div>
            <h2 style={{ color:'#e8e0d0', margin:'0 0 8px', fontSize:'20px', fontWeight:'normal' }}>Recent Activity</h2>
            <div style={{ background:'rgba(184,147,58,0.08)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'8px', padding:'12px 18px', marginBottom:'18px', color:GOLD, fontSize:'13px', fontWeight:'bold' }}>💸 You've earned it — spend the $ anywhere you want! 🎉</div>
            {recentSessions.length === 0 ? <p style={{ color:'#4a5568', textAlign:'center', padding:'60px' }}>No activity yet.</p> :
              recentSessions.map((sess, i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'18px 20px', marginBottom:'8px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
                  <div>
                    <div style={{ color:'#e8e0d0', fontWeight:'bold', marginBottom:'3px' }}>{sess.userName||sess.userEmail} <span style={{ color:'#4a5568', fontWeight:'normal', fontFamily:'monospace', fontSize:'12px' }}>@{sess.username}</span></div>
                    <div style={{ color:'#6b7280', fontSize:'12px' }}>{analytics.formatDateTime(sess.startTime)}</div>
                    <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'4px', display:'flex', gap:'12px' }}>
                      <span>📄 {sess.pages?.length||0} pages</span><span>📥 {sess.downloads?.length||0} downloads</span>
                      {!sess.endTime && <span style={{ color:'#4ade80' }}>● Active</span>}
                    </div>
                  </div>
                  <div style={{ color:GOLD, fontWeight:'bold', fontSize:'16px' }}>{analytics.formatDuration(sess.durationSeconds)}</div>
                </div>
              ))
            }
          </div>
        )}

        {view === 'leads'            && <LeadsTab openLeadId={openLeadId} onLeadOpened={() => setOpenLeadId(null)} mockLeads={isMockUser ? MOCK_LEADS : null} />}
        {view === 'marketing'        && <MarketingTab />}
        {view === 'kb'               && <KnowledgeBaseManagerComponent IntentEngineTuner={IntentEngineTuner} CoachRulesTuner={CoachRulesTuner} />}
        {view === 'signnow'          && <SignNowRequestsView settings={portalSettings} />}
        {view === 'signnow-settings' && <SignNowSettings settings={portalSettings} onSettingsSaved={s => setPortalSettings(s)} />}
        {view === 'portal'           && <div><div style={{ marginBottom:'28px' }}><h2 style={{ color:'#e8e0d0', margin:'0 0 6px', fontSize:'20px', fontWeight:'normal' }}>Portal Controls</h2></div><PortalControls /></div>}
        {view === 'settings'         && <AdminSettings changeAdminPassword={changeAdminPassword} changeAdminUsername={changeAdminUsername} />}
        {view === 'bob'              && <BobTab />}
      </div>

      {showCallLog && <CallLogPanel onClose={() => setShowCallLog(false)} onOpenLead={(leadId) => { handleViewChange('leads'); setOpenLeadId(leadId); setShowCallLog(false); }} />}
      <IncomingCallPopup
        onAnswerInvestor={(investor) => { setContactCard(investor); }}
        onAnswerLead={(lead) => { handleViewChange('leads'); setOpenLeadId(lead.id); }}
        onCreateLead={(lead) => { handleViewChange('leads'); setOpenLeadId(lead.id); }}
      />
      {dueReminder && (
        <ReminderPopup
          reminder={dueReminder}
          onDismiss={dismissReminder}
          onOpenCard={() => {
            if (dueReminder.type === 'lead') { handleViewChange('leads'); setOpenLeadId(dueReminder.contactId); }
            else if (dueReminder.type === 'investor') { openInvestorById(dueReminder.contactId); }
            dismissReminder();
          }}
        />
      )}

      {/* ── Admin Chat Window ── */}
      {showChat && (
        <AdminChatWindow
          currentUsername={currentUsername}
          onOpenLeadCard={(leadId) => { handleViewChange('leads'); setOpenLeadId(leadId); }}
          onOpenInvestorCard={(investorId) => openInvestorById(investorId)}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* ── Alert Popup — always listening ── */}
      <AdminAlertPopup
        currentUsername={currentUsername}
        onOpenChat={() => setShowChat(true)}
      />
    </div>
  );
}