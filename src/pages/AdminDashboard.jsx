import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import analytics from '@/lib/analytics';
import { getPortalSettings, loadPortalSettings, savePortalSettings } from '@/lib/portalSettings';
import { SignNowRequestDB, InvestorUser, ContactNoteDB, AppointmentDB, AccreditationDocDB } from '@/api/entities';
import RosieTab from '@/components/admin/RosieTab';
import { computeEngagementScore, getScoreColor, getScoreLabel } from '@/lib/engagementScore';
import { signnowSendDocuments, signnowGetToken } from '@/lib/signnow';
import DateTimePicker from '@/components/admin/DateTimePicker';
import LeadsTab from '@/components/leads/LeadsTab';
import TwilioDialer from '@/components/leads/TwilioDialer';
import PortalAccessTab from '@/components/admin/PortalAccessTab';
import ZoomBookingModal from '@/components/ZoomBookingModal';
import ProspectPipeline from '@/components/admin/ProspectPipeline';
import UpcomingReminders from '@/components/admin/UpcomingReminders';
import InvestorAnalyticsTab from '@/components/admin/InvestorAnalyticsTab';
import RecentInvestorEvents from '@/components/admin/RecentInvestorEvents';
import { base44 } from '@/api/base44Client';
import InvestorWebsiteTab from '@/components/leads/InvestorWebsiteTab';
import ResearchTab from '@/components/leads/ResearchTab';
import ScriptAssistant from '@/components/leads/ScriptAssistant';

const LOGO = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png';
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
function Tog({ label, value, onToggle, desc }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ color:'#c4cdd8', fontSize:'14px' }}>{label}</div>
        {desc && <div style={{ color:'#4a5568', fontSize:'12px', marginTop:'2px' }}>{desc}</div>}
      </div>
      <button onClick={onToggle} style={{ width:'48px', height:'26px', borderRadius:'13px', border:'none', cursor:'pointer', background:value?'linear-gradient(135deg,#b8933a,#d4aa50)':'rgba(255,255,255,0.1)', position:'relative', flexShrink:0 }}>
        <div style={{ position:'absolute', top:'3px', left:value?'25px':'3px', width:'20px', height:'20px', background:'#fff', borderRadius:'50%', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }} />
      </button>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const isInvestor = status === 'investor';
  return (
    <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:'2px', background:isInvestor?'rgba(74,222,128,0.12)':'rgba(167,139,250,0.12)', color:isInvestor?'#4ade80':'#a78bfa', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', whiteSpace:'nowrap' }}>
      {isInvestor ? '✅ Investor' : '🔷 Potential Investor'}
    </span>
  );
}

// ─── CONTACT CARD MODAL ───────────────────────────────────────────────────
function ContactCardModal({ user, onClose, onSave, allSessions, matchesUser }) {
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
  const [showZoom, setShowZoom] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  // Tab highlight: track which tabs have been viewed and when
  const [viewedTabs, setViewedTabs] = useState(() => {
    try { return JSON.parse(user.lastViewedTabs || '{}'); } catch { return {}; }
  });

  // Mark a tab as viewed — update local state + DB
  const markTabViewed = async (tabId) => {
    const now = new Date().toISOString();
    const updated = { ...viewedTabs, [tabId]: now };
    setViewedTabs(updated);
    try {
      await base44.entities.InvestorUser.update(user.id, { lastViewedTabs: JSON.stringify(updated) });
    } catch {}
  };

  // A tab has new activity if lastActivityAt is newer than when we last viewed that tab
  const tabHasNew = (tabId) => {
    if (!user.lastActivityAt) return false;
    const lastViewed = viewedTabs[tabId];
    if (!lastViewed) return true; // never viewed
    return new Date(user.lastActivityAt) > new Date(lastViewed);
  };

  useEffect(() => {
    loadAll();
  }, [user.id]);

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

    // Auto-update engagement score
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
    const ns = await ContactNoteDB.listForInvestor(user.id);
    setNotes(ns);
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
    const ap = await AppointmentDB.listForInvestor(user.id);
    setAppts(ap);
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

  const TABS = [
    ['overview','👤 Overview'], ['history','📞 History'], ['analytics','📊 Analytics'],
    ['documents','📄 Documents'], ['accreditation','🔐 Accreditation'], ['calendar','📅 Calendar'],
    ['portal','🔑 Portal Access'], ['rosie','🤖 Rosie AI'], ['sitestats','📊 Site Stats'], ['research','🔍 Research'], ['script','📝 Script'],
  ];

  const noteTypeIcons = { note:'📝', call:'📞', sms:'💬', voicemail:'📳', email:'✉️' };
  const apptTypeColors = { call:GOLD, meeting:'#60a5fa', 'follow-up':'#4ade80', demo:'#f59e0b', other:'#8a9ab8' };
  const docStatusColors = { pending:'#f59e0b', under_review:'#60a5fa', approved:'#4ade80', rejected:'#ef4444' };

  const handleCallLogged = async (leadId) => {
    // Also log in ContactNote for CRM history
    try {
      await ContactNoteDB.create({ investorId: user.id, investorEmail: user.email, type: 'call', content: `Outbound call via Twilio dialer`, createdBy: 'admin' });
      const ns = await ContactNoteDB.listForInvestor(user.id);
      setNotes(ns);
    } catch {}
  };

  const sendEmail = async () => {
    if (!editUser.email) { setEmailMsg('No email address on file.'); return; }
    setSendingEmail(true); setEmailMsg('');
    try {
      await base44.functions.invoke('sendLeadEmail', {
        investorId: user.id,
        toEmail: editUser.email,
        toName: user.name,
        firstName: user.name.split(' ')[0],
      });
      setEmailMsg('✓ Email sent!');
      setTimeout(() => setEmailMsg(''), 3000);
    } catch (e) {
      setEmailMsg('Error: ' + (e.response?.data?.error || e.message));
    }
    setSendingEmail(false);
  };

  return (
    <>
    {showDialerLocal && (
      <TwilioDialer
        initialLead={dialerLead}
        onClose={() => { setShowDialerLocal(false); setDialerLead(null); }}
        onCallLogged={handleCallLogged}
      />
    )}
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
            {/* Engagement score badge */}
            {(() => {
              const sc = user.engagementScore || 0;
              const col = getScoreColor(sc);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: `${col}15`, border: `1px solid ${col}44`, borderRadius: '20px', padding: '4px 10px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${col}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: col, fontSize: '9px', fontWeight: 'bold' }}>{sc}</span>
                  </div>
                  <span style={{ color: col, fontSize: '11px', letterSpacing: '0.5px' }}>{getScoreLabel(sc)}</span>
                </div>
              );
            })()}
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <button onClick={sendEmail} disabled={sendingEmail || !editUser.email}
              style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'8px 14px', cursor: editUser.email ? 'pointer' : 'not-allowed', fontSize:'12px', fontWeight:'bold', opacity: editUser.email ? 1 : 0.5 }}>
              {sendingEmail ? '⏳ Sending…' : '✉️ Send Email'}
            </button>
            {emailMsg && <span style={{ fontSize:'11px', color: emailMsg.startsWith('Error') ? '#ef4444' : '#4ade80' }}>{emailMsg}</span>}
            <button onClick={() => setShowZoom(true)}
              style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'8px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
              📅 Book Zoom
            </button>
            {user.phone && (
              <button onClick={() => { setDialerLead({ firstName: user.name, lastName: '', phone: user.phone, id: user.id }); setShowDialerLocal(true); }}
                style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'2px', padding:'8px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                📞 {user.phone}
              </button>
            )}
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#6b7280', cursor:'pointer', fontSize:'20px', width:'36px', height:'36px', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
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
                {hasNew && (
                  <span style={{ position:'absolute', top:'6px', right:'4px', width:'6px', height:'6px', borderRadius:'50%', background:'#ef4444', display:'block' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px' }}>
              {/* Left: edit form */}
              <div>
                <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Contact Details</div>
                {/* Status selector */}
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>Status</label>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {['prospect','investor'].map(s => (
                      <button key={s} onClick={() => setEditUser({...editUser, status:s})}
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
                    <option value="cash">Cash</option>
                    <option value="ira">IRA</option>
                  </select>
                </div>
                {editUser.investmentType === 'ira' && (
                  <TA label="IRA Information" value={editUser.iraInformation} onChange={e=>setEditUser({...editUser,iraInformation:e.target.value})} rows={2} placeholder="Custodian, account #…" />
                )}
                <F label="New Password (blank = keep current)" value={editUser.newPassword||''} onChange={e=>setEditUser({...editUser,newPassword:e.target.value})} placeholder="••••••••" />
              </div>

              {/* Right: investment + notes */}
              <div>
                <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Investment Details</div>
                <F label="Investment Amount ($)" value={editUser.investmentAmount} onChange={e=>setEditUser({...editUser,investmentAmount:e.target.value})} type="number" placeholder="50000" />
                <F label="Date Invested" value={editUser.investmentDate} onChange={e=>setEditUser({...editUser,investmentDate:e.target.value})} type="date" />
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>Signature Docs Requested</label>
                  <button onClick={() => setEditUser({...editUser, signnowRequested:!editUser.signnowRequested})}
                    style={{ width:'48px', height:'26px', borderRadius:'13px', border:'none', cursor:'pointer', background:editUser.signnowRequested?'linear-gradient(135deg,#b8933a,#d4aa50)':'rgba(255,255,255,0.1)', position:'relative' }}>
                    <div style={{ position:'absolute', top:'3px', left:editUser.signnowRequested?'25px':'3px', width:'20px', height:'20px', background:'#fff', borderRadius:'50%', transition:'left 0.2s' }} />
                  </button>
                </div>
                <TA label="Internal Notes (not visible to investor)" value={editUser.notes} onChange={e=>setEditUser({...editUser,notes:e.target.value})} rows={5} placeholder="Private notes…" />
                {/* Quick stats */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginTop:'8px' }}>
                  {[[stats.sessionCount,'Sessions',GOLD],[analytics.formatDuration(stats.totalTime),'Time Spent','#4ade80'],[stats.totalDownloads,'Downloads','#60a5fa']].map(([v,l,c]) => (
                    <div key={l} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'2px', padding:'10px', textAlign:'center' }}>
                      <div style={{ color:c, fontSize:'16px', fontWeight:'bold' }}>{v}</div>
                      <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save button */}
              <div style={{ gridColumn:'1/-1', display:'flex', gap:'12px', alignItems:'center', paddingTop:'16px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                <button onClick={saveProfile} disabled={saving} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'11px 32px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{saving?'Saving…':'Save Changes'}</button>
                {saveMsg && <span style={{ color:saveMsg.startsWith('Error')?'#ef4444':'#4ade80', fontSize:'13px' }}>{saveMsg}</span>}
              </div>
            </div>
          )}

          {/* HISTORY */}
          {tab === 'history' && (
            <div>
              {/* Add note form */}
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

              {/* Timeline */}
              {loading && <p style={{ color:'#6b7280', textAlign:'center' }}>Loading…</p>}
              {!loading && notes.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'32px' }}>No history yet. Log your first interaction above.</p>}
              {(() => {
                // Sort all notes chronologically — migrated lead history interleaved with admin notes
                const sorted = [...notes].sort((a, b) => {
                  const ta = new Date(a.createdAt || a.created_date || 0).getTime();
                  const tb = new Date(b.createdAt || b.created_date || 0).getTime();
                  return tb - ta; // newest first
                });
                return sorted.map((note, i) => {
                  const isMigrated = (note.content || '').startsWith('[From Lead History');
                  const icon = isMigrated ? '📋' : (noteTypeIcons[note.type] || '📝');
                  const borderColor = isMigrated ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.06)';
                  const labelColor = isMigrated ? '#60a5fa' : GOLD;
                  const label = isMigrated ? 'Lead History' : note.type;
                  return (
                    <div key={note.id} style={{ display:'flex', gap:'14px', marginBottom:'16px' }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'24px', flexShrink:0 }}>
                        <div style={{ fontSize:'18px' }}>{icon}</div>
                        {i < sorted.length - 1 && <div style={{ width:'1px', flex:1, background:'rgba(255,255,255,0.06)', marginTop:'4px' }} />}
                      </div>
                      <div style={{ flex:1, background: isMigrated ? 'rgba(96,165,250,0.04)' : 'rgba(255,255,255,0.02)', border:`1px solid ${borderColor}`, borderRadius:'2px', padding:'14px 16px' }}>
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
                        <p style={{ color: isMigrated ? '#8a9ab8' : '#c4cdd8', fontSize:'13px', margin:0, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{note.content}</p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* ANALYTICS */}
          {tab === 'analytics' && (
            <InvestorAnalyticsTab user={editUser} sessions={sessions} stats={stats} />
          )}

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
              {!loading && accDocs.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No accreditation documents uploaded by this investor yet.</p>}
              {accDocs.map(doc => {
                const sc = { pending:'#f59e0b', under_review:'#60a5fa', approved:'#4ade80', rejected:'#ef4444' };
                return (
                  <div key={doc.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'18px', marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                      <div>
                        <div style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'14px' }}>{doc.fileName}</div>
                        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'2px' }}>
                          {doc.docType?.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())} · {doc.fileSize ? `${(doc.fileSize/1024).toFixed(1)} KB` : ''} · {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <span style={{ color:sc[doc.status]||'#f59e0b', fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px' }}>● {doc.status}</span>
                        <button onClick={() => downloadAccDoc(doc)} style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', padding:'5px 12px', cursor:'pointer', fontSize:'11px' }}>↓ Download</button>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
                      {['pending','under_review','approved','rejected'].map(s => (
                        <button key={s} onClick={async () => { await AccreditationDocDB.updateStatus(doc.id, s, doc.adminNotes); const ad=await AccreditationDocDB.listForInvestor(user.id); setAccDocs(ad); }}
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

          {/* PORTAL ACCESS */}
          {tab === 'portal' && (
            <PortalAccessTab user={user} onClose={onClose} onSave={onSave} />
          )}

          {/* ROSIE AI */}
          {tab === 'rosie' && <RosieTab user={user} />}

          {/* SCRIPT */}
          {tab === 'sitestats' && <InvestorWebsiteTab user={user} />}
          {tab === 'research' && <ResearchTab user={user} />}
          {tab === 'script' && <ScriptAssistant user={user} />}

          {/* CALENDAR */}
          {tab === 'calendar' && (
            <div>
              {/* Book appointment */}
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
                  <DateTimePicker
                    label="Date & Time"
                    value={apptForm.scheduledAt}
                    onChange={iso => setApptForm(f => ({...f, scheduledAt: iso}))}
                  />
                  <div style={{ marginBottom:'16px' }}>
                    <label style={ls}>Duration</label>
                    <select value={apptForm.durationMinutes} onChange={e=>setApptForm({...apptForm,durationMinutes:Number(e.target.value)})} style={{ ...inp, cursor:'pointer' }}>
                      {[15,30,45,60,90,120].map(d=><option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>
                </div>
                <TA label="Notes" value={apptForm.notes} onChange={e=>setApptForm({...apptForm,notes:e.target.value})} rows={2} placeholder="Agenda, talking points…" />
                <button onClick={addAppt} disabled={!apptForm.title||!apptForm.scheduledAt} style={{ background: (!apptForm.title||!apptForm.scheduledAt) ? 'rgba(184,147,58,0.3)' : 'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'9px 24px', cursor: (!apptForm.title||!apptForm.scheduledAt) ? 'not-allowed' : 'pointer', fontWeight:'bold', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>Book Appointment</button>
              </div>

              {/* Appointments list */}
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
                        <div style={{ color:'#8a9ab8', fontSize:'12px' }}>
                          {appt.scheduledAt ? new Date(appt.scheduledAt).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : ''} · {appt.durationMinutes} min
                        </div>
                        {appt.notes && <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'4px' }}>{appt.notes}</div>}
                      </div>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <select value={appt.status||'scheduled'} onChange={async e => { await AppointmentDB.update(appt.id,{status:e.target.value}); const ap=await AppointmentDB.listForInvestor(user.id); setAppts(ap); }}
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

// ─── GLOBAL CALENDAR VIEW ─────────────────────────────────────────────────
function GlobalCalendar({ users = [], setContactCard, setView }) {
  const [allAppts, setAllAppts] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dragging, setDragging] = useState(null); // { appt, sourceDay }
  const [dragOver, setDragOver] = useState(null);  // day index
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      AppointmentDB.listAll(),
      base44.entities.Lead.list('-created_date', 2000),
    ]).then(([a, l]) => { setAllAppts(a); setAllLeads(l); setLoading(false); });
  }, []);

  // Build 7 days starting from today + weekOffset*7
  const today = new Date();
  today.setHours(0,0,0,0);
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() + weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDay);
    d.setDate(d.getDate() + i);
    return d;
  });

  const isToday = (d) => d.toDateString() === new Date().toDateString();

  // Build unified event list
  const invEvents = allAppts.map(a => ({
    id: a.id, type: 'investor', raw: a,
    title: a.title || 'Appointment',
    name: a.investorName || '',
    dateTime: new Date(a.scheduledAt),
    status: a.status || 'scheduled',
    notes: a.notes || '',
    phone: null,
    color: '#60a5fa',
  }));

  const leadEvents = allLeads
    .filter(l => l.callbackAt && l.status !== 'callback_later' && l.status !== 'converted' && l.status !== 'not_interested')
    .map(l => ({
      id: l.id, type: 'lead', raw: l,
      title: 'Lead Callback',
      name: `${l.firstName} ${l.lastName}`,
      dateTime: new Date(l.callbackAt),
      status: 'scheduled',
      notes: '',
      phone: l.phone,
      color: '#a78bfa',
    }));

  const allEvents = [...invEvents, ...leadEvents]
    .filter(e => filter === 'all' || e.type === filter);

  const eventsForDay = (day) => {
    return allEvents.filter(e => e.dateTime.toDateString() === day.toDateString())
      .sort((a, b) => a.dateTime - b.dateTime);
  };

  const statusColors = { scheduled: GOLD, completed: '#4ade80', cancelled: '#4a5568', 'no-show': '#ef4444' };

  const handleDrop = async (targetDay, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    if (!dragging || dragging.type !== 'investor') return;
    const appt = dragging;
    setDragging(null);

    // Keep same time, just move the date
    const orig = new Date(appt.dateTime);
    const newDate = new Date(targetDay);
    newDate.setHours(orig.getHours(), orig.getMinutes(), 0, 0);

    // Skip if same day
    if (newDate.toDateString() === orig.toDateString()) return;

    // Optimistic update
    setAllAppts(prev => prev.map(a => a.id === appt.id
      ? { ...a, scheduledAt: newDate.toISOString() }
      : a
    ));

    try {
      await AppointmentDB.update(appt.id, { scheduledAt: newDate.toISOString() });
    } catch (e) {
      console.error('Failed to move appointment:', e);
      setAllAppts(prev => prev.map(a => a.id === appt.id ? appt.raw : a));
    }
  };

  const totalUpcoming = allEvents.filter(e => e.dateTime >= today).length;

  return (
    <div style={{ fontFamily:'Georgia, serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 2px', fontSize:'20px', fontWeight:'normal' }}>📅 Calendar</h2>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>Drag appointments between days to reschedule</p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          {/* Filter */}
          {[['all','All'],['investor','👤 Investors'],['lead','🎯 Leads']].map(([id,label]) => (
            <button key={id} onClick={() => setFilter(id)}
              style={{ background: filter===id ? 'rgba(184,147,58,0.15)' : 'transparent', border: filter===id ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.1)', color: filter===id ? GOLD : '#6b7280', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'11px' }}>
              {label}
            </button>
          ))}
          <div style={{ color:GOLD, fontWeight:'bold', fontSize:'14px', marginLeft:'8px' }}>{totalUpcoming} upcoming</div>
          {/* Week nav */}
          <button onClick={() => setWeekOffset(0)}
            style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'11px' }}>
            Today
          </button>
          <button onClick={() => setWeekOffset(w => w - 1)}
            style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', fontSize:'13px' }}>
            ‹
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)}
            style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', fontSize:'13px' }}>
            ›
          </button>
        </div>
      </div>

      {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'60px' }}>Loading…</div>}

      {!loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'6px', minHeight:'500px' }}>
          {days.map((day, i) => {
            const dayEvents = eventsForDay(day);
            const isT = isToday(day);
            const isPast = day < today && !isT;
            const isDropTarget = dragOver === i;

            return (
              <div key={i}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(i); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                onDrop={e => handleDrop(day, e)}
                style={{
                  background: isDropTarget ? 'rgba(184,147,58,0.1)' : isT ? 'rgba(184,147,58,0.06)' : 'rgba(255,255,255,0.02)',
                  border: isDropTarget ? `2px dashed ${GOLD}` : isT ? `1px solid rgba(184,147,58,0.35)` : '1px solid rgba(255,255,255,0.06)',
                  borderRadius:'6px',
                  padding:'8px',
                  minHeight:'120px',
                  opacity: isPast ? 0.6 : 1,
                  transition:'background 0.15s, border 0.15s',
                }}>
                {/* Day header */}
                <div style={{ marginBottom:'8px', textAlign:'center' }}>
                  <div style={{ color: isT ? GOLD : '#6b7280', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase' }}>
                    {day.toLocaleDateString('en-US', { weekday:'short' })}
                  </div>
                  <div style={{ color: isT ? GOLD : isPast ? '#4a5568' : '#e8e0d0', fontSize:'18px', fontWeight: isT ? 'bold' : 'normal', lineHeight:1.2 }}>
                    {day.getDate()}
                  </div>
                  {isT && <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, margin:'2px auto 0' }} />}
                </div>

                {/* Events */}
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {dayEvents.map(evt => (
                    <div key={`${evt.type}-${evt.id}`}
                      draggable={evt.type === 'investor'}
                      onDragStart={(e) => { e.stopPropagation(); setDragging(evt); }}
                      onDragEnd={() => { setDragging(null); setDragOver(null); }}
                      onClick={() => {
                        if (evt.type === 'investor') {
                          const u = users.find(u => u.id === evt.id);
                          if (u) setContactCard(u);
                        } else if (evt.type === 'lead') {
                          base44.entities.Lead.filter({ id: evt.id }).then(leads => {
                            if (leads?.[0]) setView('leads');
                          }).catch(() => {});
                        }
                      }}
                      style={{
                        background: `${evt.color}18`,
                        border: `1px solid ${evt.color}44`,
                        borderLeft: `3px solid ${evt.color}`,
                        borderRadius:'3px',
                        padding:'5px 7px',
                        cursor: 'pointer',
                        userSelect:'none',
                        opacity: dragging?.id === evt.id ? 0.4 : 1,
                        transition:'all 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = `${evt.color}30`}
                      onMouseLeave={e => e.currentTarget.style.background = `${evt.color}18`}>
                      <div style={{ color:'#e8e0d0', fontSize:'10px', fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {evt.name}
                      </div>
                      <div style={{ color: evt.color, fontSize:'9px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {evt.title}
                      </div>
                      <div style={{ color:'#6b7280', fontSize:'9px', marginTop:'1px' }}>
                        {evt.dateTime.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}
                      </div>
                      {evt.phone && <div style={{ color:'#4ade80', fontSize:'9px', fontFamily:'monospace' }}>{evt.phone}</div>}
                      {evt.type === 'investor' && (
                        <div style={{ color: statusColors[evt.status] || GOLD, fontSize:'8px', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:'2px' }}>
                          ● {evt.status}
                        </div>
                      )}
                    </div>
                  ))}
                  {dayEvents.length === 0 && (
                    <div style={{ color:'#2d3748', fontSize:'10px', textAlign:'center', padding:'8px 0', borderTop:'1px dashed rgba(255,255,255,0.04)', marginTop:'4px' }}>
                      —
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Past appointments */}
      {!loading && weekOffset === 0 && (() => {
        const past = allEvents.filter(e => e.dateTime < today).sort((a,b) => b.dateTime - a.dateTime).slice(0,8);
        if (!past.length) return null;
        return (
          <div style={{ marginTop:'24px', opacity:0.5 }}>
            <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px', paddingBottom:'6px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>✓ Past</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              {past.map(evt => (
                <div key={`past-${evt.type}-${evt.id}`} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'4px', borderLeft:`3px solid ${evt.color}` }}>
                  <div>
                    <span style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold', marginRight:'8px' }}>{evt.name}</span>
                    <span style={{ color: evt.color, fontSize:'10px' }}>{evt.title}</span>
                  </div>
                  <span style={{ color:'#4a5568', fontSize:'10px' }}>{evt.dateTime.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── SignNow Requests View ────────────────────────────────────────────────
function SignNowRequestsView({ settings }) {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  useEffect(() => { SignNowRequestDB.listAll().then(r => { setRequests(r); setLoading(false); }); }, []);
  const sc = { pending:{bg:'rgba(245,158,11,0.12)',color:'#f59e0b',border:'rgba(245,158,11,0.3)'}, sent:{bg:'rgba(96,165,250,0.12)',color:'#60a5fa',border:'rgba(96,165,250,0.3)'}, completed:{bg:'rgba(74,222,128,0.12)',color:'#4ade80',border:'rgba(74,222,128,0.3)'}, declined:{bg:'rgba(239,68,68,0.12)',color:'#ef4444',border:'rgba(239,68,68,0.3)'}, error:{bg:'rgba(239,68,68,0.12)',color:'#ef4444',border:'rgba(239,68,68,0.3)'} };
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div><h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>SignNow Document Requests</h2><p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>All investor signature requests sent via SignNow.</p></div>
        <div style={{ color:GOLD, fontSize:'24px', fontWeight:'bold' }}>{requests.length}</div>
      </div>
      {!settings?.signnowAccessToken && <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'2px', padding:'16px', marginBottom:'24px', color:'#f59e0b', fontSize:'13px' }}>⚠ SignNow not configured. Configure in <strong>SignNow Settings</strong>.</div>}
      {loading && <p style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</p>}
      {!loading && requests.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'60px' }}>No SignNow requests yet.</p>}
      {!loading && requests.length > 0 && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
            {['pending','sent','completed','declined'].map(status => {
              const count=requests.filter(r=>r.status===status).length, s2=sc[status];
              return <div key={status} style={{ background:s2.bg, border:`1px solid ${s2.border}`, borderRadius:'2px', padding:'16px', textAlign:'center' }}><div style={{ color:s2.color, fontSize:'28px', fontWeight:'bold' }}>{count}</div><div style={{ color:'#6b7280', fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px', marginTop:'4px' }}>{status}</div></div>;
            })}
          </div>
          {requests.map(req => {
            const s2=sc[req.status]||sc.pending; let docs=[]; try { docs=JSON.parse(req.documents||'[]'); } catch {}
            return (
              <div key={req.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'20px', marginBottom:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
                  <span style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'16px' }}>{req.userName}</span>
                  <span style={{ background:s2.bg, color:s2.color, border:`1px solid ${s2.border}`, fontSize:'10px', padding:'3px 10px', borderRadius:'2px', textTransform:'uppercase' }}>{req.status}</span>
                </div>
                <div style={{ color:'#8a9ab8', fontSize:'13px', marginBottom:'8px' }}>{req.userEmail} · Sent {analytics.formatDateTime(req.sentAt)}</div>
                {docs.length > 0 && <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>{docs.map((doc,i)=>{ const ds=sc[doc.status]||sc.pending; return <span key={i} style={{ background:ds.bg, color:ds.color, border:`1px solid ${ds.border}`, fontSize:'11px', padding:'3px 10px', borderRadius:'2px' }}>📄 {doc.name} — {doc.status}</span>; })}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SignNow Settings ─────────────────────────────────────────────────────
function SignNowSettings({ settings, onSettingsSaved }) {
  const [form, setForm] = useState({ signnowClientId:settings?.signnowClientId||'', signnowClientSecret:settings?.signnowClientSecret||'', signnowUsername:settings?.signnowUsername||'', signnowPassword:settings?.signnowPassword||'', signnowAccessToken:settings?.signnowAccessToken||'', signnowTemplate1Id:settings?.signnowTemplate1Id||'', signnowTemplate1Name:settings?.signnowTemplate1Name||'Investor Questionnaire', signnowTemplate2Id:settings?.signnowTemplate2Id||'', signnowTemplate2Name:settings?.signnowTemplate2Name||'Subscription Agreement', signnowSignerRole:settings?.signnowSignerRole||'Signer 1', signnowInviteMessage:settings?.signnowInviteMessage||'Dear {name}, please review and sign the attached investment documents for Rosie AI LLC.' });
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const testAuth = async () => {
    setTesting(true); setStatus('');
    try { const res=await signnowGetToken(form.signnowClientId,form.signnowClientSecret,form.signnowUsername,form.signnowPassword); setForm(f=>({...f,signnowAccessToken:res.access_token})); setStatus('success:Connected!'); }
    catch(e) { setStatus('error:Auth failed — '+e.message); }
    finally { setTesting(false); }
  };
  const save = async () => {
    setSaving(true); setStatus('');
    try { await savePortalSettings({...settings,...form}); setStatus('success:Settings saved.'); onSettingsSaved({...settings,...form}); }
    catch(e) { setStatus('error:Save failed — '+e.message); }
    finally { setSaving(false); }
  };
  const [stType,stMsg] = status.split(':');
  return (
    <div>
      <h2 style={{ color:'#e8e0d0', margin:'0 0 8px', fontSize:'20px', fontWeight:'normal' }}>SignNow Settings</h2>
      <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 28px' }}>Configure SignNow API credentials, templates, and signer settings.</p>
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'24px', marginBottom:'20px' }}>
        <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 16px' }}>API Credentials</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <F label="Client ID" value={form.signnowClientId} onChange={e=>setForm({...form,signnowClientId:e.target.value})} mono />
          <F label="Client Secret" value={form.signnowClientSecret} onChange={e=>setForm({...form,signnowClientSecret:e.target.value})} mono />
          <F label="SignNow Email" value={form.signnowUsername} onChange={e=>setForm({...form,signnowUsername:e.target.value})} />
          <F label="SignNow Password" value={form.signnowPassword} onChange={e=>setForm({...form,signnowPassword:e.target.value})} type="password" />
        </div>
        <div style={{ display:'flex', gap:'12px', alignItems:'center', marginBottom:'16px' }}>
          <button onClick={testAuth} disabled={testing} style={{ background:'rgba(96,165,250,0.15)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'10px 20px', cursor:'pointer', fontSize:'12px' }}>{testing?'Connecting…':'🔌 Test Connection & Get Token'}</button>
          {stType==='success'&&<span style={{ color:'#4ade80', fontSize:'13px' }}>✓ {stMsg}</span>}
          {stType==='error'&&<span style={{ color:'#ef4444', fontSize:'13px' }}>✗ {stMsg}</span>}
        </div>
        <F label="Access Token" value={form.signnowAccessToken} onChange={e=>setForm({...form,signnowAccessToken:e.target.value})} mono />
      </div>
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'24px', marginBottom:'24px' }}>
        <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 20px' }}>Document Templates</h3>
        {[['1','Template1','signnowTemplate1Id','signnowTemplate1Name','Investor Questionnaire'],['2','Template2','signnowTemplate2Id','signnowTemplate2Name','Subscription Agreement']].map(([n,,idKey,nameKey,placeholder]) => (
          <div key={n} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'2px', padding:'16px', marginBottom:'12px' }}>
            <div style={{ color:'#c4cdd8', fontWeight:'bold', fontSize:'13px', marginBottom:'12px' }}>Document {n}</div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'0 20px' }}>
              <F label="Template ID" value={form[idKey]} onChange={e=>setForm({...form,[idKey]:e.target.value})} mono placeholder="32-char template ID" />
              <F label="Display Name" value={form[nameKey]} onChange={e=>setForm({...form,[nameKey]:e.target.value})} placeholder={placeholder} />
            </div>
          </div>
        ))}
        <F label="Signer Role Name" value={form.signnowSignerRole} onChange={e=>setForm({...form,signnowSignerRole:e.target.value})} placeholder="Signer 1" />
        <TA label="Invite Email Message ({name} = investor's name)" value={form.signnowInviteMessage} onChange={e=>setForm({...form,signnowInviteMessage:e.target.value})} rows={3} />
      </div>
      <button onClick={save} disabled={saving} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px 32px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{saving?'Saving…':'Save SignNow Settings'}</button>
    </div>
  );
}

// ─── Portal Controls ──────────────────────────────────────────────────────
function PortalControls() {
  const [s, setS]       = useState(getPortalSettings);
  const [saved, setSaved]   = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sec, setSec]   = useState('raise');
  useEffect(() => { loadPortalSettings().then(setS); }, []);
  const upd  = (k,v) => setS(prev=>({...prev,[k]:v}));
  const save = async () => { setSaveError(''); try { await savePortalSettings(s); setSaved(true); setTimeout(()=>setSaved(false),2500); } catch(e) { setSaveError('Save failed — '+e.message); } };
  const sections = [['raise','📊 Raise Progress'],['contact','📍 Contact'],['content','✏️ Content'],['terms','📋 Terms'],['rosie','🤖 Rosie AI'],['toggles','⚙️ Visibility']];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:'0' }}>
      <div style={{ borderRight:'1px solid rgba(255,255,255,0.07)' }}>
        {sections.map(([id,label]) => <button key={id} onClick={()=>setSec(id)} style={{ display:'block', width:'100%', textAlign:'left', background:sec===id?'rgba(184,147,58,0.12)':'transparent', border:'none', borderLeft:sec===id?`3px solid ${GOLD}`:'3px solid transparent', padding:'11px 14px', color:sec===id?GOLD:'#6b7280', fontSize:'12px', cursor:'pointer' }}>{label}</button>)}
      </div>
      <div style={{ paddingLeft:'32px' }}>
        {sec==='raise' && <div><h3 style={{ color:'#e8e0d0', margin:'0 0 20px', fontWeight:'normal' }}>Raise Progress</h3><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}><F label="Total Raise Target ($)" value={s.totalRaise} onChange={e=>upd('totalRaise',Number(e.target.value))} type="number" /><F label="Committed Capital ($)" value={s.committedCapital} onChange={e=>upd('committedCapital',Number(e.target.value))} type="number" /><F label="Invested Capital ($)" value={s.investedCapital} onChange={e=>upd('investedCapital',Number(e.target.value))} type="number" /><F label="Invested Target ($)" value={s.investedTarget} onChange={e=>upd('investedTarget',Number(e.target.value))} type="number" /></div></div>}
        {sec==='contact' && <div><h3 style={{ color:'#e8e0d0', margin:'0 0 20px', fontWeight:'normal' }}>Contact Info</h3><F label="Company Name" value={s.companyName} onChange={e=>upd('companyName',e.target.value)} /><F label="Address Line 1" value={s.address1} onChange={e=>upd('address1',e.target.value)} /><F label="Address Line 2" value={s.address2} onChange={e=>upd('address2',e.target.value)} /><F label="Phone" value={s.phone} onChange={e=>upd('phone',e.target.value)} /><F label="Email" value={s.email} onChange={e=>upd('email',e.target.value)} /></div>}
        {sec==='content' && <div><h3 style={{ color:'#e8e0d0', margin:'0 0 20px', fontWeight:'normal' }}>Portal Content</h3><F label="Tagline" value={s.portalTagline} onChange={e=>upd('portalTagline',e.target.value)} /><F label="Headline" value={s.portalHeadline} onChange={e=>upd('portalHeadline',e.target.value)} /><TA label="Subheading" value={s.portalSubtext} onChange={e=>upd('portalSubtext',e.target.value)} rows={3} /><TA label="Legal Disclosure" value={s.disclosureText} onChange={e=>upd('disclosureText',e.target.value)} rows={4} /></div>}
        {sec==='terms' && <div><h3 style={{ color:'#e8e0d0', margin:'0 0 20px', fontWeight:'normal' }}>Investment Terms</h3><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}><F label="Round Size" value={s.roundSize} onChange={e=>upd('roundSize',e.target.value)} /><F label="Valuation Cap" value={s.valuationCap} onChange={e=>upd('valuationCap',e.target.value)} /><F label="Min Investment" value={s.minInvestment} onChange={e=>upd('minInvestment',e.target.value)} /><F label="Discount Rate" value={s.discountRate} onChange={e=>upd('discountRate',e.target.value)} /><F label="Target Close" value={s.targetClose} onChange={e=>upd('targetClose',e.target.value)} /></div></div>}
        {sec==='rosie' && (
          <div>
            <h3 style={{ color:'#e8e0d0', margin:'0 0 6px', fontWeight:'normal' }}>Rosie AI Voice Agent</h3>
            <p style={{ color:'#4a5568', fontSize:'12px', margin:'0 0 24px' }}>Configure the Rosie AI voice assistant that lives inside the investor portal.</p>

            {/* API Keys */}
            <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>API Configuration</div>
              <F label="Deepgram API Key" value={s.deepgramApiKey||''} onChange={e=>upd('deepgramApiKey',e.target.value)} placeholder="Your Deepgram API key" type="password" />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>LLM Provider</label>
                  <select value={s.llmProvider||'open_ai'} onChange={e=>upd('llmProvider',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="open_ai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>LLM Model</label>
                  <select value={s.llmModel||'gpt-4.1-mini'} onChange={e=>upd('llmModel',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="gpt-4.1-mini">GPT-4.1 Mini (fast, cheap)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4o">GPT-4o (most capable)</option>
                    <option value="claude-haiku-4-5-20251001">Claude Haiku (fast)</option>
                    <option value="claude-sonnet-4-6">Claude Sonnet</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Voice settings */}
            <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Voice Settings</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>STT Model (Speech-to-Text)</label>
                  <select value={s.sttModel||'nova-3'} onChange={e=>upd('sttModel',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="nova-3">Nova-3 (latest)</option>
                    <option value="nova-2">Nova-2</option>
                    <option value="nova-2-general">Nova-2 General</option>
                  </select>
                </div>
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>Voice Model (Text-to-Speech)</label>
                  <select value={s.voiceModel||'aura-2-asteria-en'} onChange={e=>upd('voiceModel',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="aura-2-asteria-en">Asteria (Female, Warm)</option>
                    <option value="aura-2-luna-en">Luna (Female, Soft)</option>
                    <option value="aura-2-stella-en">Stella (Female, Bright)</option>
                    <option value="aura-2-athena-en">Athena (Female, Confident)</option>
                    <option value="aura-2-hera-en">Hera (Female, Authoritative)</option>
                    <option value="aura-2-orion-en">Orion (Male, Professional)</option>
                    <option value="aura-2-arcas-en">Arcas (Male, Warm)</option>
                    <option value="aura-asteria-en">Asteria v1</option>
                    <option value="aura-luna-en">Luna v1</option>
                  </select>
                </div>
              </div>
              <F label="Agent Name" value={s.chatbotName||'Rosie'} onChange={e=>upd('chatbotName',e.target.value)} placeholder="Rosie" />
            </div>

            {/* Personality */}
            <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Personality & Knowledge</div>
              <TA label="Opening Greeting" value={s.chatbotGreeting||''} onChange={e=>upd('chatbotGreeting',e.target.value)} rows={3} placeholder="Hi! I'm Rosie..." />
              <TA label="System Prompt / Personality" value={s.chatbotContext||''} onChange={e=>upd('chatbotContext',e.target.value)} rows={6} placeholder="You are Rosie, an AI investment assistant for Rosie AI LLC..." />
              <TA label="Knowledge Base" value={s.knowledgeBase||''} onChange={e=>upd('knowledgeBase',e.target.value)} rows={8} placeholder="Paste additional facts, FAQs, or context Rosie should know..." />
            </div>

            <Tog label="Rosie AI Enabled on Portal" value={s.chatbotEnabled !== false} onToggle={()=>upd('chatbotEnabled',!s.chatbotEnabled)} />
          </div>
        )}
        {sec==='toggles' && <div><h3 style={{ color:'#e8e0d0', margin:'0 0 20px', fontWeight:'normal' }}>Visibility</h3><Tog label="Portal Active" value={s.portalActive} onToggle={()=>upd('portalActive',!s.portalActive)} /><Tog label="Show Market Data Tab" value={s.showMarketData} onToggle={()=>upd('showMarketData',!s.showMarketData)} /><Tog label="Show Subscription Tab" value={s.showSubscription} onToggle={()=>upd('showSubscription',!s.showSubscription)} /></div>}
        <div style={{ display:'flex', gap:'12px', marginTop:'32px', paddingTop:'24px', borderTop:'1px solid rgba(255,255,255,0.07)', alignItems:'center' }}>
          <button onClick={save} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px 32px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{saved?'✓ Saved!':'Save Changes'}</button>
          {saved && <span style={{ color:'#4ade80', fontSize:'13px' }}>Live on portal.</span>}
          {saveError && <span style={{ color:'#ef4444', fontSize:'13px' }}>{saveError}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Settings ───────────────────────────────────────────────────────
function AdminSettings({ changeAdminPassword, changeAdminUsername }) {
  const [pwForm, setPwForm] = useState({ current:'', newPw:'', confirm:'' });
  const [unForm, setUnForm] = useState({ current:'', newUsername:'' });
  const [pwMsg,  setPwMsg]  = useState(null);
  const [unMsg,  setUnMsg]  = useState(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [unSaving, setUnSaving] = useState(false);
  const ms = t => ({ background:t==='success'?'rgba(74,222,128,0.1)':'rgba(220,60,60,0.12)', border:`1px solid ${t==='success'?'rgba(74,222,128,0.3)':'rgba(220,60,60,0.3)'}`, borderRadius:'2px', padding:'10px 14px', color:t==='success'?'#4ade80':'#ff8a8a', fontSize:'13px', marginBottom:'16px' });

  const handleChangeUsername = async () => {
    setUnSaving(true); setUnMsg(null);
    const r = await changeAdminUsername(unForm.current, unForm.newUsername);
    if (r.success) { setUnMsg({type:'success',text:'Username updated!'}); setUnForm({current:'',newUsername:''}); }
    else setUnMsg({type:'error',text:r.error});
    setUnSaving(false);
  };

  const handleChangePassword = async () => {
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg({type:'error',text:'Passwords do not match'}); return; }
    setPwSaving(true); setPwMsg(null);
    const r = await changeAdminPassword(pwForm.current, pwForm.newPw);
    if (r.success) { setPwMsg({type:'success',text:'Password updated!'}); setPwForm({current:'',newPw:'',confirm:''}); }
    else setPwMsg({type:'error',text:r.error});
    setPwSaving(false);
  };

  return (
    <div>
      <h2 style={{ color:'#e8e0d0', margin:'0 0 32px', fontSize:'20px', fontWeight:'normal' }}>Admin Settings</h2>
      <div style={{ background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'2px', padding:'12px 16px', marginBottom:'24px', color:'#60a5fa', fontSize:'12px' }}>
        ℹ️ Admin credentials are stored in the database and work across all devices/browsers.
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'32px' }}>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'28px' }}>
          <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 20px' }}>Change Admin Username</h3>
          <F label="Current Password" value={unForm.current} onChange={e=>setUnForm({...unForm,current:e.target.value})} type="password" />
          <F label="New Username" value={unForm.newUsername} onChange={e=>setUnForm({...unForm,newUsername:e.target.value})} />
          {unMsg && <div style={ms(unMsg.type)}>{unMsg.text}</div>}
          <button onClick={handleChangeUsername} disabled={unSaving} style={{ width:'100%', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{unSaving ? 'Saving…' : 'Update Username'}</button>
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'28px' }}>
          <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 20px' }}>Change Admin Password</h3>
          <F label="Current Password" value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})} type="password" />
          <F label="New Password" value={pwForm.newPw} onChange={e=>setPwForm({...pwForm,newPw:e.target.value})} type="password" />
          <F label="Confirm New Password" value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} type="password" />
          {pwMsg && <div style={ms(pwMsg.type)}>{pwMsg.text}</div>}
          <button onClick={handleChangePassword} disabled={pwSaving} style={{ width:'100%', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{pwSaving ? 'Saving…' : 'Update Password'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add User Form ────────────────────────────────────────────────────────
function AddUserForm({ onAdd, onClose }) {
  const [form, setForm] = useState({ name:'', username:'', email:'', password:'', role:'investor', company:'', phone:'', address:'', investmentType:'cash', iraInformation:'', notes:'', signnowRequested:false, status:'prospect', investmentAmount:'', investmentDate:'' });
  const [error, setError] = useState('');
  const { addUser } = usePortalAuth();
  const submit = async () => {
    if (!form.name||!form.username||!form.password) { setError('Name, username, and password are required.'); return; }
    setError('');
    const result = await addUser(form);
    if (result.success) { onAdd(); onClose(); } else { setError(result.error || 'Failed to create user'); }
  };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', padding:'36px', maxWidth:'640px', width:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 40px 100px rgba(0,0,0,0.8)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
          <h3 style={{ color:GOLD, margin:0, fontSize:'13px', letterSpacing:'2px', textTransform:'uppercase' }}>Add New Client</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'20px' }}>×</button>
        </div>
        <div style={{ display:'flex', gap:'8px', marginBottom:'24px' }}>
          {['prospect','investor'].map(s => (
            <button key={s} onClick={() => setForm({...form,status:s})} style={{ flex:1, padding:'10px', border:`1px solid ${form.status===s?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', background:form.status===s?'rgba(184,147,58,0.15)':'transparent', color:form.status===s?GOLD:'#6b7280', cursor:'pointer', fontSize:'12px', textTransform:'uppercase', letterSpacing:'2px' }}>
              {s==='prospect'?'🔷 Potential Investor':'✅ Investor'}
            </button>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <F label="Full Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="John Smith" />
          <F label="Username (for login)" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="john-smith" />
          <F label="Email Address" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} type="email" placeholder="investor@example.com" />
          <F label="Phone Number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(216) 555-0123" />
          <F label="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Set a strong password" />
          <F label="Company / Fund" value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="ABC Capital" />
        </div>
        <F label="Mailing Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="123 Main St, Cleveland, OH 44101" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <div style={{ marginBottom:'16px' }}>
            <label style={ls}>Account Type</label>
            <select value={form.investmentType} onChange={e=>setForm({...form,investmentType:e.target.value})} style={{ ...inp, cursor:'pointer' }}><option value="cash">Cash</option><option value="ira">IRA</option></select>
          </div>
          <div style={{ marginBottom:'16px' }}>
            <label style={ls}>Portal Role</label>
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={{ ...inp, cursor:'pointer' }}><option value="investor">Investor</option><option value="admin">Admin</option></select>
          </div>
        </div>
        {form.investmentType==='ira' && <TA label="IRA Information" value={form.iraInformation} onChange={e=>setForm({...form,iraInformation:e.target.value})} rows={3} />}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <F label="Investment Amount ($)" value={form.investmentAmount} onChange={e=>setForm({...form,investmentAmount:e.target.value})} type="number" placeholder="50000" />
          <F label="Date Invested" value={form.investmentDate} onChange={e=>setForm({...form,investmentDate:e.target.value})} type="date" />
        </div>
        <TA label="Internal Notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={3} placeholder="Private notes…" />
        {error && <div style={{ background:'rgba(220,60,60,0.12)', border:'1px solid rgba(220,60,60,0.3)', borderRadius:'2px', padding:'10px 14px', color:'#ff8a8a', fontSize:'13px', marginBottom:'16px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'12px' }}>
          <button onClick={submit} style={{ flex:1, background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Add Client</button>
          <button onClick={onClose} style={{ padding:'12px 20px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ADMIN DASHBOARD ─────────────────────────────────────────────────

// ─── Knowledge Base Manager ───────────────────────────────────────────────
function KnowledgeBaseManager() {
  const [entries, setEntries]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [section, setSection]       = useState('entries'); // entries | add | upload | scrape
  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('all');

  // Add manual Q&A
  const [q, setQ]       = useState('');
  const [a, setA]       = useState('');
  const [cat, setCat]   = useState('faq');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // File upload
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const fileRef = useRef(null);

  // URL scrape
  const [scrapeUrl, setScrapeUrl]   = useState('');
  const [scraping, setScraping]     = useState(false);
  const [scrapeMsg, setScrapeMsg]   = useState('');

  // Delete
  const [deleting, setDeleting]     = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.KnowledgeBase.list('-created_date', 1000);
      setEntries(all || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addManual = async () => {
    if (!q.trim() || !a.trim()) return;
    setSaving(true); setSaveMsg('');
    try {
      await base44.entities.KnowledgeBase.create({
        question: q.trim(), answer: a.trim(), category: cat,
        tags: tags.trim(), source: 'manual',
      });
      setQ(''); setA(''); setTags('');
      setSaveMsg('✓ Entry added');
      await load();
    } catch (e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true); setUploadMsg(''); setUploadProgress('Reading file…');
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = () => rej(new Error('Read failed'));
        r.readAsDataURL(file);
      });
      setUploadProgress(`Processing "${file.name}" with AI — this may take 30-60s for large documents…`);
      const result = await base44.functions.invoke('kbExtractFile', {
        fileName: file.name, fileType: file.type, base64,
      });
      const extracted = result?.data?.entries || [];
      setUploadProgress(`Saving ${extracted.length} entries…`);
      let saved = 0;
      for (const entry of extracted) {
        try {
          await base44.entities.KnowledgeBase.create({
            question: entry.question, answer: entry.answer,
            category: entry.category || 'faq', source: file.name,
            tags: entry.tags || '',
          });
          saved++;
        } catch {}
      }
      setUploadMsg(`✓ Extracted and saved ${saved} entries from "${file.name}"`);
      await load();
    } catch (e) { setUploadMsg('Error: ' + e.message); }
    setUploading(false); setUploadProgress('');
    setTimeout(() => setUploadMsg(''), 6000);
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true); setScrapeMsg('Fetching and analyzing page…');
    try {
      const result = await base44.functions.invoke('kbScrapeUrl', { url: scrapeUrl.trim() });
      const extracted = result?.data?.entries || [];
      let saved = 0;
      for (const entry of extracted) {
        try {
          await base44.entities.KnowledgeBase.create({
            question: entry.question, answer: entry.answer,
            category: entry.category || 'faq', source: scrapeUrl.trim(),
            tags: entry.tags || '',
          });
          saved++;
        } catch {}
      }
      setScrapeMsg(`✓ Scraped and saved ${saved} entries from ${scrapeUrl}`);
      setScrapeUrl('');
      await load();
    } catch (e) { setScrapeMsg('Error: ' + e.message); }
    setScraping(false);
    setTimeout(() => setScrapeMsg(''), 6000);
  };

  const deleteEntry = async (id) => {
    setDeleting(id);
    try { await base44.entities.KnowledgeBase.delete(id); await load(); } catch {}
    setDeleting(null);
  };

  const deleteAll = async () => {
    if (!window.confirm('Delete ALL knowledge base entries? This cannot be undone.')) return;
    setLoading(true);
    for (const e of entries) {
      try { await base44.entities.KnowledgeBase.delete(e.id); } catch {}
    }
    await load();
  };

  const CATEGORIES = ['all','faq','financials','product','team','market','legal','process','risk','company','pricing','manual','raw_document'];
  const CAT_COLORS = { faq:'#60a5fa', financials:'#4ade80', product:'#a78bfa', team:'#f59e0b', market:'#f59e0b', legal:'#ef4444', process:'#8a9ab8', risk:'#ef4444', company:'#60a5fa', pricing:'#4ade80', manual:GOLD, raw_document:'#4a5568' };

  const filtered = entries
    .filter(e => filterCat === 'all' || e.category === filterCat)
    .filter(e => !search || `${e.question} ${e.answer} ${e.tags || ''}`.toLowerCase().includes(search.toLowerCase()));

  const sources = [...new Set(entries.filter(e => e.source).map(e => e.source))];
  const inp2 = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box' };
  const ta2  = { ...inp2, resize:'vertical', minHeight:'80px' };

  return (
    <div style={{ fontFamily:'Georgia, serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 6px', fontSize:'22px', fontWeight:'normal' }}>🧠 Knowledge Base</h2>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>
            {entries.filter(e => e.category !== 'raw_document').length} entries · {sources.length} sources · Used by <strong style={{ color:GOLD }}>Rosie AI</strong> and the <strong style={{ color:'#a78bfa' }}>Live Call Assistant</strong>
          </p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={load} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 14px', cursor:'pointer', fontSize:'12px' }}>↻ Refresh</button>
          <button onClick={deleteAll} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'4px', padding:'8px 14px', cursor:'pointer', fontSize:'12px' }}>🗑 Clear All</button>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:'28px' }}>
        {[['entries','📋 Entries'],['add','✏️ Add Q&A'],['upload','📄 Upload Document'],['scrape','🌐 Scrape Website'],['intent','🦆 Intent Engine'],['coach','🎯 Coach Rules']].map(([id,label]) => (
          <button key={id} onClick={() => setSection(id)}
            style={{ background:'none', border:'none', borderBottom:section===id?`2px solid ${GOLD}`:'2px solid transparent', color:section===id?GOLD:'#6b7280', padding:'10px 20px', cursor:'pointer', fontSize:'12px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── ENTRIES ── */}
      {section === 'entries' && (
        <div>
          {/* Filters */}
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries…"
              style={{ ...inp2, width:'260px', padding:'8px 12px', fontSize:'12px' }} />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              style={{ ...inp2, width:'160px', padding:'8px 12px', fontSize:'12px', cursor:'pointer' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? `All Categories (${entries.length})` : `${c} (${entries.filter(e=>e.category===c).length})`}</option>)}
            </select>
          </div>

          {loading && <p style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</p>}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px', color:'#4a5568' }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>🧠</div>
              <p>No entries yet. Upload a document, scrape a URL, or add Q&A manually.</p>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {filtered.slice(0, 100).map(e => (
              <div key={e.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'12px 16px', display:'flex', gap:'14px', alignItems:'flex-start' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'4px', flexWrap:'wrap' }}>
                    {e.category && (
                      <span style={{ background:`${CAT_COLORS[e.category]||'#6b7280'}18`, color:CAT_COLORS[e.category]||'#6b7280', border:`1px solid ${CAT_COLORS[e.category]||'#6b7280'}44`, borderRadius:'10px', padding:'1px 8px', fontSize:'10px', letterSpacing:'0.5px', textTransform:'uppercase', flexShrink:0 }}>{e.category}</span>
                    )}
                    {e.source && <span style={{ color:'#4a5568', fontSize:'10px', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'200px' }}>{e.source}</span>}
                    {e.tags && <span style={{ color:'#6b7280', fontSize:'10px' }}>#{e.tags}</span>}
                  </div>
                  <div style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold', marginBottom:'4px', lineHeight:1.4 }}>
                    {e.question?.startsWith('[') ? <span style={{ color:'#4a5568' }}>{e.question}</span> : `Q: ${e.question}`}
                  </div>
                  {e.category !== 'raw_document' && (
                    <div style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical' }}>
                      A: {e.answer}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteEntry(e.id)} disabled={deleting === e.id}
                  style={{ background:'none', border:'none', color:deleting===e.id?'#4a5568':'#ef444466', cursor:'pointer', fontSize:'16px', padding:'2px 4px', flexShrink:0 }}>
                  {deleting === e.id ? '…' : '×'}
                </button>
              </div>
            ))}
            {filtered.length > 100 && (
              <p style={{ color:'#4a5568', fontSize:'12px', textAlign:'center', padding:'8px' }}>Showing 100 of {filtered.length} — refine search to see more</p>
            )}
          </div>
        </div>
      )}

      {/* ── ADD Q&A ── */}
      {section === 'add' && (
        <div style={{ maxWidth:'640px' }}>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 20px', fontSize:'16px' }}>Add Manual Q&A Entry</h3>

          <div style={{ marginBottom:'16px' }}>
            <label style={ls}>Question / Keyword / Topic</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="What is the minimum investment?" style={inp2} />
          </div>
          <div style={{ marginBottom:'16px' }}>
            <label style={ls}>Answer</label>
            <textarea value={a} onChange={e => setA(e.target.value)} placeholder="The minimum investment is $25,000…" rows={5} style={ta2} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
            <div>
              <label style={ls}>Category</label>
              <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp2, cursor:'pointer' }}>
                {['faq','financials','product','team','market','legal','process','risk','company','pricing','manual'].map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={ls}>Tags (optional)</label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="minimum, investment, amount" style={inp2} />
            </div>
          </div>
          {saveMsg && <div style={{ background:saveMsg.startsWith('✓')?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${saveMsg.startsWith('✓')?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'10px 14px', color:saveMsg.startsWith('✓')?'#4ade80':'#ef4444', fontSize:'13px', marginBottom:'16px' }}>{saveMsg}</div>}
          <button onClick={addManual} disabled={saving || !q.trim() || !a.trim()}
            style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'12px 32px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
            {saving ? 'Saving…' : '+ Add Entry'}
          </button>
        </div>
      )}

      {/* ── UPLOAD DOCUMENT ── */}
      {section === 'upload' && (
        <div style={{ maxWidth:'640px' }}>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 8px', fontSize:'16px' }}>Upload Document</h3>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 24px', lineHeight:1.7 }}>
            Upload a PDF, Word doc, or text file. The AI will read the entire document and extract every useful Q&A pair automatically. A 56-page document produces 60-100+ entries.
          </p>

          <div
            onClick={() => !uploading && fileRef.current?.click()}
            style={{ border:`2px dashed ${uploading?'rgba(184,147,58,0.5)':'rgba(255,255,255,0.15)'}`, borderRadius:'8px', padding:'48px', textAlign:'center', cursor:uploading?'default':'pointer', background:'rgba(255,255,255,0.02)', transition:'all 0.2s' }}
            onMouseEnter={e => { if (!uploading) e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.background = 'rgba(184,147,58,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv" onChange={handleFileUpload} style={{ display:'none' }} />
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>{uploading ? '⏳' : '📄'}</div>
            <div style={{ color: uploading ? GOLD : '#e8e0d0', fontSize:'15px', marginBottom:'6px', fontWeight:'bold' }}>
              {uploading ? uploadProgress || 'Processing…' : 'Click to select a file'}
            </div>
            <div style={{ color:'#4a5568', fontSize:'12px' }}>PDF, Word (.docx), TXT, Markdown, CSV — max 10MB</div>
          </div>

          {uploadMsg && (
            <div style={{ marginTop:'16px', background:uploadMsg.startsWith('✓')?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${uploadMsg.startsWith('✓')?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'12px 16px', color:uploadMsg.startsWith('✓')?'#4ade80':'#ef4444', fontSize:'13px' }}>
              {uploadMsg}
            </div>
          )}

          {/* Sources already loaded */}
          {sources.length > 0 && (
            <div style={{ marginTop:'28px' }}>
              <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Documents Already Loaded ({sources.length})</div>
              {sources.map(src => {
                const count = entries.filter(e => e.source === src && e.category !== 'raw_document').length;
                return (
                  <div key={src} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', marginBottom:'4px' }}>
                    <div>
                      <span style={{ color:'#c4cdd8', fontSize:'13px' }}>{src}</span>
                      <span style={{ color:'#4a5568', fontSize:'11px', marginLeft:'10px' }}>{count} entries</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Delete all entries from "${src}"?`)) return;
                        const toDelete = entries.filter(e => e.source === src);
                        for (const e of toDelete) { try { await base44.entities.KnowledgeBase.delete(e.id); } catch {} }
                        await load();
                      }}
                      style={{ background:'none', border:'none', color:'#ef444466', cursor:'pointer', fontSize:'13px' }}>
                      × Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SCRAPE WEBSITE ── */}
      {section === 'scrape' && (
        <div style={{ maxWidth:'640px' }}>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 8px', fontSize:'16px' }}>Scrape Website</h3>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 24px', lineHeight:1.7 }}>
            Enter a URL and the AI will fetch the page, strip the noise, and extract every useful Q&A pair. Works best on product pages, FAQs, about pages, and documentation.
          </p>

          <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
            <input value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)}
              placeholder="https://www.rosieai.tech/about"
              onKeyDown={e => { if (e.key === 'Enter' && !scraping) handleScrape(); }}
              style={{ ...inp2, flex:1 }} />
            <button onClick={handleScrape} disabled={scraping || !scrapeUrl.trim()}
              style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'10px 20px', cursor:'pointer', fontWeight:'700', fontSize:'12px', whiteSpace:'nowrap' }}>
              {scraping ? '⏳ Scraping…' : '🌐 Scrape'}
            </button>
          </div>

          {scrapeMsg && (
            <div style={{ background:scrapeMsg.startsWith('✓')?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${scrapeMsg.startsWith('✓')?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'12px 16px', color:scrapeMsg.startsWith('✓')?'#4ade80':'#ef4444', fontSize:'13px', marginBottom:'16px' }}>
              {scrapeMsg}
            </div>
          )}

          <div style={{ background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'4px', padding:'14px 16px', fontSize:'12px', color:'#8a9ab8', lineHeight:1.8 }}>
            <strong style={{ color:'#60a5fa' }}>Tip:</strong> Scrape multiple pages for best coverage — home page, features, pricing, FAQ, about. Each URL is processed separately and its entries are tagged with the source URL so you can remove them later.
          </div>
        </div>
      )}

      {/* ── INTENT ENGINE TUNING ── */}
      {section === 'intent' && (
        <IntentEngineTuner />
      )}

      {/* ── COACH RULES TUNING ── */}
      {section === 'coach' && (
        <CoachRulesTuner />
      )}

    </div>
  );
}

// ─── Intent Engine Tuner ──────────────────────────────────────────────────
function IntentEngineTuner() {
  const [s, setS]       = useState(getPortalSettings);
  const [saved, setSaved] = useState(false);
  useEffect(() => { loadPortalSettings().then(setS); }, []);

  const duckDef = s.intentDuckDefinition || `Argumentative, skeptical, raises objections, tries to prove things wrong, combative tone, says things like "that won't work", "I doubt that", "prove it".`;
  const cowDef  = s.intentCowDefinition  || `Agreeable, curious, open-minded, says things like "that's interesting", "really?", "wow", asks genuine questions, believes what you say, enthusiastic listener.`;
  const triggers = s.intentTriggerKeywords || 'minimum investment, how much, returns, roi, risk, guaranteed, lock-up, liquidity, accredited, fees, cost, sec, regulation';
  const interval = s.intentIntervalSeconds || 20;

  const save = async () => {
    await savePortalSettings({ ...s, intentDuckDefinition: duckDef2, intentCowDefinition: cowDef2, intentTriggerKeywords: triggers2, intentIntervalSeconds: Number(interval2) });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const [duckDef2, setDuckDef2]     = useState(duckDef);
  const [cowDef2, setCowDef2]       = useState(cowDef);
  const [triggers2, setTriggers2]   = useState(triggers);
  const [interval2, setInterval2]   = useState(interval);

  const ta = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'vertical' };
  const inp3 = { ...ta, minHeight:'unset', resize:'none' };

  return (
    <div style={{ maxWidth:'700px' }}>
      <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 8px', fontSize:'16px' }}>🦆 Intent Engine Tuning</h3>
      <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 24px', lineHeight:1.7 }}>
        The intent engine runs every <strong style={{ color:GOLD }}>{interval2}s</strong> during a live call and classifies the prospect as a Duck (skeptic) or Cow (believer). It also scores buying intent and question quality. Tune the definitions and what triggers Q&A lookups below.
      </p>

      <div style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
        <div style={{ color:'#f59e0b', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>🦆 Duck Definition</div>
        <textarea value={duckDef2} onChange={e => setDuckDef2(e.target.value)} rows={4} style={ta} />
        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'6px' }}>Describe what behaviors and phrases identify a Duck (skeptic/arguer). The AI uses this exact text.</div>
      </div>

      <div style={{ background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
        <div style={{ color:'#4ade80', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>🐄 Cow Definition</div>
        <textarea value={cowDef2} onChange={e => setCowDef2(e.target.value)} rows={4} style={ta} />
        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'6px' }}>Describe what behaviors and phrases identify a Cow (believer/agreeable). The AI uses this exact text.</div>
      </div>

      <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>❓ Auto Q&A Trigger Keywords</div>
        <textarea value={triggers2} onChange={e => setTriggers2(e.target.value)} rows={3} style={ta} />
        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'6px' }}>Comma-separated keywords. When detected in the transcript, the AI instantly looks up an answer from the KB. These replace the hardcoded patterns.</div>
      </div>

      <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'24px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>⏱ Intent Check Interval (seconds)</div>
        <input type="number" value={interval2} onChange={e => setInterval2(e.target.value)} min={10} max={60} style={{ ...inp3, width:'120px' }} />
        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'6px' }}>How often the intent engine runs during a live call. Default: 20s. Lower = more responsive but more API calls.</div>
      </div>

      <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
        <button onClick={save} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'12px 28px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Save Rules</button>
        {saved && <span style={{ color:'#4ade80', fontSize:'13px' }}>✓ Saved — live on next call</span>}
      </div>
    </div>
  );
}

// ─── Coach Rules Tuner ────────────────────────────────────────────────────
function CoachRulesTuner() {
  const [s, setS]       = useState(getPortalSettings);
  const [saved, setSaved] = useState(false);
  useEffect(() => { loadPortalSettings().then(setS); }, []);

  const [focus, setFocus]       = useState(s.coachFocusAreas     || 'next talking point, handling the last objection raised, building rapport, timing a close, addressing price concerns, reinforcing credibility');
  const [style, setStyle]       = useState(s.coachStyle          || 'Be direct and conversational. The agent reads this live mid-call. Maximum 2 sentences. Start with the action, not the reason.');
  const [interval, setInterval] = useState(s.coachIntervalSeconds || 15);
  const [context, setContext]   = useState(s.coachAdditionalContext || '');

  const save = async () => {
    await savePortalSettings({ ...s, coachFocusAreas: focus, coachStyle: style, coachIntervalSeconds: Number(interval), coachAdditionalContext: context });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const ta = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'vertical' };

  return (
    <div style={{ maxWidth:'700px' }}>
      <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 8px', fontSize:'16px' }}>🎯 Coach Mode Rules</h3>
      <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 24px', lineHeight:1.7 }}>
        Coach mode fires every <strong style={{ color:GOLD }}>{interval}s</strong> when enabled on a live call and gives the agent one real-time tip. Tune what the coach focuses on and how it communicates.
      </p>

      <div style={{ background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
        <div style={{ color:'#a78bfa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>🎯 Focus Areas</div>
        <textarea value={focus} onChange={e => setFocus(e.target.value)} rows={3} style={ta} />
        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'6px' }}>What the coach should focus tips on. Comma-separated or written naturally — the AI reads this directly.</div>
      </div>

      <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>🗣 Coaching Style</div>
        <textarea value={style} onChange={e => setStyle(e.target.value)} rows={3} style={ta} />
        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'6px' }}>Instructions for tone and format of coach tips. This is injected directly into the coach prompt.</div>
      </div>

      <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>📋 Additional Context for Coach</div>
        <textarea value={context} onChange={e => setContext(e.target.value)} rows={4} style={ta} placeholder="E.g. Our minimum investment is $25,000. Always mention the Q3 close deadline. Never mention competitors by name..." />
        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'6px' }}>Any specific facts, rules, or context the coach should always be aware of. Added to every coach prompt.</div>
      </div>

      <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'24px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>⏱ Coach Interval (seconds)</div>
        <input type="number" value={interval} onChange={e => setInterval(e.target.value)} min={10} max={60} style={{ width:'120px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none' }} />
        <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'6px' }}>How often coach tips fire. Default: 15s.</div>
      </div>

      <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
        <button onClick={save} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'12px 28px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Save Rules</button>
        {saved && <span style={{ color:'#4ade80', fontSize:'13px' }}>✓ Saved — live on next call</span>}
      </div>
    </div>
  );
}

const VIEWS = [
  { id:'users',    label:'CRM / Clients' },
  { id:'leads',    label:'Leads' },
  { id:'calendar', label:'Calendar' },
  { id:'analytics',label:'Analytics' },
  { id:'activity', label:'Recent Activity' },
  { id:'kb',       label:'🧠 Knowledge Base' },
  { id:'signnow',  label:'SignNow Requests' },
  { id:'portal',   label:'Portal Controls' },
  { id:'signnow-settings', label:'SignNow Settings' },
  { id:'settings', label:'Admin Settings' },
];

export default function AdminDashboard() {
  const { portalUser, isAdmin, isPortalLoading, portalLogout, getAllUsers, removeUser, changeAdminPassword, changeAdminUsername } = usePortalAuth();
  const [view, setView]           = useState(() => localStorage.getItem('admin_view') || 'users');
  const [users, setUsers]         = useState([]);
  const [showAdd, setShowAdd]     = useState(false);
  const [contactCard, setContactCard] = useState(null);
  const [allSessions, setAllSessions] = useState([]);
  const [globalStats, setGlobalStats] = useState({ totalSessions:0, totalTime:0, totalDownloads:0, totalDocViews:0 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [portalSettings, setPortalSettings] = useState({});
  const [dialerLead, setDialerLead] = useState(null);
  const [showDialer, setShowDialer] = useState(false);
  const [crmSidebar, setCrmSidebar] = useState('investors'); // 'investors' | 'activity'
  const [activityFilter, setActivityFilter] = useState('all');
  const [newSignNowCount, setNewSignNowCount] = useState(0);
  const [signNowAlertDismissed, setSignNowAlertDismissed] = useState(() => parseInt(localStorage.getItem('sn_dismissed_count') || '0'));
  const navigate = useNavigate();

  const handleViewChange = (v) => { setView(v); localStorage.setItem('admin_view', v); };

  const matchesUser = useCallback((session, user) => {
    const n = v => (v||'').toLowerCase().trim();
    return (n(user.email) && n(session.userEmail) && n(session.userEmail)===n(user.email))
        || (n(user.username) && n(session.username) && n(session.username)===n(user.username));
  }, []);

  const load = useCallback(async () => {
    try {
      const [usersData, sessions, ps] = await Promise.all([getAllUsers(), analytics.getAllSessions(), loadPortalSettings()]);
      setUsers(usersData); setAllSessions(sessions); setPortalSettings(ps);
      const global = await analytics.computeGlobalStats(sessions); setGlobalStats(global);
      // Count new signnow requests since last dismissed
      try {
        const snReqs = await SignNowRequestDB.listAll();
        const dismissed = parseInt(localStorage.getItem('sn_dismissed_count') || '0');
        setNewSignNowCount(Math.max(0, snReqs.length - dismissed));
      } catch {}
    } catch(e) { console.error('[Admin] load error:', e); }
  }, [getAllUsers]);

  useEffect(() => {
    if (isPortalLoading) return;
    if (!portalUser || !isAdmin) { navigate('/admin-login'); return; }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [portalUser, isAdmin, isPortalLoading, load]);

  if (isPortalLoading) return (
    <div style={{ minHeight:'100vh', background:'#060c18', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'32px', height:'32px', border:'3px solid rgba(184,147,58,0.2)', borderTop:'3px solid #b8933a', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!portalUser || !isAdmin) return null;

  const nonAdminUsers  = users.filter(u => u.role !== 'admin');
  const filteredUsers  = nonAdminUsers.filter(u => filterStatus === 'all' || (u.status||'prospect') === filterStatus);
  const recentSessions = allSessions.filter(s=>s.startTime).sort((a,b)=>new Date(b.startTime)-new Date(a.startTime)).slice(0,15);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div style={{ minHeight:'100vh', background:'#060c18', fontFamily:'Georgia, serif', color:'#e8e0d0' }}>
      <nav style={{ background:DARK, borderBottom:'1px solid rgba(184,147,58,0.2)', position:'sticky', top:0, zIndex:200 }}>
        {/* Top bar with inline KPIs */}
        <div style={{ padding:isMobile ? '0 12px' : '0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px', gap:'8px' }}>
          {/* Left: Logo + title */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
            <img src={LOGO} alt="Rosie AI" style={{ height:'28px', width:'auto' }} />
            {!isMobile && <><div style={{ width:'1px', height:'16px', background:'rgba(184,147,58,0.3)' }} />
            <span style={{ color:GOLD, fontSize:'8px', letterSpacing:'3px', textTransform:'uppercase' }}>Admin Dashboard</span></>}
          </div>
          {/* Center: KPI strip — visible on all tabs */}
          {!isMobile && (
            <div style={{ display:'flex', alignItems:'center', gap:'0', flex:1, justifyContent:'center' }}>
              {[
                { label:'Clients',   value:nonAdminUsers.length,                                                  icon:'👥', color:GOLD      },
                { label:'Investors', value:nonAdminUsers.filter(u=>u.status==='investor').length,                 icon:'✅', color:'#4ade80' },
                { label:'Prospects', value:nonAdminUsers.filter(u=>(u.status||'prospect')==='prospect').length,   icon:'🔷', color:'#a78bfa' },
                { label:'Sessions',  value:globalStats.totalSessions,                                             icon:'🔐', color:'#f59e0b' },
                { label:'Time',      value:analytics.formatDuration(globalStats.totalTime),                       icon:'⏱',  color:'#a78bfa' },
              ].map(({label,value,icon,color}) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 12px', borderRight:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
                  <span style={{ fontSize:'11px' }}>{icon}</span>
                  <div>
                    <div style={{ color, fontSize:'13px', fontWeight:'bold', lineHeight:1.1 }}>{value}</div>
                    <div style={{ color:'#4a5568', fontSize:'7px', letterSpacing:'1px', textTransform:'uppercase' }}>{label}</div>
                  </div>
                </div>
              ))}
              {/* SignNow — always visible, shows 0 when cleared */}
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
            </div>
          )}
          {/* Right: Actions */}
          <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
            <button onClick={load} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'10px' }}>↻</button>
            <button onClick={() => navigate('/portal')} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'10px' }}>Portal</button>
            <button onClick={() => { portalLogout(); navigate('/'); }} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'10px' }}>Logout</button>
          </div>
        </div>
        {/* Tab Navigation */}
        <div style={{ display:'flex', overflowX:'auto', borderTop:'1px solid rgba(255,255,255,0.05)', scrollbarWidth:'none' }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => handleViewChange(v.id)}
              style={{ background:'none', border:'none', borderBottom:view===v.id?`2px solid ${GOLD}`:'2px solid transparent', color:view===v.id?GOLD:'#6b7280', padding:isMobile?'8px 10px':'10px 18px', cursor:'pointer', fontSize:isMobile?'9px':'11px', letterSpacing:'1px', whiteSpace:'nowrap', flexShrink:0, transition:'color 0.15s' }}>
              {v.label}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth:'1600px', margin:'0 auto', padding:isMobile?'12px 16px':'24px 32px' }}>

        {/* Upcoming appointments — only on CRM/Leads tabs */}
        {(view === 'users' || view === 'leads') && (
          <UpcomingReminders
            onOpenLeadCard={(lead) => {}}
            onOpenUserCard={(investorId) => { const u = users.find(u => u.id === investorId); if (u) setContactCard(u); }}
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
            {/* CRM Sidebar */}
            <div style={{ width:'190px', flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ padding:'0 0 12px 0' }}>
                {[
                  { id:'investors', icon:'👥', label:'Investors' },
                  { id:'activity',  icon:'⚡', label:'Investor Activity' },
                ].map(item => (
                  <button key={item.id} onClick={() => setCrmSidebar(item.id)}
                    style={{ display:'block', width:'100%', textAlign:'left', background: crmSidebar===item.id ? 'rgba(184,147,58,0.1)' : 'transparent', border:'none', borderLeft: crmSidebar===item.id ? `3px solid ${GOLD}` : '3px solid transparent', padding:'10px 14px', color: crmSidebar===item.id ? GOLD : '#6b7280', fontSize:'12px', cursor:'pointer', letterSpacing:'0.5px', transition:'all 0.15s' }}>
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
              {/* Activity filter — only when activity tab is active */}
              {crmSidebar === 'activity' && (
                <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>Filter</div>
                  {[
                    ['all',           'All Activity'],
                    ['login',         '🔐 Portal Logins'],
                    ['rosie',         '🤖 Rosie AI'],
                    ['download',      '📥 Downloads'],
                    ['offering',      '📄 Offering Read'],
                    ['sub_agreement', '✍️ Sub Agreement'],
                    ['questionnaire', '📋 Questionnaire'],
                  ].map(([id, label]) => (
                    <button key={id} onClick={() => setActivityFilter(id)}
                      style={{ display:'block', width:'100%', textAlign:'left', background: activityFilter===id ? 'rgba(255,255,255,0.06)' : 'transparent', border:'none', borderRadius:'2px', padding:'6px 10px', color: activityFilter===id ? '#e8e0d0' : '#4a5568', fontSize:'11px', cursor:'pointer', marginBottom:'2px' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CRM Main Content */}
            <div style={{ flex:1, paddingLeft:'24px', minWidth:0 }}>

              {/* ── Investors Table ── */}
              {crmSidebar === 'investors' && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
                    <div />
                    <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ display:'flex', gap:'4px' }}>
                        {[['all','All'],['prospect','Potential Investors'],['investor','Investors']].map(([s,l]) => (
                          <button key={s} onClick={() => setFilterStatus(s)}
                            style={{ padding:'7px 14px', background:filterStatus===s?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.05)', border:`1px solid ${filterStatus===s?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', color:filterStatus===s?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>
                            {l}
                          </button>
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
                            const us  = allSessions.filter(s => matchesUser(s, user));
                            const st  = analytics.computeUserStats(us);
                            const status = user.status || 'prospect';
                            return (
                              <tr key={user.username||user.email}
                                onClick={() => setContactCard(user)}
                                style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', transition:'background 0.1s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td style={{ padding:'14px 12px' }}><StatusBadge status={status} /></td>
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

              {/* ── Investor Activity ── */}
              {crmSidebar === 'activity' && (
                <RecentInvestorEvents
                  filter={activityFilter}
                  onOpenUserCard={(investorId) => { const u = users.find(u => u.id === investorId); if (u) setContactCard(u); }}
                />
              )}

            </div>
          </div>
        )}

        {/* ── Calendar ── */}
        {view === 'calendar' && <GlobalCalendar users={users} setContactCard={setContactCard} setView={handleViewChange} />}

        {/* ── Analytics ── */}
        {view === 'analytics' && (() => {
          // Compute all users with scores, sorted by score desc
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
                        {/* Rank + Name */}
                        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                          <div style={{ width:'32px', textAlign:'center', fontSize:'20px', flexShrink:0 }}>
                            {medals[rank] || <span style={{ color:'#4a5568', fontSize:'14px', fontWeight:'bold' }}>#{rank+1}</span>}
                          </div>
                          <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:`${col}20`, border:`2px solid ${col}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>
                            {(user.name||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ color:'#e8e0d0', fontSize:'15px', fontWeight:'bold' }}>{user.name}</div>
                            <div style={{ color:'#4a5568', fontSize:'11px' }}>@{user.username} · {analytics.formatDate(st.lastSeen)}</div>
                          </div>
                          <StatusBadge status={user.status||'prospect'} />
                        </div>

                        {/* Score */}
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', background:`${col}15`, border:`1px solid ${col}44`, borderRadius:'20px', padding:'6px 14px' }}>
                          <div style={{ width:'26px', height:'26px', borderRadius:'50%', border:`2px solid ${col}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ color:col, fontSize:'10px', fontWeight:'bold' }}>{score}</span>
                          </div>
                          <span style={{ color:col, fontSize:'13px', fontWeight:'bold' }}>{getScoreLabel(score)}</span>
                        </div>

                        {/* Stats */}
                        <div style={{ display:'flex', gap:'20px' }}>
                          {[
                            [st.sessionCount,'Logins',GOLD],
                            [analytics.formatDuration(st.totalTime),'Time','#4ade80'],
                            [st.totalDownloads,'Downloads','#60a5fa'],
                            [st.totalDocViews,'Doc Views','#f59e0b'],
                          ].map(([v,l,c]) => (
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

        {/* ── Recent Activity ── */}
        {view === 'activity' && (
          <div>
            <h2 style={{ color:'#e8e0d0', margin:'0 0 24px', fontSize:'20px', fontWeight:'normal' }}>Recent Activity</h2>
            {recentSessions.length === 0 ? <p style={{ color:'#4a5568', textAlign:'center', padding:'60px' }}>No activity yet.</p> :
              recentSessions.map((sess, i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'18px 20px', marginBottom:'8px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
                  <div>
                    <div style={{ color:'#e8e0d0', fontWeight:'bold', marginBottom:'3px' }}>{sess.userName||sess.userEmail} <span style={{ color:'#4a5568', fontWeight:'normal', fontFamily:'monospace', fontSize:'12px' }}>@{sess.username}</span></div>
                    <div style={{ color:'#6b7280', fontSize:'12px' }}>{analytics.formatDateTime(sess.startTime)}</div>
                    <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'4px', display:'flex', gap:'12px' }}>
                      <span>📄 {sess.pages?.length||0} pages</span>
                      <span>📥 {sess.downloads?.length||0} downloads</span>
                      {!sess.endTime && <span style={{ color:'#4ade80' }}>● Active</span>}
                    </div>
                    {(sess.downloads||[]).length > 0 && (
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginTop:'6px' }}>
                        {(sess.downloads||[]).map((d,di) => <span key={di} style={{ background:'rgba(96,165,250,0.1)', color:'#60a5fa', fontSize:'10px', padding:'2px 6px', borderRadius:'2px' }}>↓ {d.fileName}</span>)}
                      </div>
                    )}
                  </div>
                  <div style={{ color:GOLD, fontWeight:'bold', fontSize:'16px' }}>{analytics.formatDuration(sess.durationSeconds)}</div>
                </div>
              ))
            }
          </div>
        )}

        {view === 'leads'            && <LeadsTab />}
        {view === 'kb'               && <KnowledgeBaseManager />}
        {view === 'signnow'          && <SignNowRequestsView settings={portalSettings} />}
        {view === 'signnow-settings' && <SignNowSettings settings={portalSettings} onSettingsSaved={s => setPortalSettings(s)} />}
        {view === 'portal'           && <div><div style={{ marginBottom:'28px' }}><h2 style={{ color:'#e8e0d0', margin:'0 0 6px', fontSize:'20px', fontWeight:'normal' }}>Portal Controls</h2></div><PortalControls /></div>}
        {view === 'settings'         && <AdminSettings changeAdminPassword={changeAdminPassword} changeAdminUsername={changeAdminUsername} />}
      </div>
    </div>
  );
}