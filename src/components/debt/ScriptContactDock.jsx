/**
 * Quiet, live contact dock for the script reading mode. A single Save & Send
 * action commits on-screen edits BEFORE the email/SMS backend reads the card.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const ink = '#e8e0d0';
const muted = '#99a9b7';
const gold = '#d9bb7a';
const green = '#66d7af';
const fields = [
  { key:'email', name:'Email address', type:'email' },
  { key:'phone', name:'Mobile number', type:'tel' },
  { key:'debtAmount', name:'Total debt ($)', type:'text' },
];
const formField = { width:'100%', minWidth:0, padding:'8px 10px', borderRadius:7, color:ink, fontSize:13, background:'#111c2a', border:'1px solid rgba(154,198,188,.25)', outline:'none', boxSizing:'border-box' };
const smallBtn = { padding:'8px 11px', color:ink, fontSize:11, fontWeight:750, borderRadius:7, border:'1px solid rgba(154,198,188,.27)', background:'#142432', cursor:'pointer' };
const normalize = s => {
  const digits=String(s||'').replace(/\D/g,'');
  return digits.length===10 ? '+1'+digits : digits.length===11 && digits.startsWith('1') ? '+'+digits : null;
};
const formatDebt = n => n == null || n === '' ? '' : String(n);
const initial = lead => ({
  email: lead?.email || '',
  phone: lead?.phone || '',
  debtAmount: formatDebt(lead?.debtAmount),
});
export default function ScriptContactDock({ lead, onSaved, onSendEmail, sendingEmail, smsOpen, onSmsOpen, emailRequest = 0 }) {
  const { sessionToken, sessionUserId, user } = useDebtCoachAuth();
  const [draft, setDraft] = useState(() => initial(lead));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState(null);
  useEffect(() => {
    setDraft(initial(lead)); setFeedback(''); setConsent(false); setSmsResult(null);
  }, [lead?.id]);
  useEffect(() => {
    // Avoid replacing unsaved typing with a stale re-render from Live Call.
    setDraft(previous => {
      const old = initial(lead);
      return Object.keys(old).every(key => String(previous[key]) === String(old[key])) ? old : previous;
    });
  }, [lead?.email, lead?.phone, lead?.debtAmount]);
  useEffect(() => {
    const name = lead?.firstName || 'there';
    setText('Hi ' + name + ', this is ' + (user?.firstName || user?.username || 'your debt specialist') + ' with Debt Advisors of America. Thank you for speaking with me today. Reply STOP to opt out.');
  }, [lead?.id, lead?.firstName, user?.firstName, user?.username]);

  const dirty = fields.some(f => String(draft[f.key]).trim() !== String(initial(lead)[f.key]).trim());
  const persist = async () => {
    if (!lead?.id) { setFeedback('Open a contact in Live Call first.'); return false; }
    const fresh = await base44.entities.DebtLead.get(lead.id);
    const updates = {};
    if (String(draft.email).trim() !== String(fresh.email || '').trim()) {
      const v = draft.email.trim();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setFeedback('Enter a valid email.'); return false; }
      updates.email = v;
    }
    if (String(draft.phone).trim() !== String(fresh.phone || '').trim()) {
      const v = draft.phone.trim();
      if (v && !normalize(v)) { setFeedback('Enter a valid 10-digit US phone.'); return false; }
      updates.phone = normalize(v) || '';
    }
    if (String(draft.debtAmount).trim() !== formatDebt(fresh.debtAmount).trim()) {
      const str = String(draft.debtAmount).replace(/[$,\s]/g,'');
      if (str && (!/^\d+(\.\d{1,2})?$/.test(str) || Number(str) > 100000000)) {
        setFeedback('Enter a valid total debt amount.'); return false;
      }
      updates.debtAmount = str ? Number(str) : 0;
    }
    if (Object.keys(updates).length) {
      await base44.entities.DebtLead.update(lead.id, updates);
      // A dedicated event lets Live Call override its draft-protection state
      // when the agent deliberately saved from Scripts.
      window.dispatchEvent(new CustomEvent('debt_script_contact_saved', { detail: { leadId: lead.id, updates } }));
      window.dispatchEvent(new CustomEvent('lead_autosaved', { detail: Object.keys(updates) }));
      onSaved?.(updates);
    }
    setFeedback(Object.keys(updates).length ? '✓ Contact card updated' : '✓ Contact card is current');
    return true;
  };
  const save = async () => {
    if (busy) return false;
    setBusy(true);
    try { return await persist(); }
    catch(e) { setFeedback('Save failed: ' + (e?.message || String(e))); return false; }
    finally { setBusy(false); }
  };
  const email = async () => {
    if (sendingEmail || busy) return;
    if (await save()) await onSendEmail?.();
  };
  useEffect(() => { if (emailRequest) email(); }, [emailRequest]); // eslint-disable-line react-hooks/exhaustive-deps
  const openSms = async () => {
    if (busy) return;
    if (await save()) onSmsOpen?.(true);
  };
  const sendSms = async () => {
    if (smsSending || !consent || !text.trim() || !lead?.id) return;
    setSmsSending(true); setFeedback('');
    try {
      if (!(await persist())) return;
      const res = await base44.functions.invoke('scriptAndroidSms', {
        action:'send', leadId:lead.id, message:text, consentConfirmed:true,
        sessionUserId, sessionToken, requestId:crypto.randomUUID(),
      });
      const data = res?.data || res || {};
      if (data.error || !data.success) throw new Error(data.error || 'SMS not accepted');
      setSmsResult({ messageId:data.messageId, status:data.status });
      setFeedback('Text accepted by Android gateway ('+data.status+'). This is not a delivery confirmation.');
      setConsent(false);
    } catch(e) { setFeedback('Text failed: '+(e?.message || String(e))); }
    finally { setSmsSending(false); }
  };
  const checkStatus = async () => {
    if (!smsResult?.messageId) return;
    try {
      const res=await base44.functions.invoke('scriptAndroidSms', {
        action:'status', messageId:smsResult.messageId, sessionUserId, sessionToken,
      });
      const data=res?.data || res || {};
      if (data.error) throw new Error(data.error);
      setSmsResult(p=>({...p, status:data.status}));
      setFeedback('Android text status: '+data.status);
    } catch(e) { setFeedback('Status check failed: '+(e?.message || String(e))); }
  };

  return (
    <section aria-label="Live contact fields and actions" style={{background:'linear-gradient(120deg,#122331,#132a2b)', border:'1px solid rgba(154,198,188,.25)',borderRadius:12,padding:'12px 14px',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap',marginBottom:10}}>
        <div style={{fontWeight:800,fontSize:12,color:gold,letterSpacing:'.4px'}}>CONTACT · LIVE SCRIPT</div>
        <span style={{fontSize:11,color:muted}}>{lead?.id ? [lead.firstName,lead.lastName].filter(Boolean).join(' ') || 'Selected contact' : 'Select a contact in Live Call'}</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:10}}>
        {fields.map(f=><label key={f.key} style={{minWidth:0,fontSize:10,fontWeight:800,color:muted,letterSpacing:'.5px'}}>
          {f.name.toUpperCase()}
          <input type={f.type} aria-label={f.name} value={draft[f.key]} onChange={e=>setDraft(p=>({...p,[f.key]:e.target.value}))}
            onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();save();}}}
            placeholder={f.name} disabled={!lead?.id || busy} style={{...formField,marginTop:4}}/>
        </label>)}
      </div>
      <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap',marginTop:10}}>
        <button type="button" disabled={!lead?.id || busy || !dirty} onClick={save} style={{...smallBtn,color:green,opacity:(!lead?.id || busy || !dirty) ? 0.55 : 1}}>{busy?'Saving…':dirty?'Save contact changes':'Contact saved'}</button>
        <button type="button" disabled={!lead?.id || busy || sendingEmail} onClick={email} style={{...smallBtn,color:'#a7cdfd'}}>{sendingEmail?'Sending…':'✉ Send credentials email'}</button>
        <button type="button" disabled={!lead?.id || busy} onClick={()=>smsOpen?onSmsOpen(false):openSms()} style={{...smallBtn,color:gold}}>✉ {smsOpen?'Hide text message':'Send text message'}</button>
      </div>
      {smsOpen && <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(154,198,188,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:8}}>
          <strong style={{color:ink,fontSize:12}}>SMS via Android phone</strong>
          <span style={{color:muted,fontSize:11}}>To: {normalize(draft.phone) || 'Add a mobile number'}</span>
        </div>
        <textarea value={text} maxLength={480} onChange={e=>setText(e.target.value)} rows={3}
          aria-label="Text message body" style={{...formField,minHeight:72,resize:'vertical'}}/>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:muted,marginTop:4}}>
          <span>One-to-one text · Includes STOP instructions</span><span>{text.length}/480</span>
        </div>
        <label style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:11,color:ink,marginTop:10}}>
          <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} style={{accentColor:green,marginTop:2}}/>
          I have verified this contact's permission to receive this text. This sends from our Android SIM.
        </label>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:10}}>
          <button type="button" onClick={sendSms} disabled={!lead?.id || !consent || !text.trim() || smsSending} style={{...smallBtn,color:'#071c19',background:green,opacity:!consent ? 0.55 : 1}}>{smsSending?'Sending…':'Send text now'}</button>
          {smsResult?.messageId && <button type="button" onClick={checkStatus} style={smallBtn}>Check delivery · {smsResult.status}</button>}
        </div>
      </div>}
      {feedback && <p role="status" style={{color:feedback.includes('failed')||feedback.includes('valid')?'#f7a49b':green,fontSize:11,margin:'10px 0 0'}}>{feedback}</p>}
    </section>
  );
}
