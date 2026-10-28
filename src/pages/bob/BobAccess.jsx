import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, LockKeyhole, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { BobNav, BobFooter } from './BobMarketing';
import './BobSite.css';
function goLogin(){base44.auth.redirectToLogin(window.location.origin+'/bob/portal');}
export function BobLogin(){
  return <div className="bob-site"><BobNav/><main className="bob-form-page"><div className="bob-panel" style={{padding:35}}><span className="bob-feature-icon"><LockKeyhole size={24}/></span><div className="bob-eyebrow" style={{marginTop:25}}>Private training access</div><h1>Welcome back.</h1><p style={{color:'#a5b3c5'}}>Sign in to your organization's BOB training workspace using your account email. Only assigned organization members can access their training.</p><button type="button" className="bob-btn bob-btn-gold" onClick={goLogin} style={{width:'100%',marginTop:15}}>Sign in to BOB <ArrowRight size={16}/></button><p className="bob-tiny">New organization? <Link style={{color:'#d7b978'}} to="/bob/signup">Get started here</Link>.</p></div></main><BobFooter/></div>;
}
export function BobSignup(){
  const navigate=useNavigate();
  return <div className="bob-site"><BobNav/><main className="bob-form-page"><span className="bob-eyebrow">Create your BOB organization</span><h1>Train your team, your way.</h1><p>Start a branded training workspace for your organization. New self-service workspaces begin with three trial seats; larger allocations are set by BOB sales.</p><div className="bob-panel"><div className="bob-feature-icon"><Building2 size={23}/></div><h3>Step 1. Secure your account</h3><p>Sign in or create an account with the email you'll use to administer your organization. You'll name the workspace and set up your team inside the portal.</p><button className="bob-btn bob-btn-gold" onClick={goLogin}>Continue to account setup <ArrowRight size={16}/></button><hr style={{margin:'24px 0',border:0,borderTop:'1px solid #ffffff19'}}/><h3>Need more than three seats?</h3><p>Tell us your team size and we'll help set up an organization with the right allocation.</p><button className="bob-btn bob-btn-ghost" onClick={()=>navigate('/bob/inquire')}>Request commercial pricing</button></div></main><BobFooter/></div>;
}
export function BobInquiry(){
  const [form,setForm]=useState({contactName:'',email:'',company:'',seatEstimate:'10',message:'',website:''});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
  const update=(key)=>(e)=>setForm(s=>({...s,[key]:e.target.value}));
  const send=async(e)=>{
    e.preventDefault();setBusy(true);setError('');
    try{const res=await base44.functions.invoke('bobSaas',{action:'inquire',...form});
      const data=res?.data||res;if(data?.error)throw new Error(data.error);setSent(true);
    }catch(e){setError(e.message||'Could not submit inquiry.');}finally{setBusy(false);}
  };
  return <div className="bob-site"><BobNav/><main className="bob-form-page"><span className="bob-eyebrow">Commercial partnerships</span><h1>Bring BOB to your team.</h1><p>Interested in buying training seats, onboarding your company, or seeing a demo? Share your requirements and we'll review them.</p>
    {sent?<div className="bob-panel" style={{textAlign:'center',padding:42}}><CheckCircle2 size={38} color="#d7b978"/><h2>Inquiry received.</h2><p>Thank you. Your request has been recorded for our team.</p><Link className="bob-btn bob-btn-gold" to="/bob">Back to BOB</Link></div>
    :<form className="bob-panel" onSubmit={send}><div className="bob-form-grid"><div className="bob-field"><label htmlFor="bob-contact">Full name *</label><input id="bob-contact" required maxLength={120} value={form.contactName} onChange={update('contactName')}/></div><div className="bob-field"><label htmlFor="bob-email">Business email *</label><input id="bob-email" type="email" required maxLength={255} value={form.email} onChange={update('email')}/></div><div className="bob-field"><label htmlFor="bob-company">Organization</label><input id="bob-company" maxLength={150} value={form.company} onChange={update('company')}/></div><div className="bob-field"><label htmlFor="bob-seats">Estimated trainees</label><input id="bob-seats" type="number" min="1" max="10000" value={form.seatEstimate} onChange={update('seatEstimate')}/></div></div><div className="bob-field"><label htmlFor="bob-message">What are you looking to accomplish?</label><textarea id="bob-message" maxLength={2500} value={form.message} onChange={update('message')} placeholder="Tell us about your team and training requirements…"/></div><div style={{position:'absolute',left:'-10000px'}} aria-hidden="true"><input tabIndex={-1} value={form.website} onChange={update('website')}/></div>{error&&<p className="bob-message error">{error}</p>}<button disabled={busy} className="bob-btn bob-btn-gold" type="submit"><Mail size={16}/>{busy?'Submitting…':'Send inquiry'}<ArrowRight size={16}/></button></form>}
  </main><BobFooter/></div>;
}
