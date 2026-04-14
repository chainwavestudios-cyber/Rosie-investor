import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import analytics from '@/lib/analytics';
import { getPortalSettings, loadPortalSettings } from '@/lib/portalSettings';
import RosieVoiceAgent from '@/components/RosieVoiceAgent';
import { InvestorUpdateDB, SignNowRequestDB, AccreditationDocDB } from '@/api/entities';
import { signnowSendDocuments, signnowGetDocument, signnowDownloadDocument } from '@/lib/signnow';

const LOGO_URL = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png';
const GOLD   = '#b8933a';
const DARK   = '#0a0f1e';
const DARKER = '#060c18';
const h2s    = { color:'#e8e0d0', fontSize:'20px', marginTop:0, marginBottom:'16px', fontFamily:'Georgia, serif', fontWeight:'normal' };
const bodyText  = { color:'#8a9ab8', lineHeight:1.7, fontSize:'14px', marginBottom:'16px' };
const labelStyle = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inputStyle = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

// ─── Request Documents Modal ──────────────────────────────────────────────
function RequestDocumentsModal({ portalUser, onClose, onSuccess }) {
  const [step, setStep] = useState('confirm');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSend = async () => {
    setStep('sending');
    try {
      const settings = await loadPortalSettings();
      if (!settings?.signnowAccessToken) throw new Error('SignNow is not configured. Please contact the administrator.');
      const templates = [];
      if (settings.signnowTemplate1Id) templates.push({ templateId:settings.signnowTemplate1Id, name:settings.signnowTemplate1Name||'Investor Questionnaire' });
      if (settings.signnowTemplate2Id) templates.push({ templateId:settings.signnowTemplate2Id, name:settings.signnowTemplate2Name||'Subscription Agreement' });
      if (!templates.length) throw new Error('No document templates configured. Please contact the administrator.');
      const results = await signnowSendDocuments(settings.signnowAccessToken, templates, portalUser.email, portalUser.name);
      await SignNowRequestDB.create({ userId:portalUser.id||portalUser.username, userName:portalUser.name, userEmail:portalUser.email, documents:JSON.stringify(results), status:results.every(r=>r.status==='sent')?'sent':'partial', requestedBy:'investor_self' });
      setStep('done');
    } catch(e) { setErrorMsg(e.message||'An error occurred.'); setStep('error'); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.35)', borderRadius:'2px', padding:'44px', maxWidth:'520px', width:'100%', boxShadow:'0 40px 100px rgba(0,0,0,0.8)' }}>
        {step==='confirm' && (<>
          <div style={{ textAlign:'center', marginBottom:'32px' }}>
            <div style={{ fontSize:'44px', marginBottom:'12px' }}>✍️</div>
            <h3 style={{ color:GOLD, margin:'0 0 8px', fontFamily:'Georgia, serif', fontWeight:'normal', fontSize:'20px' }}>Request Investment Documents</h3>
            <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>The following documents will be sent for digital signature via SignNow:</p>
          </div>
          <div style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'20px', marginBottom:'24px' }}>
            {[['📋','Investor Questionnaire','SEC Accreditation & Suitability Form'],['📄','Subscription Agreement','SAFE Note — Rosie AI LLC Investment Agreement']].map(([icon,name,desc]) => (
              <div key={name} style={{ display:'flex', gap:'14px', alignItems:'flex-start', padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize:'22px', flexShrink:0 }}>{icon}</span>
                <div>
                  <div style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'14px', marginBottom:'2px' }}>{name}</div>
                  <div style={{ color:'#6b7280', fontSize:'12px' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'rgba(184,147,58,0.08)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'2px', padding:'16px', marginBottom:'28px' }}>
            <div style={{ color:'#8a9ab8', fontSize:'11px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'4px' }}>Documents will be sent to</div>
            <div style={{ color:GOLD, fontWeight:'bold', fontSize:'15px' }}>{portalUser.email}</div>
          </div>
          <div style={{ display:'flex', gap:'12px' }}>
            <button onClick={handleSend} style={{ flex:1, background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'14px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2.5px', textTransform:'uppercase' }}>Send Documents</button>
            <button onClick={onClose} style={{ padding:'14px 20px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
          </div>
        </>)}
        {step==='sending' && <div style={{ textAlign:'center', padding:'40px 0' }}><div style={{ width:'44px', height:'44px', border:'3px solid rgba(184,147,58,0.2)', borderTop:`3px solid ${GOLD}`, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 20px' }} /><p style={{ color:'#8a9ab8' }}>Sending documents via SignNow…</p><style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style></div>}
        {step==='done' && <div style={{ textAlign:'center', padding:'20px 0' }}><div style={{ fontSize:'52px', marginBottom:'16px' }}>✅</div><h3 style={{ color:'#4ade80', margin:'0 0 12px', fontFamily:'Georgia, serif', fontWeight:'normal' }}>Documents Sent!</h3><p style={{ color:'#8a9ab8', fontSize:'13px', lineHeight:1.7, margin:'0 auto 28px', maxWidth:'360px' }}>Documents sent to <strong style={{ color:GOLD }}>{portalUser.email}</strong>. Check your inbox to sign.</p><button onClick={()=>{ onSuccess&&onSuccess(); onClose(); }} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px 36px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Close</button></div>}
        {step==='error' && <div style={{ textAlign:'center', padding:'20px 0' }}><div style={{ fontSize:'52px', marginBottom:'16px' }}>⚠️</div><h3 style={{ color:'#ef4444', margin:'0 0 12px', fontFamily:'Georgia, serif', fontWeight:'normal' }}>Error Sending Documents</h3><p style={{ color:'#8a9ab8', fontSize:'13px', lineHeight:1.7, margin:'0 auto 28px', maxWidth:'360px' }}>{errorMsg}</p><div style={{ display:'flex', gap:'12px', justifyContent:'center' }}><button onClick={()=>setStep('confirm')} style={{ background:'rgba(255,255,255,0.08)', color:'#c4cdd8', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'2px', padding:'10px 24px', cursor:'pointer', fontSize:'12px' }}>Try Again</button><button onClick={onClose} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'10px 24px', cursor:'pointer', fontSize:'12px' }}>Close</button></div></div>}
      </div>
    </div>
  );
}

// ─── Account: Profile ─────────────────────────────────────────────────────
function AccountProfile({ portalUser }) {
  const { updateUser } = usePortalAuth();
  const isInvestor = portalUser.status === 'investor';
  const [form, setForm] = useState({
    name:  portalUser.name  || '',
    email: portalUser.email || '',
    phone: portalUser.phone || '',
    // address only editable if investor — shown always but grayed out for prospects
    address: portalUser.address || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const updates = { name:form.name, email:form.email, phone:form.phone };
      if (isInvestor) updates.address = form.address;
      await updateUser(portalUser.username||portalUser.email, updates);
      setMsg({ ok:true, text:'Profile updated successfully.' });
    } catch { setMsg({ ok:false, text:'Update failed — please try again.' }); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth:'520px' }}>
      <h3 style={{ color:'#8a9ab8', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', marginTop:0, marginBottom:'20px' }}>Contact Information</h3>
      {/* Always-visible fields */}
      {[{ key:'name', label:'Full Name' }, { key:'email', label:'Email Address', type:'email' }, { key:'phone', label:'Phone Number', placeholder:'(216) 555-0123' }].map(({ key, label, type='text', placeholder='' }) => (
        <div key={key} style={{ marginBottom:'16px' }}>
          <label style={labelStyle}>{label}</label>
          <input type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={placeholder} style={inputStyle} />
        </div>
      ))}
      {/* Address: only shown to investors */}
      {isInvestor ? (
        <div style={{ marginBottom:'16px' }}>
          <label style={labelStyle}>Mailing Address</label>
          <input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="123 Main St, Cleveland, OH 44101" style={inputStyle} />
        </div>
      ) : (
        <div style={{ background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'2px', padding:'14px 16px', marginBottom:'20px' }}>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>🔒 Your mailing address will be visible once your account is upgraded to <strong style={{ color:'#60a5fa' }}>Investor</strong> status.</p>
        </div>
      )}
      {msg && <div style={{ background:msg.ok?'rgba(74,222,128,0.1)':'rgba(220,60,60,0.1)', border:`1px solid ${msg.ok?'rgba(74,222,128,0.3)':'rgba(220,60,60,0.3)'}`, borderRadius:'2px', padding:'10px 14px', color:msg.ok?'#4ade80':'#ff8a8a', fontSize:'13px', marginBottom:'16px' }}>{msg.text}</div>}
      <button onClick={save} disabled={saving} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px 32px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{saving?'Saving…':'Save Changes'}</button>
    </div>
  );
}

// ─── Account: Investment ──────────────────────────────────────────────────
function AccountInvestment({ portalUser }) {
  const isInvestor = portalUser.status === 'investor';

  if (!isInvestor) {
    return (
      <div style={{ textAlign:'center', padding:'56px 24px' }}>
        <div style={{ fontSize:'52px', marginBottom:'16px' }}>🔒</div>
        <h3 style={{ color:'#4a5568', fontFamily:'Georgia, serif', fontWeight:'normal', marginBottom:'12px' }}>Investment Details Locked</h3>
        <p style={{ color:'#374151', fontSize:'13px', maxWidth:'380px', margin:'0 auto 12px', lineHeight:1.7 }}>
          Investment amount, investment date, and account type will be visible here once your account status is upgraded to <strong style={{ color:'#60a5fa' }}>Investor</strong>.
        </p>
        <p style={{ color:'#374151', fontSize:'12px', maxWidth:'360px', margin:'0 auto' }}>
          Please complete the accreditation process and contact our investor relations team.
        </p>
      </div>
    );
  }

  if (!portalUser.investmentAmount && !portalUser.investmentDate) {
    return (
      <div style={{ textAlign:'center', padding:'48px', color:'#4a5568' }}>
        <div style={{ fontSize:'40px', marginBottom:'12px' }}>📊</div>
        <p>No investment details on file yet.</p>
        <p style={{ fontSize:'12px' }}>Contact our investor relations team for more information.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ color:'#8a9ab8', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', marginTop:0, marginBottom:'20px' }}>Investment Details</h3>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
        {[
          { label:'Investment Amount', value:portalUser.investmentAmount?`$${Number(portalUser.investmentAmount).toLocaleString()}`:'—', color:GOLD },
          { label:'Date Invested', value:portalUser.investmentDate?new Date(portalUser.investmentDate).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):'—', color:'#e8e0d0' },
          { label:'Account Type', value:(portalUser.investmentType||'Cash').toUpperCase(), color:portalUser.investmentType==='ira'?'#f59e0b':'#8a9ab8' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'20px' }}>
            <div style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>{label}</div>
            <div style={{ color, fontSize:'18px', fontWeight:'bold' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Account: Documents ───────────────────────────────────────────────────
function AccountDocuments({ portalUser }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => { loadDocs(); const t=setInterval(loadDocs,30000); return ()=>clearInterval(t); }, []);

  const loadDocs = async () => {
    try { const r=await SignNowRequestDB.listForEmail(portalUser.email); setRequests(r); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const downloadSigned = async (req, doc) => {
    const key=`${req.id}-${doc.documentId}`; setDownloadingId(key);
    try {
      const settings=await loadPortalSettings();
      if (!settings?.signnowAccessToken) throw new Error('Not configured');
      const blob=await signnowDownloadDocument(settings.signnowAccessToken, doc.documentId);
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${doc.name}.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch(e) { alert('Download failed: '+e.message); }
    finally { setDownloadingId(null); }
  };

  const sc = {
    pending:   { bg:'rgba(245,158,11,0.12)',  color:'#f59e0b', border:'rgba(245,158,11,0.3)',  label:'⏳ Pending' },
    sent:      { bg:'rgba(96,165,250,0.12)',   color:'#60a5fa', border:'rgba(96,165,250,0.3)',   label:'📨 Awaiting Signature' },
    completed: { bg:'rgba(74,222,128,0.12)',   color:'#4ade80', border:'rgba(74,222,128,0.3)',   label:'✅ Signed & Complete' },
    declined:  { bg:'rgba(239,68,68,0.12)',    color:'#ef4444', border:'rgba(239,68,68,0.3)',    label:'❌ Declined' },
    error:     { bg:'rgba(239,68,68,0.12)',    color:'#ef4444', border:'rgba(239,68,68,0.3)',    label:'⚠️ Error' },
  };

  if (loading) return <div style={{ textAlign:'center', padding:'48px', color:'#6b7280' }}>Loading…</div>;

  const allDocs     = requests.flatMap(req => { let docs=[]; try { docs=JSON.parse(req.documents||'[]'); } catch {} return docs.map(d=>({...d,reqId:req.id,req})); });
  const completed   = allDocs.filter(d=>d.status==='completed');
  const outstanding = allDocs.filter(d=>d.status!=='completed');

  if (allDocs.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:'48px 20px' }}>
        <div style={{ fontSize:'44px', marginBottom:'12px' }}>📭</div>
        <h3 style={{ color:'#4a5568', fontFamily:'Georgia, serif', fontWeight:'normal', marginBottom:'8px' }}>No Documents Yet</h3>
        <p style={{ color:'#374151', fontSize:'13px', maxWidth:'340px', margin:'0 auto' }}>Click <strong style={{ color:GOLD }}>"Request Investment Documents"</strong> at the top to start the signature process.</p>
      </div>
    );
  }

  return (
    <div>
      {outstanding.length > 0 && (
        <div style={{ marginBottom:'32px' }}>
          <h3 style={{ color:'#8a9ab8', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', marginTop:0, marginBottom:'14px' }}>Outstanding Documents</h3>
          {outstanding.map((doc,i) => { const s2=sc[doc.status]||sc.pending; return (
            <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'18px 20px', marginBottom:'10px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
              <div><div style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'14px', marginBottom:'4px' }}>📄 {doc.name}</div><div style={{ color:'#4a5568', fontSize:'11px' }}>Sent {doc.req?.sentAt?new Date(doc.req.sentAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—'}</div></div>
              <span style={{ background:s2.bg, color:s2.color, border:`1px solid ${s2.border}`, fontSize:'11px', padding:'5px 12px', borderRadius:'2px', whiteSpace:'nowrap', flexShrink:0 }}>{s2.label}</span>
            </div>
          ); })}
        </div>
      )}
      {completed.length > 0 && (
        <div>
          <h3 style={{ color:'#8a9ab8', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', marginTop:0, marginBottom:'14px' }}>Signed Documents</h3>
          {completed.map((doc,i) => (
            <div key={i} style={{ background:'rgba(74,222,128,0.04)', border:'1px solid rgba(74,222,128,0.15)', borderRadius:'2px', padding:'18px 20px', marginBottom:'10px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
              <div><div style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'14px', marginBottom:'4px' }}>✅ {doc.name}</div><div style={{ color:'#4a5568', fontSize:'11px' }}>Signed {doc.completedAt?new Date(doc.completedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—'}</div></div>
              {doc.documentId && <button onClick={()=>downloadSigned(doc.req,doc)} disabled={downloadingId===`${doc.reqId}-${doc.documentId}`} style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'2px', padding:'7px 16px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>{downloadingId===`${doc.reqId}-${doc.documentId}`?'Downloading…':'↓ Download PDF'}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Account: Accreditation Upload ────────────────────────────────────────
function AccountAccreditation({ portalUser }) {
  const [docs, setDocs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [docType, setDocType]       = useState('tax_return');
  const [uploadMsg, setUploadMsg]   = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { loadDocs(); }, []);

  const loadDocs = async () => {
    try { const d=await AccreditationDocDB.listForInvestor(portalUser.id||portalUser.username); setDocs(d); }
    catch{} finally { setLoading(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setUploadMsg({ ok:false, text:'File must be under 10 MB.' }); return; }
    setUploading(true); setUploadMsg(null);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1];
        await AccreditationDocDB.create({
          investorId:   portalUser.id || portalUser.username,
          investorEmail: portalUser.email,
          investorName:  portalUser.name,
          fileName:  file.name,
          docType,
          fileData:  base64,
          fileSize:  file.size,
          mimeType:  file.type,
        });
        setUploadMsg({ ok:true, text:'Document uploaded successfully. Our team will review it shortly.' });
        await loadDocs();
        if (fileRef.current) fileRef.current.value = '';
        setUploading(false);
      };
      reader.onerror = () => { setUploadMsg({ ok:false, text:'File read error. Please try again.' }); setUploading(false); };
      reader.readAsDataURL(file);
    } catch(e) { setUploadMsg({ ok:false, text:'Upload failed: '+e.message }); setUploading(false); }
  };

  const docTypeLabels = { tax_return:'Tax Return (W-2, 1040)', bank_statement:'Bank Statement', cpa_letter:'CPA Letter', other:'Other Document' };
  const statusColors  = { pending:'#f59e0b', under_review:'#60a5fa', approved:'#4ade80', rejected:'#ef4444' };
  const statusLabels  = { pending:'⏳ Pending Review', under_review:'🔍 Under Review', approved:'✅ Approved', rejected:'❌ Rejected' };

  return (
    <div>
      {/* Notice banner */}
      <div style={{ background:'rgba(184,147,58,0.07)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'2px', padding:'20px', marginBottom:'28px' }}>
        <div style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>🔐 Accreditation Verification</div>
        <p style={{ color:'#c4cdd8', fontSize:'13px', lineHeight:1.7, margin:'0 0 10px' }}>
          To verify your accredited investor status, please upload one or more of the following documents:
          <strong style={{ color:'#e8e0d0' }}> tax returns (W-2 or 1040), bank statements, or a letter from your CPA or attorney.</strong>
        </p>
        <p style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:1.6, margin:'0 0 8px' }}>
          ✏️ <strong>You may redact any account numbers or other sensitive information</strong> before uploading.
          Your name, income/asset totals, and date must remain visible.
        </p>
        <p style={{ color:'#4a5568', fontSize:'11px', margin:0 }}>
          🔒 All documents are stored with AES-256 encryption and are only accessible to authorized Rosie AI personnel.
        </p>
      </div>

      {/* Upload form */}
      <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'24px', marginBottom:'28px' }}>
        <div style={{ color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Upload Document</div>
        <div style={{ marginBottom:'14px' }}>
          <label style={labelStyle}>Document Type</label>
          <select value={docType} onChange={e=>setDocType(e.target.value)} style={{ ...inputStyle, cursor:'pointer' }}>
            {Object.entries(docTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div style={{ border:'2px dashed rgba(184,147,58,0.25)', borderRadius:'2px', padding:'28px', textAlign:'center', cursor:'pointer', position:'relative' }}
          onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileUpload} style={{ display:'none' }} />
          {uploading ? (
            <div>
              <div style={{ width:'32px', height:'32px', border:'3px solid rgba(184,147,58,0.2)', borderTop:`3px solid ${GOLD}`, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
              <p style={{ color:'#8a9ab8', fontSize:'13px', margin:0 }}>Uploading…</p>
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>📎</div>
              <p style={{ color:'#8a9ab8', fontSize:'13px', margin:'0 0 6px' }}>Click to select a file, or drag and drop here</p>
              <p style={{ color:'#4a5568', fontSize:'11px', margin:0 }}>PDF, JPG, PNG, or Word document — max 10 MB</p>
            </div>
          )}
        </div>
        {uploadMsg && (
          <div style={{ background:uploadMsg.ok?'rgba(74,222,128,0.08)':'rgba(239,68,68,0.1)', border:`1px solid ${uploadMsg.ok?'rgba(74,222,128,0.25)':'rgba(239,68,68,0.25)'}`, borderRadius:'2px', padding:'12px 16px', marginTop:'14px', color:uploadMsg.ok?'#4ade80':'#ff8a8a', fontSize:'13px' }}>
            {uploadMsg.text}
          </div>
        )}
      </div>

      {/* Uploaded docs */}
      {loading && <p style={{ color:'#6b7280', textAlign:'center' }}>Loading…</p>}
      {!loading && docs.length === 0 && (
        <p style={{ color:'#4a5568', textAlign:'center', padding:'28px' }}>No documents uploaded yet. Use the form above to get started.</p>
      )}
      {docs.length > 0 && (
        <div>
          <div style={{ color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>Your Uploaded Documents</div>
          {docs.map(doc => (
            <div key={doc.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'16px 18px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'13px', marginBottom:'3px' }}>{doc.fileName}</div>
                <div style={{ color:'#6b7280', fontSize:'11px' }}>{docTypeLabels[doc.docType]||doc.docType} · {doc.fileSize?(doc.fileSize/1024).toFixed(1)+' KB':''} · {doc.uploadedAt?new Date(doc.uploadedAt).toLocaleDateString():''}</div>
              </div>
              <span style={{ color:statusColors[doc.status]||'#f59e0b', fontSize:'11px', whiteSpace:'nowrap' }}>{statusLabels[doc.status]||doc.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Account Tab ──────────────────────────────────────────────────────────
function AccountTab({ portalUser }) {
  const isInvestor = portalUser.status === 'investor';
  const [sub, setSub] = useState('investment');

  const subTabs = [
    ['investment', '📊 Investment'],
    ['documents', '📄 Documents'],
    ['accreditation', '🔐 Accreditation'],
    ['profile', '👤 Profile'],
  ];

  return (
    <div id="portal-tab-content">
      <h2 style={{ ...h2s, marginBottom:'4px' }}>My Account</h2>
      <p style={{ color:'#4a5568', fontSize:'12px', margin:'0 0 24px' }}>
        View your investment details, signed documents, accreditation, and contact info.
        {!isInvestor && <span style={{ color:'#60a5fa' }}> · Status: <strong>Prospect</strong> — some details locked until upgraded to Investor.</span>}
      </p>
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:'28px' }}>
        {subTabs.map(([id,label]) => (
          <button key={id} onClick={() => setSub(id)} style={{ background:'none', border:'none', borderBottom:sub===id?`2px solid ${GOLD}`:'2px solid transparent', color:sub===id?GOLD:'#6b7280', padding:'12px 20px', cursor:'pointer', fontSize:'12px', letterSpacing:'1px' }}>{label}</button>
        ))}
      </div>
      {sub === 'investment'    && <AccountInvestment    portalUser={portalUser} />}
      {sub === 'documents'     && <AccountDocuments     portalUser={portalUser} />}
      {sub === 'accreditation' && <AccountAccreditation portalUser={portalUser} />}
      {sub === 'profile'       && <AccountProfile       portalUser={portalUser} />}
    </div>
  );
}

// ─── Investment Calculator ────────────────────────────────────────────────
function InvestorCalculator() {
  const [investment, setInvestment] = useState(50000);
  const [multiple, setMultiple]     = useState(5);
  return (
    <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'2px', padding:'32px', marginTop:'40px' }}>
      <h3 style={{ color:GOLD, fontSize:'12px', letterSpacing:'3px', textTransform:'uppercase', margin:'0 0 24px' }}>Investment Return Calculator</h3>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px', marginBottom:'24px' }}>
        <div>
          <label style={{ color:'#8a9ab8', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', display:'block', marginBottom:'8px' }}>Investment Amount</label>
          <input type="number" value={investment} onChange={e=>setInvestment(Number(e.target.value))} min={25000} step={5000} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'12px 16px', color:'#e8e0d0', fontSize:'16px', outline:'none', boxSizing:'border-box' }} />
        </div>
        <div>
          <label style={{ color:'#8a9ab8', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', display:'block', marginBottom:'8px' }}>Return Multiple (x)</label>
          <input type="range" min={2} max={20} value={multiple} onChange={e=>setMultiple(Number(e.target.value))} style={{ width:'100%', accentColor:GOLD, marginTop:'8px' }} />
          <div style={{ color:GOLD, fontSize:'20px', fontWeight:'bold', textAlign:'center' }}>{multiple}x</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px' }}>
        {[{ label:'Initial Investment', value:`$${investment.toLocaleString()}`, color:'#8a9ab8' },{ label:'Projected Return', value:`$${(investment*multiple).toLocaleString()}`, color:GOLD },{ label:'Net Profit', value:`$${((investment*multiple)-investment).toLocaleString()}`, color:'#4ade80' }].map(({ label, value, color }) => (
          <div key={label} style={{ background:'rgba(0,0,0,0.2)', padding:'16px', textAlign:'center', borderRadius:'2px' }}>
            <div style={{ color:'#5a6a7e', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>{label}</div>
            <div style={{ color, fontSize:'20px', fontWeight:'bold' }}>{value}</div>
          </div>
        ))}
      </div>
      <p style={{ color:'#4a5568', fontSize:'11px', marginTop:'16px', textAlign:'center' }}>* Projections are illustrative only and do not constitute a guarantee of returns.</p>
    </div>
  );
}

// ─── PPM / Investment Offering ────────────────────────────────────────────
const PPM_PDF_URL = 'https://media.base44.com/files/public/69cd2741578c9b5ce655395b/4be131d5b_RosieAI_PPM_revised3.pdf';
async function downloadFile(url, filename) {
  analytics.trackDownload(filename, 'pdf');
  const res=await fetch(url); const blob=await res.blob(); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=filename; a.click(); URL.revokeObjectURL(u);
}
const PPM_INDEX = [
  { id:'cover', label:'Cover Page', page:1 },{ id:'notices', label:'Notices', page:2 },{ id:'summary', label:'Summary of Terms', page:4 },{ id:'focus', label:'Focus of the Offering', page:5 },
  { id:'revenue', label:'Revenue Projections & Milestones', page:6 },{ id:'subscribe', label:'How to Subscribe', page:7 },{ id:'intro', label:'Rosie AI Introduction', page:9 },{ id:'positioning', label:'Unique Positioning', page:10 },
  { id:'leadership', label:'Leadership & Architects', page:12 },{ id:'orgchart', label:'Organizational Chart', page:14 },{ id:'capitalization', label:'Capitalization & Management', page:15 },{ id:'fiduciary', label:'Fiduciary Responsibilities', page:16 },
  { id:'risk-mgmt', label:'Risk Management & Exit Strategy', page:18 },{ id:'terms', label:'Terms of the Offering', page:19 },{ id:'subscribing', label:'Subscribing to the Offering', page:20 },{ id:'proceeds', label:'Use of Investor Proceeds', page:22 },
  { id:'rights', label:'Rights & Liabilities', page:25 },{ id:'alloc', label:'Allocation & Distributions', page:26 },{ id:'sub-proc', label:'Subscription Procedures', page:28 },{ id:'risk-factors', label:'Risk Factors', page:42 },
  { id:'erisa', label:'ERISA Considerations', page:50 },{ id:'state-notices', label:'State-Specific Legal Notices', page:44 },{ id:'additional', label:'Additional Information', page:53 },
];

function InvestmentOffering() {
  const [activeSection, setActiveSection] = useState('cover');
  const docIdRef = useRef(null);
  const activeIdx = PPM_INDEX.findIndex(s => s.id === activeSection);
  const activeSec = PPM_INDEX.find(s => s.id === activeSection) || PPM_INDEX[0];
  useEffect(() => { docIdRef.current=analytics.trackDocumentOpen('Private Placement Memorandum','ppm'); analytics.trackDocumentPageView(docIdRef.current,1); return ()=>{ if(docIdRef.current)analytics.trackDocumentClose(docIdRef.current); }; }, []);
  const goToSection = (sec) => { if(sec.id===activeSection)return; if(docIdRef.current)analytics.trackDocumentPageView(docIdRef.current,sec.page); setActiveSection(sec.id); };
  return (
    <div style={{ display:'flex', gap:'0', minHeight:'700px' }}>
      <div style={{ width:'220px', flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.08)', overflowY:'auto', maxHeight:'80vh' }}>
        <div style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', padding:'0 0 10px 16px' }}>Table of Contents</div>
        {PPM_INDEX.map(sec => (
          <button key={sec.id} onClick={()=>goToSection(sec)} style={{ display:'block', width:'100%', textAlign:'left', background:activeSection===sec.id?'rgba(184,147,58,0.12)':'transparent', border:'none', borderLeft:activeSection===sec.id?`3px solid ${GOLD}`:'3px solid transparent', padding:'10px 14px', cursor:'pointer' }}>
            <div style={{ color:activeSection===sec.id?GOLD:'#c4cdd8', fontSize:'12px', lineHeight:1.3 }}>{sec.label}</div>
            <div style={{ color:'#4a5568', fontSize:'10px', marginTop:'2px' }}>p. {sec.page}</div>
          </button>
        ))}
        <div style={{ padding:'16px', borderTop:'1px solid rgba(255,255,255,0.07)', marginTop:'8px' }}>
          <button onClick={()=>downloadFile(PPM_PDF_URL,'RosieAI_PPM.pdf')} style={{ width:'100%', background:'rgba(184,147,58,0.15)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'2px', padding:'10px', cursor:'pointer', fontSize:'12px' }}>↓ Download PPM</button>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.2)', flexShrink:0 }}>
          <div><span style={{ color:GOLD, fontWeight:'bold', fontSize:'14px' }}>Rosie AI — Private Placement Memorandum</span><span style={{ color:'#6b7280', fontSize:'12px', marginLeft:'12px' }}>53 pages · 506c PPM</span></div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <button onClick={()=>{ if(activeIdx>0)goToSection(PPM_INDEX[activeIdx-1]); }} disabled={activeIdx===0} style={{ background:activeIdx===0?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.08)', color:activeIdx===0?'#3a4a5e':'#c4cdd8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'5px 12px', cursor:activeIdx===0?'default':'pointer', fontSize:'13px' }}>‹ Prev</button>
            <span style={{ minWidth:'160px', textAlign:'center', color:'#6b7280', fontSize:'12px' }}>{activeSec.label} (p.{activeSec.page})</span>
            <button onClick={()=>{ if(activeIdx<PPM_INDEX.length-1)goToSection(PPM_INDEX[activeIdx+1]); }} disabled={activeIdx===PPM_INDEX.length-1} style={{ background:activeIdx===PPM_INDEX.length-1?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.08)', color:activeIdx===PPM_INDEX.length-1?'#3a4a5e':'#c4cdd8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'5px 12px', cursor:activeIdx===PPM_INDEX.length-1?'default':'pointer', fontSize:'13px' }}>Next ›</button>
            <button onClick={()=>downloadFile(PPM_PDF_URL,'RosieAI_PPM.pdf')} style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'2px', padding:'6px 14px', cursor:'pointer', fontSize:'11px', marginLeft:'4px' }}>↓ Download</button>
          </div>
        </div>
        <iframe key={activeSection} src={`https://docs.google.com/viewer?url=${encodeURIComponent(PPM_PDF_URL)}&embedded=true#page=${activeSec.page}`} style={{ flex:1, width:'100%', minHeight:'640px', border:'none', background:'#fff' }} title="Investment Offering PPM" />
      </div>
    </div>
  );
}

// ─── Subscription Agreements ──────────────────────────────────────────────
const PDF_DOCS = [
  { id:'subscription',  name:'Subscription Agreement',  badge:'Required', url:'https://media.base44.com/files/public/69cd2741578c9b5ce655395b/088aa5ef3_RosieAI_Subscription_Agreement.pdf', totalPages:7 },
  { id:'accreditation', name:'Investor Questionnaire',   badge:'Required', url:'https://media.base44.com/files/public/69cd2741578c9b5ce655395b/903902aa1_RosieAI_Investor_Questionnaire.pdf', totalPages:7 },
];

function SubscriptionAgreements({ onRequestDocuments }) {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const docIdRef = useRef(null);
  const openDoc  = (doc) => { if(docIdRef.current)analytics.trackDocumentClose(docIdRef.current); docIdRef.current=analytics.trackDocumentOpen(doc.name,doc.id); setSelectedDoc(doc); };
  const closeDoc = () => { if(docIdRef.current){ analytics.trackDocumentClose(docIdRef.current); docIdRef.current=null; } setSelectedDoc(null); };
  const handleDownload = (doc) => { downloadFile(doc.url, doc.name+'.pdf'); };
  return (
    <div id="portal-tab-content">
      <div style={{ display:'flex', gap:'0', minHeight:'600px' }}>
        <div style={{ width:'220px', flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', padding:'0 0 12px 16px', marginBottom:'4px' }}>Documents</div>
          {PDF_DOCS.map(doc => (
            <button key={doc.id} onClick={()=>openDoc(doc)} style={{ display:'block', width:'100%', textAlign:'left', background:selectedDoc?.id===doc.id?'rgba(184,147,58,0.12)':'transparent', border:'none', borderLeft:selectedDoc?.id===doc.id?`3px solid ${GOLD}`:'3px solid transparent', padding:'14px 16px', cursor:'pointer' }}>
              <div style={{ color:selectedDoc?.id===doc.id?GOLD:'#c4cdd8', fontSize:'13px', fontWeight:selectedDoc?.id===doc.id?'bold':'normal', marginBottom:'3px' }}>{doc.name}</div>
              <div style={{ color:'#4a5568', fontSize:'11px' }}>{doc.badge} · {doc.totalPages} pages</div>
            </button>
          ))}
          <div style={{ padding:'16px', marginTop:'16px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
            {PDF_DOCS.map(doc => <button key={doc.id} onClick={()=>handleDownload(doc)} style={{ display:'block', width:'100%', textAlign:'left', background:'transparent', border:'none', color:'#8a9ab8', padding:'6px 0', cursor:'pointer', fontSize:'12px' }}>↓ {doc.name}</button>)}
          </div>
        </div>
        <div style={{ flex:1 }}>
          {!selectedDoc ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', minHeight:'500px', gap:'16px' }}>
              <div style={{ fontSize:'48px' }}>📄</div>
              <div style={{ color:'#6b7280', fontSize:'14px' }}>Select a document from the sidebar to view it</div>
              <div style={{ display:'flex', gap:'12px', marginTop:'8px' }}>
                {PDF_DOCS.map(doc => <button key={doc.id} onClick={()=>openDoc(doc)} style={{ background:'rgba(184,147,58,0.12)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'2px', padding:'10px 20px', cursor:'pointer', fontSize:'12px' }}>📖 {doc.name}</button>)}
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.2)' }}>
                <div><span style={{ color:GOLD, fontWeight:'bold', fontSize:'14px' }}>{selectedDoc.name}</span><span style={{ color:'#6b7280', fontSize:'12px', marginLeft:'12px' }}>{selectedDoc.totalPages} pages</span></div>
                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={()=>handleDownload(selectedDoc)} style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'2px', padding:'7px 16px', cursor:'pointer', fontSize:'12px' }}>↓ Download PDF</button>
                  <button onClick={closeDoc} style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#6b7280', borderRadius:'2px', padding:'7px 12px', cursor:'pointer', fontSize:'14px' }}>×</button>
                </div>
              </div>
              <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(selectedDoc.url)}&embedded=true`} style={{ flex:1, width:'100%', minHeight:'560px', border:'none', background:'#fff' }} title={selectedDoc.name} />
            </div>
          )}
        </div>
      </div>
      <div style={{ textAlign:'center', padding:'32px', background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'2px', marginTop:'24px' }}>
        <div style={{ fontSize:'36px', marginBottom:'12px' }}>✍️</div>
        <h3 style={{ color:GOLD, marginBottom:'12px', fontFamily:'Georgia, serif', fontWeight:'normal' }}>Ready to Subscribe?</h3>
        <p style={{ color:'#8a9ab8', fontSize:'13px', margin:'0 auto 24px', maxWidth:'400px' }}>After reviewing the documents above, request your digital signature package. Documents are sent to your email via SignNow.</p>
        <button onClick={onRequestDocuments} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'14px 36px', cursor:'pointer', fontSize:'12px', letterSpacing:'3px', textTransform:'uppercase', fontWeight:'700' }}>Request Investment Documents</button>
      </div>
    </div>
  );
}

// ─── Investor Updates ─────────────────────────────────────────────────────
function InvestorUpdates({ isAdmin }) {
  const [updates, setUpdates]  = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState({ title:'', content:'', category:'General Update' });
  useEffect(() => { loadUpdates(); }, []);
  async function loadUpdates() {
    setLoading(true);
    try {
      const arr=await InvestorUpdateDB.list();
      if(arr.length===0){
        for(const s of[{ title:'Q1 2025 Performance Update', content:'Revenue grew 47% QoQ to $95K MRR. We onboarded 12 new enterprise clients in solar and insurance verticals.', category:'Financial Update', author:'Management Team', publishedAt:'2025-04-01T00:00:00.000Z' },{ title:'Product Launch: Rosie 2.0', content:'Today we launched Rosie 2.0 with a new real-time conversation AI engine with less than 150ms latency.', category:'Product Update', author:'Product Team', publishedAt:'2025-02-28T00:00:00.000Z' }]){ try { await InvestorUpdateDB.create(s); } catch {} }
        setUpdates(await InvestorUpdateDB.list());
      } else { setUpdates(arr); }
    } catch(e){ console.error(e); } finally { setLoading(false); }
  }
  const catColors = { 'Financial Update':'#4ade80','Product Update':'#60a5fa','Partnership':'#f59e0b','General Update':'#8a9ab8','Important Notice':'#ef4444' };
  return (
    <div id="portal-tab-content">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px' }}>
        <div><h2 style={{ ...h2s, marginBottom:'8px' }}>Investor Updates</h2><p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>Chronological updates from the Rosie AI management team</p></div>
        {isAdmin && <button onClick={()=>setShowForm(!showForm)} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'10px 20px', cursor:'pointer', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', fontWeight:'700' }}>+ Post Update</button>}
      </div>
      {showForm && isAdmin && (
        <div style={{ background:'rgba(184,147,58,0.08)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'2px', padding:'24px', marginBottom:'28px' }}>
          <h4 style={{ color:GOLD, marginTop:0, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>New Update</h4>
          <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Update Title" style={{ ...inputStyle, marginBottom:'12px' }} />
          <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{ ...inputStyle, marginBottom:'12px' }}>{Object.keys(catColors).map(c=><option key={c}>{c}</option>)}</select>
          <textarea value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="Update content..." rows={6} style={{ ...inputStyle, resize:'vertical', marginBottom:'16px' }} />
          <div style={{ display:'flex', gap:'12px' }}>
            <button onClick={async()=>{ await InvestorUpdateDB.create({...form,author:'Admin'}); setForm({title:'',content:'',category:'General Update'}); setShowForm(false); loadUpdates(); }} disabled={!form.title||!form.content} style={{ background:GOLD, color:DARK, border:'none', borderRadius:'2px', padding:'10px 24px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>Post</button>
            <button onClick={()=>setShowForm(false)} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 24px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
        {updates.map((update,idx) => (
          <div key={update.id} style={{ display:'flex', gap:'20px', paddingBottom:'32px' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'20px', flexShrink:0 }}>
              <div style={{ width:'12px', height:'12px', background:GOLD, borderRadius:'50%', marginTop:'6px', flexShrink:0 }} />
              {idx<updates.length-1 && <div style={{ width:'1px', flex:1, background:'rgba(255,255,255,0.08)', marginTop:'4px' }} />}
            </div>
            <div style={{ flex:1, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
                <div><span style={{ display:'inline-block', padding:'3px 10px', borderRadius:'2px', background:`${catColors[update.category]}22`, color:catColors[update.category]||'#8a9ab8', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>{update.category}</span><h3 style={{ color:'#e8e0d0', margin:'0', fontSize:'16px', fontFamily:'Georgia, serif', fontWeight:'normal' }}>{update.title}</h3></div>
                <div style={{ textAlign:'right', flexShrink:0 }}><div style={{ color:GOLD, fontSize:'13px' }}>{new Date(update.publishedAt||update.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div><div style={{ color:'#4a5568', fontSize:'11px', marginTop:'2px' }}>{update.author}</div></div>
              </div>
              <p style={{ color:'#8a9ab8', fontSize:'13px', lineHeight:1.7, margin:'0 0 12px' }}>{update.content}</p>
              {isAdmin && <button onClick={async()=>{ if(window.confirm('Delete?')){ await InvestorUpdateDB.delete(update.id); setUpdates(prev=>prev.filter(u=>u.id!==update.id)); } }} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'11px', padding:'0', opacity:0.6 }}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Raise Progress ───────────────────────────────────────────────────────
function RaiseProgress() {
  const [s, setS] = useState(getPortalSettings());
  useEffect(() => { loadPortalSettings().then(setS); const handler=e=>setS(e.detail); window.addEventListener('portalSettingsChanged',handler); return ()=>window.removeEventListener('portalSettingsChanged',handler); }, []);
  const TOTAL=Number(s.totalRaise)||2500000, COMMITTED=Number(s.committedCapital)||0, INVESTED=Number(s.investedCapital)||0, INVESTED_T=Number(s.investedTarget)||500000;
  const fmt=n=>n>=1000000?`$${(n/1000000).toFixed(2)}M`:`$${(n/1000).toFixed(0)}K`;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'32px' }}>
      {[{ label:'Committed Capital', pct:Math.min((COMMITTED/TOTAL)*100,100), color:GOLD, sub:`${fmt(COMMITTED)} of ${fmt(TOTAL)} raise` },{ label:'Invested Capital', pct:Math.min((INVESTED/INVESTED_T)*100,100), color:'#4ade80', sub:`${fmt(INVESTED)} of ${fmt(INVESTED_T)} deployed` }].map(({ label,pct,color,sub }) => (
        <div key={label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'10px' }}><span style={{ color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase' }}>{label}</span><span style={{ color, fontSize:'22px', fontWeight:'bold' }}>{Math.round(pct)}%</span></div>
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:'2px', height:'6px', marginBottom:'10px', overflow:'hidden' }}><div style={{ background:`linear-gradient(90deg,${color}88,${color})`, width:`${pct}%`, height:'100%', borderRadius:'2px', transition:'width 1s ease' }} /></div>
          <div style={{ color:'#4a5568', fontSize:'11px' }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Portal Home ──────────────────────────────────────────────────────────
function PortalHome({ setActiveTab, portalUser, onRequestDocuments }) {
  const [s, setS] = useState(getPortalSettings());
  useEffect(() => { loadPortalSettings().then(setS); const handler=e=>setS(e.detail); window.addEventListener('portalSettingsChanged',handler); return ()=>window.removeEventListener('portalSettingsChanged',handler); }, []);
  const navCards = [
    { tab:'account', icon:'👤', title:'My Account', desc:'View your investment summary, documents, accreditation, and contact info.' },
    { tab:'offering', icon:'📊', title:'Investment Offering', desc:'Full memorandum, financials, team & terms. Download PDF.' },
    { tab:'subscription', icon:'✍️', title:'Subscription Agreements', desc:'Review and execute investment documents via SignNow.' },
    { tab:'updates', icon:'📬', title:'Investor Updates', desc:'Chronological management updates & milestones.' },
  ];
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'32px', marginBottom:'32px', alignItems:'start' }}>
        <div>
          <p style={{ color:GOLD, fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase', marginBottom:'10px', margin:'0 0 10px' }}>{s.portalTagline}</p>
          <h1 style={{ color:'#e8e0d0', fontSize:'30px', fontWeight:'normal', margin:'0 0 12px', lineHeight:1.2, fontFamily:'Georgia, serif' }}>
            {s.portalHeadline?.split('\n').map((line,i)=><span key={i}>{line}{i===0?<br/>:null}</span>)}
          </h1>
          <p style={{ color:'#6b7280', fontSize:'14px', lineHeight:1.65, margin:'0 0 28px', maxWidth:'560px' }}>{s.portalSubtext}</p>
          <RaiseProgress />
          <InvestorCalculator />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.18)', borderRadius:'2px', padding:'18px' }}>
            <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Investor Relations</div>
            <div style={{ color:'#c4cdd8', fontSize:'13px', fontWeight:'bold', marginBottom:'6px' }}>{s.companyName}</div>
            <div style={{ color:'#6b7280', fontSize:'12px', lineHeight:2 }}>
              {s.address1}<br />{s.address2}<br />
              <a href={`tel:${s.phone?.replace(/\D/g,'')}`} style={{ color:'#8a9ab8', textDecoration:'none' }}>{s.phone}</a><br />
              <a href={`mailto:${s.email}`} style={{ color:GOLD, textDecoration:'none', fontSize:'12px' }}>{s.email}</a>
            </div>
          </div>
        </div>
      </div>
      <div style={{ paddingTop:'24px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ color:'#2d3748', fontSize:'11px', lineHeight:1.7, margin:0 }}><strong style={{ color:'#374151' }}>Important Disclosure:</strong> {s.disclosureText}</p>
      </div>
      <RosieVoiceAgent userName={portalUser?.name||portalUser?.username||'Investor'} />
    </div>
  );
}

// ─── Main Portal ──────────────────────────────────────────────────────────
const TABS = [
  { id:'home',         label:'Overview' },
  { id:'account',      label:'Account' },
  { id:'offering',     label:'Investment Offering' },
  { id:'subscription', label:'Subscription Agreements' },
  { id:'updates',      label:'Investor Updates' },
];

export default function InvestorPortal() {
  const { portalUser, portalLogout, isAdmin, isPortalLoading } = usePortalAuth();
  const [activeTab, setActiveTab]       = useState('home');
  const [showRequestDocs, setShowRequestDocs] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isPortalLoading) return;
    if (!portalUser) { navigate('/portal-login'); return; }
    if (!analytics.getCurrentSession()) analytics.startSession(portalUser.email, portalUser.name, portalUser.username);
    analytics.trackPageView('portal');
    // Track on visibility change so downloads are captured if user closes tab
    const handleVisibility = () => { if (document.visibilityState === 'hidden') analytics.endSession(); };
    const handleUnload = () => analytics.endSession();
    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { window.removeEventListener('beforeunload', handleUnload); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [portalUser, isPortalLoading]);

  useEffect(() => { analytics.trackSection(activeTab); }, [activeTab]);

  if (isPortalLoading) return (
    <div style={{ minHeight:'100vh', background:'#060c18', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'28px', height:'28px', border:'3px solid rgba(184,147,58,0.2)', borderTop:'3px solid #b8933a', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!portalUser) return null;

  return (
    <div style={{ minHeight:'100vh', background:DARKER, fontFamily:'Georgia, serif', color:'#e8e0d0' }}>
      {showRequestDocs && (
        <RequestDocumentsModal portalUser={portalUser} onClose={()=>setShowRequestDocs(false)} onSuccess={()=>setActiveTab('account')} />
      )}
      <nav style={{ background:DARK, borderBottom:'1px solid rgba(184,147,58,0.2)', padding:'0 32px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'64px', position:'sticky', top:0, zIndex:200 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
          <img src={LOGO_URL} alt="Rosie AI" style={{ height:'38px', width:'auto' }} />
          <div style={{ width:'1px', height:'24px', background:'rgba(184,147,58,0.3)' }} />
          <span style={{ color:GOLD, fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase' }}>Investor Portal</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'nowrap' }}>
          <button onClick={()=>setShowRequestDocs(true)} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'9px 16px', cursor:'pointer', fontWeight:'700', fontSize:'11px', letterSpacing:'1.5px', textTransform:'uppercase', whiteSpace:'nowrap' }}>✍️ Request Investment Documents</button>
          <span style={{ color:'#6b7280', fontSize:'12px', whiteSpace:'nowrap' }}>{portalUser.name||portalUser.email}</span>
          {isAdmin && <button onClick={()=>navigate('/admin')} style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', padding:'6px 14px', cursor:'pointer', fontSize:'11px' }}>Admin</button>}
          <button onClick={()=>{ portalLogout(); navigate('/'); }} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 14px', cursor:'pointer', fontSize:'11px' }}>Logout</button>
        </div>
      </nav>
      <div style={{ background:DARK, borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 32px', display:'flex', gap:'0', overflowX:'auto' }}>
        {TABS.map(({ id,label }) => (
          <button key={id} onClick={()=>setActiveTab(id)} style={{ background:'none', border:'none', borderBottom:activeTab===id?`2px solid ${GOLD}`:'2px solid transparent', color:activeTab===id?GOLD:'#6b7280', padding:'16px 18px', cursor:'pointer', fontSize:'12px', letterSpacing:'1px', transition:'all 0.15s', fontFamily:'Georgia, serif', whiteSpace:'nowrap' }}>{label}</button>
        ))}
      </div>
      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'48px 32px' }}>
        {activeTab === 'home'         && <PortalHome setActiveTab={setActiveTab} portalUser={portalUser} onRequestDocuments={()=>setShowRequestDocs(true)} />}
        {activeTab === 'account'      && <AccountTab portalUser={portalUser} />}
        {activeTab === 'offering'     && <InvestmentOffering />}
        {activeTab === 'subscription' && <SubscriptionAgreements onRequestDocuments={()=>setShowRequestDocs(true)} />}
        {activeTab === 'updates'      && <InvestorUpdates isAdmin={isAdmin} />}
      </div>
    </div>
  );
}