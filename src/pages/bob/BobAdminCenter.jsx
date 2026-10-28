import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, AudioLines, BarChart3, BookLock, Building2,
  Clock3, CreditCard, FileCode2, Headphones,
  KeyRound, LockKeyhole, MessageSquare, RefreshCcw, Search,
  Settings2, ShieldCheck, SlidersHorizontal, UserCog, Users, UserRoundPlus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './BobSite.css';

const ADMIN_DESTINATIONS=[
  {id:'team',label:'Team, roles & seats',Icon:Users,description:'Invite users, assign admin/manager/trainee roles and release seats.',scope:'admin'},
  {id:'workflow',label:'AI workflow & script studio',Icon:FileCode2,description:'Design end-to-end call journeys, AI personas, scripted actions and follow-up stages.',scope:'designer'},
  {id:'knowledge',label:'Customer knowledge vault',Icon:BookLock,description:'Encrypted training knowledge. Only organization members with the passphrase can unlock it.',scope:'designer'},
  {id:'supervisor',label:'Supervisor & recording cockpit',Icon:Headphones,description:'Consented live sessions, coaching audio and encrypted previous recordings.',scope:'supervisor'},
  {id:'settings',label:'Voice, privacy & permissions',Icon:SlidersHorizontal,description:'Control manager delegation, recording consent, monitoring policy and Deepgram keys.',scope:'admin'},
  {id:'billing',label:'Subscription & billing',Icon:CreditCard,description:'Training seat subscription, billing status and Stripe-managed payment details.',scope:'admin'},
  {id:'addons',label:'Live products & private libraries',Icon:AudioLines,description:'Track Live Q&A / Live Coach interest and keep their draft knowledge separate.',scope:'admin'},
  {id:'sessions',label:'Training history & coaching',Icon:BarChart3,description:'Review permitted encrypted training sessions, notes and coaching feedback.',scope:'supervisor'},
];

const logDate=v=>v?new Date(v).toLocaleString():'—';
const addonText=ids=>Array.isArray(ids)&&ids.length?ids.map(v=>v==='live_qa'?'Live Q&A':v==='live_coach'?'Live Coach':v).join(' + '):'BOB only';

export default function BobAdminCenter({
 ctx,org,isPlatform=false,isAdmin=false,isManager=false,canDesign=false,isSupervisor=false,
 members=[],sessions=[],documents=[],flows=[],scripts=[],vaultUnlocked=false,
 onNavigate,onSelectOrganization,onSetOrganization,onCreateOrganization,onSetInquiryStatus,
 api,onRefresh
}){
 const [search,setSearch]=useState(''),[statusFilter,setStatusFilter]=useState('all');
 const [editing,setEditing]=useState(null),[draft,setDraft]=useState({seatLimit:3,status:'trial'});
 const [newOrg,setNewOrg]=useState({name:'',ownerEmail:'',industry:'General sales',seatLimit:5});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [inquiries,setInquiries]=useState([]),[audit,setAudit]=useState([]),[activityScope,setActivityScope]=useState('organization');
 const allOrganizations=ctx?.organizations||[];
 const counts=useMemo(()=>({
  organizations:allOrganizations.length,
  active:allOrganizations.filter(o=>o.status==='active').length,
  trial:allOrganizations.filter(o=>o.status==='trial').length,
  suspended:allOrganizations.filter(o=>o.status==='suspended').length,
  licensedSeats:allOrganizations.reduce((sum,o)=>sum+(Number(o.seatLimit)||0),0),
  addonRequested:allOrganizations.filter(o=>(o.requestedAddons||[]).length>0).length
 }),[allOrganizations]);
 const filtered=useMemo(()=>allOrganizations.filter(o=>
   (statusFilter==='all'||o.status===statusFilter)&&
   [o.name,o.ownerEmail,o.industry,o.slug].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase()))
 ),[allOrganizations,statusFilter,search]);

 const loadInquiries=async()=>{
  if(!isPlatform)return;
  const data=await api('listInquiries');
  setInquiries(data.inquiries||[]);
 };
 const loadAudit=async()=>{
  if(!isPlatform&&!isAdmin)return;
  const global=isPlatform&&activityScope==='platform';
  const data=await api('adminActivity',{organizationId:org?.id||'',global});
  setAudit(data.events||[]);
 };
 useEffect(()=>{
  let active=true;
  if(isPlatform)api('listInquiries').then(x=>{if(active)setInquiries(x.inquiries||[])}).catch(()=>{});
  return()=>{active=false};
 },[isPlatform]);
 useEffect(()=>{
  let active=true;
  if(!isPlatform&&!isAdmin){setAudit([]);return;}
  api('adminActivity',{organizationId:org?.id||'',global:isPlatform&&activityScope==='platform'})
   .then(x=>{if(active)setAudit(x.events||[])}).catch(()=>{if(active)setAudit([])});
  return()=>{active=false};
 },[org?.id,isPlatform,isAdmin,activityScope]);
 const perform=async(task,message)=>{
  setBusy(true);setError('');setNotice('');
  try{await task();setNotice(message);await onRefresh?.();await loadInquiries().catch(()=>{});await loadAudit().catch(()=>{});}
  catch(e){setError(e?.response?.data?.error||e.message||'Administration request failed.');}
  finally{setBusy(false);}
 };
 const choose=organization=>{
  onSelectOrganization?.(organization.id);
  setEditing(organization.id);
  setDraft({seatLimit:organization.seatLimit,status:organization.status,name:organization.name});
 };
 const updateOrg=async(e)=>{
  e.preventDefault();
  if(!editing)return;
  await perform(()=>onSetOrganization(editing,{
   name:draft.name,seatLimit:Number(draft.seatLimit),status:draft.status
  }),'Organization settings and licensed capacity saved.');
 };
 const createOrg=async(e)=>{
  e.preventDefault();
  await perform(async()=>{
   await onCreateOrganization({...newOrg});
   setNewOrg({name:'',ownerEmail:'',industry:'General sales',seatLimit:5});
  },'Customer organization created and owner seat assigned.');
 };
 const updateInquiry=async(id,status)=>perform(
  ()=>onSetInquiryStatus(id,status),'Inquiry status updated.');
 const visibleDestinations=ADMIN_DESTINATIONS.filter(d=>
  d.scope==='admin'?isAdmin:d.scope==='designer'?canDesign:isSupervisor
 );

 return <div className="bob-stack" style={{gap:20}}>
   <div className="bob-panel" style={{background:'linear-gradient(125deg,#17313a,#0c1d2d 74%)',borderColor:'#c6a96a4a',padding:'26px 30px'}}>
    <div className="bob-panel-title"><div><div className="bob-eyebrow">{isPlatform?'Platform owner administration':'Private organization administration'}</div>
     <h2 style={{fontSize:30,letterSpacing:'-.045em',margin:'8px 0'}}>{isPlatform?'BOB Command Center':'Organization Command Center'}</h2>
     <p className="bob-portal-desc" style={{maxWidth:800}}>{isPlatform
      ?'Manage customers, subscriptions, trials, seat entitlements and sales operations. Customer-encrypted knowledge and transcripts are not available in the operator console.'
      :'Manage company members, scripted simulations, workflow permissions, voice configuration, live supervision and subscriptions from one place.'}</p>
    </div><ShieldCheck size={34} color="#d7b978"/></div>
    <div style={{display:'flex',gap:9,flexWrap:'wrap',marginTop:12}}>
      <span className="bob-pill"><LockKeyhole size={12}/> Private knowledge requires the customer passphrase</span>
      {isAdmin&&<span className="bob-pill"><UserCog size={12}/> Organization admin</span>}
      {isManager&&<span className="bob-pill"><Users size={12}/> Delegated manager</span>}
    </div>
   </div>
   {error&&<div className="bob-message error">{error}</div>}
   {notice&&<div className="bob-message success">{notice}</div>}
   {isPlatform&&<>
    <div className="bob-dashboard-grid">
      {[
       ['Customer organizations',counts.organizations],
       ['Active organizations',counts.active],
       ['Organizations on trial',counts.trial],
       ['Licensed seat capacity',counts.licensedSeats],
      ].map(([label,value])=><div className="bob-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="bob-grid-2" style={{gridTemplateColumns:'minmax(0,1.45fr) minmax(290px,.8fr)',alignItems:'start'}}>
     <div className="bob-panel"><div className="bob-panel-title"><h3><Building2 size={18} color="#d7b978" style={{display:'inline',marginRight:8}}/> Customer organizations</h3>
       <button className="bob-btn bob-btn-ghost" onClick={()=>perform(async()=>{},'Customer list refreshed.')} disabled={busy}><RefreshCcw size={14}/> Refresh</button></div>
       <div className="bob-form-grid">
        <div className="bob-field"><label htmlFor="bob-platform-search">Search customers</label><div style={{display:'flex',alignItems:'center',gap:8}}><Search size={16} color="#97afc0"/><input id="bob-platform-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, owner email, industry…"/></div></div>
        <div className="bob-field"><label>Subscription access</label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All organizations</option><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option></select></div>
       </div>
       <div className="bob-table-wrap"><table className="bob-table"><thead><tr><th>Organization</th><th>Owner</th><th>Seats</th><th>Status</th><th>Add-ons requested</th><th/></tr></thead><tbody>
        {filtered.map(o=><tr key={o.id}><td><strong>{o.name}</strong><div className="bob-tiny">{o.industry}</div></td><td>{o.ownerEmail}</td><td>{o.seatLimit}</td><td><span className="bob-pill">{o.status}</span><div className="bob-tiny">Billing: {o.billingStatus||'unconfigured'}</div></td><td>{addonText(o.requestedAddons)}</td><td><button className="bob-btn bob-btn-ghost" type="button" onClick={()=>choose(o)}>Manage</button></td></tr>)}
       </tbody></table>{filtered.length===0&&<div className="bob-empty">No organizations match the current filters.</div>}</div>
       {editing&&<form onSubmit={updateOrg} className="bob-panel" style={{background:'#0c1b27',marginTop:19}}>
        <div className="bob-panel-title"><h3>Manage commercial access</h3><span className="bob-pill">Billing and seats only</span></div>
        <p className="bob-tiny">Platform changes cannot unlock private tenant knowledge, training recordings, workflows or transcripts. Payment activation must be reconciled with Stripe.</p>
        <div className="bob-form-grid"><div className="bob-field"><label>Customer organization</label><input required minLength={2} value={draft.name||''} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></div><div className="bob-field"><label>Licensed seat allocation</label><input type="number" min="1" value={draft.seatLimit} onChange={e=>setDraft(d=>({...d,seatLimit:e.target.value}))}/></div></div>
        <div className="bob-field"><label>Access status</label><select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}><option value="trial">Trial</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
        <p className="bob-tiny">An active access flag is not proof of successful payment. Customer subscriptions remain verified by Stripe webhook events.</p>
        <button disabled={busy} className="bob-btn bob-btn-gold" type="submit">Save commercial settings</button>
       </form>}
     </div>
     <form className="bob-panel" onSubmit={createOrg}><div className="bob-panel-title"><h3><UserRoundPlus color="#d7b978" size={18} style={{display:'inline',marginRight:8}}/> Onboard customer</h3></div>
      <p className="bob-tiny">Create a dedicated company, assign an owner and allocate initial training seats. The customer sets their own private knowledge passphrase.</p>
      <div className="bob-field"><label>Organization name</label><input minLength={2} required maxLength={120} value={newOrg.name} onChange={e=>setNewOrg(o=>({...o,name:e.target.value}))}/></div>
      <div className="bob-field"><label>Owner email</label><input type="email" required value={newOrg.ownerEmail} onChange={e=>setNewOrg(o=>({...o,ownerEmail:e.target.value}))}/></div>
      <div className="bob-field"><label>Industry</label><input maxLength={80} value={newOrg.industry} onChange={e=>setNewOrg(o=>({...o,industry:e.target.value}))}/></div>
      <div className="bob-field"><label>Licensed trainee seats</label><input type="number" required min="1" value={newOrg.seatLimit} onChange={e=>setNewOrg(o=>({...o,seatLimit:e.target.value}))}/></div>
      <button disabled={busy} className="bob-btn bob-btn-gold" type="submit"><Building2 size={14}/> Create customer workspace</button>
     </form>
    </div>
    <div className="bob-panel"><div className="bob-panel-title"><h3><MessageSquare size={18} color="#d7b978" style={{display:'inline',marginRight:8}}/> Sales & onboarding inquiries</h3>
      <span className="bob-pill">{inquiries.length} total</span></div>
      {inquiries.length===0?<div className="bob-empty">No commercial inquiries recorded.</div>:
      <div className="bob-table-wrap"><table className="bob-table"><thead><tr><th>Contact</th><th>Company</th><th>BOB seats</th><th>Live products</th><th>Message</th><th>Follow-up status</th></tr></thead><tbody>
       {inquiries.map(q=><tr key={q.id}><td>{q.contactName}<div className="bob-tiny">{q.email}</div></td><td>{q.company||'—'}</td><td>{q.seatEstimate||'—'}</td><td>{(()=>{try{return addonText(JSON.parse(q.requestedAddons||'[]'))}catch{return 'BOB only'}})()}</td><td style={{maxWidth:240,whiteSpace:'normal'}}>{q.message||'—'}</td><td><select className="bob-input" style={{minWidth:140}} disabled={busy} value={q.status||'new'} onChange={e=>updateInquiry(q.id,e.target.value)}>{['new','contacted','qualified','converted','closed'].map(v=><option key={v} value={v}>{v}</option>)}</select></td></tr>)}
      </tbody></table></div>}
    </div>
    <div className="bob-panel"><div className="bob-panel-title"><h3>Platform operating overview</h3></div><div className="bob-dashboard-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))'}}>
      <div className="bob-stat"><span>Suspended</span><strong>{counts.suspended}</strong></div>
      <div className="bob-stat"><span>Live-product inquiries</span><strong>{counts.addonRequested}</strong></div>
      <div className="bob-stat"><span>New sales inquiries</span><strong>{inquiries.filter(x=>!x.status||x.status==='new').length}</strong></div>
    </div><p className="bob-tiny" style={{marginTop:14}}>Stripe pricing, payment-provider activation, production webhook delivery and security certification require separate platform configuration and verification before public launch.</p></div>
   </>}
   {(isAdmin||isManager)&&org&&<>
    <div className="bob-dashboard-grid">
      {[
       ['Assigned seats',members.length?members.filter(m=>m.status==='active').length:'—'],
       ['Licensed capacity',org.seatLimit],
       ['Saved training sessions',sessions.length],
       ['Private knowledge entries',documents.length],
      ].map(([label,value])=><div className="bob-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="bob-panel"><div className="bob-panel-title"><h3><Settings2 size={18} color="#d7b978" style={{display:'inline',marginRight:8}}/> Organization administration</h3><span className="bob-pill">{org.myRole}</span></div>
      <p className="bob-portal-desc">Choose a module to administer this organization. Your permissions and private knowledge vault restrictions continue to apply in every module.</p>
      <div className="bob-feature-grid" style={{marginTop:20}}>{visibleDestinations.map(({id,label,Icon,description})=>
        <button key={id} type="button" className="bob-panel" style={{textAlign:'left',padding:20,cursor:'pointer'}} onClick={()=>onNavigate(id)}>
         <span className="bob-feature-icon"><Icon size={20}/></span><strong style={{display:'block',marginTop:13,fontSize:15}}>{label}</strong>
         <p className="bob-tiny" style={{minHeight:39}}>{description}</p><span style={{fontSize:12,color:'#d7b978'}}>Open module <ArrowRight size={13} style={{display:'inline',marginLeft:4}}/></span>
        </button>)}</div>
    </div>
    <div className="bob-grid-2">
     <div className="bob-panel"><div className="bob-panel-title"><h3><ShieldCheck size={17} color="#d7b978" style={{display:'inline',marginRight:8}}/> Permissions & security</h3></div>
       {[
        ['Manager workflow editing',org.managerCanConfigure],
        ['Manager recording controls',org.managerCanControlRecording],
        ['Opt-in training recording',org.allowSessionRecording],
        ['Opt-in live monitoring',org.allowLiveMonitoring],
        ['Customer knowledge vault',vaultUnlocked],
       ].map(([label,allowed])=><div key={label} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'9px 0',borderBottom:'1px solid #ffffff1b',fontSize:12}}><span>{label}</span><span style={{color:allowed?'#a8e6c3':'#e9c98b',fontWeight:700}}>{allowed?'Enabled / unlocked':'Disabled / locked'}</span></div>)}
       {isAdmin&&<button className="bob-btn bob-btn-ghost" style={{marginTop:18}} onClick={()=>onNavigate('settings')}>Change organization policies</button>}
       <p className="bob-tiny" style={{marginTop:13}}>BOB platform operators cannot obtain your passphrase through the administration console. See the <Link to="/bob/security" style={{color:'#d7b978'}}>security implementation</Link> for technical limitations.</p>
     </div>
     <div className="bob-panel"><div className="bob-panel-title"><h3><Activity size={17} color="#d7b978" style={{display:'inline',marginRight:8}}/> Training operations</h3></div>
      <p>Workflow templates: <strong>{flows.length}</strong></p><p>Private scripts: <strong>{scripts.length}</strong></p>
      <p>Organization training records: <strong>{sessions.length}</strong></p><p>Optional products: <strong>{addonText(org.requestedAddons)}</strong></p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{canDesign&&<button className="bob-btn bob-btn-gold" onClick={()=>onNavigate('workflow')}>Edit BOB workflows</button>}
       {isSupervisor&&<button className="bob-btn bob-btn-ghost" onClick={()=>onNavigate('supervisor')}>Supervisor cockpit</button>}</div>
     </div>
    </div>
   </>}
   {(isPlatform||isAdmin)&&<div className="bob-panel"><div className="bob-panel-title"><h3><Clock3 size={17} color="#d7b978" style={{display:'inline',marginRight:8}}/> Administrative activity</h3>
    {isPlatform&&<select className="bob-input" style={{maxWidth:220}} value={activityScope} onChange={e=>setActivityScope(e.target.value)}><option value="organization">Selected organization</option><option value="platform">All platform activity</option></select>}</div>
    {audit.length===0?<div className="bob-empty">No administration events recorded yet.</div>:
     <div className="bob-table-wrap"><table className="bob-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead><tbody>{audit.map(x=><tr key={x.id}><td>{logDate(x.createdAt)}</td><td>{x.actorEmail}</td><td>{x.action}</td><td>{x.description||'—'}</td></tr>)}</tbody></table></div>}
    <p className="bob-tiny">This audit captures selected administration actions. It does not include plaintext company knowledge, secrets, or simulated customer data. Complete compliance-grade auditing remains a launch requirement.</p>
   </div>}
   <div className="bob-panel" style={{background:'#0c1924',display:'flex',gap:14,alignItems:'flex-start'}}>
    <KeyRound size={22} color="#d7b978" style={{flexShrink:0}}/><div><strong style={{fontSize:14}}>Data separation stays in effect for administrators.</strong>
      <p className="bob-tiny">Platform operations cover customer accounts and entitlements. Private documents, scripts and recordings remain encrypted with organization-held keys. Administrators who control the application deployment could still change delivered JavaScript, and selected decrypted content is shared with AI providers for live training. Do not claim an independently audited, operator-proof zero-access service.</p></div>
   </div>
 </div>;
}
