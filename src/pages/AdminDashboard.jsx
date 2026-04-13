import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import analytics from '@/lib/analytics';
import { getPortalSettings, loadPortalSettings, savePortalSettings, resetPortalSettings } from '@/lib/portalSettings';
import { DocusignRequestDB } from '@/api/entities';

const LOGO = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";
const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const ls  = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

// ─── Reusable stable field components ────────────────────────────────────
function F({ label, value, onChange, type='text', placeholder='', mono=false }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      {label && <label style={ls}>{label}</label>}
      <input type={type} value={value??''} onChange={onChange} placeholder={placeholder}
        style={{ ...inp, fontFamily: mono?'monospace':'Georgia, serif', fontSize: mono?'12px':'14px' }} />
    </div>
  );
}
function TA({ label, value, onChange, rows=4 }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      {label && <label style={ls}>{label}</label>}
      <textarea value={value??''} onChange={onChange} rows={rows}
        style={{ ...inp, resize:'vertical', lineHeight:1.6, fontSize:'13px' }} />
    </div>
  );
}
function Toggle({ label, value, onToggle, desc }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ color:'#c4cdd8', fontSize:'14px' }}>{label}</div>
        {desc && <div style={{ color:'#4a5568', fontSize:'12px', marginTop:'2px' }}>{desc}</div>}
      </div>
      <button onClick={onToggle} style={{ width:'48px', height:'26px', borderRadius:'13px', border:'none', cursor:'pointer', background: value?'linear-gradient(135deg,#b8933a,#d4aa50)':'rgba(255,255,255,0.1)', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
        <div style={{ position:'absolute', top:'3px', left: value?'25px':'3px', width:'20px', height:'20px', background:'#fff', borderRadius:'50%', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }} />
      </button>
    </div>
  );
}

// ─── User Activity Modal ──────────────────────────────────────────────────
function UserActivityModal({ user, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats]       = useState({ sessionCount:0, totalTime:0, totalDownloads:0, totalDocViews:0, pageTime:{}, sectionTime:{}, logins:[], lastSeen:null, firstSeen:null });
  const [tab, setTab]           = useState('sessions');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    // Query by email if available, then by username — getUserSessions merges both
    const identifier = (user.email || user.username || '').toLowerCase().trim();
    analytics.getUserSessions(identifier).then(sess => {
      setSessions(sess);
      setStats(analytics.computeUserStats(sess));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const kpis = [
    { label:'Total Sessions',  value: stats.sessionCount,                          color: GOLD    },
    { label:'Total Time',      value: analytics.formatDuration(stats.totalTime),   color:'#4ade80' },
    { label:'Downloads',       value: stats.totalDownloads,                        color:'#60a5fa' },
    { label:'Docs Viewed',     value: stats.totalDocViews,                         color:'#f59e0b' },
    { label:'First Login',     value: analytics.formatDate(stats.firstSeen),       color:'#8a9ab8' },
    { label:'Last Login',      value: analytics.formatDate(stats.lastSeen),        color:'#8a9ab8' },
  ];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', width:'100%', maxWidth:'860px', maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 40px 100px rgba(0,0,0,0.8)' }}>
        {/* Header */}
        <div style={{ padding:'24px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
          <div>
            <h3 style={{ color:GOLD, margin:'0 0 4px', fontFamily:'Georgia,serif', fontWeight:'normal', fontSize:'20px' }}>{user.name}</h3>
            <p style={{ color:'#6b7280', margin:0, fontSize:'13px' }}>@{user.username} · {user.email||'no email'} · {user.company||'No company'} · <span style={{ color:user.role==='admin'?GOLD:'#4ade80', textTransform:'uppercase', fontSize:'11px' }}>{user.role}</span></p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'22px', lineHeight:1, marginTop:'-4px' }}>×</button>
        </div>

        {loading && <div style={{ padding:'20px', textAlign:'center', color:'#6b7280' }}>Loading analytics…</div>}
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'12px', padding:'20px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background:'rgba(0,0,0,0.2)', padding:'12px 10px', textAlign:'center', borderRadius:'2px', border:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color:k.color, fontSize:'18px', fontWeight:'bold', marginBottom:'4px' }}>{k.value}</div>
              <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', lineHeight:1.3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Sub-tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          {[['sessions','Sessions'],['pages','Pages & Sections'],['documents','Documents'],['downloads','Downloads'],['logins','Login History']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background:'none', border:'none', borderBottom: tab===id?`2px solid ${GOLD}`:'2px solid transparent', color: tab===id?GOLD:'#6b7280', padding:'12px 18px', cursor:'pointer', fontSize:'12px', letterSpacing:'0.5px' }}>{label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 28px' }}>

          {/* Sessions */}
          {tab === 'sessions' && (
            sessions.length === 0
              ? <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No sessions recorded yet.</p>
              : sessions.map((sess, i) => (
                <div key={sess.id||i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'16px 20px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                    <div>
                      <div style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'14px' }}>
                        {analytics.formatDateTime(sess.startTime)}
                      </div>
                      <div style={{ color:'#6b7280', fontSize:'12px', marginTop:'2px' }}>
                        {analytics.formatTime(sess.startTime)} → {sess.endTime ? analytics.formatTime(sess.endTime) : <span style={{ color:'#4ade80' }}>Active Now</span>}
                        &nbsp;·&nbsp;{sess.pages?.length||0} pages&nbsp;·&nbsp;{sess.downloads?.length||0} downloads&nbsp;·&nbsp;{sess.docViews?.length||0} docs
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ color:GOLD, fontWeight:'bold', fontSize:'18px' }}>{analytics.formatDuration(sess.durationSeconds)}</div>
                      <div style={{ color:'#4a5568', fontSize:'10px' }}>Duration</div>
                    </div>
                  </div>
                </div>
              ))
          )}

          {/* Pages & Sections */}
          {tab === 'pages' && (
            <div>
              {Object.keys(stats.pageTime).length === 0
                ? <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No page data yet.</p>
                : <>
                  <div style={{ marginBottom:'24px' }}>
                    <div style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Time per Page (all sessions combined)</div>
                    {Object.entries(stats.pageTime).sort((a,b)=>b[1]-a[1]).map(([page, secs]) => {
                      const maxSecs = Math.max(...Object.values(stats.pageTime));
                      return (
                        <div key={page} style={{ marginBottom:'10px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                            <span style={{ color:'#c4cdd8', fontSize:'13px' }}>{page}</span>
                            <span style={{ color:GOLD, fontWeight:'bold', fontSize:'13px' }}>{analytics.formatDuration(secs)}</span>
                          </div>
                          <div style={{ background:'rgba(255,255,255,0.06)', height:'4px', borderRadius:'2px' }}>
                            <div style={{ background:GOLD, width:`${(secs/maxSecs)*100}%`, height:'100%', borderRadius:'2px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {Object.keys(stats.sectionTime).length > 0 && (
                    <div>
                      <div style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Time per Section (all sessions combined)</div>
                      {Object.entries(stats.sectionTime).sort((a,b)=>b[1]-a[1]).map(([sec, secs]) => (
                        <div key={sec} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:'12px' }}>
                          <span style={{ color:'#8a9ab8' }}>{sec}</span>
                          <span style={{ color:'#4ade80', fontWeight:'bold' }}>{analytics.formatDuration(secs)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              }
            </div>
          )}

          {/* Documents */}
          {tab === 'documents' && (
            <div>
              {sessions.flatMap(s => s.docViews||[]).length === 0
                ? <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No documents viewed yet.</p>
                : sessions.flatMap(s => s.docViews||[]).sort((a,b)=>new Date(b.openedAt)-new Date(a.openedAt)).map((dv, i) => (
                  <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'16px', marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                      <div>
                        <div style={{ color:'#e8e0d0', fontWeight:'bold', marginBottom:'3px' }}>{dv.docName}</div>
                        <div style={{ color:'#6b7280', fontSize:'12px' }}>{analytics.formatDateTime(dv.openedAt)} · {dv.pagesViewed?.length||0} pages viewed · {analytics.formatDuration(dv.durationSeconds)}</div>
                      </div>
                      <span style={{ color:GOLD, fontWeight:'bold' }}>{analytics.formatDuration(dv.durationSeconds)}</span>
                    </div>
                    {dv.pagesViewed?.length > 0 && (
                      <div style={{ paddingLeft:'12px', borderLeft:'2px solid rgba(184,147,58,0.2)' }}>
                        {dv.pagesViewed.map((pv,pi) => (
                          <div key={pi} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', padding:'4px 0', color:'#6b7280' }}>
                            <span>Page {pv.pageNum}</span>
                            <div style={{ display:'flex', gap:'16px' }}>
                              <span>{analytics.formatTime(pv.enteredAt)}</span>
                              <span style={{ color:'#4ade80' }}>{analytics.formatDuration(pv.durationSeconds)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          )}

          {/* Downloads */}
          {tab === 'downloads' && (
            <div>
              {sessions.flatMap(s => s.downloads||[]).length === 0
                ? <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No downloads yet.</p>
                : sessions.flatMap(s => s.downloads||[]).sort((a,b)=>new Date(b.downloadedAt)-new Date(a.downloadedAt)).map((d,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', alignItems:'center' }}>
                    <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                      <span style={{ color:'#4ade80', fontSize:'16px' }}>↓</span>
                      <div>
                        <div style={{ color:'#e8e0d0', fontSize:'13px' }}>{d.fileName}</div>
                        <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'2px' }}>{d.page}{d.section ? ` › ${d.section}` : ''}</div>
                      </div>
                    </div>
                    <span style={{ color:'#6b7280', fontSize:'12px' }}>{analytics.formatDateTime(d.downloadedAt)}</span>
                  </div>
                ))
              }
            </div>
          )}

          {/* Login History */}
          {tab === 'logins' && (
            <div>
              {stats.logins.length === 0
                ? <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No login history yet.</p>
                : <>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                    <thead>
                      <tr style={{ borderBottom:'2px solid rgba(184,147,58,0.3)' }}>
                        {['Date & Time','Duration','Pages','Downloads','Docs'].map(h => (
                          <th key={h} style={{ color:GOLD, padding:'8px 12px', textAlign:'left', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.logins.map((login, i) => (
                        <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding:'10px 12px', color:'#c4cdd8' }}>{analytics.formatDateTime(login.date)}</td>
                          <td style={{ padding:'10px 12px', color:GOLD, fontWeight:'bold' }}>{analytics.formatDuration(login.duration)}</td>
                          <td style={{ padding:'10px 12px', color:'#8a9ab8' }}>{login.pagesCount}</td>
                          <td style={{ padding:'10px 12px', color:'#4ade80' }}>{login.downloadsCount}</td>
                          <td style={{ padding:'10px 12px', color:'#f59e0b' }}>{login.docViewsCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add User Form ────────────────────────────────────────────────────────
function AddUserForm({ onAdd, onClose }) {
  const [form, setForm] = useState({ name:'', username:'', email:'', password:'', role:'investor', company:'' });
  const [error, setError] = useState('');
  const { addUser } = usePortalAuth();

  const submit = () => {
    if (!form.name || !form.username || !form.password) { setError('Name, username, and password are required.'); return; }
    const result = addUser(form);
    if (result.success) { onAdd(); onClose(); } else { setError(result.error); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', padding:'36px', maxWidth:'480px', width:'100%', boxShadow:'0 40px 100px rgba(0,0,0,0.8)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
          <h3 style={{ color:GOLD, margin:0, fontSize:'13px', letterSpacing:'2px', textTransform:'uppercase' }}>Add New Investor</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'20px' }}>×</button>
        </div>
        <F label="Full Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="John Smith" />
        <F label="Username (for login)" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="john-smith" />
        <F label="Email Address (optional)" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} type="email" placeholder="investor@example.com" />
        <F label="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Set a strong password" />
        <F label="Company / Fund (optional)" value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="ABC Capital" />
        <div style={{ marginBottom:'24px' }}>
          <label style={ls}>Role</label>
          <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={{ ...inp, cursor:'pointer' }}>
            <option value="investor">Investor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <div style={{ background:'rgba(220,60,60,0.12)', border:'1px solid rgba(220,60,60,0.3)', borderRadius:'2px', padding:'10px 14px', color:'#ff8a8a', fontSize:'13px', marginBottom:'16px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'12px' }}>
          <button onClick={submit} style={{ flex:1, background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Add User</button>
          <button onClick={onClose} style={{ padding:'12px 20px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}


// ─── DocuSign Requests View ───────────────────────────────────────────────
function DocusignRequestsView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    DocusignRequestDB.list().then(r => { setRequests(r); setLoading(false); });
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await DocusignRequestDB.updateStatus(id, status);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) {
      console.error('updateStatus:', e);
    }
  };

  const statusColors = {
    pending:   { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    sent:      { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
    executed:  { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80', border: 'rgba(74,222,128,0.3)' },
    cancelled: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>DocuSign Requests</h2>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>All investor subscription requests. Update status as you process each one.</p>
        </div>
        <div style={{ color:GOLD, fontSize:'24px', fontWeight:'bold' }}>{requests.length}</div>
      </div>

      {loading && <p style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading requests…</p>}

      {!loading && requests.length === 0 && (
        <p style={{ color:'#4a5568', textAlign:'center', padding:'60px' }}>No DocuSign requests yet. They will appear here as investors submit the subscription form.</p>
      )}

      {!loading && requests.length > 0 && (
        <div>
          {/* Summary stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
            {['pending','sent','executed','cancelled'].map(status => {
              const count = requests.filter(r => r.status === status).length;
              const sc = statusColors[status];
              return (
                <div key={status} style={{ background:sc.bg, border:`1px solid ${sc.border}`, borderRadius:'2px', padding:'16px', textAlign:'center' }}>
                  <div style={{ color:sc.color, fontSize:'28px', fontWeight:'bold' }}>{count}</div>
                  <div style={{ color:'#6b7280', fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px', marginTop:'4px' }}>{status}</div>
                </div>
              );
            })}
          </div>

          {/* Request cards */}
          {requests.map(req => {
            const sc = statusColors[req.status] || statusColors.pending;
            return (
              <div key={req.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'20px', marginBottom:'12px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
                      <span style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'16px' }}>{req.firstName} {req.lastName}</span>
                      <span style={{ background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`, fontSize:'10px', padding:'3px 10px', borderRadius:'2px', textTransform:'uppercase', letterSpacing:'1px' }}>{req.status}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', fontSize:'13px' }}>
                      <div><span style={{ color:'#4a5568' }}>Email: </span><span style={{ color:'#8a9ab8' }}>{req.email}</span></div>
                      <div><span style={{ color:'#4a5568' }}>Amount: </span><span style={{ color:GOLD, fontWeight:'bold' }}>${Number(req.amountToInvest||0).toLocaleString()}</span></div>
                      <div><span style={{ color:'#4a5568' }}>Type: </span><span style={{ color:'#c4cdd8' }}>{req.investmentType} · {req.fundingType}</span></div>
                      <div><span style={{ color:'#4a5568' }}>Address: </span><span style={{ color:'#8a9ab8' }}>{req.mailingAddress||'—'}</span></div>
                      <div><span style={{ color:'#4a5568' }}>Submitted: </span><span style={{ color:'#6b7280' }}>{analytics.formatDateTime(req.submittedAt)}</span></div>
                      <div><span style={{ color:'#4a5568' }}>By: </span><span style={{ color:'#6b7280' }}>@{req.submittedByUsername||'unknown'}</span></div>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px', flexShrink:0 }}>
                    <label style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>Update Status</label>
                    <select
                      value={req.status}
                      onChange={e => updateStatus(req.id, e.target.value)}
                      style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'8px 12px', color:'#e8e0d0', fontSize:'12px', cursor:'pointer', outline:'none' }}>
                      <option value="pending">Pending</option>
                      <option value="sent">DocuSign Sent</option>
                      <option value="executed">Executed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Portal Controls ──────────────────────────────────────────────────────
function PortalControls() {
  const [s, setS] = useState(getPortalSettings);
  useEffect(() => { loadPortalSettings().then(setS); }, []);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sec, setSec] = useState('raise');

  const upd = (k,v) => setS(prev=>({...prev,[k]:v}));
  const save = async () => {
    setSaveError('');
    try {
      await savePortalSettings(s);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError('Save failed — check that all required fields exist on the PortalSettings entity in Base44.');
    }
  };
  const reset = async () => {
    if (!window.confirm('Reset ALL portal settings to defaults?')) return;
    try {
      await resetPortalSettings();
      setS(getPortalSettings());
    } catch (e) {
      setSaveError('Reset failed — database error.');
    }
  };

  const fmt = n => `$${Number(n||0).toLocaleString()}`;
  const pct = (a,b) => b ? Math.min(100, Math.round((a/b)*100)) : 0;

  const sections = [
    ['raise','📊 Raise Progress'],['contact','📍 Contact Info'],['content','✏️ Portal Content'],
    ['chatbot','🤖 Voice Agent'],['terms','📋 Investment Terms'],['toggles','⚙️ Visibility'],
  ];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:'0' }}>
      {/* Sidebar */}
      <div style={{ borderRight:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', padding:'0 0 12px 0', marginBottom:'4px' }}>Settings</div>
        {sections.map(([id,label]) => (
          <button key={id} onClick={()=>setSec(id)} style={{ display:'block', width:'100%', textAlign:'left', background: sec===id?'rgba(184,147,58,0.12)':'transparent', border:'none', borderLeft: sec===id?`3px solid ${GOLD}`:'3px solid transparent', padding:'11px 14px', color: sec===id?GOLD:'#6b7280', fontSize:'12px', cursor:'pointer', transition:'all 0.15s' }}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ paddingLeft:'32px' }}>

        {sec === 'raise' && (
          <div>
            <h3 style={{ color:'#e8e0d0', margin:'0 0 6px', fontWeight:'normal', fontSize:'18px' }}>Raise Progress Bars</h3>
            <p style={{ color:'#4a5568', fontSize:'13px', margin:'0 0 20px' }}>Live preview of the two progress bars on the investor portal home page.</p>
            {/* Live preview */}
            <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.15)', borderRadius:'2px', padding:'20px', marginBottom:'24px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Live Preview</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                {[
                  { label:'Committed Capital', current:s.committedCapital, total:s.totalRaise,    color:GOLD },
                  { label:'Invested Capital',  current:s.investedCapital,  total:s.investedTarget, color:'#4ade80' },
                ].map(({label,current,total,color}) => {
                  const p = pct(current,total);
                  return (
                    <div key={label} style={{ background:'rgba(0,0,0,0.2)', padding:'16px', borderRadius:'2px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                        <span style={{ color:'#6b7280', fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px' }}>{label}</span>
                        <span style={{ color, fontWeight:'bold', fontSize:'20px' }}>{p}%</span>
                      </div>
                      <div style={{ background:'rgba(255,255,255,0.06)', height:'5px', borderRadius:'2px', overflow:'hidden' }}>
                        <div style={{ background:color, width:`${p}%`, height:'100%', borderRadius:'2px', transition:'width 0.4s', boxShadow:`0 0 6px ${color}88` }} />
                      </div>
                      <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'6px' }}>{fmt(current)} of {fmt(total)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
              <F label="Total Raise Target ($)" value={s.totalRaise} onChange={e=>upd('totalRaise',Number(e.target.value))} type="number" placeholder="2500000" />
              <F label="Committed Capital ($)" value={s.committedCapital} onChange={e=>upd('committedCapital',Number(e.target.value))} type="number" placeholder="875000" />
              <F label="Invested Capital ($)" value={s.investedCapital} onChange={e=>upd('investedCapital',Number(e.target.value))} type="number" placeholder="500000" />
              <F label="Invested Capital Target ($)" value={s.investedTarget} onChange={e=>upd('investedTarget',Number(e.target.value))} type="number" placeholder="500000" />
            </div>
          </div>
        )}

        {sec === 'contact' && (
          <div>
            <h3 style={{ color:'#e8e0d0', margin:'0 0 6px', fontWeight:'normal', fontSize:'18px' }}>Contact Information</h3>
            <p style={{ color:'#4a5568', fontSize:'13px', margin:'0 0 20px' }}>Shown in the contact card on the portal home page.</p>
            <F label="Company Name" value={s.companyName} onChange={e=>upd('companyName',e.target.value)} placeholder="Rosie AI LLC" />
            <F label="Address Line 1" value={s.address1} onChange={e=>upd('address1',e.target.value)} placeholder="1234 Main St" />
            <F label="Address Line 2 (City, State)" value={s.address2} onChange={e=>upd('address2',e.target.value)} placeholder="Cleveland, OH" />
            <F label="Phone Number" value={s.phone} onChange={e=>upd('phone',e.target.value)} placeholder="216-332-4234" />
            <F label="Investor Email" value={s.email} onChange={e=>upd('email',e.target.value)} placeholder="Investors@RosieAI.com" />
          </div>
        )}

        {sec === 'content' && (
          <div>
            <h3 style={{ color:'#e8e0d0', margin:'0 0 6px', fontWeight:'normal', fontSize:'18px' }}>Portal Content</h3>
            <p style={{ color:'#4a5568', fontSize:'13px', margin:'0 0 20px' }}>Edit headline, subtext, and legal disclosure on the portal home page.</p>
            <F label="Tagline (small text above headline)" value={s.portalTagline} onChange={e=>upd('portalTagline',e.target.value)} placeholder="Confidential · Authorized Access Only" />
            <F label="Main Headline (use \\n for line break)" value={s.portalHeadline} onChange={e=>upd('portalHeadline',e.target.value)} placeholder="Welcome to the Rosie AI\nInvestor Data Portal" />
            <TA label="Subheading / Description" value={s.portalSubtext} onChange={e=>upd('portalSubtext',e.target.value)} rows={3} />
            <TA label="Legal Disclosure Text" value={s.disclosureText} onChange={e=>upd('disclosureText',e.target.value)} rows={4} />
          </div>
        )}

        {sec === 'chatbot' && (
          <div>
            <h3 style={{ color:'#e8e0d0', margin:'0 0 6px', fontWeight:'normal', fontSize:'18px' }}>Voice Agent (Deepgram)</h3>
            <p style={{ color:'#4a5568', fontSize:'13px', margin:'0 0 20px' }}>Powered by Deepgram Voice Agent API — Nova-3 STT + LLM + Aura-2 TTS. $4.50/hr connection time.</p>
            <Toggle label="Enable Voice Agent" value={s.chatbotEnabled} onToggle={()=>upd('chatbotEnabled',!s.chatbotEnabled)} desc="Show 'Talk to Rosie' button on the portal home page" />
            <div style={{ marginTop:'20px' }}>
              {/* API Key */}
              <div style={{ background: s.deepgramApiKey?'rgba(74,222,128,0.06)':'rgba(239,68,68,0.06)', border:`1px solid ${s.deepgramApiKey?'rgba(74,222,128,0.2)':'rgba(239,68,68,0.2)'}`, borderRadius:'2px', padding:'16px', marginBottom:'20px' }}>
                <div style={{ color: s.deepgramApiKey?'#4ade80':'#ef4444', fontSize:'12px', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'10px' }}>
                  {s.deepgramApiKey ? '✓ Deepgram API Key Configured' : '⚠ Deepgram API Key Required'}
                </div>
                <F value={s.deepgramApiKey} onChange={e=>upd('deepgramApiKey',e.target.value)} type="password" placeholder="dg_xxxxxxxxxxxxxxxxxxxx" mono={true} />
                <p style={{ color:'#4a5568', fontSize:'11px', margin:'-4px 0 0' }}>Get key at <span style={{ color:GOLD }}>console.deepgram.com</span> → API Keys</p>
              </div>
              {/* Voice Picker */}
              <div style={{ marginBottom:'20px' }}>
                <label style={ls}>TTS Voice — Aura-2 Featured</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'12px' }}>
                  {[['aura-2-asteria-en','Asteria','Warm · Pro','F'],['aura-2-luna-en','Luna','Calm · Clear','F'],['aura-2-orpheus-en','Orpheus','Rich · Auth','M'],['aura-2-hera-en','Hera','Confident','F'],['aura-2-orion-en','Orion','Deep · Trust','M'],['aura-2-thalia-en','Thalia','Bright','F']].map(([id,name,tone,g]) => (
                    <button key={id} onClick={()=>upd('voiceModel',id)} style={{ background: s.voiceModel===id?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.03)', border:`1px solid ${s.voiceModel===id?'rgba(184,147,58,0.5)':'rgba(255,255,255,0.08)'}`, borderRadius:'2px', padding:'10px 8px', cursor:'pointer', textAlign:'center' }}>
                      <div style={{ color: s.voiceModel===id?GOLD:'#e8e0d0', fontSize:'12px', fontWeight:'bold' }}>{name}</div>
                      <div style={{ color:'#4a5568', fontSize:'10px', marginTop:'2px' }}>{g} · {tone}</div>
                    </button>
                  ))}
                </div>
                <label style={{ ...ls, marginTop:'8px' }}>All Aura-2 Voices</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'12px' }}>
                  {['apollo','atlas','aurora','callista','cora','cordelia','delia','draco','electra','harmonia','helena','hermes','hyperion','iris','janus','juno','jupiter','mars','minerva','neptune','odysseus','ophelia','pandora','phoebe','pluto','saturn','selene','theia','vesta','zeus','amalthea','andromeda','arcas','aries','athena'].map(n => {
                    const id=`aura-2-${n}-en`;
                    return <button key={id} onClick={()=>upd('voiceModel',id)} style={{ background: s.voiceModel===id?'rgba(184,147,58,0.15)':'rgba(255,255,255,0.03)', border:`1px solid ${s.voiceModel===id?'rgba(184,147,58,0.35)':'rgba(255,255,255,0.06)'}`, color: s.voiceModel===id?GOLD:'#6b7280', borderRadius:'2px', padding:'4px 10px', cursor:'pointer', fontSize:'11px', textTransform:'capitalize' }}>{n.charAt(0).toUpperCase()+n.slice(1)}</button>;
                  })}
                </div>
                <F label="Active Voice Model ID" value={s.voiceModel} onChange={e=>upd('voiceModel',e.target.value)} placeholder="aura-2-asteria-en" mono={true} />
              </div>
              {/* STT Model */}
              <div style={{ marginBottom:'16px' }}>
                <label style={ls}>STT Model (Speech-to-Text) — included in $4.50/hr</label>
                <select value={s.sttModel||'nova-3'} onChange={e=>upd('sttModel',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                  <option value="nova-3">Nova-3 — best accuracy (recommended)</option>
                  <option value="nova-2">Nova-2 — proven, reliable</option>
                  <option value="flux-general-en">Flux — lowest latency (Early Access)</option>
                </select>
              </div>

              {/* LLM */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
                <div>
                  <label style={ls}>LLM Provider</label>
                  <select value={s.llmProvider||'open_ai'} onChange={e=>{ upd('llmProvider',e.target.value); upd('llmModel', e.target.value==='open_ai'?'gpt-4.1-mini': e.target.value==='anthropic'?'claude-4-5-haiku-latest': e.target.value==='google'?'gemini-2.5-flash-lite': e.target.value==='nvidia'?'nemotron-3-nano-30B-A3B': 'openai/gpt-oss-20b'); }} style={{ ...inp, cursor:'pointer' }}>
                    <option value="open_ai">OpenAI (GPT)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="google">Google (Gemini)</option>
                    <option value="nvidia">NVIDIA (Nemotron)</option>
                    <option value="groq">Groq</option>
                  </select>
                </div>
                <div>
                  <label style={ls}>LLM Model — Standard tier = $4.50/hr · Advanced = higher</label>
                  <select value={s.llmModel} onChange={e=>upd('llmModel',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    {(s.llmProvider==='open_ai'||!s.llmProvider) && <>
                      <optgroup label="Standard Tier (included in $4.50/hr)">
                        <option value="gpt-4.1-nano">GPT-4.1 nano — fastest, cheapest</option>
                        <option value="gpt-4.1-mini">GPT-4.1 mini — recommended</option>
                        <option value="gpt-4o-mini">GPT-4o mini</option>
                        <option value="gpt-5-nano">GPT-5 nano</option>
                        <option value="gpt-5-mini">GPT-5 mini</option>
                        <option value="gpt-5.4-nano">GPT-5.4 nano</option>
                        <option value="gpt-5.4-mini">GPT-5.4 mini</option>
                      </optgroup>
                      <optgroup label="Advanced Tier (extra cost)">
                        <option value="gpt-4.1">GPT-4.1</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-5">GPT-5</option>
                        <option value="gpt-5.4">GPT-5.4</option>
                        <option value="gpt-5.2-chat-latest">GPT-5.2 Instant</option>
                        <option value="gpt-5.3-chat-latest">GPT-5.3 Instant</option>
                      </optgroup>
                    </>}
                    {s.llmProvider==='anthropic' && <>
                      <optgroup label="Standard Tier">
                        <option value="claude-4-5-haiku-latest">Claude Haiku 4.5 — fastest</option>
                        <option value="claude-3-5-haiku-latest">Claude Haiku 3.5</option>
                      </optgroup>
                      <optgroup label="Advanced Tier (extra cost)">
                        <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
                        <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                        <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                      </optgroup>
                    </>}
                    {s.llmProvider==='google' && <>
                      <optgroup label="Standard Tier">
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite — cheapest</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                        <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
                      </optgroup>
                      <optgroup label="Advanced Tier (extra cost)">
                        <option value="gemini-3-pro-preview">Gemini 3.0 Pro</option>
                      </optgroup>
                    </>}
                    {s.llmProvider==='nvidia' && <>
                      <optgroup label="Standard Tier">
                        <option value="nemotron-3-nano-30B-A3B">Nemotron 3 Nano 30B — fastest</option>
                        <option value="llama-nemotron-super-49B">Llama Nemotron Super 49B</option>
                      </optgroup>
                    </>}
                    {s.llmProvider==='groq' && <>
                      <optgroup label="Standard Tier">
                        <option value="openai/gpt-oss-20b">GPT OSS 20B (via Groq)</option>
                      </optgroup>
                    </>}
                  </select>
                </div>
              </div>
              <TA label="Agent Greeting (spoken on connect)" value={s.chatbotGreeting} onChange={e=>upd('chatbotGreeting',e.target.value)} rows={3} />
              <TA label="System Prompt / Agent Instructions" value={s.chatbotContext} onChange={e=>upd('chatbotContext',e.target.value)} rows={8} />
              <TA label="Knowledge Base (appended to system prompt)" value={s.knowledgeBase||''} onChange={e=>upd('knowledgeBase',e.target.value)} rows={8} />
              <p style={{ color:'#4a5568', fontSize:'11px', margin:'-8px 0 0' }}>Add FAQs, term sheets, objection handling, or any custom knowledge.</p>
            </div>
          </div>
        )}

        {sec === 'terms' && (
          <div>
            <h3 style={{ color:'#e8e0d0', margin:'0 0 6px', fontWeight:'normal', fontSize:'18px' }}>Investment Terms</h3>
            <p style={{ color:'#4a5568', fontSize:'13px', margin:'0 0 20px' }}>Shown in the Investment Terms section of the Investment Offering tab.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <F label="Round Size" value={s.roundSize} onChange={e=>upd('roundSize',e.target.value)} placeholder="$2,500,000" />
              <F label="Valuation Cap" value={s.valuationCap} onChange={e=>upd('valuationCap',e.target.value)} placeholder="$15,000,000" />
              <F label="Minimum Investment" value={s.minInvestment} onChange={e=>upd('minInvestment',e.target.value)} placeholder="$25,000" />
              <F label="Discount Rate" value={s.discountRate} onChange={e=>upd('discountRate',e.target.value)} placeholder="20%" />
              <F label="Target Close Date" value={s.targetClose} onChange={e=>upd('targetClose',e.target.value)} placeholder="Q2 2025" />
            </div>
          </div>
        )}

        {sec === 'toggles' && (
          <div>
            <h3 style={{ color:'#e8e0d0', margin:'0 0 6px', fontWeight:'normal', fontSize:'18px' }}>Visibility & Access</h3>
            <p style={{ color:'#4a5568', fontSize:'13px', margin:'0 0 20px' }}>Control which sections are visible to investors.</p>
            <Toggle label="Portal Active" value={s.portalActive} onToggle={()=>upd('portalActive',!s.portalActive)} desc="When off, investors see a maintenance message" />
            <Toggle label="Show Investment Calculator" value={s.showCalculator} onToggle={()=>upd('showCalculator',!s.showCalculator)} desc="Return calculator on the portal home page" />
            <Toggle label="Show Market Data Tab" value={s.showMarketData} onToggle={()=>upd('showMarketData',!s.showMarketData)} desc="M&A comps, comparables, and trend charts" />
            <Toggle label="Show Subscription Tab" value={s.showSubscription} onToggle={()=>upd('showSubscription',!s.showSubscription)} desc="DocuSign request and agreement documents" />
          </div>
        )}

        <div style={{ display:'flex', gap:'12px', marginTop:'32px', paddingTop:'24px', borderTop:'1px solid rgba(255,255,255,0.07)', alignItems:'center' }}>
          <button onClick={save} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px 32px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
            {saved ? '✓ Saved!' : 'Save Changes'}
          </button>
          <button onClick={reset} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'12px 24px', cursor:'pointer', fontSize:'12px' }}>
            Reset to Defaults
          </button>
          {saved && <span style={{ color:'#4ade80', fontSize:'13px' }}>Changes are live on the investor portal.</span>}
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
  const [pwMsg, setPwMsg] = useState(null);
  const [unMsg, setUnMsg] = useState(null);

  const changePw = () => {
    setPwMsg(null);
    if (!pwForm.current||!pwForm.newPw||!pwForm.confirm) { setPwMsg({type:'error',text:'All fields required.'}); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg({type:'error',text:'Passwords do not match.'}); return; }
    if (pwForm.newPw.length < 8) { setPwMsg({type:'error',text:'Min 8 characters.'}); return; }
    const r = changeAdminPassword(pwForm.current, pwForm.newPw);
    if (r.success) { setPwMsg({type:'success',text:'Password updated.'}); setPwForm({current:'',newPw:'',confirm:''}); }
    else setPwMsg({type:'error',text:r.error});
  };
  const changeUn = () => {
    setUnMsg(null);
    if (!unForm.current||!unForm.newUsername) { setUnMsg({type:'error',text:'All fields required.'}); return; }
    if (unForm.newUsername.length < 3) { setUnMsg({type:'error',text:'Min 3 characters.'}); return; }
    const r = changeAdminUsername(unForm.current, unForm.newUsername);
    if (r.success) { setUnMsg({type:'success',text:'Username updated.'}); setUnForm({current:'',newUsername:''}); }
    else setUnMsg({type:'error',text:r.error});
  };

  const ms = t => ({ background: t==='success'?'rgba(74,222,128,0.1)':'rgba(220,60,60,0.12)', border:`1px solid ${t==='success'?'rgba(74,222,128,0.3)':'rgba(220,60,60,0.3)'}`, borderRadius:'2px', padding:'10px 14px', color: t==='success'?'#4ade80':'#ff8a8a', fontSize:'13px', marginBottom:'16px' });

  return (
    <div>
      <h2 style={{ color:'#e8e0d0', margin:'0 0 8px', fontSize:'20px', fontWeight:'normal' }}>Admin Settings</h2>
      <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 32px' }}>Manage admin login credentials. Username: <span style={{ color:GOLD }}>admin</span></p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'32px' }}>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'28px' }}>
          <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 20px' }}>Change Admin Username</h3>
          <F label="Current Password (to verify)" value={unForm.current} onChange={e=>setUnForm({...unForm,current:e.target.value})} type="password" placeholder="••••••••" />
          <F label="New Username" value={unForm.newUsername} onChange={e=>setUnForm({...unForm,newUsername:e.target.value})} placeholder="new-username" />
          {unMsg && <div style={ms(unMsg.type)}>{unMsg.text}</div>}
          <button onClick={changeUn} style={{ width:'100%', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Update Username</button>
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'28px' }}>
          <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 20px' }}>Change Admin Password</h3>
          <F label="Current Password" value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})} type="password" placeholder="••••••••" />
          <F label="New Password" value={pwForm.newPw} onChange={e=>setPwForm({...pwForm,newPw:e.target.value})} type="password" placeholder="Min. 8 characters" />
          <F label="Confirm New Password" value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} type="password" placeholder="••••••••" />
          {pwMsg && <div style={ms(pwMsg.type)}>{pwMsg.text}</div>}
          <button onClick={changePw} style={{ width:'100%', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Update Password</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────
export default function AdminDashboard() {
  const { portalUser, isAdmin, isPortalLoading, portalLogout, getAllUsers, removeUser, changeAdminPassword, changeAdminUsername } = usePortalAuth();
  const [view, setView]           = useState('users');
  const [users, setUsers]         = useState([]);
  const [showAdd, setShowAdd]     = useState(false);
  const [selUser, setSelUser]     = useState(null);
  const [allSessions, setAllSessions] = useState([]);
  const [globalStats, setGlobalStats] = useState({ totalSessions:0, totalTime:0, totalDownloads:0, totalDocViews:0 });
  const [docusignRequests, setDocusignRequests] = useState([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [usersData, sessions] = await Promise.all([
        getAllUsers(),
        analytics.getAllSessions(),
      ]);
      setUsers(usersData);
      // Sessions are already parsed by analytics.getAllSessions()
      setAllSessions(sessions);
      const global = await analytics.computeGlobalStats(sessions);
      setGlobalStats(global);
    } catch (e) {
      console.error('[Admin] load error:', e);
    }
  }, [getAllUsers]);

  useEffect(() => {
    if (isPortalLoading) return; // wait for auth to resolve
    if (!portalUser || !isAdmin) {
      navigate('/admin-login');
      return;
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [portalUser, isAdmin, isPortalLoading, load]);

  // Match a session to a user by normalised email OR username
  const matchesUser = useCallback((session, user) => {
    const norm = v => (v || '').toLowerCase().trim();
    const sEmail    = norm(session.userEmail);
    const sUsername = norm(session.username);
    const uEmail    = norm(user.email);
    const uUsername = norm(user.username);
    return (uEmail && sEmail && sEmail === uEmail)
        || (uUsername && sUsername && sUsername === uUsername)
        || (uEmail && sUsername && sUsername === uEmail);  // edge: stored email in username field
  }, []);

  // Show spinner while auth resolves — prevents flash-redirect
  if (isPortalLoading) {
    return (
      <div style={{ minHeight:'100vh', background:'#060c18', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:'32px', height:'32px', border:'3px solid rgba(184,147,58,0.2)', borderTop:'3px solid #b8933a', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!portalUser || !isAdmin) return null;

  const investorUsers = users.filter(u => u.role === 'investor');

  const recentSessions = allSessions
    .filter(s => s.startTime)
    .sort((a,b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(0, 15);

  return (
    <div style={{ minHeight:'100vh', background:'#060c18', fontFamily:'Georgia, serif', color:'#e8e0d0' }}>
      {/* Nav */}
      <nav style={{ background:DARK, borderBottom:'1px solid rgba(184,147,58,0.2)', padding:'0 40px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'64px', position:'sticky', top:0, zIndex:200 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
          <img src={LOGO} alt="Rosie AI" style={{ height:'38px', width:'auto' }} />
          <div style={{ width:'1px', height:'24px', background:'rgba(184,147,58,0.3)' }} />
          <span style={{ color:GOLD, fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase' }}>Admin Dashboard</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <button onClick={load} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 16px', cursor:'pointer', fontSize:'11px' }}>↻ Refresh</button>
          <button onClick={() => navigate('/portal')} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 16px', cursor:'pointer', fontSize:'11px' }}>← Portal</button>
          <button onClick={() => { portalLogout(); navigate('/'); }} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 16px', cursor:'pointer', fontSize:'11px' }}>Logout</button>
        </div>
      </nav>

      {/* Sub Nav */}
      <div style={{ background:DARK, borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 40px', display:'flex', gap:'0' }}>
        {[['users','User Management'],['analytics','Engagement Analytics'],['activity','Recent Activity'],['docusign','DocuSign Requests'],['portal','Portal Controls'],['settings','Admin Settings']].map(([id,label]) => (
          <button key={id} onClick={()=>setView(id)} style={{ background:'none', border:'none', borderBottom: view===id?`2px solid ${GOLD}`:'2px solid transparent', color: view===id?GOLD:'#6b7280', padding:'14px 20px', cursor:'pointer', fontSize:'12px', letterSpacing:'1px' }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'40px' }}>
        {/* Global KPIs — always visible */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'14px', marginBottom:'32px' }}>
          {[
            { label:'Investors',      value: investorUsers.length,                       icon:'👥', color:GOLD },
            { label:'Total Sessions', value: globalStats.totalSessions,                       icon:'🔐', color:'#60a5fa' },
            { label:'Time Spent',     value: analytics.formatDuration(globalStats.totalTime), icon:'⏱',  color:'#4ade80' },
            { label:'Downloads',      value: globalStats.totalDownloads,                      icon:'📥', color:'#f59e0b' },
            { label:'Docs Viewed',    value: globalStats.totalDocViews,                       icon:'📄', color:'#a78bfa' },
          ].map(({ label,value,icon,color }) => (
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

        {/* Modals */}
        {showAdd && <AddUserForm onAdd={load} onClose={()=>setShowAdd(false)} />}
        {selUser && <UserActivityModal user={selUser} onClose={()=>setSelUser(null)} />}

        {/* ── Users ── */}
        {view === 'users' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
              <h2 style={{ color:'#e8e0d0', margin:0, fontSize:'20px', fontWeight:'normal' }}>User Management</h2>
              <button onClick={()=>setShowAdd(true)} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'10px 24px', cursor:'pointer', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', fontWeight:'700' }}>+ Add Investor</button>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ borderBottom:'2px solid rgba(184,147,58,0.3)' }}>
                  {['Name','Username','Email','Company','Role','Created','Sessions','Last Login','Actions'].map(h => (
                    <th key={h} style={{ color:GOLD, padding:'10px 12px', textAlign:'left', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const userSessions = allSessions.filter(s => matchesUser(s, user));
                  const stats = analytics.computeUserStats(userSessions);
                  return (
                    <tr key={user.username||user.email}
                      style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'12px 12px', color:'#e8e0d0', fontWeight:'bold' }}>{user.name}</td>
                      <td style={{ padding:'12px 12px', color:GOLD, fontFamily:'monospace', fontSize:'12px' }}>@{user.username}</td>
                      <td style={{ padding:'12px 12px', color:'#8a9ab8', fontSize:'12px' }}>{user.email||'—'}</td>
                      <td style={{ padding:'12px 12px', color:'#6b7280' }}>{user.company||'—'}</td>
                      <td style={{ padding:'12px 12px' }}><span style={{ display:'inline-block', padding:'3px 10px', borderRadius:'2px', background: user.role==='admin'?'rgba(184,147,58,0.15)':'rgba(74,222,128,0.1)', color: user.role==='admin'?GOLD:'#4ade80', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>{user.role}</span></td>
                      <td style={{ padding:'12px 12px', color:'#4a5568', fontSize:'12px' }}>{user.createdAt ? analytics.formatDate(user.createdAt) : '—'}</td>
                      <td style={{ padding:'12px 12px', color:'#60a5fa', fontWeight:'bold' }}>{stats.sessionCount}</td>
                      <td style={{ padding:'12px 12px', color:'#6b7280', fontSize:'12px' }}>{analytics.formatDate(stats.lastSeen)}</td>
                      <td style={{ padding:'12px 12px' }}>
                        <div style={{ display:'flex', gap:'8px' }}>
                          <button onClick={()=>setSelUser(user)} style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', padding:'5px 12px', cursor:'pointer', fontSize:'11px' }}>📊 Activity</button>
                          {user.role !== 'admin' && <button onClick={()=>{ if(window.confirm(`Remove ${user.name}?`)){removeUser(user.email||user.username);load();} }} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'2px', padding:'5px 12px', cursor:'pointer', fontSize:'11px' }}>Remove</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Analytics ── */}
        {view === 'analytics' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
              <h2 style={{ color:'#e8e0d0', margin:0, fontSize:'20px', fontWeight:'normal' }}>Engagement Analytics</h2>
              <button onClick={()=>analytics.exportJSON()} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'8px 18px', cursor:'pointer', fontSize:'12px' }}>↓ Export JSON</button>
            </div>
            {investorUsers.length === 0
              ? <p style={{ color:'#4a5568', textAlign:'center', padding:'60px' }}>No investor users yet.</p>
              : investorUsers.map(user => {
                const userSessions = allSessions.filter(s => matchesUser(s, user));
                const stats = analytics.computeUserStats(userSessions);
                const maxPT = Math.max(...Object.values(stats.pageTime), 1);
                return (
                  <div key={user.username||user.email} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'24px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
                      <div>
                        <div style={{ color:'#e8e0d0', fontSize:'16px', fontWeight:'bold' }}>{user.name}</div>
                        <div style={{ color:'#6b7280', fontSize:'12px', marginTop:'2px' }}>@{user.username} · Last seen: {analytics.formatDate(stats.lastSeen)}</div>
                      </div>
                      <div style={{ display:'flex', gap:'20px' }}>
                        {[
                          [stats.sessionCount, 'Sessions', GOLD],
                          [analytics.formatDuration(stats.totalTime), 'Time', '#4ade80'],
                          [stats.totalDownloads, 'Downloads', '#60a5fa'],
                          [stats.totalDocViews, 'Docs', '#f59e0b'],
                        ].map(([v,l,c]) => (
                          <div key={l} style={{ textAlign:'center' }}>
                            <div style={{ color:c, fontWeight:'bold', fontSize:'18px' }}>{v}</div>
                            <div style={{ color:'#4a5568', fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {Object.keys(stats.pageTime).length > 0 && (
                      <div style={{ marginBottom:'12px' }}>
                        <div style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>Time per Page</div>
                        {Object.entries(stats.pageTime).sort((a,b)=>b[1]-a[1]).map(([page,secs]) => (
                          <div key={page} style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'6px' }}>
                            <span style={{ color:'#8a9ab8', fontSize:'12px', minWidth:'120px' }}>{page}</span>
                            <div style={{ flex:1, background:'rgba(255,255,255,0.06)', height:'4px', borderRadius:'2px' }}>
                              <div style={{ background:GOLD, width:`${(secs/maxPT)*100}%`, height:'100%', borderRadius:'2px' }} />
                            </div>
                            <span style={{ color:GOLD, fontWeight:'bold', fontSize:'12px', minWidth:'50px', textAlign:'right' }}>{analytics.formatDuration(secs)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={()=>setSelUser(user)} style={{ background:'transparent', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'2px', padding:'6px 16px', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>
                      Full Detail →
                    </button>
                  </div>
                );
              })
            }
          </div>
        )}

        {/* ── Activity ── */}
        {view === 'activity' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
              <h2 style={{ color:'#e8e0d0', margin:0, fontSize:'20px', fontWeight:'normal' }}>Recent Activity</h2>
              <div style={{ color:'#4a5568', fontSize:'12px' }}>Auto-refreshes every 30s</div>
            </div>
            {recentSessions.length === 0
              ? <p style={{ color:'#4a5568', textAlign:'center', padding:'60px' }}>No activity yet. Sessions will appear here once investors log in.</p>
              : recentSessions.map((sess, i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'18px 20px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px' }}>
                  <div>
                    <div style={{ color:'#e8e0d0', fontWeight:'bold', marginBottom:'3px' }}>{sess.userName||sess.userEmail} <span style={{ color:'#4a5568', fontWeight:'normal', fontFamily:'monospace', fontSize:'12px' }}>@{sess.username}</span></div>
                    <div style={{ color:'#6b7280', fontSize:'12px' }}>{analytics.formatDateTime(sess.startTime)}</div>
                    <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'4px', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                      <span>📄 {sess.pages?.length||0} pages</span>
                      <span>📥 {sess.downloads?.length||0} downloads</span>
                      <span>📋 {sess.docViews?.length||0} docs viewed</span>
                      {!sess.endTime && <span style={{ color:'#4ade80' }}>● Active Now</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ color:GOLD, fontWeight:'bold', fontSize:'16px' }}>{analytics.formatDuration(sess.durationSeconds)}</div>
                    <button onClick={()=>{const u=users.find(u=>u.email===sess.userEmail||u.username===sess.username);if(u)setSelUser(u);}} style={{ marginTop:'6px', background:'transparent', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'2px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}>View Profile</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── DocuSign Requests ── */}
        {view === 'docusign' && (
          <DocusignRequestsView />
        )}

        {/* ── Portal Controls ── */}
        {view === 'portal' && (
          <div>
            <div style={{ marginBottom:'28px' }}>
              <h2 style={{ color:'#e8e0d0', margin:'0 0 6px', fontSize:'20px', fontWeight:'normal' }}>Portal Controls</h2>
              <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>Live-edit all investor portal content, raise data, contact info, and AI voice agent settings. Changes take effect immediately.</p>
            </div>
            <PortalControls />
          </div>
        )}

        {/* ── Admin Settings ── */}
        {view === 'settings' && (
          <AdminSettings changeAdminPassword={changeAdminPassword} changeAdminUsername={changeAdminUsername} />
        )}
      </div>
    </div>
  );
}