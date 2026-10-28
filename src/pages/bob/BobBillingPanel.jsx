import { useEffect, useState } from 'react';
import { ArrowUpRight, CreditCard, ExternalLink, LockKeyhole, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import './BobSite.css';

async function billing(action,organizationId){
  const r=await base44.functions.invoke('bobBilling',{action,organizationId});
  const data=r?.data||r;
  if(data.error)throw new Error(data.error);
  return data;
}
export default function BobBillingPanel({organizationId,organizationName,orgStatus,seatLimit}){
  const [info,setInfo]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const refresh=async()=>{try{setInfo(await billing('billingInfo',organizationId));}catch(e){setError(e?.message||'Billing information unavailable.');}};
  useEffect(()=>{setInfo(null);setError('');refresh();},[organizationId]);
  useEffect(()=>{
    const value=new URLSearchParams(window.location.search).get('checkout');
    if(value==='complete')setMessage('Checkout returned. Subscription access will activate after Stripe confirms payment via its signed webhook. Refresh your billing status to verify.');
    if(value==='cancelled')setMessage('Checkout was cancelled. Your organization was not charged by this attempt.');
  },[]);
  const redirect=async(action)=>{
    setBusy(true);setError('');
    try{
      const result=await billing(action,organizationId);
      if(!result?.url || !result.url.startsWith('https://'))throw new Error('Stripe did not return a valid secure link.');
      window.location.assign(result.url);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="bob-grid-2">
    <section className="bob-panel"><div className="bob-panel-title"><h3>Subscriptions & training seats</h3><CreditCard color="#d7b978" size={20}/></div>
      <div className="bob-stack" style={{gap:9,marginBottom:20}}><div><small className="bob-eyebrow">Organization</small><h3 style={{marginTop:6}}>{organizationName}</h3></div><div className="bob-stat"><span>Licensed seats</span><strong>{seatLimit}</strong></div><div className="bob-stat"><span>Subscription status</span><strong style={{fontSize:21}}>{info?.billingStatus||orgStatus||'Loading…'}</strong></div></div>
      {info?.mode==='test'&&<div className="bob-message">Stripe test mode is active. Test checkouts do not charge real payment methods.</div>}
      {!info?.configured&&<div className="bob-message">Self-service paid checkout is not enabled yet. BOB needs an approved per-seat Stripe price and its webhook configuration. You can request commercial activation now.</div>}
      {message&&<div className="bob-message">{message}</div>}{error&&<div className="bob-message error">{error}</div>}
      <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>{info?.subscribed
        ?<button className="bob-btn bob-btn-gold" onClick={()=>redirect('portal')} disabled={busy}><ExternalLink size={15}/> Manage Stripe billing</button>
        :<button className="bob-btn bob-btn-gold" onClick={()=>redirect('checkout')} disabled={busy||!info?.configured}><ArrowUpRight size={15}/> Start subscription checkout</button>}
        <button className="bob-btn bob-btn-ghost" type="button" disabled={busy} onClick={refresh}>Refresh billing status</button>
      </div>
      <p className="bob-tiny">Seat limits are enforced by the BOB server. Subscription status and capacity are updated only after Stripe sends verified billing events. You can manage payment methods and cancellation in Stripe's hosted customer portal.</p>
    </section>
    <section className="bob-panel"><div className="bob-panel-title"><h3>Billing and privacy</h3><ShieldCheck size={19} color="#d7b978"/></div>
      <p>Stripe collects and manages billing information on its hosted checkout pages. BOB does not collect card numbers or retain payment details in its training databases.</p>
      <p>Your organization's sales knowledge and saved transcripts are separately encrypted in your browser. Billing records only contain essential subscription identifiers, seat counts and account administration details.</p>
      <div className="bob-message"><LockKeyhole size={15} style={{display:'inline',marginRight:8}}/> The billing administrator cannot recover the company's knowledge-vault passphrase.</div>
      <p className="bob-tiny">The site operator can update application code, and selected decrypted content is sent to third-party AI services during live training. Review our public security implementation before uploading sensitive materials.</p>
      <a href="/bob/security" className="bob-btn bob-btn-ghost">Review security & source code <ExternalLink size={15}/></a>
    </section>
  </div>;
}
