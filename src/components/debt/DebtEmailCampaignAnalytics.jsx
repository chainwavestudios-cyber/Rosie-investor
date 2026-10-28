
/**
 * Read-only Gmail Campaign View for Debt Call Coach Email Engagement.
 * Uses authenticated debtEmailCampaignView server reports. Legacy remains separate.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useDebtCoachAuth} from '@/lib/DebtCoachAuthContext';
import EngagementContactCard from '@/components/engagement/EngagementContactCard';
import {Archive,ArrowRight,BarChart3,CalendarClock,CheckCircle2,ChevronDown,Download,Eye,ExternalLink,FileText,HelpCircle,Inbox,Layers3,Link2,Mail,MousePointerClick,RefreshCw,Search,Send,Settings2,ShieldCheck,Users,X,AlertTriangle} from 'lucide-react';
import './DebtEmailCampaignAnalytics.css';

const n=v=>Number.isFinite(Number(v))?Number(v):0;
const fmt=v=>n(v).toLocaleString('en-US');
const pct=(a,b)=>b?Math.round(n(a)/n(b)*100)+'%':'—';
const date=v=>v&&!isNaN(new Date(v).getTime())?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const shortDate=v=>v&&!isNaN(new Date(v).getTime())?new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
const colors={running:'green',completed:'green',sent:'green',ready:'blue',pending:'blue',draft:'grey',paused:'gold',skipped:'gold',cancelled:'red',failed:'red'};
const csvValue=value=>{
 let s=String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
 if(/^[=+\-@]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
};
const queues=raw=>{try{const x=JSON.parse(raw||'[]');return Array.isArray(x)?x.filter(q=>q.enabled!==false):[]}catch{return []}};
function Flag({status}){return <span className={'dca-flag dca-'+(colors[status]||'grey')}>{status||'unknown'}</span>}
function Stat({Icon,label,value,foot}){return <div className="dca-stat"><div><span>{label}</span><Icon size={16}/></div><strong>{value}</strong><small>{foot}</small></div>}
function Detail({label,value}){return <div className="dca-detail"><span>{label}</span><strong>{value||'—'}</strong></div>}
const statuses=[['all','All'],['running','Running'],['paused','Paused'],['completed','Completed'],['draft','Drafts']];
const recipientStatuses=[['all','All'],['sent','Sent'],['pending','Pending'],['failed','Failed'],['skipped','Skipped']];

export default function DebtEmailCampaignAnalytics(){
 const {sessionUserId,sessionToken,isAdmin,user}=useDebtCoachAuth();
 const [campaigns,setCampaigns]=useState([]),[campaignCursor,setCampaignCursor]=useState(null),[campaignSearch,setCampaignSearch]=useState(''),[status,setStatus]=useState('all');
 const [activeId,setActiveId]=useState(''),[report,setReport]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [rows,setRows]=useState([]),[recCursor,setRecCursor]=useState(null),[recOffset,setRecOffset]=useState(0),[recMore,setRecMore]=useState(false);
 const [recipientStatus,setRecipientStatus]=useState('all'),[search,setSearch]=useState(''),[searchValue,setSearchValue]=useState(''),[rowsBusy,setRowsBusy]=useState(false),[rowsError,setRowsError]=useState(''),[searchLimited,setSearchLimited]=useState(false);
 const [detailsOpen,setDetailsOpen]=useState(true),[selected,setSelected]=useState(null),[selectedDetails,setSelectedDetails]=useState(null),[detailBusy,setDetailBusy]=useState(false);
 const [leadCard,setLeadCard]=useState(null),[exporting,setExporting]=useState(false),[exportNote,setExportNote]=useState('');
 const selectedRef=useRef('');
 const auth=useMemo(()=>({sessionUserId,sessionToken}),[sessionUserId,sessionToken]);
 const api=useCallback(async(mode,args={})=>{
   const res=await base44.functions.invoke('debtEmailCampaignView',{mode,...auth,...args});
   const data=res?.data||res||{};
   if(data.error)throw new Error(data.error);
   return data;
 },[auth]);
 const loadCampaigns=useCallback(async(extra=false)=>{
   if(!isAdmin||!sessionToken)return;
   setBusy(true);
   try{
     const data=await api('list',extra&&campaignCursor?{cursor:campaignCursor}:{});
     setCampaigns(prev=>extra?[...prev.filter(a=>!(data.campaigns||[]).some(b=>b.id===a.id)),...(data.campaigns||[])]:data.campaigns||[]);
     setCampaignCursor(data.nextCursor||null);
     setError('');
     if(!extra&&!selectedRef.current&&data.campaigns?.length){
       selectedRef.current=data.campaigns[0].id;
       setActiveId(data.campaigns[0].id);
     }
   }catch(e){setError(e?.response?.data?.error||e.message||'Unable to load Gmail campaigns.')}
   finally{setBusy(false);setLoading(false);}
 },[api,isAdmin,sessionToken,campaignCursor]);
 const loadDetail=useCallback(async()=>{
   if(!activeId||!isAdmin||!sessionToken)return;
   try{const data=await api('detail',{campaignId:activeId});setReport(data);setError('');}
   catch(e){setError(e?.response?.data?.error||e.message||'Unable to load campaign performance.');}
 },[activeId,isAdmin,sessionToken,api]);
 const loadRecipients=useCallback(async(extra=false)=>{
   if(!activeId||!isAdmin||!sessionToken)return;
   setRowsBusy(true);
   try{
     const args={campaignId:activeId,status:recipientStatus,search:searchValue,limit:75};
     if(extra&&searchValue)args.offset=recOffset;
     else if(extra&&recCursor)args.cursor=recCursor;
     const data=await api('recipients',args);
     setRows(prev=>extra?[...prev,...(data.recipients||[])]:data.recipients||[]);
     setRecMore(!!data.hasMore);setRecCursor(data.nextCursor||null);setRecOffset(data.nextOffset||0);
     setSearchLimited(!!data.searchLimited);setRowsError('');
   }catch(e){setRowsError(e?.response?.data?.error||e.message||'Unable to load recipients.')}
   finally{setRowsBusy(false);}
 },[activeId,sessionToken,isAdmin,api,recipientStatus,searchValue,recOffset,recCursor]);
 useEffect(()=>{loadCampaigns(false)},[isAdmin,sessionToken,sessionUserId,api]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{selectedRef.current=activeId},[activeId]);
 useEffect(()=>{if(!activeId)return;setReport(null);setSelected(null);loadDetail()},[activeId,loadDetail]);
 useEffect(()=>{const timer=setTimeout(()=>setSearchValue(search.trim()),350);return()=>clearTimeout(timer)},[search]);
 useEffect(()=>{if(!activeId)return;setRows([]);setRecCursor(null);setRecOffset(0);setRecMore(false);loadRecipients(false)},[activeId,recipientStatus,searchValue,api]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')loadDetail()},60000);return()=>clearInterval(timer)},[loadDetail]);
 const filtered=useMemo(()=>campaigns.filter(c=>(status==='all'||c.status===status)&&(!campaignSearch.trim()||[c.name,c.templateName,c.listName,c.subject,c.senderEmail].some(v=>String(v||'').toLowerCase().includes(campaignSearch.toLowerCase().trim())))),[campaigns,campaignSearch,status]);
 const campaign=report?.campaign||campaigns.find(c=>c.id===activeId)||null;
 const breakdown=report?.breakdown||{};
 const sent=breakdown.sent??campaign?.sentCount??0;
 const total=breakdown.total??campaign?.importedCount??0;
 const progress=Math.min(100,Math.round(sent/Math.max(1,n(campaign?.eligibleCount)||total)*100));
 const refresh=async()=>{setBusy(true);try{await Promise.all([loadCampaigns(false),loadDetail(),loadRecipients(false)])}finally{setBusy(false)}};
 const openRow=async(row)=>{
   setSelected(row);setSelectedDetails(null);setDetailBusy(true);
   try{const data=await api('recipientDetail',{campaignId:activeId,recipientId:row.id});setSelectedDetails(data);}
   catch(e){setSelectedDetails({error:e?.response?.data?.error||e.message||'Unable to read send history.'})}
   finally{setDetailBusy(false)}
 };
 const exportCSV=async()=>{
   if(!campaign||exporting)return;
   setExporting(true);setExportNote('Preparing full campaign roster…');
   try{
     const columns=['Name','Email','Phone','Status','Subject','Sent At','First Open','Recorded Opens','First Click','Recorded Clicks','Invitation Visited','Unsubscribed','Error Or Skip Reason','Contact ID','Send ID'];
     const content=[columns.map(csvValue).join(',')];
     let cursor=null,downloaded=0,pages=0;
     do{
       const data=await api('recipients',{campaignId:activeId,status:'all',search:'',limit:150,...(cursor?{cursor}:{})});
       for(const r of data.recipients||[])content.push([r.name,r.email,r.phone,r.status,r.subject,r.sentAt,r.openedAt,r.openCount,r.clickedAt,r.clickCount,r.qualifyVisitAt,r.unsubscribedAt,r.error||r.reason,r.leadId,r.sendId].map(csvValue).join(','));
       cursor=data.nextCursor||null;downloaded+=(data.recipients||[]).length;
       setExportNote(fmt(downloaded)+' recipient rows collected…');pages++;
       if(data.hasMore&&!cursor)throw Error('Export incomplete — the server did not return another page.');
       if(pages>=100&&cursor)throw Error('Export reached the 15,000-row safety limit; no partial file downloaded.');
     }while(cursor);
     const blob=new Blob(['\uFEFF'+content.join('\r\n')],{type:'text/csv;charset=utf-8'});
     const url=URL.createObjectURL(blob);
     const anchor=document.createElement('a');
     anchor.href=url;anchor.download='campaign-'+String(campaign.name||'results').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()+'.csv';
     document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
     setExportNote(fmt(downloaded)+' recipient records exported.');
   }catch(e){setError(e.message||'Could not export results.')}
   finally{setExporting(false)}
 };
 if(!isAdmin)return <div className="dca-root">Only Debt Call Coach administrators can view campaigns.</div>;
 return <section className="dca-root" aria-label="Gmail campaign intelligence">
   <header className="dca-hero"><div><div className="dca-eyebrow">ROSIE AI · DEBT CALL COACH</div><h2>Campaign <em>Intelligence</em></h2><p>Choose any Gmail campaign. See performance, individual emails and every recorded step of the customer journey.</p></div><button type="button" className="dca-button" onClick={refresh} disabled={busy}><RefreshCw size={16}/>{busy?'Refreshing…':'Refresh'}</button></header>
   <div className="dca-scope"><ShieldCheck size={15}/> Email Campaigns only. Historical Gmail records remain in Legacy Tracking. Nothing is sent or modified from this view.</div>
   {error&&<div className="dca-error" role="alert"><AlertTriangle size={16}/>{error}</div>}
   <div className="dca-layout">
     <aside className="dca-sidebar">
       <div className="dca-sidebar-heading"><div><span className="dca-eyebrow">SELECT A CAMPAIGN</span><h3>All Campaigns</h3></div><span className="dca-count">{fmt(campaigns.length)}{campaignCursor?'+':''}</span></div>
       <label className="dca-search"><Search size={15}/><input aria-label="Search campaigns" placeholder="Search campaigns…" value={campaignSearch} onChange={e=>setCampaignSearch(e.target.value)}/></label>
       <div className="dca-filter-row">{statuses.map(([key,label])=><button key={key} className={status===key?'active':''} onClick={()=>setStatus(key)}>{label}</button>)}</div>
       <div className="dca-campaign-list">{filtered.map(c=><button key={c.id} className={'dca-campaign'+(c.id===activeId?' selected':'')} onClick={()=>setActiveId(c.id)}>
         <span className="dca-campaign-title">{c.name}<Flag status={c.status}/></span>
         <span className="dca-campaign-sub">{c.listName||c.templateName||'Email campaign'}<small>{shortDate(c.startedAt||c.createdAt)}</small></span>
         <span className="dca-campaign-stats"><span><Send size={13}/>{fmt(c.sentCount)}</span><span><Eye size={13}/>{fmt(c.openCount)}</span><span><Link2 size={13}/>{fmt(c.clickCount)}</span></span>
         <span className="dca-campaign-progress"><i style={{width:Math.min(100,Math.round(n(c.sentCount)/Math.max(1,n(c.eligibleCount))*100))+'%'}}/></span>
       </button>)}
       {loading&&!filtered.length&&<p className="dca-muted">Loading campaigns…</p>}
       {!loading&&!filtered.length&&<p className="dca-muted">No campaigns match this filter.</p>}</div>
       {campaignCursor&&<button className="dca-button dca-load" disabled={busy} onClick={()=>loadCampaigns(true)}>More campaigns <ChevronDown size={15}/></button>}
     </aside>
     <main className="dca-content">
     {!campaign?<div className="dca-empty"><Inbox size={35}/><h3>Select a campaign</h3><p>Campaign data appears here after you select one.</p></div>:<>
       <section className="dca-summary">
         <div className="dca-summary-head"><div><span className="dca-eyebrow">PERFORMANCE OVERVIEW</span><h3>{campaign.name}</h3><div className="dca-subhead"><Flag status={campaign.status}/><span>{campaign.templateName||'No template'}</span><span>{campaign.listName||'Gmail campaign'}</span></div></div><button className="dca-button" disabled={exporting} onClick={exportCSV}><Download size={16}/>{exporting?'Preparing…':'Export CSV'}</button></div>
         {exportNote&&<div className="dca-muted">{exportNote}</div>}
         <div className="dca-progress"><div><span style={{width:progress+'%'}}/></div><small>{progress}% of eligible recipients sent</small></div>
         <div className="dca-grid">
           <Stat Icon={Users} label="Imported" value={fmt(campaign.importedCount)} foot={fmt(campaign.eligibleCount)+' eligible · '+fmt(campaign.excludedCount)+' excluded'}/>
           <Stat Icon={Send} label="Sent" value={fmt(sent)} foot={pct(sent,campaign.eligibleCount)+' of eligible'}/>
           <Stat Icon={Eye} label="Open events*" value={fmt(campaign.openCount)} foot={'Unique openers: '+(breakdown.uniqueOpened==null?'—':fmt(breakdown.uniqueOpened))}/>
           <Stat Icon={MousePointerClick} label="Click events" value={fmt(campaign.clickCount)} foot={'Unique clickers: '+(breakdown.uniqueClicked==null?'—':fmt(breakdown.uniqueClicked))}/>
           <Stat Icon={ExternalLink} label="Invitation visits" value={breakdown.uniqueVisited==null?'—':fmt(breakdown.uniqueVisited)} foot="Page visits, not booked appointments"/>
           <Stat Icon={AlertTriangle} label="Failed / Skipped" value={fmt(breakdown.failed??campaign.failedCount)+' / '+fmt(breakdown.skipped??campaign.skippedCount)} foot={fmt(breakdown.pending??0)+' pending'}/>
         </div>
         <div className="dca-note"><HelpCircle size={15}/> Open requests may be triggered by email privacy systems. Clicks and invitation visits do not by themselves confirm a human visitor, a reply, or a booking.</div>
       </section>
       <section className="dca-settings">
         <button type="button" className="dca-section-title" onClick={()=>setDetailsOpen(v=>!v)} aria-expanded={detailsOpen}><span><Settings2 size={17}/> Campaign details and sending schedule</span><ChevronDown size={17} style={{transform:detailsOpen?'rotate(180deg)':'none'}}/></button>
         {detailsOpen&&<div className="dca-details">
           <div className="dca-detail-grid">
             <Detail label="Email subject" value={campaign.subject||'Template default (not overridden)'}/>
             <Detail label="Template" value={campaign.templateName||'Not assigned'}/>
             <Detail label="Sending account" value={[campaign.senderName,campaign.senderEmail].filter(Boolean).join(' · ')||'Connected Gmail account'}/>
             <Detail label="Audience / List" value={campaign.listName}/>
             <Detail label="Source CSV" value={campaign.sourceFile}/>
             <Detail label="Created by" value={campaign.createdBy}/>
             <Detail label="Created" value={date(campaign.createdAt)}/>
             <Detail label="Recipients approved" value={date(campaign.approvedAt)}/>
             <Detail label="Approved by" value={campaign.approvedBy}/>
             <Detail label="Started" value={date(campaign.startedAt)}/>
             <Detail label="Last run" value={date(campaign.lastRunAt)}/>
             <Detail label="Next scheduled send" value={campaign.status==='running'?date(campaign.nextSendAt):'Not running'}/>
             <Detail label="Completed" value={date(campaign.completedAt)}/>
             <Detail label="Send window" value={[campaign.windowStart,campaign.windowEnd].filter(Boolean).join('–')}/>
             <Detail label="Timezone" value={campaign.timezone}/>
             <Detail label="Daily send limit" value={fmt(campaign.dailyLimit)}/>
             <Detail label="Contact cards created / updated" value={fmt(campaign.contactCreatedCount)+' / '+fmt(campaign.contactUpdatedCount)}/>
             <Detail label="Unsubscribed" value={fmt(breakdown.unsubscribed??campaign.unsubscribedCount)}/>
             <Detail label="Last queue" value={campaign.lastQueueName}/>
           </div>
           {!!queues(campaign.queuesJson).length&&<div className="dca-queues"><h4><Layers3 size={15}/> Sending queues</h4>{queues(campaign.queuesJson).map((q,i)=><div key={i}><strong>{q.label||'Queue '+(i+1)}</strong><span>{fmt(q.perBurst)} emails / burst</span><span>{fmt(q.gapMinSeconds)}–{fmt(q.gapMaxSeconds||q.gapMinSeconds)} seconds between sends</span></div>)}</div>}
           {!!campaign.notes&&<p className="dca-notes"><b>Notes: </b>{campaign.notes}</p>}
         </div>}
       </section>
       <section className="dca-recipients">
         <div className="dca-recipient-head"><div><div className="dca-eyebrow">RECIPIENT DETAILS</div><h3>Individual Emails &amp; Activity</h3><p>Sent, opened, clicked, failed or skipped — with the actual send record and timeline.</p></div><span className="dca-count">{fmt(total)} records</span></div>
         <div className="dca-toolbar"><label className="dca-search"><Search size={15}/><input aria-label="Search recipients across selected campaign" placeholder="Search name, email, subject, send ID…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="dca-filter-row">{recipientStatuses.map(([key,label])=><button key={key} className={recipientStatus===key?'active':''} onClick={()=>setRecipientStatus(key)}>{label}</button>)}</div></div>
         {rowsError&&<div className="dca-error" role="alert">{rowsError}</div>}
         {searchLimited&&<div className="dca-error">Search reached the 15,000-row scan limit; narrow your search to see complete results.</div>}
         <div className="dca-table-scroll"><table className="dca-table">
           <thead><tr><th>Recipient</th><th>Status</th><th>Sent</th><th>Open*</th><th>Clicks</th><th>Tracking / Error</th><th></th></tr></thead>
           <tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.name}</strong><span>{row.email}</span></td><td><Flag status={row.status}/></td><td>{shortDate(row.sentAt)}</td><td>{fmt(row.openCount)}</td><td>{fmt(row.clickCount)}</td><td className="dca-row-note">{row.error||row.reason||(row.qualifyVisitAt?'Invitation visited':row.clickedAt?'Clicked':row.openedAt?'Open recorded':'—')}</td><td><button className="dca-row-action" onClick={()=>openRow(row)}>Details <ArrowRight size={13}/></button></td></tr>)}
           {!rows.length&&!rowsBusy&&<tr><td colSpan={7} className="dca-muted">No recipients match this filter.</td></tr>}
           </tbody></table></div>
         {rowsBusy&&<p className="dca-muted">Loading recipients…</p>}
         {recMore&&<button type="button" className="dca-button dca-load" onClick={()=>loadRecipients(true)} disabled={rowsBusy}>Load more recipients <ChevronDown size={15}/></button>}
         <div className="dca-note">Showing {fmt(rows.length)} recipient records. Search is limited to this campaign, and CSV export includes all available pages.</div>
       </section>
     </>}
     </main>
   </div>
   {selected&&<div className="dca-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
     <aside className="dca-drawer" role="dialog" aria-modal="true" aria-label="Individual campaign email details">
       <header><div><span className="dca-eyebrow">INDIVIDUAL EMAIL</span><h3>{selected.name}</h3><p>{selected.email}</p></div><button aria-label="Close recipient details" onClick={()=>setSelected(null)}><X size={20}/></button></header>
       {detailBusy?<p className="dca-muted">Loading event history…</p>:selectedDetails?.error?<p className="dca-error">{selectedDetails.error}</p>:<div className="dca-drawer-body">
         <div className="dca-detail-grid"><Detail label="Campaign" value={campaign?.name}/><Detail label="Status" value={selected.status}/><Detail label="Subject" value={selected.subject}/><Detail label="Sent" value={date(selected.sentAt)}/><Detail label="Send ID" value={selected.sendId}/><Detail label="First open*" value={date(selected.openedAt)}/><Detail label="First click" value={date(selected.clickedAt)}/><Detail label="Invitation visited" value={date(selected.qualifyVisitAt)}/><Detail label="Reply recorded" value={date(selectedDetails?.message?.repliedAt)}/><Detail label="Bounce recorded" value={date(selectedDetails?.message?.bouncedAt)}/><Detail label="Unsubscribed" value={date(selected.unsubscribedAt||selectedDetails?.message?.unsubscribedAt)}/></div>
         {(selected.error||selected.reason||selectedDetails?.message?.bounceReason)&&<p className="dca-error">{selected.error||selected.reason||selectedDetails?.message?.bounceReason}</p>}
         <div className="dca-drawer-metrics"><span><Eye size={15}/>{fmt(selected.openCount)} open events*</span><span><Link2 size={15}/>{fmt(selected.clickCount)} clicks</span></div>
         {selected.leadId&&<button className="dca-button" onClick={()=>setLeadCard({leadId:selected.leadId,source:'coach',name:selected.name})}>Open contact card <ExternalLink size={15}/></button>}
         <h4>Tracking timeline</h4>
         <div>{(selectedDetails?.events||[]).map((e,i)=><div className="dca-event" key={e.id||i}><span>{e.type==='click'?<Link2 size={16}/>:<Eye size={16}/>}</span><div><strong>{e.type==='click'?'Link click':e.type==='open'?'Open pixel request':e.type==='qualify_visit'?'Qualification visit':e.type}</strong><small>{e.link||(e.quality==='automated_or_proxy_possible'?'Proxy/automated possible':'Visitor not verified')}</small></div><time>{date(e.at)}</time></div>)}{!selectedDetails?.events?.length&&<p className="dca-muted">No raw tracking events for this send ID.</p>}</div>
         <p className="dca-note">Open pixels can be triggered by proxies; clicks are tracked redirects, not verified human visits.</p>
       </div>}
     </aside>
   </div>}
   <EngagementContactCard target={leadCard} username={user?.username} onClose={()=>setLeadCard(null)}/>
 </section>;
}
