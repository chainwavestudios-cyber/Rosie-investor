import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { SignNowRequestDB, InvestorUser, ContactNoteDB, AppointmentDB, AccreditationDocDB } from '@/api/entities';
import { analytics } from '@/lib/analytics';
import { computeEngagementScore, getScoreColor, getScoreLabel } from '@/lib/engagementScore';
import RosieTab from '@/components/admin/RosieTab';
import PortalAccessTab from '@/components/admin/PortalAccessTab';
import DateTimePicker from '@/components/admin/DateTimePicker';
import InvestorAnalyticsTab from '@/components/admin/InvestorAnalyticsTab';
import InvestorWebsiteTab from '@/components/leads/InvestorWebsiteTab';
import ResearchTab from '@/components/leads/ResearchTab';
import ScriptAssistant from '@/components/leads/ScriptAssistant';
import ZoomBookingModal from '@/components/ZoomBookingModal';
import { useInlineDialer } from '@/hooks/useInlineDialer';
import InlineCallBar from '@/components/shared/InlineCallBar';
import CustomEmailTab from '@/components/shared/CustomEmailTab';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import { loadPortalSettings } from '@/lib/portalSettings';
import SetReminderButton from '@/components/SetReminderButton';
import ReminderCountdown from '@/components/ReminderCountdown';
import { useReminders } from '@/hooks/useReminders';
import CallLogPanel from '@/components/admin/CallLogPanel';
import SmsTab from '@/components/shared/SmsTab';
import { fmtDateTimeShort } from '@/lib/fmtDate.js';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const inp  = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };
const ls   = { display:'block', color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'5px' };

function F({ label, value, onChange, type='text', placeholder='' }) {
  return (
    <div style={{ marginBottom:'12px' }}>
      {label && <label style={ls}>{label}</label>}
      <input type={type} value={value??''} onChange={onChange} placeholder={placeholder} style={inp} />
    </div>
  );
}
function TA({ label, value, onChange, rows=3, placeholder='' }) {
  return (
    <div style={{ marginBottom:'12px' }}>
      {label && <label style={ls}>{label}</label>}
      <textarea value={value??''} onChange={onChange} rows={rows} placeholder={placeholder}
        style={{ ...inp, resize:'vertical', lineHeight:1.6, fontSize:'12px' }} />
    </div>
  );
}

// ── Tab row ───────────────────────────────────────────────────────────────────
function TabRow({ tabs, activeTab, onTab }) {
  return (
    <div style={{ display:'flex', overflowX:'auto', scrollbarWidth:'none' }}>
      {tabs.map(([id, label]) => (
        <button key={id} onClick={() => onTab(id)}
          style={{ background:'none', border:'none', borderBottom: activeTab===id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeTab===id ? GOLD : '#6b7280', padding:'9px 14px', cursor:'pointer', fontSize:'10px', letterSpacing:'0.5px', whiteSpace:'nowrap', flexShrink:0, transition:'color 0.15s' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function ContactCardModal({ user, onClose, onSave, allSessions }) {
  const { portalUser } = usePortalAuth();
  const currentUsername = portalUser?.username || 'admin';
  const { setReminder } = useReminders();

  const [tab, setTab]         = useState('overview');
  const [editing, setEditing] = useState(false);
  const [smsOptedIn, setSmsOptedIn] = useState(false);
  const [unreadSms, setUnreadSms] = useState(0);
  const [notes, setNotes]     = useState([]);
  const [appts, setAppts]     = useState([]);
  const [accDocs, setAccDocs] = useState([]);
  const [snReqs, setSnReqs]   = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats]     = useState({ sessionCount:0, totalTime:0, totalDownloads:0, totalDocViews:0 });
  const [loading, setLoading] = useState(true);
  const [noteForm, setNoteForm] = useState({ type:'note', content:'' });
  const [apptForm, setApptForm] = useState({ title:'', type:'call', scheduledAt:'', durationMinutes:30, notes:'' });
  const [editUser, setEditUser] = useState({ ...user });
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);
  const [showCallLog, setShowCallLog] = useState(false);
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackNote, setCallbackNote] = useState('');
  const [showZoom, setShowZoom] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [sendingPortalEmail, setSendingPortalEmail] = useState(false);
  const [portalEmailMsg, setPortalEmailMsg] = useState('');
  const [portalCfg, setPortalCfg] = useState({});

  const refreshNotes = async () => { setNotes(await ContactNoteDB.listForInvestor(user.id)); };
  const dialer = useInlineDialer({ onCallLogged: refreshNotes, agentName: currentUsername });

  useEffect(() => { loadPortalSettings().then(setPortalCfg).catch(() => {}); }, []);
  useEffect(() => { loadAll(); }, [user.id]);

  useEffect(() => {
    const check = async () => {
      try {
        const msgs = await base44.entities.SmsMessage.filter({ investorId: user.id, direction:'inbound', read:false }).catch(()=>[]);
        setUnreadSms((msgs||[]).length);
      } catch {}
    };
    check();
    const t = setInterval(check, 8000);
    return () => clearInterval(t);
  }, [user.id]);

  useEffect(() => {
    const checkOptIn = async () => {
      if (!user.phone) return;
      try {
        const records = await base44.entities.SmsOptIn.filter({ active: true });
        const norm = user.phone.replace(/[\s\-().]/g, '');
        setSmsOptedIn((records||[]).some(r => (r.phone||'').replace(/[\s\-().]/g,'') === norm));
      } catch {}
    };
    checkOptIn();
  }, [user.id, user.phone]);

  const loadAll = async () => {
    setLoading(true);
    const [ns, ap, ad, sn, sess] = await Promise.all([
      ContactNoteDB.listForInvestor(user.id),
      AppointmentDB.listForInvestor(user.id),
      AccreditationDocDB.listForInvestor(user.id),
      SignNowRequestDB.listForEmail(user.email),
      analytics.getUserSessions((user.email || user.username || '').toLowerCase().trim()),
    ]);
    setNotes(ns); setAppts(ap); setAccDocs(ad); setSnReqs(sn); setSessions(sess);
    setStats(analytics.computeUserStats(sess));
    setLoading(false);
  };

  const addNote = async () => {
    if (!noteForm.content.trim()) return;
    await ContactNoteDB.create({ investorId:user.id, investorEmail:user.email, type:noteForm.type, content:noteForm.content, createdBy:currentUsername });
    setNoteForm(prev => ({ ...prev, content:'' }));
    await refreshNotes();
  };

  const deleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    await ContactNoteDB.delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const addAppt = async () => {
    if (!apptForm.title || !apptForm.scheduledAt) return;
    await AppointmentDB.create({ investorId:user.id, investorEmail:user.email, investorName:user.name, ...apptForm, createdBy: currentUsername });
    setApptForm({ title:'', type:'call', scheduledAt:'', durationMinutes:30, notes:'' });
    setAppts(await AppointmentDB.listForInvestor(user.id));
  };

  const saveProfile = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const updates = {
        name:editUser.name, email:(editUser.email||'').toLowerCase(), phone:editUser.phone,
        address:editUser.address, company:editUser.company, investmentType:editUser.investmentType,
        iraInformation:editUser.iraInformation, notes:editUser.notes,
        signnowRequested:editUser.signnowRequested, status:editUser.status,
        investmentAmount:editUser.investmentAmount, investmentDate:editUser.investmentDate,
      };
      if (editUser.newPassword?.trim()) updates.password = editUser.newPassword.trim();
      await InvestorUser.update(user.id, updates);
      setSaveMsg('Saved ✓'); onSave();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch(e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
  };

  const markNotInterested = async () => {
    if (!window.confirm(`Mark ${user.name} as Not Interested?`)) return;
    await base44.entities.InvestorUser.update(user.id, { disposition: 'not_interested' });
    await ContactNoteDB.create({ investorId: user.id, investorEmail: user.email, type: 'note', content: `🚫 Marked as Not Interested by ${currentUsername}`, createdAt: new Date().toISOString(), createdBy: currentUsername });
    onSave(); onClose();
  };

  const scheduleCallback = async () => {
    if (!callbackDate) return;
    await base44.entities.InvestorUser.update(user.id, { disposition: 'callback', callbackAt: new Date(callbackDate).toISOString(), callbackNote });
    await ContactNoteDB.create({ investorId: user.id, investorEmail: user.email, type: 'note', content: `📅 Callback scheduled${callbackNote ? ' — ' + callbackNote : ''} for ${new Date(callbackDate).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · by ${currentUsername}`, createdAt: new Date().toISOString(), createdBy: currentUsername });
    setShowCallbackPicker(false); setCallbackDate(''); setCallbackNote('');
    onSave();
  };

  const sendEmail = async () => {
    if (!editUser.email) { setEmailMsg('No email on file.'); return; }
    setSendingEmail(true); setEmailMsg('');
    try {
      await base44.functions.invoke('sendLeadEmail', { investorId:user.id, toEmail:editUser.email, toName:user.name, firstName:user.name?.split(' ')[0], sentBy:currentUsername });
      setEmailMsg('✓ Sent!'); setTimeout(() => setEmailMsg(''), 3000);
    } catch(e) { setEmailMsg('Error: ' + (e.response?.data?.error || e.message)); }
    setSendingEmail(false);
  };

  const sendPortalEmail = async () => {
    if (!editUser.email) { setPortalEmailMsg('No email on file.'); return; }
    setSendingPortalEmail(true); setPortalEmailMsg('');
    try {
      const lastSlug = (user.name||'').toLowerCase().split(' ').pop().replace(/[^a-z]/g,'');
      const pw = user.username ? `${lastSlug}#2026` : '';
      const loginUrl = user.username ? `https://investors.rosieai.tech/portal-login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(pw)}` : '';
      await base44.functions.invoke('sendPortalAccessEmail', { investorId:user.id, leadId:user.leadId||null, toEmail:editUser.email, toName:user.name, firstName:user.name?.split(' ')[0], username:user.username, password:pw, loginUrl, sentBy:currentUsername });
      setPortalEmailMsg('✓ Portal email sent!'); setTimeout(() => setPortalEmailMsg(''), 4000);
    } catch(e) { setPortalEmailMsg('Error: ' + (e.response?.data?.error || e.message)); }
    setSendingPortalEmail(false);
  };

  const sc = user.engagementScore || 0;
  const scoreCol = getScoreColor(sc);

  const TABS_ROW1 = [
    ['overview', '👤 Overview'],
    ['history',  '📋 History'],
    ['email',    '✉️ Email'],
    ['sms',      unreadSms > 0 ? `💬 SMS (${unreadSms})` : '💬 SMS'],
    ['analytics','📊 Analytics'],
    ['calendar', '📅 Calendar'],
    ['portal',   '🔑 Portal'],
  ];
  const TABS_ROW2 = [
    ['documents',     '📄 Documents'],
    ['accreditation', '🔐 Accreditation'],
    ['rosie',         '🤖 Rosie AI'],
    ['sitestats',     '🌐 Site Stats'],
    ['research',      '🔍 Research'],
    ['script',        '📝 Script'],
  ];

  const noteTypeIcons = { note:'📝', call:'📞', sms:'💬', voicemail:'📳', email:'✉️' };
  const noteTypeColors = { note:'#c4cdd8', call:'#60a5fa', sms:'#4ade80', email:'#a78bfa', voicemail:'#f59e0b' };

  const visibleNotes = notes.filter(n => !['[Lead History','✅ Migrated','[Site Visits','[Email Log','[Appointment'].some(p => (n.content||'').startsWith(p)));

  const Btn = ({ onClick, children, color='#8a9ab8', bg='rgba(255,255,255,0.05)', border='rgba(255,255,255,0.12)', disabled=false, title='' }) => (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ background:bg, color, border:`1px solid ${border}`, borderRadius:'4px', padding:'5px 10px', cursor:disabled?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', whiteSpace:'nowrap', opacity:disabled?0.4:1 }}>
      {children}
    </button>
  );

  return (
    <>
    {/* Callback modal */}
    {showCallbackPicker && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10001 }}>
        <div style={{ background:'#0d1b2a', border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'6px', padding:'24px', width:'340px', boxShadow:'0 24px 80px rgba(0,0,0,0.9)' }}>
          <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>📅 Schedule Callback</div>
          <F label="Date & Time" value={callbackDate} onChange={e=>setCallbackDate(e.target.value)} type="datetime-local" />
          <F label="Note (optional)" value={callbackNote} onChange={e=>setCallbackNote(e.target.value)} placeholder="What to discuss…" />
          <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
            <button onClick={scheduleCallback} disabled={!callbackDate}
              style={{ flex:1, background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'9px', cursor:'pointer', fontWeight:'700', fontSize:'11px', opacity:callbackDate?1:0.4 }}>
              Save Callback
            </button>
            <button onClick={() => setShowCallbackPicker(false)}
              style={{ padding:'9px 14px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', cursor:'pointer', fontSize:'12px' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {showZoom && <ZoomBookingModal isOpen={showZoom} onClose={() => setShowZoom(false)} buttonLabel="Book Zoom Call" zoomUrl={portalCfg?.zoomBookingUrl || 'https://scheduler.zoom.us'} />}

    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
      <div style={{ background:'#0d1b2a', border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'6px', width:'100%', maxWidth:'1000px', maxHeight:'94vh', display:'flex', flexDirection:'column', boxShadow:'0 40px 120px rgba(0,0,0,0.9)' }}>

        {/* ── HEADER ── */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.25)', flexShrink:0 }}>

          {/* Row 1: Name + badges + score + close */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                <span style={{ color:'#e8e0d0', fontSize:'20px', fontFamily:'Georgia,serif' }}>{user.name}</span>
                {smsOptedIn && <span style={{ background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.35)', borderRadius:'10px', padding:'2px 8px', color:'#4ade80', fontSize:'10px' }}>💬 SMS ✓</span>}
                {/* Status pills — clickable */}
                {['prospect','investor'].map(s => (
                  <button key={s} onClick={() => { setEditUser(prev=>({...prev,status:s})); base44.entities.InvestorUser.update(user.id,{status:s}).then(onSave).catch(()=>{}); }}
                    style={{ background: editUser.status===s?(s==='investor'?'rgba(74,222,128,0.15)':'rgba(167,139,250,0.15)'):'transparent', border:`1.5px solid ${editUser.status===s?(s==='investor'?'rgba(74,222,128,0.5)':'rgba(167,139,250,0.5)'):'rgba(255,255,255,0.15)'}`, borderRadius:'20px', color:editUser.status===s?(s==='investor'?'#4ade80':'#a78bfa'):'#6b7280', padding:'4px 11px', cursor:'pointer', fontSize:'11px', fontWeight:editUser.status===s?'bold':'normal', whiteSpace:'nowrap' }}>
                    {s==='prospect'?'🔷 Potential':'✅ Investor'}
                  </button>
                ))}
                {user.disposition === 'not_interested' && <span style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'10px', padding:'2px 8px', fontSize:'10px' }}>🚫 Not Interested</span>}
                {user.disposition === 'callback' && user.callbackAt && <span style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'10px', padding:'2px 8px', fontSize:'10px' }}>📅 {new Date(user.callbackAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
              </div>
              <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'3px' }}>@{user.username} · {user.email}</div>
            </div>
            {/* Score + close */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'5px', background:`${scoreCol}15`, border:`1px solid ${scoreCol}44`, borderRadius:'20px', padding:'4px 10px' }}>
                <div style={{ width:'20px', height:'20px', borderRadius:'50%', border:`2px solid ${scoreCol}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ color:scoreCol, fontSize:'8px', fontWeight:'bold' }}>{sc}</span>
                </div>
                <span style={{ color:scoreCol, fontSize:'10px' }}>{getScoreLabel(sc)}</span>
              </div>
              <button onClick={onClose} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#6b7280', cursor:'pointer', fontSize:'18px', width:'30px', height:'30px', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          </div>

          {/* Row 2: Inline call bar */}
          {user.phone && (
            <div style={{ marginBottom:'10px' }}>
              <InlineCallBar
                phone={editUser.phone || user.phone}
                name={user.name || ''}
                dialer={dialer}
                onLogCall={refreshNotes}
                showCallLog={showCallLog}
                onToggleCallLog={() => setShowCallLog(v => !v)}
              />
            </div>
          )}

          {/* Row 3: Action buttons */}
          <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center' }}>
            <Btn onClick={sendEmail} disabled={sendingEmail||!editUser.email} color='#60a5fa' bg='rgba(96,165,250,0.12)' border='rgba(96,165,250,0.25)' title="Send investor site access email">
              {sendingEmail ? '⏳' : '💼 Site Access'}
            </Btn>
            <Btn onClick={sendPortalEmail} disabled={sendingPortalEmail||!editUser.email} color='#a78bfa' bg='rgba(167,139,250,0.12)' border='rgba(167,139,250,0.25)' title="Send portal credentials">
              {sendingPortalEmail ? '⏳' : '🔐 Portal Email'}
            </Btn>
            <Btn onClick={() => setShowZoom(true)} color='#60a5fa' bg='rgba(96,165,250,0.08)' border='rgba(96,165,250,0.2)'>📅 Zoom</Btn>
            <Btn onClick={() => setShowCallbackPicker(true)} color='#f59e0b' bg='rgba(245,158,11,0.1)' border='rgba(245,158,11,0.25)'>📅 Callback</Btn>
            <Btn onClick={markNotInterested} color='#ef4444' bg='rgba(239,68,68,0.08)' border='rgba(239,68,68,0.2)'>🚫 Not Interested</Btn>
            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <SetReminderButton contact={{ id:user.id, firstName:user.name?.split(' ')[0]||user.name, lastName:user.name?.split(' ').slice(1).join(' ')||'', type:'investor' }} onSetReminder={setReminder} />
              <ReminderCountdown contactId={user.id} />
            </div>
            {!user.phone && (
              <Btn onClick={() => setShowCallLog(v=>!v)} color={showCallLog?'#60a5fa':'#8a9ab8'} bg={showCallLog?'rgba(96,165,250,0.12)':'rgba(255,255,255,0.05)'} border={showCallLog?'rgba(96,165,250,0.35)':'rgba(255,255,255,0.1)'}>
                📋 Call Log
              </Btn>
            )}
            {(emailMsg||portalEmailMsg) && <span style={{ fontSize:'10px', color:(emailMsg||portalEmailMsg).startsWith('Error')?'#ef4444':'#4ade80' }}>{emailMsg||portalEmailMsg}</span>}
          </div>
        </div>

        {/* ── DOUBLE-STACKED TABS ── */}
        <div style={{ borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <TabRow tabs={TABS_ROW1} activeTab={tab} onTab={setTab} />
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
            <TabRow tabs={TABS_ROW2} activeTab={tab} onTab={setTab} />
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div>
              {/* Read view */}
              {!editing && (
                <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px', padding:'14px 16px', marginBottom:'16px', position:'relative' }}>
                  <button onClick={() => setEditing(true)}
                    style={{ position:'absolute', top:'12px', right:'12px', background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}>
                    ✏️ Edit
                  </button>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'8px 20px', marginBottom:'12px' }}>
                    {[
                      ['👤 Name',      editUser.name],
                      ['✉️ Email',     editUser.email],
                      ['📞 Phone',     editUser.phone],
                      ['🏢 Company',   editUser.company],
                      ['🏠 Address',   editUser.address],
                      ['💳 Acct',      editUser.investmentType==='ira'?'IRA':'Cash'],
                      ['💰 Invested',  editUser.investmentAmount?`$${Number(editUser.investmentAmount).toLocaleString()}`:null],
                      ['📅 Inv. Date', editUser.investmentDate],
                      ['✍️ SignNow',   editUser.signnowRequested?'✓ Requested':null],
                    ].filter(([,v])=>v).map(([label, value]) => (
                      <div key={label}>
                        <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'2px' }}>{label}</div>
                        <div style={{ color:'#c4cdd8', fontSize:'12px' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {editUser.iraInformation && (
                    <div style={{ marginBottom:'8px' }}>
                      <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'2px' }}>🏦 IRA Info</div>
                      <div style={{ color:'#8a9ab8', fontSize:'12px' }}>{editUser.iraInformation}</div>
                    </div>
                  )}
                  {editUser.notes && (
                    <div style={{ paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'3px' }}>📋 Internal Notes</div>
                      <div style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{editUser.notes}</div>
                    </div>
                  )}
                  {/* Stats strip */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginTop:'12px', paddingTop:'10px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                    {[[stats.sessionCount,'Sessions',GOLD],[analytics.formatDuration(stats.totalTime),'Time','#4ade80'],[stats.totalDownloads,'Downloads','#60a5fa']].map(([v,l,c]) => (
                      <div key={l} style={{ background:'rgba(0,0,0,0.2)', borderRadius:'4px', padding:'8px', textAlign:'center' }}>
                        <div style={{ color:c, fontSize:'15px', fontWeight:'bold' }}>{v}</div>
                        <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit view */}
              {editing && (
                <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'6px', padding:'16px', marginBottom:'16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                    <span style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase' }}>Edit Contact</span>
                    <button onClick={() => { setEditing(false); setEditUser({...user}); }}
                      style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'11px' }}>Cancel</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                    <div>
                      <div style={{ color:GOLD, fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Contact Details</div>
                      <div style={{ marginBottom:'12px' }}>
                        <label style={ls}>Status</label>
                        <div style={{ display:'flex', gap:'6px' }}>
                          {['prospect','investor'].map(s => (
                            <button key={s} onClick={() => setEditUser({...editUser,status:s})}
                              style={{ flex:1, padding:'7px', border:`1px solid ${editUser.status===s?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'4px', background:editUser.status===s?'rgba(184,147,58,0.15)':'transparent', color:editUser.status===s?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px' }}>
                              {s==='prospect'?'🔷 Potential':'✅ Investor'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <F label="Full Name"       value={editUser.name}    onChange={e=>setEditUser({...editUser,name:e.target.value})} />
                      <F label="Email"           value={editUser.email}   onChange={e=>setEditUser({...editUser,email:e.target.value})} type="email" />
                      <F label="Phone"           value={editUser.phone}   onChange={e=>setEditUser({...editUser,phone:e.target.value})} />
                      <F label="Company / Fund"  value={editUser.company} onChange={e=>setEditUser({...editUser,company:e.target.value})} />
                      <F label="Mailing Address" value={editUser.address} onChange={e=>setEditUser({...editUser,address:e.target.value})} />
                      <div style={{ marginBottom:'12px' }}>
                        <label style={ls}>Account Type</label>
                        <select value={editUser.investmentType||'cash'} onChange={e=>setEditUser({...editUser,investmentType:e.target.value})} style={{ ...inp, cursor:'pointer' }}>
                          <option value="cash">Cash</option><option value="ira">IRA</option>
                        </select>
                      </div>
                      {editUser.investmentType === 'ira' && (
                        <TA label="IRA Information" value={editUser.iraInformation} onChange={e=>setEditUser({...editUser,iraInformation:e.target.value})} rows={2} placeholder="Custodian, account #…" />
                      )}
                      <F label="New Password (blank = keep)" value={editUser.newPassword||''} onChange={e=>setEditUser({...editUser,newPassword:e.target.value})} placeholder="••••••••" />
                    </div>
                    <div>
                      <div style={{ color:GOLD, fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Investment Details</div>
                      <F label="Investment Amount ($)" value={editUser.investmentAmount} onChange={e=>setEditUser({...editUser,investmentAmount:e.target.value})} type="number" placeholder="50000" />
                      <F label="Date Invested" value={editUser.investmentDate} onChange={e=>setEditUser({...editUser,investmentDate:e.target.value})} type="date" />
                      <div style={{ marginBottom:'12px' }}>
                        <label style={ls}>Signature Docs Requested</label>
                        <button onClick={() => setEditUser({...editUser,signnowRequested:!editUser.signnowRequested})}
                          style={{ width:'44px', height:'24px', borderRadius:'12px', border:'none', cursor:'pointer', background:editUser.signnowRequested?'linear-gradient(135deg,#b8933a,#d4aa50)':'rgba(255,255,255,0.1)', position:'relative' }}>
                          <div style={{ position:'absolute', top:'3px', left:editUser.signnowRequested?'23px':'3px', width:'18px', height:'18px', background:'#fff', borderRadius:'50%', transition:'left 0.2s' }} />
                        </button>
                      </div>
                      <TA label="Internal Notes" value={editUser.notes} onChange={e=>setEditUser({...editUser,notes:e.target.value})} rows={4} placeholder="Private notes…" />
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'10px', alignItems:'center', paddingTop:'12px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                    <button onClick={async () => { await saveProfile(); setEditing(false); }} disabled={saving}
                      style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'9px 24px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', letterSpacing:'1.5px', textTransform:'uppercase' }}>
                      {saving ? 'Saving…' : '💾 Save Changes'}
                    </button>
                    <button onClick={() => { setEditing(false); setEditUser({...user}); }}
                      style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'9px 14px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
                    {saveMsg && <span style={{ color:saveMsg.startsWith('Error')?'#ef4444':'#4ade80', fontSize:'12px' }}>{saveMsg}</span>}
                  </div>
                </div>
              )}

              {/* Notes & Activity */}
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'14px' }}>
                <div style={{ color:GOLD, fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Notes & Activity</div>
                <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
                  <select value={noteForm.type} onChange={e=>setNoteForm({...noteForm,type:e.target.value})}
                    style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'7px 8px', color:'#8a9ab8', fontSize:'11px', outline:'none', cursor:'pointer', flexShrink:0 }}>
                    <option value="note">📝 Note</option><option value="call">📞 Call</option>
                    <option value="sms">💬 SMS</option><option value="email">✉️ Email</option>
                    <option value="voicemail">📳 Voicemail</option>
                  </select>
                  <input value={noteForm.content} onChange={e=>setNoteForm({...noteForm,content:e.target.value})}
                    onKeyDown={e=>e.key==='Enter'&&addNote()}
                    placeholder="Add a note and press Enter…"
                    style={{ flex:1, ...inp }} />
                  <button onClick={addNote}
                    style={{ background:'rgba(184,147,58,0.15)', border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'4px', padding:'7px 14px', color:GOLD, cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                    + Add
                  </button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'260px', overflowY:'auto', paddingRight:'2px' }}>
                  {loading && <p style={{ color:'#4a5568', textAlign:'center', padding:'16px', fontSize:'12px' }}>Loading…</p>}
                  {!loading && visibleNotes.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'16px', fontSize:'12px' }}>No notes or activity yet.</p>}
                  {visibleNotes.map(n => (
                    <div key={n.id} style={{ display:'flex', gap:'8px', alignItems:'flex-start', padding:'8px 10px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:'4px' }}>
                      <span style={{ fontSize:'12px', flexShrink:0, marginTop:'1px' }}>{noteTypeIcons[n.type]||'📝'}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
                          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                            <span style={{ color:noteTypeColors[n.type]||'#6b7280', fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{n.type}</span>
                            {n.createdBy && <span style={{ color:'#6b7280', fontSize:'10px' }}>· {n.createdBy}</span>}
                          </div>
                          <span style={{ color:'#4a5568', fontSize:'10px', whiteSpace:'nowrap' }}>{n.createdAt ? fmtDateTimeShort(n.createdAt) : ''}</span>
                        </div>
                        <div style={{ color:'#c8d0dc', fontSize:'12px', marginTop:'2px', lineHeight:1.5, wordBreak:'break-word' }}>{n.content}</div>
                      </div>
                      <button onClick={()=>deleteNote(n.id)} style={{ background:'none', border:'none', color:'#374151', cursor:'pointer', fontSize:'14px', padding:'0 2px', flexShrink:0 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* HISTORY */}
          {tab === 'history' && (
            <div>
              <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'14px 16px', marginBottom:'20px' }}>
                <div style={{ color:GOLD, fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Log Interaction</div>
                <div style={{ display:'flex', gap:'6px', marginBottom:'10px', flexWrap:'wrap' }}>
                  {Object.entries(noteTypeIcons).map(([t,icon]) => (
                    <button key={t} onClick={() => setNoteForm({...noteForm,type:t})}
                      style={{ padding:'6px 12px', background:noteForm.type===t?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${noteForm.type===t?GOLD:'rgba(255,255,255,0.1)'}`, borderRadius:'4px', color:noteForm.type===t?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px' }}>
                      {icon} {t.charAt(0).toUpperCase()+t.slice(1)}
                    </button>
                  ))}
                </div>
                <TA value={noteForm.content} onChange={e=>setNoteForm({...noteForm,content:e.target.value})} placeholder={`Add ${noteForm.type} details…`} rows={2} />
                <button onClick={addNote} disabled={!noteForm.content.trim()}
                  style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'8px 20px', cursor:'pointer', fontWeight:'bold', fontSize:'11px', letterSpacing:'1.5px', textTransform:'uppercase' }}>
                  Add to History
                </button>
              </div>
              {loading && <p style={{ color:'#6b7280', textAlign:'center' }}>Loading…</p>}
              {!loading && notes.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'32px' }}>No history yet.</p>}
              {[...notes].sort((a,b)=>new Date(b.createdAt||b.created_date||0)-new Date(a.createdAt||a.created_date||0)).map((note, i, arr) => {
                const isMigrated = (note.content||'').startsWith('[From Lead History');
                const icon = isMigrated ? '📋' : (noteTypeIcons[note.type]||'📝');
                return (
                  <div key={note.id} style={{ display:'flex', gap:'12px', marginBottom:'14px' }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'22px', flexShrink:0 }}>
                      <div style={{ fontSize:'16px' }}>{icon}</div>
                      {i < arr.length-1 && <div style={{ width:'1px', flex:1, background:'rgba(255,255,255,0.06)', marginTop:'4px' }} />}
                    </div>
                    <div style={{ flex:1, background:isMigrated?'rgba(96,165,250,0.04)':'rgba(255,255,255,0.02)', border:`1px solid ${isMigrated?'rgba(96,165,250,0.15)':'rgba(255,255,255,0.06)'}`, borderRadius:'4px', padding:'12px 14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'5px' }}>
                        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                          <span style={{ color:isMigrated?'#60a5fa':GOLD, fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{isMigrated?'Lead History':note.type}</span>
                          {!isMigrated && note.createdBy && <span style={{ color:'#6b7280', fontSize:'10px' }}>· {note.createdBy}</span>}
                        </div>
                        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                          <span style={{ color:'#4a5568', fontSize:'10px' }}>{note.createdAt ? fmtDateTimeShort(note.createdAt) : ''}</span>
                          {!isMigrated && <button onClick={()=>deleteNote(note.id)} style={{ background:'none', border:'none', color:'#ef444488', cursor:'pointer', fontSize:'14px', padding:'0' }}>×</button>}
                        </div>
                      </div>
                      <p style={{ color:isMigrated?'#8a9ab8':'#c4cdd8', fontSize:'12px', margin:0, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{note.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'sms' && <SmsTab toPhone={user.phone||''} toName={user.name} leadId={user.leadId||null} investorId={user.id} sentBy={currentUsername} />}
          {tab === 'analytics' && <InvestorAnalyticsTab user={editUser} sessions={sessions} stats={stats} />}
          {tab === 'email' && <CustomEmailTab toEmail={user.email} toName={user.name} leadId={user.leadId||null} investorId={user.id} sentBy={currentUsername} onSent={loadAll} />}
          {tab === 'portal'    && <PortalAccessTab user={user} onClose={onClose} onSave={onSave} />}
          {tab === 'rosie'     && <RosieTab user={user} />}
          {tab === 'sitestats' && <InvestorWebsiteTab user={user} />}
          {tab === 'research'  && <ResearchTab user={user} />}
          {tab === 'script'    && <ScriptAssistant user={user} />}

          {/* DOCUMENTS */}
          {tab === 'documents' && (
            <div>
              <div style={{ color:GOLD, fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>SignNow Documents Sent</div>
              {loading && <p style={{ color:'#6b7280' }}>Loading…</p>}
              {!loading && snReqs.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No documents sent yet.</p>}
              {snReqs.map(req => {
                let docs = []; try { docs = JSON.parse(req.documents||'[]'); } catch {}
                const sc2 = { pending:'#f59e0b', sent:'#60a5fa', completed:'#4ade80', declined:'#ef4444', error:'#ef4444' };
                return (
                  <div key={req.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'16px', marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                      <div style={{ color:'#e8e0d0', fontSize:'13px' }}>Sent {req.sentAt ? new Date(req.sentAt).toLocaleDateString() : ''}</div>
                      <span style={{ color:sc2[req.status]||'#f59e0b', fontSize:'11px', textTransform:'uppercase' }}>● {req.status}</span>
                    </div>
                    {docs.map((d,i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderTop:'1px solid rgba(255,255,255,0.04)', fontSize:'12px' }}>
                        <span style={{ color:'#8a9ab8' }}>📄 {d.name}</span>
                        <span style={{ color:sc2[d.status]||'#f59e0b' }}>{d.status}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* ACCREDITATION */}
          {tab === 'accreditation' && (
            <div>
              <div style={{ color:GOLD, fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Accreditation Documents</div>
              {loading && <p style={{ color:'#6b7280' }}>Loading…</p>}
              {!loading && accDocs.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No accreditation documents yet.</p>}
              {accDocs.map(doc => {
                const sc3 = { pending:'#f59e0b', under_review:'#60a5fa', approved:'#4ade80', rejected:'#ef4444' };
                return (
                  <div key={doc.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'16px', marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                      <div>
                        <div style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'13px' }}>{doc.fileName}</div>
                        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'2px' }}>{doc.docType?.replace('_',' ')} · {doc.uploadedAt?new Date(doc.uploadedAt).toLocaleDateString():''}</div>
                      </div>
                      <span style={{ color:sc3[doc.status]||'#f59e0b', fontSize:'11px', textTransform:'uppercase' }}>● {doc.status}</span>
                    </div>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {['pending','under_review','approved','rejected'].map(s => (
                        <button key={s} onClick={async()=>{ await AccreditationDocDB.updateStatus(doc.id,s,doc.adminNotes); setAccDocs(await AccreditationDocDB.listForInvestor(user.id)); }}
                          style={{ padding:'4px 8px', background:doc.status===s?`${sc3[s]}22`:'transparent', border:`1px solid ${doc.status===s?sc3[s]:'rgba(255,255,255,0.1)'}`, borderRadius:'4px', color:doc.status===s?sc3[s]:'#4a5568', cursor:'pointer', fontSize:'10px', textTransform:'uppercase' }}>
                          {s.replace('_',' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CALENDAR */}
          {tab === 'calendar' && (
            <div>
              <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'16px', marginBottom:'20px' }}>
                <div style={{ color:GOLD, fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>📅 Book Appointment</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px' }}>
                  <F label="Title" value={apptForm.title} onChange={e=>setApptForm({...apptForm,title:e.target.value})} placeholder="Intro Call, Follow-up…" />
                  <div style={{ marginBottom:'12px' }}>
                    <label style={ls}>Type</label>
                    <select value={apptForm.type} onChange={e=>setApptForm({...apptForm,type:e.target.value})} style={{ ...inp, cursor:'pointer' }}>
                      {['call','meeting','follow-up','demo','other'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px' }}>
                  <DateTimePicker label="Date & Time" value={apptForm.scheduledAt} onChange={iso=>setApptForm(f=>({...f,scheduledAt:iso}))} />
                  <div style={{ marginBottom:'12px' }}>
                    <label style={ls}>Duration</label>
                    <select value={apptForm.durationMinutes} onChange={e=>setApptForm({...apptForm,durationMinutes:Number(e.target.value)})} style={{ ...inp, cursor:'pointer' }}>
                      {[15,30,45,60,90,120].map(d=><option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>
                </div>
                <TA label="Notes" value={apptForm.notes} onChange={e=>setApptForm({...apptForm,notes:e.target.value})} rows={2} placeholder="Agenda, talking points…" />
                <button onClick={addAppt} disabled={!apptForm.title||!apptForm.scheduledAt}
                  style={{ background:(!apptForm.title||!apptForm.scheduledAt)?'rgba(184,147,58,0.3)':'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'8px 20px', cursor:(!apptForm.title||!apptForm.scheduledAt)?'not-allowed':'pointer', fontWeight:'bold', fontSize:'11px', letterSpacing:'1.5px', textTransform:'uppercase' }}>
                  Book Appointment
                </button>
              </div>
              {loading && <p style={{ color:'#6b7280' }}>Loading…</p>}
              {!loading && appts.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'32px' }}>No appointments yet.</p>}
              {appts.map(appt => {
                const sc4 = { scheduled:GOLD, completed:'#4ade80', cancelled:'#4a5568', 'no-show':'#ef4444' };
                const isPast = new Date(appt.scheduledAt) < new Date();
                return (
                  <div key={appt.id} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${isPast?'rgba(255,255,255,0.05)':'rgba(184,147,58,0.2)'}`, borderRadius:'4px', padding:'14px', marginBottom:'10px', opacity:isPast?0.7:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'13px', marginBottom:'3px' }}>{appt.title}</div>
                        <div style={{ color:'#8a9ab8', fontSize:'11px' }}>{appt.scheduledAt?new Date(appt.scheduledAt).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):''} · {appt.durationMinutes}m</div>
                        {appt.notes && <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'3px' }}>{appt.notes}</div>}
                      </div>
                      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        <select value={appt.status||'scheduled'} onChange={async e=>{await AppointmentDB.update(appt.id,{status:e.target.value});setAppts(await AppointmentDB.listForInvestor(user.id));}}
                          style={{ ...inp, width:'auto', fontSize:'11px', padding:'3px 6px', color:sc4[appt.status||'scheduled'] }}>
                          {['scheduled','completed','cancelled','no-show'].map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={async()=>{if(window.confirm('Delete?')){await AppointmentDB.delete(appt.id);setAppts(prev=>prev.filter(a=>a.id!==appt.id));}}}
                          style={{ background:'none', border:'none', color:'#ef444480', cursor:'pointer', fontSize:'16px' }}>×</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>

    {showCallLog && <CallLogPanel onClose={() => setShowCallLog(false)} onOpenLead={() => {}} />}
    </>
  );
}