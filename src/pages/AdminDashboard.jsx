import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import analytics from '@/lib/analytics';
import { getPortalSettings, loadPortalSettings, savePortalSettings } from '@/lib/portalSettings';
import { SignNowRequestDB, InvestorUser, ContactNoteDB, AppointmentDB, AccreditationDocDB } from '@/api/entities';
import { signnowSendDocuments, signnowGetToken } from '@/lib/signnow';
import LeadsTab from '@/components/leads/LeadsTab';
import TwilioDialer from '@/components/leads/TwilioDialer';
import PortalAccessTab from '@/components/admin/PortalAccessTab';
import { base44 } from '@/api/base44Client';

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
    ['overview','👤 Overview'], ['history','📞 History'], ['activity','📊 Activity'],
    ['documents','📄 Documents'], ['accreditation','🔐 Accreditation'], ['calendar','📅 Calendar'],
    ['portal','🔑 Portal Access'],
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

  return (
    <>
    {showDialerLocal && (
      <TwilioDialer
        initialLead={dialerLead}
        onClose={() => { setShowDialerLocal(false); setDialerLead(null); }}
        onCallLogged={handleCallLogged}
      />
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
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
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
          {TABS.map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background:'none', border:'none', borderBottom:tab===id?`2px solid ${GOLD}`:'2px solid transparent', color:tab===id?GOLD:'#6b7280', padding:'12px 16px', cursor:'pointer', fontSize:'11px', letterSpacing:'1px', whiteSpace:'nowrap' }}>{label}</button>
          ))}
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
              {notes.map((note, i) => (
                <div key={note.id} style={{ display:'flex', gap:'14px', marginBottom:'16px' }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'24px', flexShrink:0 }}>
                    <div style={{ fontSize:'18px' }}>{noteTypeIcons[note.type]||'📝'}</div>
                    {i < notes.length-1 && <div style={{ width:'1px', flex:1, background:'rgba(255,255,255,0.06)', marginTop:'4px' }} />}
                  </div>
                  <div style={{ flex:1, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'2px', padding:'14px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                      <span style={{ color:GOLD, fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px' }}>{note.type}</span>
                      <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                        <span style={{ color:'#4a5568', fontSize:'11px' }}>{note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}</span>
                        <button onClick={() => deleteNote(note.id)} style={{ background:'none', border:'none', color:'#ef444480', cursor:'pointer', fontSize:'14px', padding:'0' }}>×</button>
                      </div>
                    </div>
                    <p style={{ color:'#c4cdd8', fontSize:'13px', margin:0, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{note.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACTIVITY */}
          {tab === 'activity' && (
            <div>
              {loading && <p style={{ color:'#6b7280', textAlign:'center' }}>Loading…</p>}
              {/* KPIs */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'10px', marginBottom:'20px' }}>
                {[
                  [stats.sessionCount,'Sessions',GOLD],
                  [analytics.formatDuration(stats.totalTime),'Time','#4ade80'],
                  [stats.totalDownloads,'Downloads','#60a5fa'],
                  [stats.totalDocViews,'Doc Views','#f59e0b'],
                  [analytics.formatDate(stats.firstSeen),'First Login','#8a9ab8'],
                  [analytics.formatDate(stats.lastSeen),'Last Login','#8a9ab8'],
                ].map(([v,l,c]) => (
                  <div key={l} style={{ background:'rgba(0,0,0,0.2)', padding:'10px', textAlign:'center', borderRadius:'2px' }}>
                    <div style={{ color:c, fontSize:'16px', fontWeight:'bold', marginBottom:'3px' }}>{v}</div>
                    <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase' }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* All downloads */}
              {(() => {
                const allDownloads = sessions.flatMap(s => (s.downloads||[]).map(d => ({ ...d, sessionStart: s.startTime })));
                return allDownloads.length > 0 ? (
                  <div style={{ background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'2px', padding:'16px', marginBottom:'16px' }}>
                    <div style={{ color:'#60a5fa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>📥 All Downloads ({allDownloads.length})</div>
                    {allDownloads.map((d,i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:'12px' }}>
                        <span style={{ color:'#c4cdd8' }}>{d.fileName}</span>
                        <span style={{ color:'#4a5568' }}>{d.downloadedAt ? new Date(d.downloadedAt).toLocaleString() : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* Sessions */}
              {sessions.length === 0 ? <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No sessions yet.</p> :
                sessions.map((sess, i) => (
                  <div key={i} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'2px', padding:'14px 18px', marginBottom:'8px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                      <span style={{ color:'#e8e0d0', fontSize:'13px' }}>{analytics.formatDateTime(sess.startTime)}</span>
                      <span style={{ color:GOLD, fontWeight:'bold' }}>{analytics.formatDuration(sess.durationSeconds)}</span>
                    </div>
                    <div style={{ color:'#6b7280', fontSize:'11px', display:'flex', gap:'16px' }}>
                      <span>📄 {sess.pages?.length||0} pages</span>
                      <span>📥 {sess.downloads?.length||0} downloads</span>
                      <span>👁 {sess.docViews?.length||0} doc views</span>
                      {!sess.endTime && <span style={{ color:'#4ade80' }}>● Active Now</span>}
                    </div>
                    {(sess.downloads||[]).length > 0 && (
                      <div style={{ marginTop:'8px', display:'flex', flexWrap:'wrap', gap:'4px' }}>
                        {(sess.downloads||[]).map((d,di) => (
                          <span key={di} style={{ background:'rgba(96,165,250,0.1)', color:'#60a5fa', fontSize:'10px', padding:'2px 8px', borderRadius:'2px' }}>↓ {d.fileName}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
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
                  <F label="Date & Time" value={apptForm.scheduledAt} onChange={e=>setApptForm({...apptForm,scheduledAt:e.target.value})} type="datetime-local" />
                  <F label="Duration (minutes)" value={apptForm.durationMinutes} onChange={e=>setApptForm({...apptForm,durationMinutes:Number(e.target.value)})} type="number" />
                </div>
                <TA label="Notes" value={apptForm.notes} onChange={e=>setApptForm({...apptForm,notes:e.target.value})} rows={2} placeholder="Agenda, talking points…" />
                <button onClick={addAppt} disabled={!apptForm.title||!apptForm.scheduledAt} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'9px 24px', cursor:'pointer', fontWeight:'bold', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>Book Appointment</button>
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
function GlobalCalendar() {
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AppointmentDB.listAll().then(a => { setAppts(a); setLoading(false); });
  }, []);

  const future = appts.filter(a => new Date(a.scheduledAt) >= new Date());
  const past   = appts.filter(a => new Date(a.scheduledAt) < new Date());
  const sc = { scheduled:GOLD, completed:'#4ade80', cancelled:'#4a5568', 'no-show':'#ef4444' };

  const ApptRow = ({ appt }) => (
    <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'16px 20px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div>
        <div style={{ color:'#e8e0d0', fontWeight:'bold', marginBottom:'3px' }}>{appt.title}</div>
        <div style={{ color:'#8a9ab8', fontSize:'12px' }}>{appt.investorName} · {new Date(appt.scheduledAt).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</div>
        {appt.notes && <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'2px' }}>{appt.notes}</div>}
      </div>
      <span style={{ color:sc[appt.status||'scheduled'], fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px' }}>● {appt.status||'scheduled'}</span>
    </div>
  );

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>Calendar</h2>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>All scheduled appointments across all investors.</p>
        </div>
        <div style={{ color:GOLD, fontSize:'28px', fontWeight:'bold' }}>{future.length} upcoming</div>
      </div>
      {loading && <p style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</p>}
      {!loading && (
        <>
          {future.length > 0 && (
            <div style={{ marginBottom:'32px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px', paddingBottom:'8px', borderBottom:'1px solid rgba(184,147,58,0.2)' }}>📅 Upcoming</div>
              {future.map(a => <ApptRow key={a.id} appt={a} />)}
            </div>
          )}
          {future.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No upcoming appointments.</p>}
          {past.length > 0 && (
            <div style={{ opacity:0.5 }}>
              <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px', paddingBottom:'8px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>✓ Past</div>
              {past.slice(0,10).map(a => <ApptRow key={a.id} appt={a} />)}
            </div>
          )}
        </>
      )}
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
  const sections = [['raise','📊 Raise Progress'],['contact','📍 Contact'],['content','✏️ Content'],['terms','📋 Terms'],['toggles','⚙️ Visibility']];
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
        {sec==='toggles' && <div><h3 style={{ color:'#e8e0d0', margin:'0 0 20px', fontWeight:'normal' }}>Visibility</h3><Tog label="Portal Active" value={s.portalActive} onToggle={()=>upd('portalActive',!s.portalActive)} /><Tog label="Show Investment Calculator" value={s.showCalculator} onToggle={()=>upd('showCalculator',!s.showCalculator)} /><Tog label="Show Market Data Tab" value={s.showMarketData} onToggle={()=>upd('showMarketData',!s.showMarketData)} /><Tog label="Show Subscription Tab" value={s.showSubscription} onToggle={()=>upd('showSubscription',!s.showSubscription)} /></div>}
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
  const ms = t => ({ background:t==='success'?'rgba(74,222,128,0.1)':'rgba(220,60,60,0.12)', border:`1px solid ${t==='success'?'rgba(74,222,128,0.3)':'rgba(220,60,60,0.3)'}`, borderRadius:'2px', padding:'10px 14px', color:t==='success'?'#4ade80':'#ff8a8a', fontSize:'13px', marginBottom:'16px' });
  return (
    <div>
      <h2 style={{ color:'#e8e0d0', margin:'0 0 32px', fontSize:'20px', fontWeight:'normal' }}>Admin Settings</h2>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'32px' }}>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'28px' }}>
          <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 20px' }}>Change Admin Username</h3>
          <F label="Current Password" value={unForm.current} onChange={e=>setUnForm({...unForm,current:e.target.value})} type="password" />
          <F label="New Username" value={unForm.newUsername} onChange={e=>setUnForm({...unForm,newUsername:e.target.value})} />
          {unMsg && <div style={ms(unMsg.type)}>{unMsg.text}</div>}
          <button onClick={()=>{ const r=changeAdminUsername(unForm.current,unForm.newUsername); if(r.success){setUnMsg({type:'success',text:'Updated.'});setUnForm({current:'',newUsername:''});}else setUnMsg({type:'error',text:r.error}); }} style={{ width:'100%', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Update Username</button>
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'28px' }}>
          <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 20px' }}>Change Admin Password</h3>
          <F label="Current Password" value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})} type="password" />
          <F label="New Password" value={pwForm.newPw} onChange={e=>setPwForm({...pwForm,newPw:e.target.value})} type="password" />
          <F label="Confirm New Password" value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} type="password" />
          {pwMsg && <div style={ms(pwMsg.type)}>{pwMsg.text}</div>}
          <button onClick={()=>{ if(pwForm.newPw!==pwForm.confirm){setPwMsg({type:'error',text:'Passwords do not match'});return;} const r=changeAdminPassword(pwForm.current,pwForm.newPw); if(r.success){setPwMsg({type:'success',text:'Updated.'});setPwForm({current:'',newPw:'',confirm:''});}else setPwMsg({type:'error',text:r.error}); }} style={{ width:'100%', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Update Password</button>
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
const VIEWS = [
  { id:'users',    label:'CRM / Clients' },
  { id:'leads',    label:'Leads' },
  { id:'calendar', label:'Calendar' },
  { id:'analytics',label:'Analytics' },
  { id:'activity', label:'Recent Activity' },
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

  return (
    <div style={{ minHeight:'100vh', background:'#060c18', fontFamily:'Georgia, serif', color:'#e8e0d0' }}>
      <nav style={{ background:DARK, borderBottom:'1px solid rgba(184,147,58,0.2)', position:'sticky', top:0, zIndex:200 }}>
        {/* Top bar */}
        <div style={{ padding:'0 40px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'56px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
            <img src={LOGO} alt="Rosie AI" style={{ height:'34px', width:'auto' }} />
            <div style={{ width:'1px', height:'20px', background:'rgba(184,147,58,0.3)' }} />
            <span style={{ color:GOLD, fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase' }}>Admin Dashboard</span>
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <button onClick={load} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 14px', cursor:'pointer', fontSize:'11px' }}>↻ Refresh</button>
            <button onClick={() => navigate('/portal')} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 14px', cursor:'pointer', fontSize:'11px' }}>← Portal</button>
            <button onClick={() => { portalLogout(); navigate('/'); }} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 14px', cursor:'pointer', fontSize:'11px' }}>Logout</button>
          </div>
        </div>
        {/* Tab Navigation */}
        <div style={{ display:'flex', overflowX:'auto', borderTop:'1px solid rgba(255,255,255,0.05)', scrollbarWidth:'none' }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => handleViewChange(v.id)}
              style={{ background:'none', border:'none', borderBottom:view===v.id?`2px solid ${GOLD}`:'2px solid transparent', color:view===v.id?GOLD:'#6b7280', padding:'10px 18px', cursor:'pointer', fontSize:'11px', letterSpacing:'1px', whiteSpace:'nowrap', flexShrink:0, transition:'color 0.15s' }}>
              {v.label}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'40px' }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'14px', marginBottom:'32px' }}>
          {[
            { label:'Total Clients',  value:nonAdminUsers.length,                                                  icon:'👥', color:GOLD    },
            { label:'Investors',      value:nonAdminUsers.filter(u=>u.status==='investor').length,                  icon:'✅', color:'#4ade80' },
            { label:'Potential Investors', value:nonAdminUsers.filter(u=>(u.status||'prospect')==='prospect').length, icon:'🔷', color:'#a78bfa' },
            { label:'Total Sessions', value:globalStats.totalSessions,                                              icon:'🔐', color:'#f59e0b' },
            { label:'Time Spent',     value:analytics.formatDuration(globalStats.totalTime),                        icon:'⏱',  color:'#a78bfa' },
          ].map(({label,value,icon,color}) => (
            <div key={label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>{label}</div>
                  <div style={{ color, fontSize:'26px', fontWeight:'bold' }}>{value}</div>
                </div>
                <span style={{ fontSize:'22px' }}>{icon}</span>
              </div>
            </div>
          ))}
        </div>

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
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>CRM — Client Management</h2>
                <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>Click any row to open the full contact card.</p>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ display:'flex', gap:'4px' }}>
                  {[['all','All'],['prospect','Potential Investors'],['investor','Investors']].map(([s,l]) => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                      style={{ padding:'7px 14px', background:filterStatus===s?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.05)', border:`1px solid ${filterStatus===s?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', color:filterStatus===s?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>
                      {l}
                    </button>
                  ))}
                </div>
                <button onClick={() => handleViewChange('calendar')}
                  style={{ padding:'7px 14px', background:view==='calendar'?'rgba(96,165,250,0.2)':'rgba(255,255,255,0.05)', border:`1px solid ${view==='calendar'?'#60a5fa':'rgba(255,255,255,0.12)'}`, borderRadius:'2px', color:view==='calendar'?'#60a5fa':'#6b7280', cursor:'pointer', fontSize:'11px' }}>
                  📅 Calendar
                </button>
                <button onClick={() => setShowAdd(true)} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'10px 20px', cursor:'pointer', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', fontWeight:'700' }}>+ Add Client</button>
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid rgba(184,147,58,0.3)' }}>
                    {['Status','Name','Contact','Sessions','Last Active',''].map(h => (
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
          </div>
        )}

        {/* ── Calendar ── */}
        {view === 'calendar' && <GlobalCalendar />}

        {/* ── Analytics ── */}
        {view === 'analytics' && (
          <div>
            <h2 style={{ color:'#e8e0d0', margin:'0 0 24px', fontSize:'20px', fontWeight:'normal' }}>Engagement Analytics</h2>
            {nonAdminUsers.length === 0 ? <p style={{ color:'#4a5568', textAlign:'center', padding:'60px' }}>No users yet.</p> :
              nonAdminUsers.map(user => {
                const us = allSessions.filter(s => matchesUser(s, user));
                const st = analytics.computeUserStats(us);
                return (
                  <div key={user.username||user.email} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'24px', marginBottom:'16px', cursor:'pointer' }}
                    onClick={() => { setContactCard(user); }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px', flexWrap:'wrap', gap:'12px' }}>
                      <div>
                        <div style={{ color:'#e8e0d0', fontSize:'16px', fontWeight:'bold' }}>{user.name}</div>
                        <div style={{ color:'#6b7280', fontSize:'12px' }}>@{user.username} · Last seen: {analytics.formatDate(st.lastSeen)}</div>
                      </div>
                      <div style={{ display:'flex', gap:'20px' }}>
                        {[[st.sessionCount,'Sessions',GOLD],[analytics.formatDuration(st.totalTime),'Time','#4ade80'],[st.totalDownloads,'Downloads','#60a5fa']].map(([v,l,c]) => (
                          <div key={l} style={{ textAlign:'center' }}>
                            <div style={{ color:c, fontWeight:'bold', fontSize:'18px' }}>{v}</div>
                            <div style={{ color:'#4a5568', fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <span style={{ color:GOLD, fontSize:'11px' }}>Click to open full contact card →</span>
                  </div>
                );
              })
            }
          </div>
        )}

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
        {view === 'signnow'          && <SignNowRequestsView settings={portalSettings} />}
        {view === 'signnow-settings' && <SignNowSettings settings={portalSettings} onSettingsSaved={s => setPortalSettings(s)} />}
        {view === 'portal'           && <div><div style={{ marginBottom:'28px' }}><h2 style={{ color:'#e8e0d0', margin:'0 0 6px', fontSize:'20px', fontWeight:'normal' }}>Portal Controls</h2></div><PortalControls /></div>}
        {view === 'settings'         && <AdminSettings changeAdminPassword={changeAdminPassword} changeAdminUsername={changeAdminUsername} />}
      </div>
    </div>
  );
}