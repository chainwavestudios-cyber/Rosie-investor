import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import { getPortalSettings, loadPortalSettings, savePortalSettings } from '@/lib/portalSettings';
import { SignNowRequestDB, InvestorUser, ContactNoteDB, AppointmentDB, AccreditationDocDB, KnowledgeBaseConfigDB } from '@/api/entities';
import { signnowSendDocuments, signnowGetToken } from '@/lib/signnow';
import { base44 } from '@/api/base44Client';
import AudioRecorderManager from '@/components/admin/AudioRecorderManager';
import AdminDashboardMain from '@/components/admin/AdminDashboardMain';

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
                <div style={{ color:'#8a9ab8', fontSize:'13px', marginBottom:'8px' }}>{req.userEmail}</div>
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
            <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>API Configuration</div>
              <F label="Deepgram API Key" value={s.deepgramApiKey||''} onChange={e=>upd('deepgramApiKey',e.target.value)} placeholder="Your Deepgram API key" type="password" />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>LLM Provider</label>
                  <select value={s.llmProvider||'open_ai'} onChange={e=>upd('llmProvider',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="open_ai">OpenAI</option><option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>LLM Model</label>
                  <select value={s.llmModel||'gpt-4.1-mini'} onChange={e=>upd('llmModel',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="gpt-4.1-mini">GPT-4.1 Mini</option><option value="gpt-4o-mini">GPT-4o Mini</option><option value="gpt-4o">GPT-4o</option><option value="claude-haiku-4-5-20251001">Claude Haiku</option><option value="claude-sonnet-4-6">Claude Sonnet</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Voice Settings</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>STT Model</label>
                  <select value={s.sttModel||'nova-3'} onChange={e=>upd('sttModel',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="nova-3">Nova-3</option><option value="nova-2">Nova-2</option>
                  </select>
                </div>
                <div style={{ marginBottom:'16px' }}>
                  <label style={ls}>Voice Model</label>
                  <select value={s.voiceModel||'aura-2-asteria-en'} onChange={e=>upd('voiceModel',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="aura-2-asteria-en">Asteria (Female, Warm)</option><option value="aura-2-luna-en">Luna (Female, Soft)</option><option value="aura-2-orion-en">Orion (Male)</option>
                  </select>
                </div>
              </div>
              <F label="Agent Name" value={s.chatbotName||'Rosie'} onChange={e=>upd('chatbotName',e.target.value)} placeholder="Rosie" />
            </div>
            <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Personality & Knowledge</div>
              <TA label="Opening Greeting" value={s.chatbotGreeting||''} onChange={e=>upd('chatbotGreeting',e.target.value)} rows={3} placeholder="Hi! I'm Rosie..." />
              <TA label="System Prompt / Personality" value={s.chatbotContext||''} onChange={e=>upd('chatbotContext',e.target.value)} rows={6} placeholder="You are Rosie..." />
              <TA label="Knowledge Base" value={s.knowledgeBase||''} onChange={e=>upd('knowledgeBase',e.target.value)} rows={8} />
            </div>
            <Tog label="Rosie AI Enabled on Portal" value={s.chatbotEnabled !== false} onToggle={()=>upd('chatbotEnabled',!s.chatbotEnabled)} />
          </div>
        )}
        {sec==='toggles' && <div><h3 style={{ color:'#e8e0d0', margin:'0 0 20px', fontWeight:'normal' }}>Visibility</h3><Tog label="Portal Active" value={s.portalActive} onToggle={()=>upd('portalActive',!s.portalActive)} /><Tog label="Show Market Data Tab" value={s.showMarketData} onToggle={()=>upd('showMarketData',!s.showMarketData)} /><Tog label="Show Subscription Tab" value={s.showSubscription} onToggle={()=>upd('showSubscription',!s.showSubscription)} /></div>}
        {sec==='updates' && <InvestorUpdatesManagerStub />}
        {sec==='press' && <PressReleasesManagerStub />}
        {sec==='audio' && <AudioRecorderManager />}
        {!['updates','press','audio'].includes(sec)&&<div style={{display:'flex',gap:'12px',marginTop:'32px',paddingTop:'24px',borderTop:'1px solid rgba(255,255,255,0.07)',alignItems:'center'}}><button onClick={save} style={{background:'linear-gradient(135deg,#b8933a,#d4aa50)',color:DARK,border:'none',borderRadius:'2px',padding:'12px 32px',cursor:'pointer',fontWeight:'700',fontSize:'12px',letterSpacing:'2px',textTransform:'uppercase'}}>{saved?'✓ Saved!':'Save Changes'}</button>{saved&&<span style={{color:'#4ade80',fontSize:'13px'}}>Live on portal.</span>}{saveError&&<span style={{color:'#ef4444',fontSize:'13px'}}>{saveError}</span>}</div>}
      </div>
    </div>
  );
}

// Stub sub-sections (full versions live in their own files)
function InvestorUpdatesManagerStub() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { base44.entities.InvestorUpdate.list('-publishedAt', 200).then(r => { setUpdates(r||[]); setLoading(false); }).catch(() => setLoading(false)); }, []);
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h3 style={{ color:'#e8e0d0', margin:0, fontWeight:'normal' }}>Investor Updates</h3>
        <span style={{ color:'#6b7280', fontSize:'12px' }}>{updates.length} updates</span>
      </div>
      {loading && <p style={{ color:'#6b7280' }}>Loading…</p>}
      {updates.slice(0,5).map(u => (
        <div key={u.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'12px 16px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'#e8e0d0', fontSize:'13px' }}>{u.title}</div>
          <button onClick={async()=>{ if(window.confirm('Delete?')){ await base44.entities.InvestorUpdate.delete(u.id); setUpdates(p=>p.filter(x=>x.id!==u.id)); } }} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'none', borderRadius:'3px', padding:'3px 8px', cursor:'pointer', fontSize:'11px' }}>Delete</button>
        </div>
      ))}
    </div>
  );
}

function PressReleasesManagerStub() {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { base44.entities.PressRelease.list('-publishedAt', 200).then(r => { setReleases(r||[]); setLoading(false); }).catch(() => setLoading(false)); }, []);
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h3 style={{ color:'#e8e0d0', margin:0, fontWeight:'normal' }}>Press Releases</h3>
        <span style={{ color:'#6b7280', fontSize:'12px' }}>{releases.length} releases</span>
      </div>
      {loading && <p style={{ color:'#6b7280' }}>Loading…</p>}
      {releases.slice(0,5).map(r => (
        <div key={r.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'12px 16px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'#e8e0d0', fontSize:'13px' }}>{r.title}</div>
          <button onClick={async()=>{ if(window.confirm('Delete?')){ await base44.entities.PressRelease.delete(r.id); setReleases(p=>p.filter(x=>x.id!==r.id)); } }} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'none', borderRadius:'3px', padding:'3px 8px', cursor:'pointer', fontSize:'11px' }}>Delete</button>
        </div>
      ))}
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

// ─── AI Tuner Chat ────────────────────────────────────────────────────────
function AITunerChat({ context, onApply }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: `I'm your AI tuning assistant. Tell me your thoughts about how to improve the ${context}.` }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState(null);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim(); setInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages); setLoading(true);
    try {
      const data = await base44.functions.invoke('aiTunerChat', { context, messages: newMessages.map(m => ({ role: m.role, content: m.content })) });
      const reply = data?.reply || data?.content?.[0]?.text || 'Error getting response.';
      const jsonMatch = reply.match(/```(?:json)?\n?({[\s\S]*?})\n?```/);
      if (jsonMatch) { try { setSuggested(JSON.parse(jsonMatch[1])); } catch {} }
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (e) { setMessages([...newMessages, { role: 'assistant', content: 'Error: ' + e.message }]); }
    setLoading(false);
  };
  const ta = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'none' };
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'480px', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', overflow:'hidden' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
        <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 6px #4ade80' }} />
        <span style={{ color:GOLD, fontSize:'11px', letterSpacing:'1.5px', textTransform:'uppercase' }}>AI Tuning Assistant</span>
      </div>
      <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth:'85%', padding:'10px 14px', borderRadius:'4px', fontSize:'13px', lineHeight:1.7, background: msg.role === 'user' ? `rgba(184,147,58,0.18)` : 'rgba(255,255,255,0.04)', border: `1px solid ${msg.role === 'user' ? 'rgba(184,147,58,0.3)' : 'rgba(255,255,255,0.07)'}`, color: msg.role === 'user' ? '#e8e0d0' : '#c4cdd8', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
          </div>
        ))}
        {loading && <div style={{ display:'flex', gap:'6px', alignItems:'center', padding:'8px' }}><div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, animation:'pulse 0.6s infinite' }} /><div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, animation:'pulse 0.6s infinite 0.15s' }} /><div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, animation:'pulse 0.6s infinite 0.3s' }} /></div>}
      </div>
      {suggested && onApply && (
        <div style={{ padding:'8px 16px', background:'rgba(74,222,128,0.06)', borderTop:'1px solid rgba(74,222,128,0.15)', flexShrink:0, display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ color:'#4ade80', fontSize:'11px', flex:1 }}>✓ AI generated a suggestion — apply it?</span>
          <button onClick={() => { onApply(suggested); setSuggested(null); }} style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'4px', padding:'5px 14px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>Apply</button>
          <button onClick={() => setSuggested(null)} style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'16px', padding:'0 4px' }}>×</button>
        </div>
      )}
      <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', gap:'8px', flexShrink:0 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Share an idea or observation…" rows={2} style={{ ...ta, flex:1 }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'8px 16px', cursor:'pointer', fontWeight:'700', fontSize:'11px', alignSelf:'flex-end', whiteSpace:'nowrap' }}>Send</button>
      </div>
    </div>
  );
}

// ─── Intent Engine Tuner (stub — delegates to AITunerChat) ───────────────
function IntentEngineTuner({ kbName = '' }) {
  const [saved, setSaved] = useState(false);
  const [s, setS] = useState(getPortalSettings);
  useEffect(() => { loadPortalSettings().then(setS); }, [kbName]);
  return (
    <div style={{ maxWidth:'700px' }}>
      <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 4px', fontSize:'16px' }}>🦆 Intent Engine Tuning</h3>
      <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 20px' }}>Configure Duck/Cow classification, intent scoring, and Q&A trigger keywords.</p>
      {['intentDuckDefinition','intentCowDefinition','intentTriggerKeywords','intentPositiveSignals','intentNegativeSignals'].map(key => (
        <div key={key} style={{ marginBottom:'14px' }}>
          <label style={{ ...ls }}>{key.replace('intent','').replace(/([A-Z])/g,' $1').trim()}</label>
          <textarea value={s[key]||''} onChange={e=>setS(p=>({...p,[key]:e.target.value}))} rows={4}
            style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'vertical' }} />
        </div>
      ))}
      <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'32px' }}>
        <button onClick={async()=>{ await savePortalSettings(s); setSaved(true); setTimeout(()=>setSaved(false),2000); }} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'10px 28px', cursor:'pointer', fontWeight:'700', fontSize:'12px' }}>Save settings</button>
        {saved && <span style={{ color:'#4ade80', fontSize:'12px' }}>✓ Saved</span>}
      </div>
      <AITunerChat context="Intent Engine (Duck/Cow classification)" onApply={(s)=>{ console.log('Applied:', s); }} />
    </div>
  );
}

// ─── Coach Rules Tuner (stub) ─────────────────────────────────────────────
function CoachRulesTuner({ kbName = '' }) {
  const [saved, setSaved] = useState(false);
  const [s, setS] = useState(getPortalSettings);
  useEffect(() => { loadPortalSettings().then(setS); }, [kbName]);
  return (
    <div style={{ maxWidth:'700px' }}>
      <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 4px', fontSize:'16px' }}>🎯 Coach Mode Settings</h3>
      {['coachStyle','coachAdditionalContext'].map(key => (
        <div key={key} style={{ marginBottom:'14px' }}>
          <label style={{ ...ls }}>{key.replace('coach','').replace(/([A-Z])/g,' $1').trim()}</label>
          <textarea value={s[key]||''} onChange={e=>setS(p=>({...p,[key]:e.target.value}))} rows={4}
            style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'vertical' }} />
        </div>
      ))}
      <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'32px' }}>
        <button onClick={async()=>{ await savePortalSettings(s); setSaved(true); setTimeout(()=>setSaved(false),2000); }} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'10px 28px', cursor:'pointer', fontWeight:'700', fontSize:'12px' }}>Save settings</button>
        {saved && <span style={{ color:'#4ade80', fontSize:'12px' }}>✓ Saved</span>}
      </div>
      <AITunerChat context="Coach Mode (real-time call coaching)" onApply={(s)=>{ console.log('Applied:', s); }} />
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  return (
    <AdminDashboardMain
      AddUserForm={AddUserForm}
      SignNowRequestsView={SignNowRequestsView}
      SignNowSettings={SignNowSettings}
      PortalControls={PortalControls}
      AdminSettings={AdminSettings}
      IntentEngineTuner={IntentEngineTuner}
      CoachRulesTuner={CoachRulesTuner}
    />
  );
}