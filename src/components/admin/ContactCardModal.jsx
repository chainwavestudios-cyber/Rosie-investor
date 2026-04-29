import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { SignNowRequestDB, InvestorUser, ContactNoteDB, AppointmentDB, AccreditationDocDB } from '@/api/entities';
import analytics from '@/lib/analytics';
import { computeEngagementScore, getScoreColor, getScoreLabel } from '@/lib/engagementScore';
import RosieTab from '@/components/admin/RosieTab';
import PortalAccessTab from '@/components/admin/PortalAccessTab';
import DateTimePicker from '@/components/admin/DateTimePicker';
import InvestorAnalyticsTab from '@/components/admin/InvestorAnalyticsTab';
import InvestorWebsiteTab from '@/components/leads/InvestorWebsiteTab';
import ResearchTab from '@/components/leads/ResearchTab';
import ScriptAssistant from '@/components/leads/ScriptAssistant';
import TwilioDialer from '@/components/leads/TwilioDialer';
import ZoomBookingModal from '@/components/ZoomBookingModal';
import { useInlineDialer } from '@/hooks/useInlineDialer';
import InlineCallBar from '@/components/shared/InlineCallBar';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls   = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inp  = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

function F({ label, value, onChange, type='text', placeholder='', mono=false }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      {label && <label style={ls}>{label}</label>}
      <input type={type} value={value??''} onChange={onChange} placeholder={placeholder}
        style={{ ...inp, fontFamily:mono?'monospace':'Georgia, serif', fontSize:mono?'12px':'14px' }} />
    </div>
  );
}
function TA({ label, value, onChange, rows=4, placeholder='' }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      {label && <label style={ls}>{label}</label>}
      <textarea value={value??''} onChange={onChange} rows={rows} placeholder={placeholder}
        style={{ ...inp, resize:'vertical', lineHeight:1.6, fontSize:'13px' }} />
    </div>
  );
}

function StatusBadge({ status }) {
  const isInvestor = status === 'investor';
  return (
    <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:'2px', background:isInvestor?'rgba(74,222,128,0.12)':'rgba(167,139,250,0.12)', color:isInvestor?'#4ade80':'#a78bfa', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', whiteSpace:'nowrap' }}>
      {isInvestor ? '✅ Investor' : '🔷 Potential Investor'}
    </span>
  );
}

export default function ContactCardModal({ user, onClose, onSave, allSessions, matchesUser }) {
  const [tab, setTab]         = useState('overview');
  const [notes, setNotes]     = useState([]);
  const [appts, setAppts]     = useState([]);
  const [accDocs, setAccDocs] = useState([]);
  const [snReqs, setSnReqs]   = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats]     = useState({ sessionCount:0, totalTime:0, totalDownloads:0, totalDocViews:0, logins:[] });
  const [loading, setLoading] = useState(true);
  const [noteForm, setNoteForm] = useState({ type:'note', content:'' });
  const [apptForm, setApptForm] = useState({ title:'', type:'call', scheduledAt:'', durationMinutes:30, notes:'' });
  const [editUser, setEditUser] = useState({ ...user });
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [dialerLead, setDialerLead] = useState(null);
  const [showDialerLocal, setShowDialerLocal] = useState(false);

  // dialer hook initialized below after handleCallLogged

  const [showZoom, setShowZoom] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [sendingPortalEmail, setSendingPortalEmail] = useState(false);
  const [portalEmailMsg, setPortalEmailMsg] = useState('');
  const [viewedTabs, setViewedTabs] = useState(() => {
    try { return JSON.parse(user.lastViewedTabs || '{}'); } catch { return {}; }
  });

  const markTabViewed = async (tabId) => {
    const now = new Date().toISOString();
    const updated = { ...viewedTabs, [tabId]: now };
    setViewedTabs(updated);
    try { await base44.entities.InvestorUser.update(user.id, { lastViewedTabs: JSON.stringify(updated) }); } catch {}
  };

  const tabHasNew = (tabId) => {
    if (!user.lastActivityAt) return false;
    const lastViewed = viewedTabs[tabId];
    if (!lastViewed) return true;
    return new Date(user.lastActivityAt) > new Date(lastViewed);
  };

  useEffect(() => { loadAll(); }, [user.id]);

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
    try {
      const rosieCount = await base44.entities.RosieChatLog.filter({ investorId: user.id });
      const hasRosie = rosieCount.length > 0;
      const hasSignNow = sn.some(r => r.status !== 'pending');
      const newScore = computeEngagementScore(sess, hasSignNow, hasRosie);
      if (newScore !== user.engagementScore) {
        await base44.entities.InvestorUser.update(user.id, { engagementScore: newScore });
      }
    } catch {}
    setLoading(false);
  };

  const addNote = async () => {
    if (!noteForm.content.trim()) return;
    await ContactNoteDB.create({ investorId:user.id, investorEmail:user.email, type:noteForm.type, content:noteForm.content, createdBy:'admin' });
    setNoteForm({ type:'note', content:'' });
    setNotes(await ContactNoteDB.listForInvestor(user.id));
  };

  const deleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    await ContactNoteDB.delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const addAppt = async () => {
    if (!apptForm.title || !apptForm.scheduledAt) return;
    await AppointmentDB.create({ investorId:user.id, investorEmail:user.email, investorName:user.name, ...apptForm });
    setApptForm({ title:'', type:'call', scheduledAt:'', durationMinutes:30, notes:'' });
    setAppts(await AppointmentDB.listForInvestor(user.id));
  };

  const saveProfile = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const updates = { name:editUser.name, email:(editUser.email||'').toLowerCase(), phone:editUser.phone, address:editUser.address,
        company:editUser.company, investmentType:editUser.investmentType, iraInformation:editUser.iraInformation,
        notes:editUser.notes, signnowRequested:editUser.signnowRequested, status:editUser.status,
        investmentAmount:editUser.investmentAmount, investmentDate:editUser.investmentDate };
      if (editUser.newPassword?.trim()) updates.password = editUser.newPassword.trim();
      await InvestorUser.update(user.id, updates);
      setSaveMsg('Saved ✓'); onSave();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch(e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
  };

  const downloadAccDoc = (doc) => {
    const link = document.createElement('a');
    link.href = `data:${doc.mimeType};base64,${doc.fileData}`;
    link.download = doc.fileName;
    link.click();
  };

  const handleCallLogged = async () => {
    try {
      await ContactNoteDB.create({ investorId: user.id, investorEmail: user.email, type: 'call', content: `Outbound call via Twilio dialer`, createdBy: 'admin' });
      setNotes(await ContactNoteDB.listForInvestor(user.id));
    } catch {}
  }

  // ── Inline dialer ───────────────────────────────────────────────────
  const dialer = useInlineDialer({ onCallLogged: handleCallLogged });
;

  const sendEmail = async () => {
    if (!editUser.email) { setEmailMsg('No email address on file.'); return; }
    setSendingEmail(true); setEmailMsg('');
    try {
      await base44.functions.invoke('sendLeadEmail', { investorId: user.id, toEmail: editUser.email, toName: user.name, firstName: user.name.split(' ')[0] });
      setEmailMsg('✓ Email sent!');
      setTimeout(() => setEmailMsg(''), 3000);
    } catch (e) { setEmailMsg('Error: ' + (e.response?.data?.error || e.message)); }
    setSendingEmail(false);
  };

  const sendPortalEmail = async () => {
    if (!editUser.email) { setPortalEmailMsg('No email on file.'); return; }
    setSendingPortalEmail(true); setPortalEmailMsg('');
    try {
      const lastSlug = (user.name || '').toLowerCase().split(' ').pop().replace(/[^a-z]/g, '');
      const pw = user.username ? `${lastSlug}#2026` : '';
      const portalLoginUrl = user.username ? `https://investors.rosieai.tech/portal-login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(pw)}` : '';
      await base44.functions.invoke('sendPortalAccessEmail', {
        investorId: user.id,
        leadId:     user.leadId || null,
        toEmail:    editUser.email,
        toName:     user.name,
        firstName:  user.name.split(' ')[0],
        username:   user.username,
        password:   pw,
        loginUrl:   portalLoginUrl,
      });
      setPortalEmailMsg('✓ Portal access email sent!');
      setTimeout(() => setPortalEmailMsg(''), 4000);
    } catch (e) { setPortalEmailMsg('Error: ' + (e.response?.data?.error || e.message)); }
    setSendingPortalEmail(false);
  };

  const TABS = [
    ['overview','👤 Overview'], ['history','📞 History'], ['analytics','📊 Analytics'],
    ['documents','📄 Documents'], ['accreditation','🔐 Accreditation'], ['calendar','📅 Calendar'],
    ['portal','🔑 Portal Access'], ['rosie','🤖 Rosie AI'], ['sitestats','📊 Site Stats'], ['research','🔍 Research'], ['script','📝 Script'],
  ];

  const noteTypeIcons = { note:'📝', call:'📞', sms:'💬', voicemail:'📳', email:'✉️' };

  return (
    <>
{/* TwilioDialer replaced by InlineCallBar below */}
    {showZoom && (
      <ZoomBookingModal isOpen={showZoom} onClose={() => setShowZoom(false)} buttonLabel="Book Zoom Call" zoomUrl="https://scheduler.zoom.us/stephani-sterling" />
    )}
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', width:'100%', maxWidth:'900px', maxHeight:'94vh', display:'flex', flexDirection:'column', boxShadow:'0 40px 120px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ padding:'20px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, background:'rgba(0,0,0,0.2)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
            <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:`linear-gradient(135deg,${GOLD}44,${GOLD}22)`, border:`2px solid ${GOLD}66`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>
              {(user.name||'?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ color:'#e8e0d0', fontSize:'18px', fontFamily:'Georgia,serif' }}>{user.name}</div>
              <div style={{ color:'#6b7280', fontSize:'12px', marginTop:'2px' }}>@{user.username} · {user.email}</div>
            </div>
            <StatusBadge status={user.status || 'prospect'} />
            {(() => {
              const sc = user.engagementScore || 0;
              const col = getScoreColor(sc);
              return (
                <div style={{ display:'flex', alignItems:'center', gap:'6px', background:`${col}15`, border:`1px solid ${col}44`, borderRadius:'20px', padding:'4px 10px' }}>
                  <div style={{ width:'22px', height:'22px', borderRadius:'50%', border:`2px solid ${col}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ color:col, fontSize:'9px', fontWeight:'bold' }}>{sc}</span>
                  </div>
                  <span style={{ color:col, fontSize:'11px', letterSpacing:'0.5px' }}>{getScoreLabel(sc)}</span>
                </div>
              );
            })()}
          </div>
          <div style={{ display:'flex', gap:'5px', alignItems:'center', flexWrap:'wrap' }}>
            <button onClick={sendEmail} disabled={sendingEmail || !editUser.email}
              title="Sends investor site access code + consumer ref URL"
              style={{ background:'rgba(96,165,250,0.12)', color:editUser.email?'#60a5fa':'#4a5568', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'5px 8px', cursor:editUser.email?'pointer':'not-allowed', fontSize:'10px', fontWeight:'bold', opacity:editUser.email?1:0.5, whiteSpace:'nowrap' }}>
              {sendingEmail ? '⏳' : '💼'} Site
            </button>
            <button onClick={sendPortalEmail} disabled={sendingPortalEmail || !editUser.email}
              title="Sends portal username + password"
              style={{ background:'rgba(167,139,250,0.12)', color:editUser.email?'#a78bfa':'#4a5568', border:'1px solid rgba(167,139,250,0.3)', borderRadius:'2px', padding:'5px 8px', cursor:editUser.email?'pointer':'not-allowed', fontSize:'10px', fontWeight:'bold', opacity:editUser.email?1:0.5, whiteSpace:'nowrap' }}>
              {sendingPortalEmail ? '⏳' : '🔐'} Portal
            </button>
            {(emailMsg || portalEmailMsg) && <span style={{ fontSize:'10px', color:(emailMsg||portalEmailMsg).startsWith('Error')?'#ef4444':'#4ade80', maxWidth:'100px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emailMsg || portalEmailMsg}</span>}
            <button onClick={() => setShowZoom(true)} style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'5px 8px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
              📅 Zoom
            </button>
            {user.phone && (
              <div style={{ width: '100%', marginTop: '4px' }}>
                <InlineCallBar
                  phone={user.phone}
                  name={user.name || ''}
                  dialer={dialer}
                  onLogCall={() => dialer.logInvestorCall(user.id, user.email)}
                />
              </div>
            )}
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#6b7280', cursor:'pointer', fontSize:'18px', width:'30px', height:'30px', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', overflowX:'auto', flexShrink:0 }}>
          {TABS.map(([id,label]) => {
            const hasNew = tabHasNew(id) && id !== tab;
            return (
              <button key={id} onClick={() => { setTab(id); markTabViewed(id); }}
                style={{ background:'none', border:'none', borderBottom:tab===id?`2px solid ${GOLD}`:'2px solid transparent', color:tab===id?GOLD:'#6b7280', padding:'10px 12px', cursor:'pointer', fontSize:'10px', letterSpacing:'0.5px', whiteSpace:'nowrap', position:'relative' }}>
                {label}
                {hasNew && <span style={{ position:'absolute', top:'6px', right:'4px', width:'6px', height:'6px', borderRadius:'50%', background:'#ef4444', display:'block' }} />}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px' }}>
              <div>
                <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Contact Details</div>
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>Status</label>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {['prospect','investor'].map(s => (
                      <button key={s} onClick={() => setEditUser({...editUser,status:s})}
                        style={{ flex:1, padding:'9px', border:`1px solid ${editUser.status===s?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', background:editUser.status===s?'rgba(184,147,58,0.15)':'transparent', color:editUser.status===s?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', textTransform:'uppercase', letterSpacing:'2px' }}>
                        {s==='prospect'?'🔷 Potential Investor':'✅ Investor'}
                      </button>
                    ))}
                  </div>
                </div>
                <F label="Full Name" value={editUser.name} onChange={e=>setEditUser({...editUser,name:e.target.value})} />
                <F label="Email" value={editUser.email} onChange={e=>setEditUser({...editUser,email:e.target.value})} type="email" />
                <F label="Phone" value={editUser.phone} onChange={e=>setEditUser({...editUser,phone:e.target.value})} placeholder="(216) 555-0123" />
                <F label="Company / Fund" value={editUser.company} onChange={e=>setEditUser({...editUser,company:e.target.value})} />
                <F label="Mailing Address" value={editUser.address} onChange={e=>setEditUser({...editUser,address:e.target.value})} />
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>Account Type (Cash / IRA)</label>
                  <select value={editUser.investmentType||'cash'} onChange={e=>setEditUser({...editUser,investmentType:e.target.value})} style={{ ...inp, cursor:'pointer' }}>
                    <option value="cash">Cash</option><option value="ira">IRA</option>
                  </select>
                </div>
                {editUser.investmentType === 'ira' && (
                  <TA label="IRA Information" value={editUser.iraInformation} onChange={e=>setEditUser({...editUser,iraInformation:e.target.value})} rows={2} placeholder="Custodian, account #…" />
                )}
                <F label="New Password (blank = keep current)" value={editUser.newPassword||''} onChange={e=>setEditUser({...editUser,newPassword:e.target.value})} placeholder="••••••••" />
              </div>
              <div>
                <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Investment Details</div>
                <F label="Investment Amount ($)" value={editUser.investmentAmount} onChange={e=>setEditUser({...editUser,investmentAmount:e.target.value})} type="number" placeholder="50000" />
                <F label="Date Invested" value={editUser.investmentDate} onChange={e=>setEditUser({...editUser,investmentDate:e.target.value})} type="date" />
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>Signature Docs Requested</label>
                  <button onClick={() => setEditUser({...editUser,signnowRequested:!editUser.signnowRequested})}
                    style={{ width:'48px', height:'26px', borderRadius:'13px', border:'none', cursor:'pointer', background:editUser.signnowRequested?'linear-gradient(135deg,#b8933a,#d4aa50)':'rgba(255,255,255,0.1)', position:'relative' }}>
                    <div style={{ position:'absolute', top:'3px', left:editUser.signnowRequested?'25px':'3px', width:'20px', height:'20px', background:'#fff', borderRadius:'50%', transition:'left 0.2s' }} />
                  </button>
                </div>
                <TA label="Internal Notes (not visible to investor)" value={editUser.notes} onChange={e=>setEditUser({...editUser,notes:e.target.value})} rows={5} placeholder="Private notes…" />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginTop:'8px' }}>
                  {[[stats.sessionCount,'Sessions',GOLD],[analytics.formatDuration(stats.totalTime),'Time Spent','#4ade80'],[stats.totalDownloads,'Downloads','#60a5fa']].map(([v,l,c]) => (
                    <div key={l} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'2px', padding:'10px', textAlign:'center' }}>
                      <div style={{ color:c, fontSize:'16px', fontWeight:'bold' }}>{v}</div>
                      <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn:'1/-1', display:'flex', gap:'12px', alignItems:'center', paddingTop:'16px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                <button onClick={saveProfile} disabled={saving} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'11px 32px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{saving?'Saving…':'Save Changes'}</button>
                {saveMsg && <span style={{ color:saveMsg.startsWith('Error')?'#ef4444':'#4ade80', fontSize:'13px' }}>{saveMsg}</span>}
              </div>
            </div>
          )}

          {/* HISTORY */}
          {tab === 'history' && (
            <div>
              <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'20px', marginBottom:'24px' }}>
                <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>Log Interaction</div>
                <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
                  {Object.entries(noteTypeIcons).map(([t,icon]) => (
                    <button key={t} onClick={() => setNoteForm({...noteForm,type:t})}
                      style={{ padding:'7px 14px', background:noteForm.type===t?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${noteForm.type===t?GOLD:'rgba(255,255,255,0.1)'}`, borderRadius:'2px', color:noteForm.type===t?GOLD:'#6b7280', cursor:'pointer', fontSize:'12px' }}>
                      {icon} {t.charAt(0).toUpperCase()+t.slice(1)}
                    </button>
                  ))}
                </div>
                <TA value={noteForm.content} onChange={e=>setNoteForm({...noteForm,content:e.target.value})} placeholder={`Add ${noteForm.type} details…`} rows={3} />
                <button onClick={addNote} disabled={!noteForm.content.trim()} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'9px 24px', cursor:'pointer', fontWeight:'bold', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>Add to History</button>
              </div>
              {loading && <p style={{ color:'#6b7280', textAlign:'center' }}>Loading…</p>}
              {!loading && notes.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'32px' }}>No history yet.</p>}
              {[...notes].sort((a,b) => new Date(b.createdAt||b.created_date||0) - new Date(a.createdAt||a.created_date||0)).map((note, i, arr) => {
                const isMigrated = (note.content||'').startsWith('[From Lead History');
                const icon = isMigrated ? '📋' : (noteTypeIcons[note.type]||'📝');
                const borderColor = isMigrated ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.06)';
                const labelColor = isMigrated ? '#60a5fa' : GOLD;
                const label = isMigrated ? 'Lead History' : note.type;
                return (
                  <div key={note.id} style={{ display:'flex', gap:'14px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'24px', flexShrink:0 }}>
                      <div style={{ fontSize:'18px' }}>{icon}</div>
                      {i < arr.length-1 && <div style={{ width:'1px', flex:1, background:'rgba(255,255,255,0.06)', marginTop:'4px' }} />}
                    </div>
                    <div style={{ flex:1, background:isMigrated?'rgba(96,165,250,0.04)':'rgba(255,255,255,0.02)', border:`1px solid ${borderColor}`, borderRadius:'2px', padding:'14px 16px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ color:labelColor, fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px' }}>{label}</span>
                          {isMigrated && <span style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa', fontSize:'9px', padding:'1px 6px', borderRadius:'3px', letterSpacing:'1px' }}>MIGRATED</span>}
                        </div>
                        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                          <span style={{ color:'#4a5568', fontSize:'11px' }}>{note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}</span>
                          {!isMigrated && <button onClick={() => deleteNote(note.id)} style={{ background:'none', border:'none', color:'#ef444480', cursor:'pointer', fontSize:'14px', padding:'0' }}>×</button>}
                        </div>
                      </div>
                      <p style={{ color:isMigrated?'#8a9ab8':'#c4cdd8', fontSize:'13px', margin:0, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{note.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'analytics' && <InvestorAnalyticsTab user={editUser} sessions={sessions} stats={stats} />}

          {/* DOCUMENTS */}
          {tab === 'documents' && (
            <div>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'20px' }}>SignNow Documents Sent</div>
              {loading && <p style={{ color:'#6b7280' }}>Loading…</p>}
              {!loading && snReqs.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No documents sent yet.</p>}
              {snReqs.map(req => {
                let docs = []; try { docs = JSON.parse(req.documents||'[]'); } catch {}
                const sc = { pending:{c:'#f59e0b'}, sent:{c:'#60a5fa'}, completed:{c:'#4ade80'}, declined:{c:'#ef4444'}, error:{c:'#ef4444'} };
                const s2 = sc[req.status]||sc.pending;
                return (
                  <div key={req.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'18px', marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                      <div style={{ color:'#e8e0d0', fontSize:'13px' }}>Sent {req.sentAt ? new Date(req.sentAt).toLocaleDateString() : ''}</div>
                      <span style={{ color:s2.c, fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px' }}>● {req.status}</span>
                    </div>
                    {docs.map((d,i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderTop:'1px solid rgba(255,255,255,0.04)', fontSize:'12px' }}>
                        <span style={{ color:'#8a9ab8' }}>📄 {d.name}</span>
                        <span style={{ color:(sc[d.status]||sc.pending).c }}>{d.status}</span>
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
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'20px' }}>Accreditation Documents</div>
              {loading && <p style={{ color:'#6b7280' }}>Loading…</p>}
              {!loading && accDocs.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No accreditation documents uploaded yet.</p>}
              {accDocs.map(doc => {
                const sc = { pending:'#f59e0b', under_review:'#60a5fa', approved:'#4ade80', rejected:'#ef4444' };
                return (
                  <div key={doc.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'18px', marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                      <div>
                        <div style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'14px' }}>{doc.fileName}</div>
                        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'2px' }}>{doc.docType?.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())} · {doc.fileSize?`${(doc.fileSize/1024).toFixed(1)} KB`:''} · {doc.uploadedAt?new Date(doc.uploadedAt).toLocaleDateString():''}</div>
                      </div>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <span style={{ color:sc[doc.status]||'#f59e0b', fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px' }}>● {doc.status}</span>
                        <button onClick={() => downloadAccDoc(doc)} style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', padding:'5px 12px', cursor:'pointer', fontSize:'11px' }}>↓ Download</button>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
                      {['pending','under_review','approved','rejected'].map(s => (
                        <button key={s} onClick={async () => { await AccreditationDocDB.updateStatus(doc.id, s, doc.adminNotes); setAccDocs(await AccreditationDocDB.listForInvestor(user.id)); }}
                          style={{ padding:'4px 10px', background:doc.status===s?`${sc[s]}22`:'transparent', border:`1px solid ${doc.status===s?sc[s]:'rgba(255,255,255,0.1)'}`, borderRadius:'2px', color:doc.status===s?sc[s]:'#4a5568', cursor:'pointer', fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>
                          {s.replace('_',' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'portal'    && <PortalAccessTab user={user} onClose={onClose} onSave={onSave} />}
          {tab === 'rosie'     && <RosieTab user={user} />}
          {tab === 'sitestats' && <InvestorWebsiteTab user={user} />}
          {tab === 'research'  && <ResearchTab user={user} />}
          {tab === 'script'    && <ScriptAssistant user={user} />}

          {/* CALENDAR */}
          {tab === 'calendar' && (
            <div>
              <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'20px', marginBottom:'24px' }}>
                <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>📅 Book Appointment</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                  <F label="Title" value={apptForm.title} onChange={e=>setApptForm({...apptForm,title:e.target.value})} placeholder="Intro Call, Follow-up…" />
                  <div style={{ marginBottom:'16px' }}>
                    <label style={ls}>Type</label>
                    <select value={apptForm.type} onChange={e=>setApptForm({...apptForm,type:e.target.value})} style={{ ...inp, cursor:'pointer' }}>
                      {['call','meeting','follow-up','demo','other'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                  <DateTimePicker label="Date & Time" value={apptForm.scheduledAt} onChange={iso => setApptForm(f => ({...f,scheduledAt:iso}))} />
                  <div style={{ marginBottom:'16px' }}>
                    <label style={ls}>Duration</label>
                    <select value={apptForm.durationMinutes} onChange={e=>setApptForm({...apptForm,durationMinutes:Number(e.target.value)})} style={{ ...inp, cursor:'pointer' }}>
                      {[15,30,45,60,90,120].map(d=><option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>
                </div>
                <TA label="Notes" value={apptForm.notes} onChange={e=>setApptForm({...apptForm,notes:e.target.value})} rows={2} placeholder="Agenda, talking points…" />
                <button onClick={addAppt} disabled={!apptForm.title||!apptForm.scheduledAt} style={{ background:(!apptForm.title||!apptForm.scheduledAt)?'rgba(184,147,58,0.3)':'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'9px 24px', cursor:(!apptForm.title||!apptForm.scheduledAt)?'not-allowed':'pointer', fontWeight:'bold', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>Book Appointment</button>
              </div>
              {loading && <p style={{ color:'#6b7280' }}>Loading…</p>}
              {!loading && appts.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'32px' }}>No appointments yet.</p>}
              {appts.map(appt => {
                const sc = { scheduled:GOLD, completed:'#4ade80', cancelled:'#4a5568', 'no-show':'#ef4444' };
                const isPast = new Date(appt.scheduledAt) < new Date();
                return (
                  <div key={appt.id} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${isPast?'rgba(255,255,255,0.05)':'rgba(184,147,58,0.2)'}`, borderRadius:'2px', padding:'16px', marginBottom:'10px', opacity:isPast?0.7:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'14px', marginBottom:'4px' }}>{appt.title}</div>
                        <div style={{ color:'#8a9ab8', fontSize:'12px' }}>{appt.scheduledAt?new Date(appt.scheduledAt).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):''} · {appt.durationMinutes} min</div>
                        {appt.notes && <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'4px' }}>{appt.notes}</div>}
                      </div>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <select value={appt.status||'scheduled'} onChange={async e => { await AppointmentDB.update(appt.id,{status:e.target.value}); setAppts(await AppointmentDB.listForInvestor(user.id)); }}
                          style={{ ...inp, width:'auto', fontSize:'11px', padding:'4px 8px', color:sc[appt.status||'scheduled'] }}>
                          {['scheduled','completed','cancelled','no-show'].map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={async()=>{ if(window.confirm('Delete?')){ await AppointmentDB.delete(appt.id); setAppts(prev=>prev.filter(a=>a.id!==appt.id)); } }}
                          style={{ background:'none', border:'none', color:'#ef444480', cursor:'pointer', fontSize:'16px', padding:'0' }}>×</button>
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
    </>
  );
}