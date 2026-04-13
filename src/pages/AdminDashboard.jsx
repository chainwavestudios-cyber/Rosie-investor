import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import analytics from '@/lib/analytics';
import { getPortalSettings, loadPortalSettings, savePortalSettings } from '@/lib/portalSettings';
import { SignNowRequestDB, InvestorUser } from '@/api/entities';
import { signnowSendDocuments, signnowGetToken } from '@/lib/signnow';

const LOGO = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";
const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const ls  = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

function F({ label, value, onChange, type='text', placeholder='', mono=false }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      {label && <label style={ls}>{label}</label>}
      <input type={type} value={value??''} onChange={onChange} placeholder={placeholder}
        style={{ ...inp, fontFamily: mono?'monospace':'Georgia, serif', fontSize: mono?'12px':'14px' }} />
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
      <button onClick={onToggle} style={{ width:'48px', height:'26px', borderRadius:'13px', border:'none', cursor:'pointer', background: value?'linear-gradient(135deg,#b8933a,#d4aa50)':'rgba(255,255,255,0.1)', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
        <div style={{ position:'absolute', top:'3px', left: value?'25px':'3px', width:'20px', height:'20px', background:'#fff', borderRadius:'50%', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }} />
      </button>
    </div>
  );
}

// ─── User Activity Modal ──────────────────────────────────────────────────
function UserActivityModal({ user, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats]       = useState({ sessionCount:0, totalTime:0, totalDownloads:0, totalDocViews:0, pageTime:{}, logins:[], lastSeen:null, firstSeen:null });
  const [tab, setTab]           = useState('sessions');
  const [loading, setLoading]   = useState(true);
  useEffect(() => {
    setLoading(true);
    analytics.getUserSessions((user.email || user.username || '').toLowerCase().trim()).then(sess => {
      setSessions(sess); setStats(analytics.computeUserStats(sess)); setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);
  const kpis = [
    { label:'Sessions',    value: stats.sessionCount,                        color: GOLD    },
    { label:'Time',        value: analytics.formatDuration(stats.totalTime), color:'#4ade80' },
    { label:'Downloads',   value: stats.totalDownloads,                      color:'#60a5fa' },
    { label:'Docs',        value: stats.totalDocViews,                       color:'#f59e0b' },
    { label:'First Login', value: analytics.formatDate(stats.firstSeen),     color:'#8a9ab8' },
    { label:'Last Login',  value: analytics.formatDate(stats.lastSeen),      color:'#8a9ab8' },
  ];
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', width:'100%', maxWidth:'800px', maxHeight:'88vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'24px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <h3 style={{ color:GOLD, margin:0, fontFamily:'Georgia,serif', fontWeight:'normal', fontSize:'18px' }}>{user.name} — Activity</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'22px' }}>×</button>
        </div>
        {loading && <div style={{ padding:'20px', textAlign:'center', color:'#6b7280' }}>Loading…</div>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'10px', padding:'16px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background:'rgba(0,0,0,0.2)', padding:'10px', textAlign:'center', borderRadius:'2px' }}>
              <div style={{ color:k.color, fontSize:'16px', fontWeight:'bold', marginBottom:'3px' }}>{k.value}</div>
              <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase' }}>{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          {[['sessions','Sessions'],['logins','Login History']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background:'none', border:'none', borderBottom: tab===id?`2px solid ${GOLD}`:'2px solid transparent', color: tab===id?GOLD:'#6b7280', padding:'12px 18px', cursor:'pointer', fontSize:'12px' }}>{label}</button>
          ))}
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'20px 28px' }}>
          {tab === 'sessions' && (sessions.length === 0 ? <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No sessions yet.</p> :
            sessions.map((sess, i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'14px 18px', marginBottom:'8px', display:'flex', justifyContent:'space-between' }}>
                <div>
                  <div style={{ color:'#e8e0d0', fontSize:'13px' }}>{analytics.formatDateTime(sess.startTime)}</div>
                  <div style={{ color:'#6b7280', fontSize:'12px' }}>{sess.pages?.length||0} pages · {sess.downloads?.length||0} downloads {!sess.endTime ? <span style={{ color:'#4ade80' }}>· Active Now</span> : ''}</div>
                </div>
                <div style={{ color:GOLD, fontWeight:'bold' }}>{analytics.formatDuration(sess.durationSeconds)}</div>
              </div>
            ))
          )}
          {tab === 'logins' && (stats.logins.length === 0 ? <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No login history yet.</p> :
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead><tr style={{ borderBottom:'2px solid rgba(184,147,58,0.3)' }}>
                {['Date & Time','Duration','Pages','Downloads'].map(h => <th key={h} style={{ color:GOLD, padding:'8px 12px', textAlign:'left', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>{stats.logins.map((l,i) => (
                <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding:'10px 12px', color:'#c4cdd8' }}>{analytics.formatDateTime(l.date)}</td>
                  <td style={{ padding:'10px 12px', color:GOLD, fontWeight:'bold' }}>{analytics.formatDuration(l.duration)}</td>
                  <td style={{ padding:'10px 12px', color:'#8a9ab8' }}>{l.pagesCount}</td>
                  <td style={{ padding:'10px 12px', color:'#4ade80' }}>{l.downloadsCount}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit User Form ───────────────────────────────────────────────────────
function EditUserForm({ user, onSave, onClose }) {
  const [form, setForm] = useState({
    name: user.name||'', email: user.email||'', password: '',
    company: user.company||'', role: user.role||'investor',
    phone: user.phone||'', address: user.address||'',
    investmentType: user.investmentType||'cash',
    iraInformation: user.iraInformation||'',
    notes: user.notes||'',
    signnowRequested: user.signnowRequested||false,
    status: user.status||'prospect',
    investmentAmount: user.investmentAmount||'',
    investmentDate: user.investmentDate||'',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true); setError('');
    try {
      const updates = { name:form.name, email:form.email.trim().toLowerCase(), company:form.company, role:form.role,
        phone:form.phone, address:form.address, investmentType:form.investmentType, iraInformation:form.iraInformation,
        notes:form.notes, signnowRequested:form.signnowRequested, status:form.status,
        investmentAmount:form.investmentAmount, investmentDate:form.investmentDate };
      if (form.password.trim()) updates.password = form.password.trim();
      await InvestorUser.update(user.id, updates);
      onSave(); onClose();
    } catch (e) { setError('Save failed — ' + e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', padding:'36px', maxWidth:'640px', width:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 40px 100px rgba(0,0,0,0.8)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
          <h3 style={{ color:GOLD, margin:0, fontSize:'13px', letterSpacing:'2px', textTransform:'uppercase' }}>Edit Client — @{user.username}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'20px' }}>×</button>
        </div>
        {/* Status Toggle */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'24px' }}>
          {['prospect','investor'].map(s => (
            <button key={s} onClick={() => setForm({...form,status:s})}
              style={{ flex:1, padding:'10px', border:`1px solid ${form.status===s?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', background: form.status===s?'rgba(184,147,58,0.15)':'transparent', color: form.status===s?GOLD:'#6b7280', cursor:'pointer', fontSize:'12px', textTransform:'uppercase', letterSpacing:'2px' }}>
              {s==='prospect'?'🔵 Prospect':'✅ Investor'}
            </button>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <F label="Full Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
          <F label="Email Address" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} type="email" />
          <F label="Phone Number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(216) 555-0123" />
          <F label="Company / Fund" value={form.company} onChange={e=>setForm({...form,company:e.target.value})} />
        </div>
        <F label="Mailing Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="123 Main St, Cleveland, OH 44101" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <div style={{ marginBottom:'16px' }}>
            <label style={ls}>Account Type</label>
            <select value={form.investmentType} onChange={e=>setForm({...form,investmentType:e.target.value})} style={{ ...inp, cursor:'pointer' }}>
              <option value="cash">Cash</option>
              <option value="ira">IRA</option>
            </select>
          </div>
          <div style={{ marginBottom:'16px' }}>
            <label style={ls}>Portal Role</label>
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={{ ...inp, cursor:'pointer' }}>
              <option value="investor">Investor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        {form.investmentType === 'ira' && (
          <TA label="IRA Information (custodian, account #, etc.)" value={form.iraInformation} onChange={e=>setForm({...form,iraInformation:e.target.value})} rows={3} placeholder="Custodian: Equity Trust, Acct #: XXXX..." />
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <F label="Investment Amount ($)" value={form.investmentAmount} onChange={e=>setForm({...form,investmentAmount:e.target.value})} type="number" placeholder="50000" />
          <F label="Date Invested" value={form.investmentDate} onChange={e=>setForm({...form,investmentDate:e.target.value})} type="date" />
        </div>
        <F label="New Password (leave blank to keep current)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Enter new password" />
        <TA label="Internal Notes (not visible to investor)" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={4} placeholder="Private notes about this client…" />
        <div style={{ padding:'14px 0', borderTop:'1px solid rgba(255,255,255,0.07)', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ color:'#c4cdd8', fontSize:'14px' }}>Signature Documents Requested</div>
              <div style={{ color:'#4a5568', fontSize:'12px', marginTop:'2px' }}>Mark if documents have been sent to this investor</div>
            </div>
            <button onClick={() => setForm({...form,signnowRequested:!form.signnowRequested})}
              style={{ width:'48px', height:'26px', borderRadius:'13px', border:'none', cursor:'pointer', background: form.signnowRequested?'linear-gradient(135deg,#b8933a,#d4aa50)':'rgba(255,255,255,0.1)', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:'3px', left: form.signnowRequested?'25px':'3px', width:'20px', height:'20px', background:'#fff', borderRadius:'50%', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }} />
            </button>
          </div>
        </div>
        {error && <div style={{ background:'rgba(220,60,60,0.12)', border:'1px solid rgba(220,60,60,0.3)', borderRadius:'2px', padding:'10px 14px', color:'#ff8a8a', fontSize:'13px', marginBottom:'16px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'12px' }}>
          <button onClick={submit} disabled={saving} style={{ flex:1, background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{saving?'Saving…':'Save Changes'}</button>
          <button onClick={onClose} style={{ padding:'12px 20px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add User Form ─────────────────────────────────────────────────────────
function AddUserForm({ onAdd, onClose }) {
  const [form, setForm] = useState({ name:'', username:'', email:'', password:'', role:'investor', company:'', phone:'', address:'', investmentType:'cash', iraInformation:'', notes:'', signnowRequested:false, status:'prospect', investmentAmount:'', investmentDate:'' });
  const [error, setError] = useState('');
  const { addUser } = usePortalAuth();

  const submit = async () => {
    if (!form.name || !form.username || !form.password) { setError('Name, username, and password are required.'); return; }
    const result = await addUser(form);
    if (result.success) { onAdd(); onClose(); } else { setError(result.error); }
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
            <button key={s} onClick={() => setForm({...form,status:s})}
              style={{ flex:1, padding:'10px', border:`1px solid ${form.status===s?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', background: form.status===s?'rgba(184,147,58,0.15)':'transparent', color: form.status===s?GOLD:'#6b7280', cursor:'pointer', fontSize:'12px', textTransform:'uppercase', letterSpacing:'2px' }}>
              {s==='prospect'?'🔵 Prospect':'✅ Investor'}
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
        {form.investmentType === 'ira' && <TA label="IRA Information" value={form.iraInformation} onChange={e=>setForm({...form,iraInformation:e.target.value})} rows={3} />}
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

// ─── SignNow Requests View ─────────────────────────────────────────────────
function SignNowRequestsView({ settings }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  useEffect(() => { SignNowRequestDB.listAll().then(r => { setRequests(r); setLoading(false); }); }, []);
  const sc = { pending:{bg:'rgba(245,158,11,0.12)',color:'#f59e0b',border:'rgba(245,158,11,0.3)'}, sent:{bg:'rgba(96,165,250,0.12)',color:'#60a5fa',border:'rgba(96,165,250,0.3)'}, completed:{bg:'rgba(74,222,128,0.12)',color:'#4ade80',border:'rgba(74,222,128,0.3)'}, declined:{bg:'rgba(239,68,68,0.12)',color:'#ef4444',border:'rgba(239,68,68,0.3)'}, error:{bg:'rgba(239,68,68,0.12)',color:'#ef4444',border:'rgba(239,68,68,0.3)'} };
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>SignNow Document Requests</h2>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>All investor signature requests sent via SignNow.</p>
        </div>
        <div style={{ color:GOLD, fontSize:'24px', fontWeight:'bold' }}>{requests.length}</div>
      </div>
      {!settings?.signnowAccessToken && <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'2px', padding:'16px', marginBottom:'24px', color:'#f59e0b', fontSize:'13px' }}>⚠ SignNow is not configured. Go to <strong>SignNow Settings</strong> to set up API credentials and templates.</div>}
      {loading && <p style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</p>}
      {!loading && requests.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'60px' }}>No SignNow requests yet. They appear here when investors click "Request Investment Documents."</p>}
      {!loading && requests.length > 0 && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
            {['pending','sent','completed','declined'].map(status => {
              const count = requests.filter(r => r.status === status).length;
              const s2 = sc[status];
              return <div key={status} style={{ background:s2.bg, border:`1px solid ${s2.border}`, borderRadius:'2px', padding:'16px', textAlign:'center' }}>
                <div style={{ color:s2.color, fontSize:'28px', fontWeight:'bold' }}>{count}</div>
                <div style={{ color:'#6b7280', fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px', marginTop:'4px' }}>{status}</div>
              </div>;
            })}
          </div>
          {requests.map(req => {
            const s2 = sc[req.status] || sc.pending;
            let docs = []; try { docs = JSON.parse(req.documents || '[]'); } catch {}
            return (
              <div key={req.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'20px', marginBottom:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
                  <span style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'16px' }}>{req.userName}</span>
                  <span style={{ background:s2.bg, color:s2.color, border:`1px solid ${s2.border}`, fontSize:'10px', padding:'3px 10px', borderRadius:'2px', textTransform:'uppercase' }}>{req.status}</span>
                </div>
                <div style={{ color:'#8a9ab8', fontSize:'13px', marginBottom:'8px' }}>{req.userEmail} · Sent {analytics.formatDateTime(req.sentAt)}</div>
                {docs.length > 0 && <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>{docs.map((doc, i) => {
                  const ds = sc[doc.status] || sc.pending;
                  return <span key={i} style={{ background:ds.bg, color:ds.color, border:`1px solid ${ds.border}`, fontSize:'11px', padding:'3px 10px', borderRadius:'2px' }}>📄 {doc.name} — {doc.status}</span>;
                })}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SignNow Admin Settings ────────────────────────────────────────────────
function SignNowSettings({ settings, onSettingsSaved }) {
  const [form, setForm] = useState({
    signnowClientId:      settings?.signnowClientId || '',
    signnowClientSecret:  settings?.signnowClientSecret || '',
    signnowUsername:      settings?.signnowUsername || '',
    signnowPassword:      settings?.signnowPassword || '',
    signnowAccessToken:   settings?.signnowAccessToken || '',
    signnowTemplate1Id:   settings?.signnowTemplate1Id || '',
    signnowTemplate1Name: settings?.signnowTemplate1Name || 'Investor Questionnaire',
    signnowTemplate2Id:   settings?.signnowTemplate2Id || '',
    signnowTemplate2Name: settings?.signnowTemplate2Name || 'Subscription Agreement',
    signnowSignerRole:    settings?.signnowSignerRole || 'Signer 1',
    signnowInviteMessage: settings?.signnowInviteMessage || 'Dear {name}, please review and sign the attached investment documents for Rosie AI LLC.',
  });
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving]   = useState(false);

  const testAuth = async () => {
    setTesting(true); setStatus('');
    try {
      const res = await signnowGetToken(form.signnowClientId, form.signnowClientSecret, form.signnowUsername, form.signnowPassword);
      setForm(f => ({ ...f, signnowAccessToken: res.access_token }));
      setStatus('success:Connected! Access token obtained and saved.');
    } catch (e) { setStatus('error:Auth failed — ' + e.message); }
    finally { setTesting(false); }
  };

  const save = async () => {
    setSaving(true); setStatus('');
    try {
      await savePortalSettings({ ...settings, ...form });
      setStatus('success:Settings saved.');
      onSettingsSaved({ ...settings, ...form });
    } catch (e) { setStatus('error:Save failed — ' + e.message); }
    finally { setSaving(false); }
  };

  const [stType, stMsg] = status.split(':');
  return (
    <div>
      <h2 style={{ color:'#e8e0d0', margin:'0 0 8px', fontSize:'20px', fontWeight:'normal' }}>SignNow Settings</h2>
      <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 28px' }}>Configure your SignNow API credentials, document templates, and signer settings.</p>

      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'24px', marginBottom:'20px' }}>
        <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 16px' }}>API Credentials</h3>
        <p style={{ color:'#4a5568', fontSize:'12px', margin:'0 0 16px' }}>Get credentials at <a href="https://app.signnow.com/webapp/developer" target="_blank" rel="noreferrer" style={{ color:GOLD }}>app.signnow.com/webapp/developer</a></p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <F label="Client ID" value={form.signnowClientId} onChange={e=>setForm({...form,signnowClientId:e.target.value})} mono placeholder="Application Client ID" />
          <F label="Client Secret" value={form.signnowClientSecret} onChange={e=>setForm({...form,signnowClientSecret:e.target.value})} mono placeholder="Application Client Secret" />
          <F label="SignNow Account Email" value={form.signnowUsername} onChange={e=>setForm({...form,signnowUsername:e.target.value})} placeholder="your@email.com" />
          <F label="SignNow Account Password" value={form.signnowPassword} onChange={e=>setForm({...form,signnowPassword:e.target.value})} type="password" placeholder="••••••••" />
        </div>
        <div style={{ display:'flex', gap:'12px', alignItems:'center', marginBottom:'16px' }}>
          <button onClick={testAuth} disabled={testing} style={{ background:'rgba(96,165,250,0.15)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'10px 20px', cursor:'pointer', fontSize:'12px' }}>
            {testing ? 'Connecting…' : '🔌 Test Connection & Get Token'}
          </button>
          {stType === 'success' && <span style={{ color:'#4ade80', fontSize:'13px' }}>✓ {stMsg}</span>}
          {stType === 'error' && <span style={{ color:'#ef4444', fontSize:'13px' }}>✗ {stMsg}</span>}
        </div>
        <F label="Access Token (auto-filled on connect, or paste manually)" value={form.signnowAccessToken} onChange={e=>setForm({...form,signnowAccessToken:e.target.value})} mono placeholder="Paste access token here" />
        <p style={{ color:'#4a5568', fontSize:'11px', margin:'-4px 0 0' }}>Tokens expire in 30 days. Re-run "Test Connection" to refresh.</p>
      </div>

      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'24px', marginBottom:'20px' }}>
        <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 8px' }}>Document Templates</h3>
        <p style={{ color:'#4a5568', fontSize:'12px', margin:'0 0 20px' }}>These templates are sent when an investor clicks "Request Investment Documents." Find template IDs in SignNow → Templates → select template → copy ID from the URL.</p>
        <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'2px', padding:'16px', marginBottom:'12px' }}>
          <div style={{ color:'#c4cdd8', fontWeight:'bold', fontSize:'13px', marginBottom:'12px' }}>Document 1</div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'0 20px' }}>
            <F label="Template ID" value={form.signnowTemplate1Id} onChange={e=>setForm({...form,signnowTemplate1Id:e.target.value})} mono placeholder="32-char template ID" />
            <F label="Display Name" value={form.signnowTemplate1Name} onChange={e=>setForm({...form,signnowTemplate1Name:e.target.value})} placeholder="Investor Questionnaire" />
          </div>
        </div>
        <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'2px', padding:'16px' }}>
          <div style={{ color:'#c4cdd8', fontWeight:'bold', fontSize:'13px', marginBottom:'12px' }}>Document 2</div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'0 20px' }}>
            <F label="Template ID" value={form.signnowTemplate2Id} onChange={e=>setForm({...form,signnowTemplate2Id:e.target.value})} mono placeholder="32-char template ID" />
            <F label="Display Name" value={form.signnowTemplate2Name} onChange={e=>setForm({...form,signnowTemplate2Name:e.target.value})} placeholder="Subscription Agreement" />
          </div>
        </div>
      </div>

      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'24px', marginBottom:'24px' }}>
        <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 20px' }}>Signer & Invite Configuration</h3>
        <F label="Signer Role Name (must match template)" value={form.signnowSignerRole} onChange={e=>setForm({...form,signnowSignerRole:e.target.value})} placeholder="Signer 1" />
        <TA label="Invite Email Message ({name} = investor's name)" value={form.signnowInviteMessage} onChange={e=>setForm({...form,signnowInviteMessage:e.target.value})} rows={4} />
      </div>

      <button onClick={save} disabled={saving} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px 32px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
        {saving ? 'Saving…' : 'Save SignNow Settings'}
      </button>
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
    try { await savePortalSettings(s); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    catch (e) { setSaveError('Save failed — ' + e.message); }
  };
  const sections = [['raise','📊 Raise Progress'],['contact','📍 Contact'],['content','✏️ Content'],['terms','📋 Terms'],['toggles','⚙️ Visibility']];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:'0' }}>
      <div style={{ borderRight:'1px solid rgba(255,255,255,0.07)' }}>
        {sections.map(([id,label]) => <button key={id} onClick={()=>setSec(id)} style={{ display:'block', width:'100%', textAlign:'left', background: sec===id?'rgba(184,147,58,0.12)':'transparent', border:'none', borderLeft: sec===id?`3px solid ${GOLD}`:'3px solid transparent', padding:'11px 14px', color: sec===id?GOLD:'#6b7280', fontSize:'12px', cursor:'pointer' }}>{label}</button>)}
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

// ─── Admin Settings ────────────────────────────────────────────────────────
function AdminSettings({ changeAdminPassword, changeAdminUsername }) {
  const [pwForm, setPwForm] = useState({ current:'', newPw:'', confirm:'' });
  const [unForm, setUnForm] = useState({ current:'', newUsername:'' });
  const [pwMsg, setPwMsg] = useState(null);
  const [unMsg, setUnMsg] = useState(null);
  const ms = t => ({ background: t==='success'?'rgba(74,222,128,0.1)':'rgba(220,60,60,0.12)', border:`1px solid ${t==='success'?'rgba(74,222,128,0.3)':'rgba(220,60,60,0.3)'}`, borderRadius:'2px', padding:'10px 14px', color: t==='success'?'#4ade80':'#ff8a8a', fontSize:'13px', marginBottom:'16px' });
  return (
    <div>
      <h2 style={{ color:'#e8e0d0', margin:'0 0 32px', fontSize:'20px', fontWeight:'normal' }}>Admin Settings</h2>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'32px' }}>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'28px' }}>
          <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 20px' }}>Change Admin Username</h3>
          <F label="Current Password" value={unForm.current} onChange={e=>setUnForm({...unForm,current:e.target.value})} type="password" />
          <F label="New Username" value={unForm.newUsername} onChange={e=>setUnForm({...unForm,newUsername:e.target.value})} />
          {unMsg && <div style={ms(unMsg.type)}>{unMsg.text}</div>}
          <button onClick={() => { const r = changeAdminUsername(unForm.current, unForm.newUsername); if(r.success){setUnMsg({type:'success',text:'Updated.'});setUnForm({current:'',newUsername:''});}else setUnMsg({type:'error',text:r.error}); }} style={{ width:'100%', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Update Username</button>
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'28px' }}>
          <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', margin:'0 0 20px' }}>Change Admin Password</h3>
          <F label="Current Password" value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})} type="password" />
          <F label="New Password" value={pwForm.newPw} onChange={e=>setPwForm({...pwForm,newPw:e.target.value})} type="password" />
          <F label="Confirm New Password" value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} type="password" />
          {pwMsg && <div style={ms(pwMsg.type)}>{pwMsg.text}</div>}
          <button onClick={() => { if(pwForm.newPw!==pwForm.confirm){setPwMsg({type:'error',text:'Passwords do not match'});return;} const r=changeAdminPassword(pwForm.current,pwForm.newPw); if(r.success){setPwMsg({type:'success',text:'Updated.'});setPwForm({current:'',newPw:'',confirm:''});}else setPwMsg({type:'error',text:r.error}); }} style={{ width:'100%', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Update Password</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Dashboard ──────────────────────────────────────────────────
export default function AdminDashboard() {
  const { portalUser, isAdmin, isPortalLoading, portalLogout, getAllUsers, removeUser, changeAdminPassword, changeAdminUsername } = usePortalAuth();
  const [view, setView]         = useState('users');
  const [users, setUsers]       = useState([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [selUser, setSelUser]   = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [allSessions, setAllSessions] = useState([]);
  const [globalStats, setGlobalStats] = useState({ totalSessions:0, totalTime:0, totalDownloads:0, totalDocViews:0 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [portalSettings, setPortalSettings] = useState({});
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [usersData, sessions, ps] = await Promise.all([getAllUsers(), analytics.getAllSessions(), loadPortalSettings()]);
      setUsers(usersData); setAllSessions(sessions); setPortalSettings(ps);
      const global = await analytics.computeGlobalStats(sessions); setGlobalStats(global);
    } catch (e) { console.error('[Admin] load error:', e); }
  }, [getAllUsers]);

  useEffect(() => {
    if (isPortalLoading) return;
    if (!portalUser || !isAdmin) { navigate('/admin-login'); return; }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [portalUser, isAdmin, isPortalLoading, load]);

  const matchesUser = useCallback((session, user) => {
    const n = v => (v||'').toLowerCase().trim();
    return (n(user.email) && n(session.userEmail) && n(session.userEmail)===n(user.email))
        || (n(user.username) && n(session.username) && n(session.username)===n(user.username));
  }, []);

  if (isPortalLoading) return (
    <div style={{ minHeight:'100vh', background:'#060c18', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'32px', height:'32px', border:'3px solid rgba(184,147,58,0.2)', borderTop:'3px solid #b8933a', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!portalUser || !isAdmin) return null;

  const nonAdminUsers = users.filter(u => u.role !== 'admin');
  const filteredUsers = nonAdminUsers.filter(u => filterStatus === 'all' || (u.status || 'prospect') === filterStatus);
  const recentSessions = allSessions.filter(s=>s.startTime).sort((a,b)=>new Date(b.startTime)-new Date(a.startTime)).slice(0,15);

  const TABS = [
    ['users','CRM / Clients'],['analytics','Analytics'],['activity','Recent Activity'],
    ['signnow','SignNow Requests'],['portal','Portal Controls'],['signnow-settings','SignNow Settings'],['settings','Admin Settings'],
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#060c18', fontFamily:'Georgia, serif', color:'#e8e0d0' }}>
      <nav style={{ background:DARK, borderBottom:'1px solid rgba(184,147,58,0.2)', padding:'0 40px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'64px', position:'sticky', top:0, zIndex:200 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
          <img src={LOGO} alt="Rosie AI" style={{ height:'38px', width:'auto' }} />
          <div style={{ width:'1px', height:'24px', background:'rgba(184,147,58,0.3)' }} />
          <span style={{ color:GOLD, fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase' }}>Admin Dashboard</span>
        </div>
        <div style={{ display:'flex', gap:'12px' }}>
          <button onClick={load} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 16px', cursor:'pointer', fontSize:'11px' }}>↻ Refresh</button>
          <button onClick={() => navigate('/portal')} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 16px', cursor:'pointer', fontSize:'11px' }}>← Portal</button>
          <button onClick={() => { portalLogout(); navigate('/'); }} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 16px', cursor:'pointer', fontSize:'11px' }}>Logout</button>
        </div>
      </nav>

      <div style={{ background:DARK, borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 40px', display:'flex', overflowX:'auto' }}>
        {TABS.map(([id,label]) => (
          <button key={id} onClick={()=>setView(id)} style={{ background:'none', border:'none', borderBottom: view===id?`2px solid ${GOLD}`:'2px solid transparent', color: view===id?GOLD:'#6b7280', padding:'14px 18px', cursor:'pointer', fontSize:'12px', letterSpacing:'1px', whiteSpace:'nowrap' }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth:'1300px', margin:'0 auto', padding:'40px' }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'14px', marginBottom:'32px' }}>
          {[
            { label:'Total Clients',  value: nonAdminUsers.length,                                                       icon:'👥', color:GOLD    },
            { label:'Investors',      value: nonAdminUsers.filter(u=>u.status==='investor').length,                       icon:'✅', color:'#4ade80' },
            { label:'Prospects',      value: nonAdminUsers.filter(u=>(u.status||'prospect')==='prospect').length,         icon:'🔵', color:'#60a5fa' },
            { label:'Total Sessions', value: globalStats.totalSessions,                                                   icon:'🔐', color:'#f59e0b' },
            { label:'Time Spent',     value: analytics.formatDuration(globalStats.totalTime),                             icon:'⏱',  color:'#a78bfa' },
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

        {showAdd  && <AddUserForm onAdd={load} onClose={()=>setShowAdd(false)} />}
        {selUser  && <UserActivityModal user={selUser} onClose={()=>setSelUser(null)} />}
        {editUser && <EditUserForm user={editUser} onSave={load} onClose={()=>setEditUser(null)} />}

        {/* ── CRM ── */}
        {view === 'users' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>CRM — Client Management</h2>
                <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>Full client records — prospects, investors, notes, and document tracking.</p>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ display:'flex', gap:'4px' }}>
                  {[['all','All'],['prospect','Prospects'],['investor','Investors']].map(([s,l]) => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                      style={{ padding:'7px 14px', background: filterStatus===s?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.05)', border:`1px solid ${filterStatus===s?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', color: filterStatus===s?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>
                      {l}
                    </button>
                  ))}
                </div>
                <button onClick={()=>setShowAdd(true)} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'10px 20px', cursor:'pointer', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', fontWeight:'700' }}>+ Add Client</button>
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid rgba(184,147,58,0.3)' }}>
                    {['Status','Name / Username','Contact','Address','Account','Investment','Docs','Sessions','Actions'].map(h => (
                      <th key={h} style={{ color:GOLD, padding:'10px 12px', textAlign:'left', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const us = allSessions.filter(s=>matchesUser(s,user));
                    const st = analytics.computeUserStats(us);
                    const status = user.status || 'prospect';
                    return (
                      <tr key={user.username||user.email}
                        style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer' }}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'12px 12px' }}>
                          <span style={{ display:'inline-block', padding:'3px 8px', borderRadius:'2px', background: status==='investor'?'rgba(74,222,128,0.12)':'rgba(96,165,250,0.12)', color: status==='investor'?'#4ade80':'#60a5fa', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                            {status==='investor'?'✅ Investor':'🔵 Prospect'}
                          </span>
                        </td>
                        <td style={{ padding:'12px 12px' }}>
                          <div style={{ color:'#e8e0d0', fontWeight:'bold' }}>{user.name}</div>
                          <div style={{ color:'#4a5568', fontSize:'11px', fontFamily:'monospace' }}>@{user.username}</div>
                        </td>
                        <td style={{ padding:'12px 12px' }}>
                          <div style={{ color:'#8a9ab8', fontSize:'12px' }}>{user.email||'—'}</div>
                          <div style={{ color:'#6b7280', fontSize:'12px' }}>{user.phone||'—'}</div>
                        </td>
                        <td style={{ padding:'12px 12px', color:'#6b7280', fontSize:'12px', maxWidth:'160px' }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.address||'—'}</div>
                        </td>
                        <td style={{ padding:'12px 12px' }}>
                          <span style={{ color: user.investmentType==='ira'?'#f59e0b':'#8a9ab8', fontSize:'12px', textTransform:'uppercase' }}>{user.investmentType||'cash'}</span>
                        </td>
                        <td style={{ padding:'12px 12px' }}>
                          {user.investmentAmount ? <div>
                            <div style={{ color:GOLD, fontWeight:'bold', fontSize:'13px' }}>${Number(user.investmentAmount).toLocaleString()}</div>
                            {user.investmentDate && <div style={{ color:'#4a5568', fontSize:'11px' }}>{new Date(user.investmentDate).toLocaleDateString()}</div>}
                          </div> : <span style={{ color:'#4a5568' }}>—</span>}
                        </td>
                        <td style={{ padding:'12px 12px' }}>
                          {user.signnowRequested ? <span style={{ color:'#4ade80', fontSize:'12px' }}>✓ Sent</span> : <span style={{ color:'#4a5568', fontSize:'12px' }}>—</span>}
                        </td>
                        <td style={{ padding:'12px 12px', color:'#60a5fa', fontWeight:'bold' }}>{st.sessionCount}</td>
                        <td style={{ padding:'12px 12px' }}>
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button onClick={()=>setEditUser(user)} style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'11px' }}>✏️</button>
                            <button onClick={()=>setSelUser(user)} style={{ background:'rgba(96,165,250,0.1)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'11px' }}>📊</button>
                            {user.role!=='admin' && <button onClick={()=>{ if(window.confirm(`Remove ${user.name}?`)){removeUser(user.email||user.username);load();} }} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'11px' }}>✕</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No clients found for this filter.</p>}
            </div>
          </div>
        )}

        {/* ── Analytics ── */}
        {view === 'analytics' && (
          <div>
            <h2 style={{ color:'#e8e0d0', margin:'0 0 24px', fontSize:'20px', fontWeight:'normal' }}>Engagement Analytics</h2>
            {nonAdminUsers.length === 0 ? <p style={{ color:'#4a5568', textAlign:'center', padding:'60px' }}>No users yet.</p> :
              nonAdminUsers.map(user => {
                const us = allSessions.filter(s=>matchesUser(s,user));
                const st = analytics.computeUserStats(us);
                return (
                  <div key={user.username||user.email} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'24px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px', flexWrap:'wrap', gap:'12px' }}>
                      <div><div style={{ color:'#e8e0d0', fontSize:'16px', fontWeight:'bold' }}>{user.name}</div><div style={{ color:'#6b7280', fontSize:'12px' }}>@{user.username} · Last seen: {analytics.formatDate(st.lastSeen)}</div></div>
                      <div style={{ display:'flex', gap:'20px' }}>
                        {[[st.sessionCount,'Sessions',GOLD],[analytics.formatDuration(st.totalTime),'Time','#4ade80'],[st.totalDownloads,'Downloads','#60a5fa']].map(([v,l,c]) => (
                          <div key={l} style={{ textAlign:'center' }}><div style={{ color:c, fontWeight:'bold', fontSize:'18px' }}>{v}</div><div style={{ color:'#4a5568', fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{l}</div></div>
                        ))}
                      </div>
                    </div>
                    <button onClick={()=>setSelUser(user)} style={{ background:'transparent', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'2px', padding:'6px 16px', cursor:'pointer', fontSize:'11px' }}>Full Detail →</button>
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
              recentSessions.map((sess,i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'18px 20px', marginBottom:'8px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
                  <div>
                    <div style={{ color:'#e8e0d0', fontWeight:'bold', marginBottom:'3px' }}>{sess.userName||sess.userEmail} <span style={{ color:'#4a5568', fontWeight:'normal', fontFamily:'monospace', fontSize:'12px' }}>@{sess.username}</span></div>
                    <div style={{ color:'#6b7280', fontSize:'12px' }}>{analytics.formatDateTime(sess.startTime)}</div>
                    <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'4px', display:'flex', gap:'12px' }}><span>📄 {sess.pages?.length||0} pages</span><span>📥 {sess.downloads?.length||0} downloads</span>{!sess.endTime && <span style={{ color:'#4ade80' }}>● Active</span>}</div>
                  </div>
                  <div style={{ color:GOLD, fontWeight:'bold', fontSize:'16px' }}>{analytics.formatDuration(sess.durationSeconds)}</div>
                </div>
              ))
            }
          </div>
        )}

        {view === 'signnow' && <SignNowRequestsView settings={portalSettings} />}
        {view === 'signnow-settings' && <SignNowSettings settings={portalSettings} onSettingsSaved={s=>setPortalSettings(s)} />}
        {view === 'portal' && <div><div style={{ marginBottom:'28px' }}><h2 style={{ color:'#e8e0d0', margin:'0 0 6px', fontSize:'20px', fontWeight:'normal' }}>Portal Controls</h2></div><PortalControls /></div>}
        {view === 'settings' && <AdminSettings changeAdminPassword={changeAdminPassword} changeAdminUsername={changeAdminUsername} />}
      </div>
    </div>
  );
}