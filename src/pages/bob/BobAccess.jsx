import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, LockKeyhole, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { BobAddonSelection } from './BobAddonSelection';
import { BobNav, BobFooter } from './BobMarketing';
import './BobSite.css';

const redirectToPortal=()=>base44.auth.redirectToLogin(window.location.origin+'/bob/portal');
const pendingKey='bob_signup_preferences_v1';
export function BobLogin(){
 return <div className="bob-site"><BobNav/><main className="bob-form-page"><div className="bob-panel" style={{padding:35}}>
   <span className="bob-feature-icon"><LockKeyhole size={24}/></span><div className="bob-eyebrow" style={{marginTop:25}}>Private training access</div>
   <h1>Welcome back.</h1><p style={{color:'#a5b3c5'}}>Sign in to your organization's BOB training workspace. Only assigned organization members can enter their company's training portal.</p>
   <button type="button" className="bob-btn bob-btn-gold" onClick={redirectToPortal} style={{width:'100%',marginTop:15}}>Sign in to BOB <ArrowRight size={16}/></button>
   <p className="bob-tiny">New organization? <Link style={{color:'#d7b978'}} to="/bob/signup">Get started here</Link>.</p>
 </div></main><BobFooter/></div>;
}
export function BobSignup(){
 const navigate=useNavigate();
 const [form,setForm]=useState({name:'',industry:'General sales',requestedAddons:[]});
 const begin=()=>{
   // Only non-sensitive signup preferences are temporarily stored. No API keys
   // or company knowledge are placed in browser storage.
   try{window.sessionStorage.setItem(pendingKey,JSON.stringify(form));}catch{}
   redirectToPortal();
 };
 return <div className="bob-site"><BobNav/><main className="bob-form-page" style={{maxWidth:760}}>
   <span className="bob-eyebrow">Create your BOB organization</span><h1>Train your team, your way.</h1>
   <p>Start a private BOB training workspace. New self-service workspaces begin with three trial seats; commercial allocations are arranged with BOB sales.</p>
   <div className="bob-panel">
     <div className="bob-feature-icon"><Building2 size={23}/></div><h3>1. Your training company</h3>
     <div className="bob-field"><label htmlFor="bob-signup-company">Organization name *</label><input id="bob-signup-company" required minLength={2} maxLength={120} value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))} placeholder="Your company's name"/></div>
     <div className="bob-field"><label htmlFor="bob-signup-industry">Industry / primary training focus</label><input id="bob-signup-industry" maxLength={80} value={form.industry} onChange={e=>setForm(s=>({...s,industry:e.target.value}))} placeholder="e.g. Financial services"/></div>
     <hr style={{margin:'25px 0',border:0,borderTop:'1px solid #ffffff19'}}/>
     <div className="bob-eyebrow">2. Optional separate products</div>
     <div style={{marginTop:14}}><BobAddonSelection compact value={form.requestedAddons} onChange={a=>setForm(s=>({...s,requestedAddons:a}))}/></div>
     <hr style={{margin:'25px 0',border:0,borderTop:'1px solid #ffffff19'}}/>
     <h3>3. Secure your account</h3>
     <p>Sign in or create your administrator account. After verification, your BOB organization and selected product interests will be created in the private portal. Live Q&A and Live Coach are separate products under development and will not be activated or charged through this form.</p>
     <button type="button" className="bob-btn bob-btn-gold" onClick={begin} disabled={form.name.trim().length<2}>Continue to secure signup <ArrowRight size={16}/></button>
     <p className="bob-tiny">Your selected product interests can be reviewed in the BOB portal. No payment is collected in this step.</p>
     <hr style={{margin:'25px 0',border:0,borderTop:'1px solid #ffffff19'}}/>
     <h3>Need a larger training team?</h3><p>Discuss pricing, team seats, and future live-call products with our commercial team.</p>
     <button className="bob-btn bob-btn-ghost" onClick={()=>navigate('/bob/inquire')}>Request commercial pricing</button>
   </div>
 </main><BobFooter/></div>;
}
export function BobInquiry(){
 const [form,setForm]=useState({contactName:'',email:'',company:'',seatEstimate:'10',message:'',requestedAddons:[],website:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const update=key=>e=>setForm(s=>({...s,[key]:e.target.value}));
 const send=async e=>{
   e.preventDefault();setBusy(true);setError('');
   try{
     const res=await base44.functions.invoke('bobSaas',{action:'inquire',...form});
     const data=res?.data||res;
     if(data?.error)throw new Error(data.error);
     setSent(true);
   }catch(e){setError(e?.response?.data?.error||e.message||'Could not submit inquiry.');}
   finally{setBusy(false);}
 };
 return <div className="bob-site"><BobNav/><main className="bob-form-page" style={{maxWidth:780}}>
   <span className="bob-eyebrow">Commercial partnerships</span><h1>Bring BOB to your team.</h1>
   <p>Interested in purchasing BOB training seats or exploring future Live Q&A and Live Coach products? Share your requirements and we'll review them.</p>
   {sent?<div className="bob-panel" style={{textAlign:'center',padding:42}}><CheckCircle2 size={38} color="#d7b978"/><h2>Inquiry received.</h2><p>Thank you. Your product interests have been recorded for our commercial team.</p><Link className="bob-btn bob-btn-gold" to="/bob">Back to BOB</Link></div>:
   <form className="bob-panel" onSubmit={send}>
     <div className="bob-form-grid"><div className="bob-field"><label htmlFor="bob-contact">Full name *</label><input id="bob-contact" required maxLength={120} value={form.contactName} onChange={update('contactName')}/></div>
     <div className="bob-field"><label htmlFor="bob-email">Business email *</label><input id="bob-email" type="email" required maxLength={255} value={form.email} onChange={update('email')}/></div>
     <div className="bob-field"><label htmlFor="bob-company">Organization</label><input id="bob-company" maxLength={150} value={form.company} onChange={update('company')}/></div>
     <div className="bob-field"><label htmlFor="bob-seats">Estimated BOB trainees</label><input id="bob-seats" type="number" min="1" max="10000" value={form.seatEstimate} onChange={update('seatEstimate')}/></div></div>
     <div style={{marginBottom:21}}><BobAddonSelection compact value={form.requestedAddons} onChange={a=>setForm(s=>({...s,requestedAddons:a}))}/></div>
     <div className="bob-field"><label htmlFor="bob-message">Tell us about your training or call-center requirements</label><textarea id="bob-message" maxLength={2500} value={form.message} onChange={update('message')} placeholder="Your industry, team size, goals and preferred contact details…"/></div>
     <div style={{position:'absolute',left:'-10000px'}} aria-hidden="true"><input tabIndex={-1} value={form.website} onChange={update('website')}/></div>
     {error&&<p className="bob-message error">{error}</p>}
     <button disabled={busy} className="bob-btn bob-btn-gold" type="submit"><Mail size={16}/>{busy?'Submitting…':'Send inquiry'}<ArrowRight size={16}/></button>
   </form>}
 </main><BobFooter/></div>;
}
