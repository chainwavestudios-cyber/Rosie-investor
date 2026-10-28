
/**
 * Read-only Gmail Campaign View for Debt Call Coach Email Engagement.
 * Uses authenticated debtEmailCampaignView server reports. Legacy remains separate.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useDebtCoachAuth} from '@/lib/DebtCoachAuthContext';
import EngagementContactCard from '@/components/engagement/EngagementContactCard';
import {CompactAudioProgress,CompactSignal,CompactMilestone} from './DebtGmailCompactRows';
import {aggregateMilestones,engagementPriority,linkCategory} from '@/lib/coachGmailMilestones';
import {Archive,ArrowRight,BarChart3,CalendarClock,CheckCircle2,ChevronDown,Download,Eye,ExternalLink,FileText,HelpCircle,Inbox,Layers3,Link2,Mail,MousePointerClick,RefreshCw,Search,Send,Settings2,ShieldCheck,Users,X,AlertTriangle} from 'lucide-react';
import './DebtEmailCampaignAnalytics.css';

const n=v=>Number.isFinite(Number(v))?Number(v):0;
const fmt=v=>n(v).toLocaleString('en-US');
const pct=(a,b)=>b?Math.round(n(a)/n(b)*100)+'%':'—';
const date=v=>v&&!isNaN(new Date(v).getTime())?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const callStamp=v=>v&&!isNaN(new Date(v).getTime())?new Date(v).toLocaleString('en-US',{month:'numeric',day:'numeric',year:'2-digit',hour:'numeric',minute:'2-digit'}).replace(', ',' '):'Never';
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
 const [activeId,setActiveId]=useState(()=>{try{return new URLSearchParams(window.location.search).get('campaignId')||''}catch{return ''}}),[report,setReport]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [rows,setRows]=useState([]),[recCursor,setRecCursor]=useState(null),[recOffset,setRecOffset]=useState(0),[recMore,setRecMore]=useState(false);
 const [recipientStatus,setRecipientStatus]=useState('all'),[search,setSearch]=useState(''),[searchValue,setSearchValue]=useState(''),[rowsBusy,setRowsBusy]=useState(false),[rowsError,setRowsError]=useState(''),[searchLimited,setSearchLimited]=useState(false);
 const [detailsOpen,setDetailsOpen]=useState(true),[selected,setSelected]=useState(null),[selectedDetails,setSelectedDetails]=useState(null),[detailBusy,setDetailBusy]=useState(false);
 const [quickBusy,setQuickBusy]=useState(''),[actionNote,setActionNote]=useState(''),[meeting,setMeeting]=useState(null),[aiTarget,setAiTarget]=useState(null),[aiInput,setAiInput]=useState(''),[aiHistory,setAiHistory]=useState([]),[aiProposal,setAiProposal]=useState(null);
 const [contactMeta,setContactMeta]=useState({});
 const [gmailSends,setGmailSends]=useState([]);
 const [leadCard,setLeadCard]=useState(null),[exporting,setExporting]=useState(false),[exportNote,setExportNote]=useState('');
 const selectedRef=useRef(activeId);
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
 useEffect(()=>{
   let cancelled=false;
   const ids=[...new Set(rows.map(r=>r.leadId).filter(Boolean))];
   if(!ids.length)return;
   // Fetch the actual contact-card phone and call history; never infer a call from email engagement.
   Promise.all(ids.map(async id=>{try{const lead=await base44.entities.DebtLead.get(id);return [id,{phone:lead.phone||'',lastCallAt:lead.lastCallAt||null,outcome:lead.appointmentDate && (!lead.lastCallAt||new Date(lead.appointmentDate)>new Date(lead.lastCallAt))?'Scheduled Appointment':''}]}catch{return [id,null]}})).then(values=>{
     if(!cancelled)setContactMeta(prev=>({...prev,...Object.fromEntries(values.filter(([,v])=>v))}));
   });
   return ()=>{cancelled=true};
 },[rows]);
 useEffect(()=>{
   if(!isAdmin||!sessionToken)return;
   let cancelled=false;
   base44.functions.invoke('sendDebtEmail',{action:'gmailReport',sessionUserId,sessionToken,days:365,view:'report'})
     .then(r=>{if(!cancelled)setGmailSends((r?.data||r)?.timeline||[])}).catch(()=>{if(!cancelled)setGmailSends([])});
   return ()=>{cancelled=true};
 },[sessionUserId,sessionToken,isAdmin]);
 const campaignSignals=useMemo(()=>{
   const lookup=new Map();for(const send of gmailSends){if(send.sendId)lookup.set(String(send.sendId),send)}
   return new Map(rows.map(r=>{
     // Strict per-send matching prevents other campaigns influencing this campaign's journal.
     const send=lookup.get(String(r.sendId||''));
     const milestone=aggregateMilestones(send?[send]:[]);
     // The campaign itself records per-recipient tracked redirects even if the Gmail report window omits them.
     const flags={...milestone.flags};for(const entry of r.links||[]){const cat=linkCategory(entry.link||entry.url);if(cat&&cat in flags)flags[cat]=true}
     flags.calendar ||= !!r.qualifyVisitAt;
     const percent=milestone.percent;
     const allLinksAndAudio=milestone.goldListener&&flags.bbb&&flags.trustpilot&&flags.company;
     const eliteJourney=allLinksAndAudio&&flags.calendar;
     const val={...milestone,flags,percent,allLinksAndAudio,eliteJourney,hotLead:n(r.clickCount)>1||!!r.qualifyVisitAt,score:Math.min(100,Math.round((percent>=98?22:percent>=75?16:percent>=25?8:percent>0?3:0)+(flags.bbb?15:0)+(flags.trustpilot?15:0)+(flags.company?15:0)+(flags.calendar?18:0)+Math.min(15,n(r.clickCount)*3)+(r.openedAt?4:0)+Math.min(6,Math.max(0,n(r.openCount)-1))))};
     return [r.id,val];
   }));
 },[rows,gmailSends]);
 const orderedRows=useMemo(()=>[...rows].sort((a,b)=>{
   const score=x=>engagementPriority(campaignSignals.get(x.id)||{})*100+Number(campaignSignals.get(x.id)?.score||0);
   return score(b)-score(a) || new Date(b.sentAt||0)-new Date(a.sentAt||0);
 }),[rows,campaignSignals]);
 const activity=async(row,result)=>{
   if(!row.leadId){setActionNote('This recipient has no linked contact card.');return;}
   setQuickBusy(row.id+result);setActionNote('');
   try{
     const lead=await base44.entities.DebtLead.get(row.leadId);
     await base44.entities.DebtLeadActivity.create({leadId:row.leadId,leadName:row.name,activityType:'call',activityText:result==='left_voicemail'?'☎ Outgoing call — Left voicemail':'📞 Outgoing call — No answer',createdBy:user?.username||'',metadataJson:JSON.stringify({result,source:'email_campaign',campaignId:activeId})});
     const calledAt=new Date().toISOString();
     await base44.entities.DebtLead.update(row.leadId,{lastCallAt:calledAt,callCount:n(lead.callCount)+1});
     setContactMeta(prev=>({...prev,[row.leadId]:{...prev[row.leadId],lastCallAt:calledAt,outcome:result==='left_voicemail'?'Left VM':'No Answer'}}));
     setActionNote(`${row.name}: ${result==='left_voicemail'?'voicemail':'no answer'} saved.`);
   }catch(e){setActionNote('Could not save call outcome: '+(e?.message||String(e)))}finally{setQuickBusy('')}
 };
 const book=async()=>{
   if(!meeting?.row?.leadId||!meeting.when||!meeting.label?.trim())return;
   setQuickBusy('meeting');setActionNote('');try{
     const start=new Date(meeting.when);if(!Number.isFinite(start.getTime())||start<=new Date())throw Error('Choose a future date and time');
     const description=`${meeting.notes||''}\n\nContact: ${meeting.row.name}\nPhone: ${meeting.row.phone||''}\nEmail: ${meeting.row.email}`;
     const result=await base44.functions.invoke('googleCalendarSync',{action:'saveLeadAppointment',sessionUserId,sessionToken,leadId:meeting.row.leadId,title:meeting.label.trim(),startISO:start.toISOString(),duration:Number(meeting.duration||30),description,reminders:meeting.reminders?[{method:'email',minutes:1440},{method:'email',minutes:60}]:[]});
     const data=result?.data||result;if(data.status!=='success')throw Error(data.error||'Calendar unavailable');
     setContactMeta(prev=>({...prev,[meeting.row.leadId]:{...prev[meeting.row.leadId],outcome:'Scheduled Appointment',lastCallAt:new Date().toISOString()}}));
     setActionNote('Meeting scheduled for '+meeting.row.name);setMeeting(null);
   }catch(e){setActionNote('Schedule failed: '+(e?.response?.data?.error||e?.message||String(e)))}finally{setQuickBusy('')}
 };
 const askAI=async()=>{
   if(!aiInput.trim()||!aiTarget?.leadId)return;
   const message=aiInput.trim();setAiInput('');setQuickBusy('ai');setAiProposal(null);
   try{
     const lead=await base44.entities.DebtLead.get(aiTarget.leadId);
     const allowed=['firstName','lastName','phone','email','address','city','state','zip','debtAmount','creditorCount','monthlyIncome','employmentStatus','notes','callbackAt'];
     const current=Object.fromEntries(allowed.map(k=>[k,lead[k]??null]));
     const result=await base44.integrations.Core.InvokeLLM({prompt:`You assist a human operator editing a debt CRM contact. Interpret the operator's request as a conversation, answer briefly, and propose ONLY explicit contact field changes. Never assume new facts. Allowed fields: ${allowed.join(', ')}. Current contact: ${JSON.stringify(current)}. Operator says: ${message}. Return JSON object with reply:string and updates:object; no other fields. Do not send emails, call people or book appointments.`,response_json_schema:{type:'object',properties:{reply:{type:'string'},updates:{type:'object',additionalProperties:true}},required:['reply','updates']}});
     const data=result?.data||result;const updates=Object.fromEntries(Object.entries(data.updates||{}).filter(([k,v])=>allowed.includes(k)&&v!==null&&v!==undefined));
     setAiHistory(h=>[...h,{who:'You',text:message},{who:'Assistant',text:data.reply||'Here are my proposed changes.'}]);if(Object.keys(updates).length)setAiProposal(updates);
   }catch(e){setAiHistory(h=>[...h,{who:'System',text:'AI request failed: '+(e?.message||String(e))}])}finally{setQuickBusy('')}
 };
 const applyAI=async()=>{if(!aiTarget?.leadId||!aiProposal)return;setQuickBusy('aiSave');try{await base44.entities.DebtLead.update(aiTarget.leadId,aiProposal);await base44.entities.DebtLeadActivity.create({leadId:aiTarget.leadId,leadName:aiTarget.name,activityType:'note',activityText:'AI-assisted contact update: '+Object.keys(aiProposal).join(', '),createdBy:user?.username||''});setAiHistory(h=>[...h,{who:'System',text:'Contact card updated.'}]);setAiProposal(null)}catch(e){setActionNote('AI update failed: '+(e?.message||String(e)))}finally{setQuickBusy('')}};
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
   <div className="dca-scope"><ShieldCheck size={15}/> Email Campaigns only. Historical Gmail records remain in Legacy Tracking. Campaign sending is unchanged. Contact actions update linked contact cards.</div>
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
         <div className="dca-recipient-head"><div><div className="dca-eyebrow">CAMPAIGN ENGAGEMENT JOURNAL</div><h3 style={{margin:"4px 0",fontSize:23}}>{campaign.name}</h3><p style={{margin:"2px 0"}}>Individual recipients · Email opens, audio, links, calling activity and quick actions</p></div><span className="dca-count">{fmt(total)} records</span></div>
         <div className="dca-toolbar"><label className="dca-search"><Search size={15}/><input aria-label="Search recipients across selected campaign" placeholder="Search name, email, subject, send ID…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="dca-filter-row">{recipientStatuses.map(([key,label])=><button key={key} className={recipientStatus===key?'active':''} onClick={()=>setRecipientStatus(key)}>{label}</button>)}</div></div>
         {rowsError&&<div className="dca-error" role="alert">{rowsError}</div>}{actionNote&&<div role="status" className="dca-note">{actionNote}</div>}
         {searchLimited&&<div className="dca-error">Search reached the 15,000-row scan limit; narrow your search to see complete results.</div>}
         <div className="dca-table-scroll" style={{overflowX:'auto'}}><table className="dca-table" style={{minWidth:1730,width:'100%',whiteSpace:'nowrap',borderCollapse:'collapse'}}>
           <thead><tr>{['Contact','Email Opened','Audio','BBB','Trustpilot','Company','Calendar','Milestone','Score','Activity','Phone','Last Called','Actions'].map(k=><th key={k} style={{padding:'7px 8px',fontSize:10}}>{k}</th>)}</tr></thead>
           <tbody>{orderedRows.map(row=>{
             const info=campaignSignals.get(row.id)||{};
             const cell={padding:'5px 7px',height:43,verticalAlign:'middle',fontSize:11};
             const btn={padding:'4px 7px',fontSize:10,whiteSpace:'nowrap'};
             return <tr key={row.id} style={{height:43}}>
               <td style={{...cell,maxWidth:185,overflow:'hidden',textOverflow:'ellipsis'}} title={row.email}><strong>{row.name}</strong> <span style={{fontSize:10,color:'#90a6ad'}}>{row.email}</span></td>
               <td style={cell}><span title={row.openedAt?`Tracked open request · ${n(row.openCount)} recorded · first ${date(row.openedAt)}. Email image requests may be automated.`:'No open request recorded'} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:row.openedAt?'#94e6b9':'#8899a3',fontWeight:row.openedAt?800:400}}>{row.openedAt?'✓ Opened':'— Not opened'}{row.openedAt&&<span style={{fontSize:10,color:'#c1d1d2'}}>({n(row.openCount)})</span>}</span></td>
               <td style={cell}><CompactAudioProgress name={row.name} percent={info.percent||0} gold={info.goldListener} estimated={info.estimated}/></td>
               <td style={cell}><CompactSignal checked={info.flags?.bbb} label="BBB" description="Tracked BBB link"/></td>
               <td style={cell}><CompactSignal checked={info.flags?.trustpilot} label="Review" description="Tracked Trustpilot link"/></td>
               <td style={cell}><CompactSignal checked={info.flags?.company} label="Site" description="Tracked company link"/></td>
               <td style={cell}><CompactSignal checked={info.flags?.calendar} label="Open" description="Calendar or qualification visit recorded; not a booking"/></td>
               <td style={cell}><CompactMilestone person={info}/></td>
               <td style={cell}><strong>{info.score||0}</strong>/100</td>
               <td style={cell}>{shortDate(info.lastEngagementAt||row.clickedAt||row.openedAt||row.sentAt)}</td>
               <td style={cell}><strong style={{fontSize:17,color:'#eac784'}}>{contactMeta[row.leadId]?.phone||row.phone||'—'}</strong></td>
               <td style={cell}>{callStamp(contactMeta[row.leadId]?.lastCallAt)}{contactMeta[row.leadId]?.outcome?' · '+contactMeta[row.leadId].outcome:''}</td>
               <td style={cell}><div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'nowrap'}}>
                 <button className="dca-row-action" style={btn} disabled={!row.leadId} onClick={()=>setLeadCard({leadId:row.leadId,source:'coach',name:row.name})}>Contact Card</button>
                 <button className="dca-row-action" style={btn} disabled={!row.leadId||!!quickBusy} onClick={()=>activity(row,'no_answer')}>No Answer</button>
                 <button className="dca-row-action" style={btn} disabled={!row.leadId||!!quickBusy} onClick={()=>activity(row,'left_voicemail')}>Voicemail</button>
                 <button className="dca-row-action" style={btn} disabled={!row.leadId} onClick={()=>setMeeting({row,when:'',label:'Consultation',notes:'',duration:30,reminders:true})}>Meeting</button>
                 <button className="dca-row-action" style={btn} disabled={!row.leadId} onClick={()=>{setAiTarget(row);setAiHistory([]);setAiProposal(null);setAiInput('')}}>✦ AI</button>
               </div></td>
             </tr>})}
           {!rows.length&&!rowsBusy&&<tr><td colSpan={13} className="dca-muted">No recipients match this filter.</td></tr>}
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
   {meeting&&<div className="dca-overlay"><section className="dca-drawer" role="dialog" aria-modal="true" aria-label="Schedule meeting" style={{padding:24}}><h3>Schedule appointment · {meeting.row.name}</h3>
     <label style={{display:'block',marginBottom:12}}>Appointment label <input style={{display:'block',width:'100%'}} value={meeting.label} onChange={e=>setMeeting(m=>({...m,label:e.target.value}))}/></label>
     <label style={{display:'block',marginBottom:12}}>Date and time <input style={{display:'block'}} type="datetime-local" value={meeting.when} onChange={e=>setMeeting(m=>({...m,when:e.target.value}))}/></label>
     <label style={{display:'block',marginBottom:12}}>Duration <select value={meeting.duration} onChange={e=>setMeeting(m=>({...m,duration:Number(e.target.value)}))}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></label>
     <label style={{display:'block',marginBottom:12}}>Appointment notes <textarea style={{display:'block',width:'100%',minHeight:85}} value={meeting.notes} onChange={e=>setMeeting(m=>({...m,notes:e.target.value}))}/></label>
     <label style={{display:'block',marginBottom:12}}><input type="checkbox" checked={meeting.reminders} onChange={e=>setMeeting(m=>({...m,reminders:e.target.checked}))}/> Enable calendar email reminders (1 day and 1 hour before)</label>
     <p style={{fontSize:11,color:'#aec3c4'}}>Google Calendar email reminders notify the calendar owner, not automatically the customer.</p>
     <div style={{display:'flex',gap:8,marginTop:20}}><button className="dca-button" disabled={!meeting.when||!meeting.label?.trim()||!!quickBusy} onClick={book}>Create Appointment</button><button className="dca-button" onClick={()=>setMeeting(null)}>Cancel</button></div></section></div>}
   {aiTarget&&<div className="dca-overlay"><section className="dca-drawer" role="dialog" aria-modal="true" aria-label="AI contact assistant" style={{padding:24}}><h3>✦ Contact AI · {aiTarget.name}</h3><p className="dca-muted">Ask questions or describe changes. Review updates before saving to the contact card.</p><div style={{maxHeight:250,overflowY:'auto',marginBottom:12}}>{aiHistory.map((m,i)=><p key={i}><strong>{m.who}: </strong>{m.text}</p>)}</div><textarea style={{width:'100%',minHeight:80,background:'#0d1b2a',color:'#fff'}} value={aiInput} onChange={e=>setAiInput(e.target.value)} placeholder="Example: Update their phone number, add a callback note, change the debt amount…"/><button className="dca-button" disabled={!!quickBusy||!aiInput.trim()} onClick={askAI}>Send to AI</button>{aiProposal&&<div style={{marginTop:15}}><h4>Review changes</h4><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(aiProposal,null,2)}</pre><button className="dca-button" disabled={!!quickBusy} onClick={applyAI}>Approve and update contact</button></div>}<button className="dca-button" style={{marginLeft:8}} onClick={()=>setAiTarget(null)}>Close</button></section></div>}
   <EngagementContactCard target={leadCard} username={user?.username} onClose={()=>setLeadCard(null)}/>
 </section>;
}
