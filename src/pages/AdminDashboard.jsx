import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import analytics from '@/lib/analytics';
import { getPortalSettings, loadPortalSettings, savePortalSettings } from '@/lib/portalSettings';
import { SignNowRequestDB, InvestorUser, ContactNoteDB, AppointmentDB, AccreditationDocDB } from '@/api/entities';
import { getScoreColor, getScoreLabel } from '@/lib/engagementScore';
import { signnowSendDocuments, signnowGetToken } from '@/lib/signnow';
import LeadsTab from '@/components/leads/LeadsTab';
import TwilioDialer from '@/components/leads/TwilioDialer';
import ProspectPipeline from '@/components/admin/ProspectPipeline';
import UpcomingReminders from '@/components/admin/UpcomingReminders';
import RecentInvestorEvents from '@/components/admin/RecentInvestorEvents';
import ContactCardModal from '@/components/admin/ContactCardModal';
import { base44 } from '@/api/base44Client';
import MarketingTab from '@/components/leads/MarketingTab';
import KnowledgeBaseManagerComponent from '@/components/admin/KnowledgeBaseManager';
import AudioRecorderManager from '@/components/admin/AudioRecorderManager';
import GlobalCalendar from '@/components/admin/GlobalCalendar';

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

// GlobalCalendar is now in components/admin/GlobalCalendar.jsx

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

// ─── Investor Updates Manager ─────────────────────────────────────────────
function InvestorUpdatesManager() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const catColors = { 'Financial Update':'#4ade80','Product Update':'#60a5fa','Partnership':'#f59e0b','General Update':'#8a9ab8','Important Notice':'#ef4444' };
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const EMPTY = { title:'', content:'', category:'General Update', author:'Management Team', imageUrl:'', videoUrl:'', publishedDate: todayStr() };
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    setLoading(true);
    try { const arr = await base44.entities.InvestorUpdate.list('-publishedAt', 200); setUpdates(arr||[]); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handlePost = async () => {
    if (!form.title || !form.content) return;
    try {
      await base44.entities.InvestorUpdate.create({ ...form, publishedAt: form.publishedDate ? new Date(form.publishedDate + 'T12:00:00').toISOString() : new Date().toISOString() });
      setForm(EMPTY); setShowForm(false); setPreview(false); await load();
    } catch(e) { alert('Error: ' + e.message); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, imageUrl: file_url }));
    } catch(e) { alert('Upload failed: ' + e.message); }
    setUploading(false);
  };

  const ta = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'vertical' };

  return (
    <div style={{ fontFamily:'Georgia, serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h3 style={{ color:'#e8e0d0', margin:'0 0 4px', fontWeight:'normal', fontSize:'18px' }}>Investor Updates</h3>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>Post updates with text, images, and video — visible to all portal investors.</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setPreview(false); }}
          style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'9px 20px', cursor:'pointer', fontWeight:'700', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>
          {showForm ? '✕ Cancel' : '+ New Update'}
        </button>
      </div>

      {/* ── COMPOSE FORM ── */}
      {showForm && (
        <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(184,147,58,0.25)', borderRadius:'6px', padding:'24px', marginBottom:'28px' }}>
          {/* Tabs: Edit / Preview */}
          <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:'20px' }}>
            {[['edit','✏️ Edit'],['preview','👁 Preview']].map(([id,label]) => (
              <button key={id} onClick={() => setPreview(id==='preview')}
                style={{ background:'none', border:'none', borderBottom:(preview&&id==='preview')||(!preview&&id==='edit')?`2px solid ${GOLD}`:'2px solid transparent', color:(preview&&id==='preview')||(!preview&&id==='edit')?GOLD:'#6b7280', padding:'8px 18px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px' }}>
                {label}
              </button>
            ))}
          </div>

          {!preview ? (
            <div>
              {/* Title + Category */}
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div>
                  <label style={ls}>Title</label>
                  <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Update title…" style={{ ...ta, resize:'none' }} />
                </div>
                <div>
                  <label style={ls}>Category</label>
                  <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{ ...ta, cursor:'pointer', resize:'none' }}>
                    {Object.keys(catColors).map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {/* Author */}
              <div style={{ marginBottom:'12px' }}>
                <label style={ls}>Author</label>
                <input value={form.author} onChange={e=>setForm({...form,author:e.target.value})} placeholder="Management Team" style={{ ...ta, resize:'none' }} />
              </div>
              {/* Date */}
              <div style={{ marginBottom:'12px' }}>
                <label style={ls}>Update Date</label>
                <input type="date" value={form.publishedDate} onChange={e=>setForm({...form,publishedDate:e.target.value})}
                  style={{ ...ta, resize:'none', colorScheme:'dark' }} />
              </div>
              {/* Content */}
              <div style={{ marginBottom:'12px' }}>
                <label style={ls}>Content</label>
                <textarea value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="Write the update…" rows={6} style={ta} />
              </div>
              {/* Image */}
              <div style={{ marginBottom:'12px' }}>
                <label style={ls}>Image (optional)</label>
                <div style={{ display:'flex', gap:'8px' }}>
                  <input value={form.imageUrl} onChange={e=>setForm({...form,imageUrl:e.target.value})} placeholder="Paste image URL or upload below…" style={{ ...ta, resize:'none', flex:1 }} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'4px', padding:'8px 14px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                    {uploading ? '⏳ Uploading…' : '📁 Upload'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display:'none' }} />
                </div>
                {form.imageUrl && <img src={form.imageUrl} alt="" style={{ marginTop:'8px', width:'100%', maxHeight:'200px', objectFit:'cover', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.08)' }} />}
              </div>
              {/* Video */}
              <div style={{ marginBottom:'20px' }}>
                <label style={ls}>Video URL (optional — YouTube, Vimeo, or direct .mp4)</label>
                <input value={form.videoUrl} onChange={e=>setForm({...form,videoUrl:e.target.value})} placeholder="https://www.youtube.com/watch?v=…" style={{ ...ta, resize:'none' }} />
              </div>
              <button onClick={handlePost} disabled={!form.title||!form.content}
                style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'11px 28px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', opacity:(!form.title||!form.content)?0.5:1 }}>
                📬 Post Update
              </button>
            </div>
          ) : (
            /* PREVIEW */
            <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'24px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
                <div>
                  <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:'2px', background:`${catColors[form.category]||'#8a9ab8'}22`, color:catColors[form.category]||'#8a9ab8', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>{form.category}</span>
                  <h3 style={{ color:'#e8e0d0', margin:'0', fontSize:'18px', fontFamily:'Georgia, serif', fontWeight:'normal' }}>{form.title||'(No title)'}</h3>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ color:GOLD, fontSize:'13px' }}>{form.publishedDate ? new Date(form.publishedDate + 'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
                  <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'2px' }}>{form.author}</div>
                </div>
              </div>
              {form.imageUrl && <img src={form.imageUrl} alt="" style={{ width:'100%', maxHeight:'320px', objectFit:'cover', borderRadius:'4px', marginBottom:'12px' }} />}
              {form.videoUrl && (
                <div style={{ marginBottom:'12px' }}>
                  {/youtube|youtu\.be/i.test(form.videoUrl) ? (
                    <iframe src={form.videoUrl.replace('watch?v=','embed/').replace('youtu.be/','www.youtube.com/embed/')} style={{ width:'100%', aspectRatio:'16/9', border:'none', borderRadius:'4px' }} allowFullScreen title="Preview" />
                  ) : /vimeo/i.test(form.videoUrl) ? (
                    <iframe src={`https://player.vimeo.com/video/${form.videoUrl.split('/').pop()}`} style={{ width:'100%', aspectRatio:'16/9', border:'none', borderRadius:'4px' }} allowFullScreen title="Preview" />
                  ) : (
                    <video src={form.videoUrl} controls style={{ width:'100%', borderRadius:'4px', maxHeight:'320px' }} />
                  )}
                </div>
              )}
              <p style={{ color:'#8a9ab8', fontSize:'13px', lineHeight:1.7, margin:0, whiteSpace:'pre-wrap' }}>{form.content||'(No content)'}</p>
              <button onClick={handlePost} disabled={!form.title||!form.content}
                style={{ marginTop:'20px', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'11px 28px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', opacity:(!form.title||!form.content)?0.5:1 }}>
                📬 Post This Update
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── EXISTING UPDATES LIST ── */}
      {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</div>}
      {!loading && updates.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px', color:'#4a5568' }}>
          <div style={{ fontSize:'40px', marginBottom:'10px' }}>📭</div>
          <p>No updates posted yet. Click "+ New Update" to create the first one.</p>
        </div>
      )}
      {updates.map(u => (
        <div key={u.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'18px 20px', marginBottom:'10px', display:'flex', gap:'16px', alignItems:'flex-start' }}>
          {u.imageUrl && <img src={u.imageUrl} alt="" style={{ width:'80px', height:'60px', objectFit:'cover', borderRadius:'4px', flexShrink:0 }} />}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px', flexWrap:'wrap' }}>
              <div>
                <span style={{ background:`${catColors[u.category]||'#8a9ab8'}22`, color:catColors[u.category]||'#8a9ab8', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', padding:'2px 8px', borderRadius:'2px', marginRight:'8px' }}>{u.category}</span>
                <span style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'14px' }}>{u.title}</span>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexShrink:0 }}>
                <span style={{ color:'#4a5568', fontSize:'11px' }}>{u.publishedAt ? new Date(u.publishedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''}</span>
                {u.videoUrl && <span style={{ color:'#60a5fa', fontSize:'10px', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'10px', padding:'1px 7px' }}>▶ Video</span>}
                <button onClick={async()=>{ if(window.confirm('Delete this update?')){ await base44.entities.InvestorUpdate.delete(u.id); await load(); } }}
                  style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'4px', padding:'3px 10px', cursor:'pointer', fontSize:'11px' }}>
                  Delete
                </button>
              </div>
            </div>
            <p style={{ color:'#6b7280', fontSize:'12px', margin:'6px 0 0', lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{u.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Press Releases Manager ───────────────────────────────────────────────
function PressReleasesManager() {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const EMPTY = { title: '', summary: '', content: '', sourceUrl: '', imageUrl: '', publishedDate: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    setLoading(true);
    try { const arr = await base44.entities.PressRelease.list('-publishedAt', 200); setReleases(arr || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handlePost = async () => {
    if (!form.title || !form.content) return;
    try {
      await base44.entities.PressRelease.create({ ...form, publishedAt: form.publishedDate ? new Date(form.publishedDate + 'T12:00:00').toISOString() : new Date().toISOString(), status: 'NEW' });
      setForm(EMPTY); setShowForm(false); await load();
    } catch (e) { alert('Error: ' + e.message); }
  };

  const ta = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box', resize: 'vertical' };
  const statusColors = { PENDING: '#f59e0b', NEW: '#60a5fa', COMPLETED: '#4ade80', ARCHIVED: '#4a5568' };

  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ color: '#e8e0d0', margin: '0 0 4px', fontWeight: 'normal', fontSize: '18px' }}>Press Releases</h3>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>Manage press releases visible to investors in the portal.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '2px', padding: '9px 20px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
          {showForm ? '✕ Cancel' : '+ New Release'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(184,147,58,0.25)', borderRadius: '6px', padding: '24px', marginBottom: '28px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Headline</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Press release headline…" style={{ ...ta, resize: 'none' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Summary (1–2 sentences)</label>
            <input value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Short summary…" style={{ ...ta, resize: 'none' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Full Content</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Full press release text…" rows={6} style={ta} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Source URL (optional)</label>
            <input value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://…" style={{ ...ta, resize: 'none' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Image URL (optional)</label>
            <input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" style={{ ...ta, resize: 'none' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={ls}>Publish Date</label>
            <input type="date" value={form.publishedDate} onChange={e => setForm({ ...form, publishedDate: e.target.value })}
              style={{ ...ta, resize: 'none', colorScheme: 'dark' }} />
          </div>
          <button onClick={handlePost} disabled={!form.title || !form.content}
            style={{ background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '4px', padding: '11px 28px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', opacity: (!form.title || !form.content) ? 0.5 : 1 }}>
            📰 Publish Release
          </button>
        </div>
      )}

      {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading…</div>}
      {!loading && releases.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#4a5568' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📰</div>
          <p>No press releases yet. Click &quot;+ New Release&quot; to create the first one.</p>
        </div>
      )}
      {releases.map(r => (
        <div key={r.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '18px 20px', marginBottom: '10px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          {r.imageUrl && <img src={r.imageUrl} alt="" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ background: `${statusColors[r.status] || '#60a5fa'}22`, color: statusColors[r.status] || '#60a5fa', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '2px', marginRight: '8px' }}>{r.status || 'NEW'}</span>
                <span style={{ color: '#e8e0d0', fontWeight: 'bold', fontSize: '14px' }}>{r.title}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ color: '#4a5568', fontSize: '11px' }}>{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                {r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontSize: '10px', border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '10px', padding: '1px 7px', textDecoration: 'none' }}>↗ Source</a>}
                <button onClick={async () => { if (window.confirm('Delete this press release?')) { await base44.entities.PressRelease.delete(r.id); await load(); } }}
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '11px' }}>
                  Delete
                </button>
              </div>
            </div>
            {r.summary && <p style={{ color: '#8a9ab8', fontSize: '12px', margin: '6px 0 0', lineHeight: 1.5 }}>{r.summary}</p>}
          </div>
        </div>
      ))}
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
  const sections = [['raise','📊 Raise Progress'],['contact','📍 Contact'],['content','✏️ Content'],['terms','📋 Terms'],['rosie','🤖 Rosie AI'],['toggles','⚙️ Visibility'],['updates','📬 Investor Updates'],['press','📰 Press Releases'],['audio','🎙 Audio Recorder']];
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
        {sec==='updates'&&<InvestorUpdatesManager />}{sec==='press'&&<PressReleasesManager />}{sec==='audio'&&<AudioRecorderManager />}
        {!['updates','press','audio'].includes(sec)&&<div style={{display:'flex',gap:'12px',marginTop:'32px',paddingTop:'24px',borderTop:'1px solid rgba(255,255,255,0.07)',alignItems:'center'}}><button onClick={save} style={{background:'linear-gradient(135deg,#b8933a,#d4aa50)',color:DARK,border:'none',borderRadius:'2px',padding:'12px 32px',cursor:'pointer',fontWeight:'700',fontSize:'12px',letterSpacing:'2px',textTransform:'uppercase'}}>{saved?'✓ Saved!':'Save Changes'}</button>{saved&&<span style={{color:'#4ade80',fontSize:'13px'}}>Live on portal.</span>}{saveError&&<span style={{color:'#ef4444',fontSize:'13px'}}>{saveError}</span>}</div>}
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

// ─── AI Tuner Chat ────────────────────────────────────────────────────────
// A chatbot where you share ideas and AI expands them into concrete rules
function AITunerChat({ context, onApply }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `I'm your AI tuning assistant. Tell me your thoughts, observations, or ideas about how to improve the ${context} — and I'll turn them into specific rules, keywords, and logic you can apply immediately.\n\nExamples:\n• "Investors who ask a lot of price questions tend to be..."\n• "When someone interrupts a lot it usually means..."\n• "I want the coach to focus more on..."\n• "Add keywords for when someone sounds skeptical"` }
  ]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [suggested, setSuggested] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const data = await base44.functions.invoke('aiTunerChat', {
        context,
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      });
      const reply = data?.reply || data?.content?.[0]?.text || data?.text || 'Error getting response.';

      // Extract JSON suggestion if present
      const jsonMatch = reply.match(/```(?:json)?\n?({[\s\S]*?})\n?```/);
      if (jsonMatch) {
        try { setSuggested(JSON.parse(jsonMatch[1])); } catch {}
      }

      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: 'Error: ' + e.message }]);
    }
    setLoading(false);
  };

  const ta = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'none' };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'480px', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', overflow:'hidden' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
        <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 6px #4ade80' }} />
        <span style={{ color:GOLD, fontSize:'11px', letterSpacing:'1.5px', textTransform:'uppercase' }}>AI Tuning Assistant</span>
        <span style={{ color:'#4a5568', fontSize:'11px', marginLeft:'auto' }}>Claude Sonnet · Tuning {context}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth:'85%', padding:'10px 14px', borderRadius:'4px', fontSize:'13px', lineHeight:1.7,
              background: msg.role === 'user' ? `rgba(184,147,58,0.18)` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(184,147,58,0.3)' : 'rgba(255,255,255,0.07)'}`,
              color: msg.role === 'user' ? '#e8e0d0' : '#c4cdd8',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', gap:'6px', alignItems:'center', padding:'8px' }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, animation:'pulse 0.6s infinite' }} />
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, animation:'pulse 0.6s infinite 0.15s' }} />
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, animation:'pulse 0.6s infinite 0.3s' }} />
          </div>
        )}
      </div>

      {/* Apply suggestion button */}
      {suggested && onApply && (
        <div style={{ padding:'8px 16px', background:'rgba(74,222,128,0.06)', borderTop:'1px solid rgba(74,222,128,0.15)', flexShrink:0, display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ color:'#4ade80', fontSize:'11px', flex:1 }}>✓ AI generated a suggestion — apply it to your rules?</span>
          <button onClick={() => { onApply(suggested); setSuggested(null); }}
            style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'4px', padding:'5px 14px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
            Apply
          </button>
          <button onClick={() => setSuggested(null)}
            style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'16px', padding:'0 4px' }}>×</button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', gap:'8px', flexShrink:0 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Share an idea, observation, or ask for suggestions…"
          rows={2} style={{ ...ta, flex:1 }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'8px 16px', cursor:'pointer', fontWeight:'700', fontSize:'11px', alignSelf:'flex-end', whiteSpace:'nowrap' }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ─── Intent Engine Tuner ──────────────────────────────────────────────────
function IntentEngineTuner() {
  const [s, setS]       = useState(getPortalSettings);
  const [saved, setSaved] = useState(false);

  const DUCK_DEFAULT = `A Duck is a skeptical, argumentative, or combative prospect who challenges claims and pushes back before fully listening. Ducks lead with doubt, not curiosity.

EXACT PHRASES — classify as Duck if any detected:
"that won't work" / "prove it" / "I doubt that" / "sounds too good to be true" / "what's the catch" / "I've heard that before" / "yeah but" / "I'm not convinced" / "that's not realistic" / "why would I trust you" / "show me the numbers" / "everyone says that" / "how do you make money" / "I've done my research" / "I don't see how that's possible" / "my lawyer won't like this" / "what's the guarantee" / "this sounds like a pitch" / "I'm skeptical" / "that seems risky" / "what happens if it fails"

BEHAVIORAL PATTERNS — classify as Duck if observed:
- Interrupts before agent finishes a sentence
- Asks the same question multiple ways (testing for inconsistency)
- Agrees on one point, immediately pivots to a new objection (whack-a-mole)
- Cites a past bad investment experience
- Short clipped responses with flat tone: "uh-huh", "right", "sure"
- Long silence after agent answers, then a new challenge

DEEPGRAM SENTIMENT — use to reinforce classification:
- Repeated negative sentiment segments = stronger Duck signal
- Negative sentiment immediately after agent makes a point = active resistance
- Sentiment swinging negative then positive = potential opening, ease off pressure

INTENSITY — score 1-5:
1 = Politely skeptical  2 = Mild Duck  3 = Moderate Duck  4 = Hard Duck  5 = Full Quack

HIDDEN BUYING SIGNALS (Duck is actually interested):
- Keeps asking questions despite pushback
- Asks about portal, paperwork, or logistics
- Objection frequency slows or stops — flag CLOSE WINDOW OPEN`;

  const COW_DEFAULT = `A Cow is a warm, curious, agreeable prospect who trusts what they hear, asks genuine questions, and responds enthusiastically. Cows are frequently mishandled — enthusiasm is mistaken for commitment and the call ends without a close.

EXACT PHRASES — classify as Cow if any detected:
"that's interesting" / "really?" / "wow" / "I didn't know that" / "that makes a lot of sense" / "tell me more" / "how does that work" / "I love that idea" / "that sounds amazing" / "I hadn't thought of it that way" / "so what would I need to do" / "oh that's not as complicated as I thought" / "I like the sound of that" / "you really know your stuff" / "I've been looking for something like this" / "is this a good investment" / "what do most people do" / "this is really exciting"

BEHAVIORAL PATTERNS — classify as Cow if observed:
- Asks follow-up questions after every point
- Agrees out loud mid-sentence ("mm-hmm", "yeah", "right" — warm, not flat)
- Repeats agent phrases back to internalize them
- Shares personal financial context unprompted
- Keeps conversation going but avoids committing to anything specific

DEEPGRAM SENTIMENT — use to reinforce classification:
- Sustained positive sentiment = confirmed Cow, watch for close window
- Positive sentiment followed by long silence = processing, do not interrupt
- Sentiment drops after enthusiasm peak = drift warning, redirect now
- Speaker 0 positive AND Speaker 1 positive = rapport peak, ideal close moment

INTENSITY — score 1-5:
1 = Mildly warm  2 = Engaged  3 = Full Cow  4 = Enthusiastic  5 = Happy Grazer (close now)

CLOSE WINDOW SIGNALS — flag CLOSE WINDOW OPEN:
- "that sounds amazing" / "I love that" / "so what would I need to do?"
- Any logistics question (portal, wire, minimum)
- Enthusiasm peaks then energy softens — act before it closes

DRIFT SIGNALS — flag DRIFT WARNING:
- Goes off-topic / "this has been so helpful" in a wrap-up tone
- Energy drops after high point without commitment`;

  const TRIGGERS_DEFAULT = `returns, ROI, yield, how much, minimum, minimum investment, $15,000, 15k, what do I get, what's my return, profit, distributions, distribution threshold, when do I get paid, how often, quarterly, waterfall, profit waterfall, capital return, return of capital, get my money back, how does it work, what is Rosie, what does Rosie do, AI platform, enterprise, B2B, clients, paying customers, MRR, revenue, $20,000, 28 organizations, how many customers, break even, what's the catch, risk, risky, what could go wrong, lose my money, worst case, guarantee, guaranteed, accredited, accredited investor, do I qualify, SEC, Reg D, 506c, legal, lawyer, attorney, operating agreement, subscription, how do I invest, portal, investor portal, next steps, wire, wire transfer, Class B, units, ownership, voting, do I have a vote, equity, stake, 21.5%, managing partner, Stephani, Wyoming, LLC, taxes, K-1, Schedule K-1, UBTI, tax, how is this taxed, exit, liquidity, can I sell, transfer, secondary market, lock up, how long, what happens if it fails, shut down, competitor, other AI tools, why Rosie, what makes you different, track record, traction, customers, proof, case study, dilution, cap table`;

  const POS_DEFAULT = `that sounds amazing, I love that, I'm interested, tell me more, that makes sense, really?, wow, I didn't know that, so what would I need to do, how do I sign up, I've been looking for something like this, that's not as complicated as I thought, I like the sound of that, you really know your stuff, is this a good investment, what do most people do, that actually makes me feel better, I want to move forward, where do I send the money, what's the minimum again, how do I get started, can you send me the link, send me the portal, I'm ready, let's do it, when can we start, what are the next steps, I've had money sitting, I have some capital, I've been thinking about this, that's exactly what I'm looking for, this is exciting, I trust you, I believe that, so I get my money back first, that's a good structure, quarterly sounds good, I like the waterfall idea, my accountant would like that, that protects me, I'm in`;

  const NEG_DEFAULT = `that won't work, prove it, I doubt that, sounds too good to be true, what's the catch, I've heard that before, yeah but, I'm not convinced, that's not realistic, why would I trust you, show me the numbers, I don't see how that's possible, my lawyer won't like this, what's the guarantee, this sounds like a pitch, I'm skeptical, that seems risky, what happens if it fails, I need to think about it, I'll think about it, not right now, maybe later, I need to talk to my spouse, I need to talk to my accountant, I need to do more research, I'm not ready, I don't have the money right now, 15k is a lot, that's a big commitment, I'm not accredited, I don't qualify, I've been burned before, I lost money on something like this, sounds like every other pitch, I don't invest in startups, AI is a bubble, this could all disappear, what if you go under, I don't know you, how do I know this is real, is this a scam, I need more time, call me next month, I'm too busy right now, my money is tied up, I have to pass, I'm going to pass, not interested, I'll let you know`;

  const SENTIMENT_DEFAULT = [
    { id:1, condition:'3+ consecutive negative segments', effect:'Boost Duck score, flag resistance spike in coach tip' },
    { id:2, condition:'positive segment immediately after agent explains waterfall', effect:'Flag CLOSE WINDOW — prospect responded warmly to structure' },
    { id:3, condition:'sentiment arc: positive then negative then positive', effect:'Duck showing interest — objection cleared, watch for opening' },
    { id:4, condition:'sentiment flat neutral for 5+ segments', effect:'Cow drifting — trigger redirect tip in coach' },
    { id:5, condition:'Speaker 0 positive AND Speaker 1 positive simultaneously', effect:'Rapport peak — ideal close moment, surface in coach tip' },
  ];

  const [duckDef,    setDuckDef]    = useState(s.intentDuckDefinition  || DUCK_DEFAULT);
  const [cowDef,     setCowDef]     = useState(s.intentCowDefinition   || COW_DEFAULT);
  const [triggers,   setTriggers]   = useState(s.intentTriggerKeywords || TRIGGERS_DEFAULT);
  const [interval2,  setInterval2]  = useState(s.intentIntervalSeconds || 20);
  const [posSignals, setPosSignals] = useState(s.intentPositiveSignals || POS_DEFAULT);
  const [negSignals, setNegSignals] = useState(s.intentNegativeSignals || NEG_DEFAULT);
  const [sentRules,  setSentRules]  = useState(() => {
    const saved = getPortalSettings().intentSentimentRules;
    return saved ? JSON.parse(saved) : SENTIMENT_DEFAULT;
  });
  const [sentModalOpen, setSentModalOpen] = useState(false);
  const [editingSent,   setEditingSent]   = useState(null);
  const [activeType,    setActiveType]    = useState('duck');

  useEffect(() => {
    loadPortalSettings().then(loaded => {
      setS(loaded);
      setDuckDef(loaded.intentDuckDefinition   || DUCK_DEFAULT);
      setCowDef(loaded.intentCowDefinition     || COW_DEFAULT);
      setTriggers(loaded.intentTriggerKeywords || TRIGGERS_DEFAULT);
      setInterval2(loaded.intentIntervalSeconds || 20);
      setPosSignals(loaded.intentPositiveSignals || POS_DEFAULT);
      setNegSignals(loaded.intentNegativeSignals || NEG_DEFAULT);
      if (loaded.intentSentimentRules) setSentRules(JSON.parse(loaded.intentSentimentRules));
    });
  }, []);

  const save = async () => {
    await savePortalSettings({
      ...s,
      intentDuckDefinition:  duckDef,
      intentCowDefinition:   cowDef,
      intentTriggerKeywords: triggers,
      intentIntervalSeconds: Number(interval2),
      intentPositiveSignals: posSignals,
      intentNegativeSignals: negSignals,
      intentSentimentRules:  JSON.stringify(sentRules),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetDefaults = () => {
    setDuckDef(DUCK_DEFAULT); setCowDef(COW_DEFAULT);
    setTriggers(TRIGGERS_DEFAULT); setInterval2(20);
    setPosSignals(POS_DEFAULT); setNegSignals(NEG_DEFAULT);
    setSentRules(SENTIMENT_DEFAULT);
  };

  const saveSentRule = (rule) => {
    if (rule.id && sentRules.find(r => r.id === rule.id)) {
      setSentRules(prev => prev.map(r => r.id === rule.id ? rule : r));
    } else {
      setSentRules(prev => [...prev, { ...rule, id: Date.now() }]);
    }
    setSentModalOpen(false); setEditingSent(null);
  };

  const S = {
    card:  { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', padding:'16px 18px', marginBottom:'14px' },
    label: { fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px', display:'flex', justifyContent:'space-between', alignItems:'center' },
    ta:    { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'vertical', lineHeight:1.6 },
    tab:   (active, color) => ({ flex:1, background: active ? `${color}18` : 'transparent', border:`1px solid ${active ? color+'44' : 'rgba(255,255,255,0.07)'}`, borderRadius:'4px', color: active ? color : '#6b7280', padding:'6px', cursor:'pointer', fontSize:'11px', fontWeight: active ? '500' : '400' }),
  };

  const SentModal = ({ rule, onSave, onClose }) => {
    const [cond, setCond] = useState(rule?.condition || '');
    const [eff,  setEff]  = useState(rule?.effect    || '');
    const minp = { width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'8px 12px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', marginBottom:'10px' };
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ background:'#0d1b2a', border:'1px solid rgba(96,165,250,0.35)', borderRadius:'8px', padding:'20px', width:'420px' }}>
          <div style={{ color:'#60a5fa', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>{rule?.id ? 'Edit' : 'Add'} sentiment rule</div>
          <div style={{ color:'#6b7280', fontSize:'10px', marginBottom:'5px' }}>When Deepgram detects…</div>
          <input value={cond} onChange={e => setCond(e.target.value)} style={minp} placeholder="e.g. 3+ consecutive negative segments" />
          <div style={{ color:'#6b7280', fontSize:'10px', marginBottom:'5px' }}>Coach / intent should…</div>
          <textarea value={eff} onChange={e => setEff(e.target.value)} rows={2} style={{ ...minp, resize:'vertical', marginBottom:'14px' }} placeholder="e.g. boost Duck score, flag resistance spike in coach tip" />
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <button onClick={onClose} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'6px 14px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
            <button onClick={() => { if (cond.trim() && eff.trim()) onSave({ ...rule, condition: cond.trim(), effect: eff.trim() }); }}
              disabled={!cond.trim() || !eff.trim()}
              style={{ background:'linear-gradient(135deg,#185FA5,#378ADD)', color:'white', border:'none', borderRadius:'4px', padding:'6px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'700', opacity:(!cond.trim()||!eff.trim())?0.5:1 }}>
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth:'700px' }}>
      <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 4px', fontSize:'16px' }}>🦆 Intent Engine Tuning</h3>
      <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 20px', lineHeight:1.6 }}>
        Runs post-call and classifies the prospect, scores buying intent, and extracts CRM data. Deepgram provides real-time <strong style={{ color:'#60a5fa' }}>sentiment</strong> and <strong style={{ color:'#60a5fa' }}>speaker labels</strong> per utterance — these feed directly into classification.
      </p>

      {/* Duck / Cow tabbed */}
      <div style={S.card}>
        <div style={{ ...S.label, color:GOLD }}><span>🐾 Prospect type definitions</span></div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'10px' }}>The AI uses these exact definitions to classify the prospect. Include phrases, behaviors, and Deepgram sentiment cues.</div>
        <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
          <button onClick={() => setActiveType('duck')} style={S.tab(activeType==='duck', '#f59e0b')}>🦆 Duck (skeptic)</button>
          <button onClick={() => setActiveType('cow')}  style={S.tab(activeType==='cow',  '#4ade80')}>🐄 Cow (believer)</button>
        </div>
        {activeType === 'duck' && <textarea value={duckDef} onChange={e => setDuckDef(e.target.value)} rows={12} style={{ ...S.ta, borderColor:'rgba(245,158,11,0.2)' }} />}
        {activeType === 'cow'  && <textarea value={cowDef}  onChange={e => setCowDef(e.target.value)}  rows={12} style={{ ...S.ta, borderColor:'rgba(74,222,128,0.2)' }} />}
      </div>

      {/* Deepgram Sentiment Rules */}
      <div style={S.card}>
        <div style={{ ...S.label, color:'#60a5fa' }}>
          <span>📡 Deepgram sentiment rules</span>
          <span style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa', fontSize:'10px', padding:'2px 8px', borderRadius:'20px', letterSpacing:'normal', textTransform:'none' }}>{sentRules.length} rules</span>
        </div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'10px' }}>
          Deepgram sends <strong style={{ color:'#60a5fa' }}>sentiment</strong> (positive / negative / neutral) and <strong style={{ color:'#60a5fa' }}>speaker labels</strong> per utterance in real time. These rules define how that data adjusts classification and triggers coach tips — no extra AI call needed.
        </div>
        {sentRules.map(r => (
          <div key={r.id} style={{ background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.12)', borderRadius:'5px', padding:'9px 12px', marginBottom:'7px', display:'flex', alignItems:'flex-start', gap:'10px' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#60a5fa', fontSize:'11px', marginBottom:'3px' }}>When: <span style={{ color:'#e8e0d0', fontStyle:'italic' }}>{r.condition}</span></div>
              <div style={{ color:'#8a9ab8', fontSize:'11px', lineHeight:1.4 }}>→ {r.effect}</div>
            </div>
            <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
              <button onClick={() => { setEditingSent(r); setSentModalOpen(true); }} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'3px 7px', cursor:'pointer', color:'#6b7280', fontSize:'11px' }}>✏</button>
              <button onClick={() => setSentRules(prev => prev.filter(x => x.id !== r.id))} style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:'4px', padding:'3px 7px', cursor:'pointer', color:'#ef4444', fontSize:'11px' }}>✕</button>
            </div>
          </div>
        ))}
        <button onClick={() => { setEditingSent(null); setSentModalOpen(true); }} style={{ width:'100%', padding:'7px', border:'1px dashed rgba(96,165,250,0.2)', borderRadius:'5px', background:'transparent', cursor:'pointer', color:'#4a5568', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', marginTop:'4px' }}>
          <span style={{ fontSize:'16px', lineHeight:1 }}>+</span> Add sentiment rule
        </button>
      </div>

      {/* Positive Signals */}
      <div style={S.card}>
        <div style={{ ...S.label, color:'#4ade80' }}>✅ Positive signal phrases</div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'8px' }}>Verbatim phrases indicating buying intent. Logged in the AI Details tab and boost the intent score.</div>
        <textarea value={posSignals} onChange={e => setPosSignals(e.target.value)} rows={4} style={{ ...S.ta, borderColor:'rgba(74,222,128,0.15)' }} />
      </div>

      {/* Negative Signals */}
      <div style={S.card}>
        <div style={{ ...S.label, color:'#ef4444' }}>⚠️ Negative signal phrases</div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'8px' }}>Verbatim phrases indicating hesitation or objection. Logged in the AI Details tab and reduce the intent score.</div>
        <textarea value={negSignals} onChange={e => setNegSignals(e.target.value)} rows={4} style={{ ...S.ta, borderColor:'rgba(239,68,68,0.15)' }} />
      </div>

      {/* Auto Q&A Triggers */}
      <div style={S.card}>
        <div style={{ ...S.label, color:GOLD }}>❓ Auto Q&A trigger keywords</div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'8px' }}>
          Comma-separated. When detected in the transcript, the AI instantly looks up an answer from the KB. No button click needed.
        </div>
        <textarea value={triggers} onChange={e => setTriggers(e.target.value)} rows={4} style={S.ta} />
        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginTop:'8px' }}>
          {triggers.split(',').slice(0, 20).map((k,i) => (
            <span key={i} style={{ background:'rgba(184,147,58,0.08)', border:'1px solid rgba(184,147,58,0.15)', borderRadius:'20px', padding:'2px 8px', fontSize:'10px', color:'#b8933a', fontFamily:'monospace' }}>{k.trim()}</span>
          ))}
          {triggers.split(',').length > 20 && <span style={{ fontSize:'10px', color:'#4a5568', padding:'2px 6px' }}>+{triggers.split(',').length - 20} more</span>}
        </div>
      </div>

      {/* Interval */}
      <div style={S.card}>
        <div style={{ ...S.label, color:GOLD }}>
          <span>⏱ Intent check interval</span>
          <span style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontSize:'10px', padding:'2px 8px', borderRadius:'20px', letterSpacing:'normal', textTransform:'none' }}>Every {interval2}s</span>
        </div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'10px' }}>How often the post-call intent AI runs. Deepgram sentiment runs continuously regardless.</div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ color:'#4a5568', fontSize:'11px' }}>10s</span>
          <input type="range" min={10} max={60} step={5} value={interval2} onChange={e => setInterval2(Number(e.target.value))} style={{ flex:1, accentColor:GOLD }} />
          <span style={{ color:'#4a5568', fontSize:'11px' }}>60s</span>
        </div>
        <div style={{ color:'#4a5568', fontSize:'10px', textAlign:'center', marginTop:'6px' }}>20s recommended.</div>
      </div>

      {/* Save */}
      <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'32px' }}>
        <button onClick={resetDefaults} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 20px', cursor:'pointer', fontSize:'12px' }}>Reset to defaults</button>
        <button onClick={save} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'10px 28px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'1px', textTransform:'uppercase' }}>Save settings</button>
        {saved && <span style={{ color:'#4ade80', fontSize:'12px' }}>✓ Saved — live on next call</span>}
      </div>

      {/* AI Tuner */}
      <div style={{ marginBottom:'8px' }}>
        <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 6px', fontSize:'16px' }}>💬 AI Tuning Assistant</h3>
        <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 14px', lineHeight:1.6 }}>Share observations from real calls — the AI will expand them into Duck/Cow signals, sentiment rules, and Q&A keywords.</p>
        <AITunerChat context="Intent Engine (Duck/Cow classification, Deepgram sentiment, Q&A triggers)" onApply={(suggestion) => {
          if (suggestion.duckSignals?.length)     setDuckDef(prev => prev + '\n\nAdditional signals: ' + suggestion.duckSignals.join(', '));
          if (suggestion.cowSignals?.length)      setCowDef(prev  => prev + '\n\nAdditional signals: ' + suggestion.cowSignals.join(', '));
          if (suggestion.keywords?.length)        setTriggers(prev => prev + ', ' + suggestion.keywords.join(', '));
          if (suggestion.positiveSignals?.length) setPosSignals(prev => prev + ', ' + suggestion.positiveSignals.join(', '));
          if (suggestion.negativeSignals?.length) setNegSignals(prev => prev + ', ' + suggestion.negativeSignals.join(', '));
          if (suggestion.sentimentRule)           setSentRules(prev => [...prev, { id: Date.now(), condition: suggestion.sentimentRule.condition, effect: suggestion.sentimentRule.effect }]);
        }} />
      </div>

      {sentModalOpen && <SentModal rule={editingSent} onSave={saveSentRule} onClose={() => { setSentModalOpen(false); setEditingSent(null); }} />}
    </div>
  );
}

// ─── Coach Rules Tuner ────────────────────────────────────────────────────
// ── Coach Smart Rule Modal ────────────────────────────────────────────────────
function SmartRuleModal({ rule, onSave, onClose }) {
  const [trigger, setTrigger] = useState(rule?.trigger || '');
  const [tip,     setTip]     = useState(rule?.tip     || '');
  const [icon,    setIcon]    = useState(rule?.icon    || '💬');

  const iconOptions = [
    { v:'💬', label:'Question / curiosity' },
    { v:'⚠️', label:'Concern / objection' },
    { v:'✅', label:'Buying signal' },
    { v:'🛑', label:'Red flag' },
    { v:'⏸️', label:'Stall / hesitation' },
  ];

  const inp = { width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'8px 12px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.35)', borderRadius:'8px', padding:'20px', width:'380px', boxShadow:'0 24px 80px rgba(0,0,0,0.85)' }}>
        <div style={{ color:GOLD, fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>
          {rule ? '✏️ Edit rule' : '+ Add rule'}
        </div>
        <div style={{ marginBottom:'10px' }}>
          <div style={{ color:'#6b7280', fontSize:'10px', marginBottom:'5px' }}>Icon</div>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {iconOptions.map(o => (
              <button key={o.v} onClick={() => setIcon(o.v)}
                style={{ background: icon===o.v ? 'rgba(184,147,58,0.2)' : 'rgba(255,255,255,0.04)', border:`1px solid ${icon===o.v ? 'rgba(184,147,58,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'13px', color:'#e8e0d0' }}
                title={o.label}>{o.v}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:'10px' }}>
          <div style={{ color:'#6b7280', fontSize:'10px', marginBottom:'5px' }}>Trigger words or phrases (comma-separated)</div>
          <input value={trigger} onChange={e => setTrigger(e.target.value)} style={inp} placeholder='e.g. "risky", "worried", "not sure"' />
        </div>
        <div style={{ marginBottom:'16px' }}>
          <div style={{ color:'#6b7280', fontSize:'10px', marginBottom:'5px' }}>Coach tip to show when triggered</div>
          <textarea value={tip} onChange={e => setTip(e.target.value)} rows={3} style={{ ...inp, resize:'vertical' }} placeholder="What should the agent do or say right now?" />
        </div>
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'7px 16px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
          <button onClick={() => { if (trigger.trim() && tip.trim()) onSave({ ...rule, icon, trigger: trigger.trim(), tip: tip.trim(), title: trigger.split(',')[0].trim() }); }}
            disabled={!trigger.trim() || !tip.trim()}
            style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'7px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'700', opacity: (!trigger.trim()||!tip.trim()) ? 0.5 : 1 }}>
            Save rule
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Coach Rules Tuner ─────────────────────────────────────────────────────────
function CoachRulesTuner() {
  const [s, setS]         = useState(getPortalSettings);
  const [saved, setSaved] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null); // null = new

  // Focus area pills
  const ALL_FOCUS_PILLS = [
    'Tone & rapport', 'Objection handling', 'Next best action',
    'Pacing & silence', 'Clarifying questions', 'Investor qualification',
    'Emotional signals', 'Closing readiness', 'Red flags',
  ];
  const DEFAULT_FOCUS_PILLS = ['Tone & rapport', 'Objection handling', 'Next best action'];

  // Coaching style
  const STYLE_DEFAULT = `One tip only. Max 2 sentences. Plain language, no jargon. Be direct — tell the agent exactly what to do or say right now. If a close is possible, give the exact words. If resistance is rising, name the type and the move. Never explain why — just tell the agent what to do.`;

  // Additional context
  const CONTEXT_DEFAULT = `PRODUCT FACTS
- Company: Rosie AI LLC, Wyoming LLC, Reg D 506(c) — accredited investors only
- Minimum investment: $15,000 (Class B Units at $0.25/unit)
- Units are non-voting. Investors get economic participation, not control
- Distribution threshold: $20,000/month MRR (~28-30 paying orgs at $700 avg MRR)
- Profit waterfall: expenses first → return of capital to Class B → then 21.5% to Class B / 78.5% to Class A
- Investor portal: investors.rosieai.tech/portal
- Never use the word "guaranteed" — ever
- Managing Partner: Stephani Scheidt

PROSPECT TYPES
THE DUCK — argumentative, skeptical, combative. Stay calm, use exact numbers, validate skepticism first. Do NOT fill silences. When objections slow down → CLOSE WINDOW OPEN.
THE COW — agreeable, curious, warm. CLOSE EARLY AND OFTEN — enthusiasm is not a commitment. Every call must end with a specific next step or it evaporates.

GENERAL RULES
- Portal link and subscription docs are the concrete next step for every call
- Never promise returns, never say "guaranteed", never dismiss a concern`;

  // Smart rules defaults
  const DEFAULT_RULES = [
    { id:1, icon:'💬', title:'returns', trigger:'return, roi, yield, how much', tip:'Lead with the waterfall structure, then emphasize the return-of-capital priority before profit splits.' },
    { id:2, icon:'⚠️', title:'risk or hesitation', trigger:'risky, worried, not sure, concerned', tip:'Acknowledge the concern, then pivot to the $15k minimum and the capital-return-first waterfall.' },
    { id:3, icon:'✅', title:'buying signal', trigger:"sounds good, I'm interested, how do I, tell me more", tip:'Strong signal — ask for the commitment or direct them to the investor portal now.' },
  ];

  // Listening strategy toggles
  const LISTENING_ITEMS = [
    { key:'listenNeeds',     label:'Listen for client needs & wants',         desc:'Detects what the prospect is actually looking for, not just what they say' },
    { key:'listenEmotion',   label:'Detect emotional state',                  desc:'Reads enthusiasm, hesitation, and doubt from word choice and phrasing' },
    { key:'listenUnresolved',label:'Track unresolved questions',              desc:'Notes questions the prospect raised that haven\'t been answered yet' },
    { key:'listenStall',     label:'Identify stalling vs. genuine objection', desc:'Distinguishes "I need to think" (stall) from a real concern that needs addressing' },
    { key:'listenFollowUp',  label:'Suggest follow-up timing',                desc:'Recommends when to go in for the close or when to back off and schedule a follow-up' },
  ];
  const DEFAULT_LISTENING = { listenNeeds: true, listenEmotion: true, listenUnresolved: true, listenStall: false, listenFollowUp: false };

  // State
  const [focusPills,  setFocusPills]  = useState(() => {
    const saved = getPortalSettings().coachFocusPills;
    return saved ? JSON.parse(saved) : DEFAULT_FOCUS_PILLS;
  });
  const [style,       setStyle]       = useState(s.coachStyle          || STYLE_DEFAULT);
  const [context,     setContext]     = useState(s.coachAdditionalContext || CONTEXT_DEFAULT);
  const [interval,    setInterval]    = useState(s.coachIntervalSeconds || 15);
  const [rules,       setRules]       = useState(() => {
    const saved = getPortalSettings().coachSmartRules;
    return saved ? JSON.parse(saved) : DEFAULT_RULES;
  });
  const [listening,   setListening]   = useState(() => {
    const saved = getPortalSettings().coachListeningStrategy;
    return saved ? JSON.parse(saved) : DEFAULT_LISTENING;
  });

  useEffect(() => {
    loadPortalSettings().then(loaded => {
      setS(loaded);
      setStyle(loaded.coachStyle || STYLE_DEFAULT);
      setContext(loaded.coachAdditionalContext || CONTEXT_DEFAULT);
      setInterval(loaded.coachIntervalSeconds || 15);
      if (loaded.coachFocusPills)        setFocusPills(JSON.parse(loaded.coachFocusPills));
      if (loaded.coachSmartRules)        setRules(JSON.parse(loaded.coachSmartRules));
      if (loaded.coachListeningStrategy) setListening(JSON.parse(loaded.coachListeningStrategy));
    });
  }, []);

  // Assemble coachFocusAreas string from pills for the AI prompt
  const buildFocusString = (pills) => pills.join(', ');

  // Assemble smart rules into context block for the AI
  const buildRulesContext = (ruleList) => ruleList.length
    ? '\n\nSMART RULES — fire these tips when triggers detected:\n' +
      ruleList.map(r => `Trigger: ${r.trigger} → Tip: "${r.tip}"`).join('\n')
    : '';

  // Assemble listening strategy into context block
  const buildListeningContext = (lst) => {
    const active = LISTENING_ITEMS.filter(i => lst[i.key]).map(i => i.label);
    return active.length ? '\n\nLISTENING STRATEGY: ' + active.join(', ') : '';
  };

  const save = async () => {
    const focusStr = buildFocusString(focusPills);
    const fullContext = context + buildRulesContext(rules) + buildListeningContext(listening);
    await savePortalSettings({
      ...s,
      coachFocusAreas: focusStr,
      coachStyle: style,
      coachAdditionalContext: fullContext,
      coachIntervalSeconds: Number(interval),
      coachFocusPills: JSON.stringify(focusPills),
      coachSmartRules: JSON.stringify(rules),
      coachListeningStrategy: JSON.stringify(listening),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const resetDefaults = async () => {
    setFocusPills(DEFAULT_FOCUS_PILLS);
    setStyle(STYLE_DEFAULT);
    setContext(CONTEXT_DEFAULT);
    setInterval(15);
    setRules(DEFAULT_RULES);
    setListening(DEFAULT_LISTENING);
  };

  const togglePill = (pill) => setFocusPills(prev =>
    prev.includes(pill) ? prev.filter(p => p !== pill) : [...prev, pill]
  );

  const toggleListening = (key) => setListening(prev => ({ ...prev, [key]: !prev[key] }));

  const saveRule = (rule) => {
    if (rule.id) {
      setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
    } else {
      setRules(prev => [...prev, { ...rule, id: Date.now() }]);
    }
    setModalOpen(false);
    setEditingRule(null);
  };

  const deleteRule = (id) => setRules(prev => prev.filter(r => r.id !== id));

  const openEdit = (rule) => { setEditingRule(rule); setModalOpen(true); };
  const openAdd  = ()     => { setEditingRule(null); setModalOpen(true); };

  const S = {
    card:  { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', padding:'16px 18px', marginBottom:'14px' },
    label: { fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' },
    ta:    { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'vertical', lineHeight:1.6 },
    pill:  (active) => ({ display:'inline-flex', alignItems:'center', padding:'5px 12px', borderRadius:'20px', border:`1px solid ${active ? 'rgba(184,147,58,0.5)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(184,147,58,0.12)' : 'transparent', color: active ? GOLD : '#6b7280', cursor:'pointer', fontSize:'12px', userSelect:'none', transition:'all 0.15s' }),
    ruleCard: { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'5px', padding:'10px 12px', marginBottom:'8px', display:'flex', alignItems:'flex-start', gap:'10px' },
    toggleRow: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' },
    toggleBtn: (on) => ({ width:'36px', height:'20px', borderRadius:'10px', border:'none', cursor:'pointer', position:'relative', background: on ? '#1D9E75' : 'rgba(255,255,255,0.1)', flexShrink:0, transition:'background 0.2s' }),
  };

  const iconBg = { '💬':'rgba(167,139,250,0.15)', '⚠️':'rgba(245,158,11,0.15)', '✅':'rgba(74,222,128,0.15)', '🛑':'rgba(239,68,68,0.15)', '⏸️':'rgba(255,255,255,0.08)' };

  return (
    <div style={{ maxWidth:'700px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
        <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:0, fontSize:'16px' }}>🎯 Coach Mode settings</h3>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'11px', color: enabled ? '#4ade80' : '#6b7280' }}>{enabled ? 'Enabled' : 'Disabled'}</span>
          <button onClick={() => setEnabled(e => !e)} style={{ ...S.toggleBtn(enabled) }}>
            <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left 0.2s', left: enabled ? '18px' : '2px' }} />
          </button>
        </div>
      </div>
      <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 20px', lineHeight:1.6 }}>
        Coach mode fires every <strong style={{ color:GOLD }}>{interval}s</strong> during a live call and gives the agent one real-time tip.
      </p>

      {/* Focus Areas */}
      <div style={S.card}>
        <div style={{ ...S.label, color:'#a78bfa' }}>🎯 Focus areas</div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'10px' }}>What the coach should pay attention to on every call. Select all that apply.</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
          {ALL_FOCUS_PILLS.map(pill => (
            <button key={pill} onClick={() => togglePill(pill)} style={S.pill(focusPills.includes(pill))}>{pill}</button>
          ))}
        </div>
      </div>

      {/* Coaching Style */}
      <div style={S.card}>
        <div style={{ ...S.label, color:GOLD }}>🗣 Coaching style</div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'8px' }}>Tone and format injected into every coach prompt. The AI reads this directly.</div>
        <textarea value={style} onChange={e => setStyle(e.target.value)} rows={3} style={S.ta} />
      </div>

      {/* Smart Rules */}
      <div style={S.card}>
        <div style={{ ...S.label, color:GOLD }}>
          <span>📌 Smart rules</span>
          <span style={{ background:'rgba(167,139,250,0.15)', color:'#a78bfa', fontSize:'10px', padding:'2px 8px', borderRadius:'20px', letterSpacing:'normal', textTransform:'none' }}>{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'10px' }}>Coach fires a specific tip when these triggers are detected in the transcript.</div>
        {rules.map(r => (
          <div key={r.id} style={S.ruleCard}>
            <div style={{ width:'30px', height:'30px', borderRadius:'6px', background: iconBg[r.icon] || 'rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0 }}>{r.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'500', marginBottom:'3px' }}>Trigger: <span style={{ color:'#6b7280', fontStyle:'italic' }}>{r.trigger}</span></div>
              <div style={{ color:'#8a9ab8', fontSize:'11px', lineHeight:1.4 }}>Tip: <em>"{r.tip.length > 80 ? r.tip.slice(0,80)+'…' : r.tip}"</em></div>
            </div>
            <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
              <button onClick={() => openEdit(r)} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', color:'#6b7280', fontSize:'11px' }}>✏</button>
              <button onClick={() => deleteRule(r.id)} style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', color:'#ef4444', fontSize:'11px' }}>✕</button>
            </div>
          </div>
        ))}
        <button onClick={openAdd} style={{ width:'100%', padding:'8px', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:'5px', background:'transparent', cursor:'pointer', color:'#6b7280', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', marginTop:'4px' }}>
          <span style={{ fontSize:'16px', lineHeight:1 }}>+</span> Add rule
        </button>
      </div>

      {/* Additional Context */}
      <div style={S.card}>
        <div style={{ ...S.label, color:GOLD }}>📋 Additional context</div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'8px' }}>Facts and rules the coach always knows. Added to every coach prompt.</div>
        <div style={{ background:'rgba(0,0,0,0.2)', borderLeft:'3px solid rgba(184,147,58,0.4)', borderRadius:'0 4px 4px 0', padding:'2px' }}>
          <textarea value={context} onChange={e => setContext(e.target.value)} rows={6} style={{ ...S.ta, background:'transparent', border:'none' }} />
        </div>
      </div>

      {/* Listening Strategy */}
      <div style={S.card}>
        <div style={{ ...S.label, color:GOLD }}>👂 Listening strategy</div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'6px' }}>What the coach pays attention to when analyzing the conversation.</div>
        {LISTENING_ITEMS.map((item, i) => (
          <div key={item.key} style={{ ...S.toggleRow, borderBottom: i === LISTENING_ITEMS.length-1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ flex:1, paddingRight:'12px' }}>
              <div style={{ color:'#e8e0d0', fontSize:'12px', marginBottom:'2px' }}>{item.label}</div>
              <div style={{ color:'#4a5568', fontSize:'11px' }}>{item.desc}</div>
            </div>
            <button onClick={() => toggleListening(item.key)} style={S.toggleBtn(listening[item.key])}>
              <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left 0.2s', left: listening[item.key] ? '18px' : '2px' }} />
            </button>
          </div>
        ))}
      </div>

      {/* Coach Interval */}
      <div style={S.card}>
        <div style={{ ...S.label, color:GOLD }}>
          <span>⏱ Coach interval</span>
          <span style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b', fontSize:'10px', padding:'2px 8px', borderRadius:'20px', letterSpacing:'normal', textTransform:'none' }}>Every {interval}s</span>
        </div>
        <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'10px' }}>How often tips fire during an active call (in seconds).</div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ color:'#4a5568', fontSize:'11px' }}>5s</span>
          <input type="range" min={5} max={60} step={5} value={interval}
            onChange={e => setInterval(Number(e.target.value))}
            style={{ flex:1, accentColor:GOLD }} />
          <span style={{ color:'#4a5568', fontSize:'11px' }}>60s</span>
        </div>
        <div style={{ color:'#4a5568', fontSize:'10px', textAlign:'center', marginTop:'6px' }}>Faster intervals = more tips, more interruptions. 15–30s recommended.</div>
      </div>

      {/* Save / Reset */}
      <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'32px' }}>
        <button onClick={resetDefaults} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 20px', cursor:'pointer', fontSize:'12px' }}>Reset to defaults</button>
        <button onClick={save} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'10px 28px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'1px', textTransform:'uppercase' }}>Save settings</button>
        {saved && <span style={{ color:'#4ade80', fontSize:'12px' }}>✓ Saved — live on next call</span>}
      </div>

      {/* AI Tuning Chatbot */}
      <div>
        <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 6px', fontSize:'16px' }}>💬 AI Tuning Assistant</h3>
        <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 14px', lineHeight:1.6 }}>
          Tell the AI what situations you want the coach to handle better. It will generate specific rules you can apply directly.
        </p>
        <AITunerChat context="Coach Mode (real-time call coaching)" onApply={(suggestion) => {
          if (suggestion.focusArea) togglePill(suggestion.focusArea);
          if (suggestion.rule)      setRules(prev => [...prev, { id: Date.now(), icon:'💬', title: suggestion.rule.slice(0,30), trigger: suggestion.trigger || '', tip: suggestion.rule }]);
          if (suggestion.context)   setContext(prev => prev + '\n' + suggestion.context);
        }} />
      </div>

      {/* Smart Rule Modal */}
      {modalOpen && (
        <SmartRuleModal rule={editingRule} onSave={saveRule} onClose={() => { setModalOpen(false); setEditingRule(null); }} />
      )}
    </div>
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
];

export default function AdminDashboard() {
  const { portalUser, isAdmin, isPortalLoading, portalLogout, getAllUsers, removeUser, changeAdminPassword, changeAdminUsername } = usePortalAuth();
  const [view, setView]           = useState(() => localStorage.getItem('admin_view') || 'users');
  const [users, setUsers]         = useState([]);
  const [showAdd, setShowAdd]     = useState(false);
  const [contactCard, setContactCard] = useState(null);
  const [openLeadId,  setOpenLeadId]  = useState(null);   // set by calendar to auto-open a lead card
  const [allSessions, setAllSessions] = useState([]);
  const [globalStats, setGlobalStats] = useState({ totalSessions:0, totalTime:0, totalDownloads:0, totalDocViews:0 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDisposition, setFilterDisposition] = useState('active');
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
  const filteredUsers  = nonAdminUsers.filter(u => {
    const statusMatch = filterStatus === 'all' || (u.status||'prospect') === filterStatus;
    const disp = u.disposition || 'active';
    const dispMatch = filterDisposition === 'all' || disp === filterDisposition;
    return statusMatch && dispMatch;
  });
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

        {/* Upcoming appointments — only on CRM tab, not leads (pipeline needs the space) */}
        {view === 'users' && (
          <UpcomingReminders
            onOpenLeadCard={(lead) => { handleViewChange('leads'); setOpenLeadId(lead.id); }}
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
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                        {[['all','All'],['prospect','Potential Investors'],['investor','Investors']].map(([s,l]) => (
                          <button key={s} onClick={() => setFilterStatus(s)}
                            style={{ padding:'7px 14px', background:filterStatus===s?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.05)', border:`1px solid ${filterStatus===s?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', color:filterStatus===s?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>
                            {l}
                          </button>
                        ))}
                        <div style={{ width:'1px', background:'rgba(255,255,255,0.08)', margin:'0 4px' }} />
                        {[['active','Active'],['callback','📅 Callbacks'],['not_interested','🚫 Not Interested'],['all','Show All']].map(([d,l]) => (
                          <button key={d} onClick={() => setFilterDisposition(d)}
                            style={{ padding:'7px 14px', background:filterDisposition===d?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.05)', border:`1px solid ${filterDisposition===d?GOLD:'rgba(255,255,255,0.12)'}`, borderRadius:'2px', color:filterDisposition===d?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>
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
        {view === 'calendar' && <GlobalCalendar users={users} setContactCard={setContactCard} setView={handleViewChange} setOpenLeadId={setOpenLeadId} />}

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

        {view === 'leads'            && <LeadsTab openLeadId={openLeadId} onLeadOpened={() => setOpenLeadId(null)} />}
        {view === 'marketing'         && <MarketingTab />}
        {view === 'kb' && <KnowledgeBaseManagerComponent IntentEngineTuner={IntentEngineTuner} CoachRulesTuner={CoachRulesTuner} />}
        {view === 'signnow'          && <SignNowRequestsView settings={portalSettings} />}
        {view === 'signnow-settings' && <SignNowSettings settings={portalSettings} onSettingsSaved={s => setPortalSettings(s)} />}
        {view === 'portal'           && <div><div style={{ marginBottom:'28px' }}><h2 style={{ color:'#e8e0d0', margin:'0 0 6px', fontSize:'20px', fontWeight:'normal' }}>Portal Controls</h2></div><PortalControls /></div>}
        {view === 'settings'         && <AdminSettings changeAdminPassword={changeAdminPassword} changeAdminUsername={changeAdminUsername} />}
      </div>
    </div>
  );
}