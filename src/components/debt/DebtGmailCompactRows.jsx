/**
 * Compact, full-contact Gmail engagement roster. Every line shows the same
 * estimated audio and tracked-link milestones available on the large cards.
 */
import { useEffect, useState } from 'react';
import {base44} from '@/api/base44Client';
import {useDebtCoachAuth} from '@/lib/DebtCoachAuthContext';
import EngagementContactCard from '@/components/engagement/EngagementContactCard';
import { Check, ChevronDown, Crown, ExternalLink, Flame, Headphones, Medal, Sparkles } from 'lucide-react';

const time=s=>s?new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const th={textAlign:'left',whiteSpace:'nowrap',padding:'8px 8px',fontSize:10,letterSpacing:.4,color:'#a8bdc2',background:'#152936',borderBottom:'1px solid #416068',position:'sticky',top:0,zIndex:2};
const td={padding:'5px 8px',fontSize:11,borderBottom:'1px solid #253e49',verticalAlign:'middle',height:42};
const milestoneName=p=>p.eliteJourney?'ELITE JOURNEY':p.allLinksAndAudio?'ALL LINKS + AUDIO':p.goldListener?'GOLD LISTENER':p.hotLead?'HOT LEAD':'—';

export function CompactAudioProgress({percent=0,gold=false,estimated=false,name=''}) {
 const pct=Math.round(Math.max(0,Math.min(100,Number(percent)||0)));
 return <div title={gold?(estimated?'Estimated full audio playback':'Audio completion event recorded'):'Estimated audio playback '+pct+'%'} style={{minWidth:122,display:'flex',alignItems:'center',gap:7}}>
   <Headphones size={12} aria-hidden="true" style={{flexShrink:0,color:gold?'#eac474':'#82aca9'}}/>
   <div role="progressbar" aria-label={name+' estimated audio progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{flex:1,minWidth:62,border:'1px solid #3a5160',background:'#061925',height:8,padding:1,borderRadius:99,overflow:'hidden'}}>
     <div style={{height:'100%',width:pct+'%',borderRadius:99,transition:'width .35s',background:gold?'linear-gradient(90deg,#9c762c,#e2b74a,#fbe6a3)':pct>=75?'linear-gradient(90deg,#287c71,#56d4a4)':pct>=25?'linear-gradient(90deg,#305d87,#79b2e9)':'#4f7286',boxShadow:gold?'0 0 8px #dfb8559a':'none'}}/>
   </div>
   <strong style={{fontSize:11,color:gold?'#f5d68e':'#cce6e6',fontVariantNumeric:'tabular-nums',minWidth:32,textAlign:'right'}}>{pct}%</strong>
 </div>;
}
export function CompactSignal({checked,label,description}) {
 return <span title={description+(checked?' recorded':' not recorded')} aria-label={label+': '+(checked?'recorded':'not recorded')} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 5px',minHeight:19,borderRadius:5,whiteSpace:'nowrap',fontSize:10,fontWeight:checked?780:510,color:checked?'#8ee6b9':'#849aa7',background:checked?'#1a3c36':'#1b2b36',border:'1px solid '+(checked?'#367d67':'#304650')}}>
   {checked?<Check size={12} strokeWidth={3}/>:<span style={{display:'inline-block',width:12,textAlign:'center'}}>—</span>}{label}
 </span>;
}
export function CompactMilestone({person:p}) {
 const label=milestoneName(p);
 if(label==='—')return <span style={{color:'#7d919d'}}>—</span>;
 const Icon=p.eliteJourney?Crown:p.allLinksAndAudio?Sparkles:p.goldListener?Medal:Flame;
 const gold=p.goldListener||p.allLinksAndAudio;
 return <span title={label==='HOT LEAD'?'Corroborated activity; not purchase probability':label} style={{display:'inline-flex',gap:4,alignItems:'center',padding:'4px 6px',borderRadius:99,whiteSpace:'nowrap',fontWeight:830,fontSize:9,letterSpacing:'.2px',color:gold?'#f7d78c':'#ffaf8a',background:gold?'linear-gradient(115deg,#3b2b18,#312b24)':'#382621',border:'1px solid '+(gold?'#b89446':'#9d5446')}}><Icon size={11}/>{label}</span>;
}
export default function DebtGmailCompactRows({people=[],onOpen,title='Contact engagement list',pageSize=40}) {
 const {sessionUserId,sessionToken,user}=useDebtCoachAuth();
 const [limit,setLimit]=useState(pageSize);
 const [meta,setMeta]=useState({}),[meeting,setMeeting]=useState(null),[aiTarget,setAiTarget]=useState(null),[aiText,setAiText]=useState(''),[aiReply,setAiReply]=useState(''),[aiDraft,setAiDraft]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const stamp=x=>x?new Date(x).toLocaleString('en-US',{month:'numeric',day:'numeric',year:'2-digit',hour:'numeric',minute:'2-digit'}).replace(', ',' '):'Never';
 useEffect(()=>{let cancelled=false;const ids=[...new Set(people.slice(0,limit).map(p=>p.leadId).filter(Boolean))];Promise.all(ids.map(async id=>{try{const lead=await base44.entities.DebtLead.get(id);return [id,{phone:lead.phone,lastCallAt:lead.lastCallAt,outcome:lead.appointmentDate?'Scheduled Appointment':''}]}catch{return [id,{}]}})).then(list=>{if(!cancelled)setMeta(m=>({...m,...Object.fromEntries(list)}))});return()=>{cancelled=true}},[people,limit]);
 const log=async(p,result)=>{if(!p.leadId)return;setBusy(true);setNotice('');try{const lead=await base44.entities.DebtLead.get(p.leadId);const at=new Date().toISOString();await base44.entities.DebtLeadActivity.create({leadId:p.leadId,leadName:p.name,activityType:'call',activityText:result==='left_voicemail'?'Outgoing call — Left voicemail':'Outgoing call — No answer',createdBy:user?.username||'',metadataJson:JSON.stringify({result,source:'engagement_journal'})});await base44.entities.DebtLead.update(p.leadId,{lastCallAt:at,callCount:Number(lead.callCount||0)+1});setMeta(m=>({...m,[p.leadId]:{...m[p.leadId],lastCallAt:at,outcome:result==='left_voicemail'?'Left VM':'No Answer'}}))}catch(e){setNotice(e.message||'Unable to save call')}finally{setBusy(false)}};
 const schedule=async()=>{setBusy(true);setNotice('');try{const start=new Date(meeting.when);if(!Number.isFinite(start.getTime())||start<=new Date())throw Error('Choose a future appointment');const r=await base44.functions.invoke('googleCalendarSync',{action:'saveLeadAppointment',sessionUserId,sessionToken,leadId:meeting.p.leadId,startISO:start.toISOString(),title:meeting.label,duration:meeting.duration,description:meeting.notes,sendReminderEmails:meeting.reminders,reminders:meeting.reminders?[{method:'email',minutes:1440},{method:'email',minutes:60}]:[]});const data=r?.data||r;if(data.status!=='success')throw Error(data.error||'Calendar failed');setMeta(m=>({...m,[meeting.p.leadId]:{...m[meeting.p.leadId],outcome:'Scheduled Appointment'}}));setMeeting(null);setNotice('Appointment saved')}catch(e){setNotice(e?.response?.data?.error||e.message)}finally{setBusy(false)}};
 const ask=async()=>{if(!aiTarget?.leadId||!aiText.trim())return;setBusy(true);try{const lead=await base44.entities.DebtLead.get(aiTarget.leadId);const fields=['firstName','lastName','phone','email','address','city','state','zip','debtAmount','notes','monthlyIncome','creditorCount'];const current=Object.fromEntries(fields.map(k=>[k,lead[k]??null]));const res=await base44.integrations.Core.InvokeLLM({prompt:`You are a debt CRM contact assistant. Current fields: ${JSON.stringify(current)}. Operator request: ${aiText}. Allowed updates: ${fields.join(',')}. Only propose facts explicitly provided; respond JSON with reply:string, updates:object.`,response_json_schema:{type:'object',properties:{reply:{type:'string'},updates:{type:'object',additionalProperties:true}},required:['reply','updates']}});const data=res?.data||res;setAiReply(data.reply||'Review proposed fields');setAiDraft(Object.fromEntries(Object.entries(data.updates||{}).filter(([k,v])=>fields.includes(k)&&v!==null&&v!==undefined)))}catch(e){setAiReply(e.message)}finally{setBusy(false)}};
 const saveAI=async()=>{setBusy(true);try{await base44.entities.DebtLead.update(aiTarget.leadId,aiDraft);await base44.entities.DebtLeadActivity.create({leadId:aiTarget.leadId,leadName:aiTarget.name,activityType:'note',activityText:'AI-assisted contact update: '+Object.keys(aiDraft).join(', '),createdBy:user?.username||''});setAiReply('Contact updated');setAiDraft(null)}catch(e){setAiReply(e.message)}finally{setBusy(false)}};

 useEffect(()=>setLimit(pageSize),[people,pageSize]);
 return <section aria-label={title} className="dcc-email-roster" style={{border:'1px solid #365560',borderRadius:12,overflow:'hidden',background:'#0f1f2c',margin:'0 0 15px'}}>
   <style>{`
     .dcc-email-roster tr:hover td{background:rgba(41,102,92,.12)}
     .dcc-email-roster button:focus-visible{outline:2px solid #d8b168;outline-offset:2px}
     @media(prefers-reduced-motion:reduce){.dcc-email-roster *{transition:none!important}}
   `}</style>
   <div style={{overflowX:'auto',maxHeight:730,overflowY:'auto'}}>
    <table style={{width:'100%',minWidth:1770,borderCollapse:'separate',borderSpacing:0,tableLayout:'fixed'}}>
     <colgroup><col style={{width:'23%'}}/><col style={{width:'14%'}}/><col style={{width:'6%'}}/><col style={{width:'9%'}}/><col style={{width:'8%'}}/><col style={{width:'9%'}}/><col style={{width:'14%'}}/><col style={{width:'5%'}}/><col style={{width:'8%'}}/><col style={{width:'4%'}}/></colgroup>
     <thead><tr><th style={th}>Priority · Contact</th><th style={th}>Audio</th><th style={th}>BBB</th><th style={th}>Trustpilot</th><th style={th}>Company</th><th style={th}>Calendar</th><th style={th}>Milestone</th><th style={th}>Score</th><th style={th}>Activity</th><th style={th}>Phone</th><th style={th}>Last Called / Outcome</th><th style={th}>Actions</th></tr></thead>
     <tbody>{people.slice(0,limit).map((p,i)=><tr key={p.id||p.email||i} style={{background:p.allLinksAndAudio?'linear-gradient(90deg,#30281c,#182630 55%,#152727)':p.hotLead?'#26251e':'transparent'}}>
      <td style={{...td,borderLeft:'3px solid '+(p.allLinksAndAudio?'#e2b658':p.hotLead?'#e09f54':p.goldListener?'#c6a456':'transparent')}}>
       <div title={[p.name,p.email,p.lastTemplate,(p.sent||0)+' emails sent'].filter(Boolean).join(' · ')} style={{display:'flex',gap:6,alignItems:'center',maxWidth:'100%',minWidth:0}}>
        {i<3&&(p.hotLead||p.allLinksAndAudio)&&<strong style={{color:'#e9c577',fontSize:10,flexShrink:0}}>{i+1}.</strong>}
        <button type="button" onClick={()=>onOpen?.(p)} disabled={!onOpen||!p.leadId||!p.onFile} style={{color:'#f3f7f0',background:'none',border:0,fontSize:11,fontWeight:800,padding:0,cursor:onOpen&&p.onFile?'pointer':'default',textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0,maxWidth:135,flexShrink:0}}>{p.name||p.email||'Unknown'}</button>
        {p.hotLead&&<Flame size={12} color="#eab86d" style={{flexShrink:0}}/>}
        <span style={{fontSize:10,color:'#9db2bb',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0,flex:1}}>{p.email}</span>
       </div>
      </td>
      <td style={td}><CompactAudioProgress name={p.name||p.email||'Contact'} percent={p.percent} gold={p.goldListener} estimated={p.estimated}/></td>
      <td style={td}><CompactSignal checked={p.flags?.bbb} label="BBB" description="Tracked BBB link"/></td>
      <td style={td}><CompactSignal checked={p.flags?.trustpilot} label="Review" description="Tracked Trustpilot link"/></td>
      <td style={td}><CompactSignal checked={p.flags?.company} label="Site" description="Tracked company website link"/></td>
      <td style={td}><CompactSignal checked={p.flags?.calendar} label="Open" description="Booking calendar opened, not booked"/></td>
      <td style={td}><CompactMilestone person={p}/></td>
      <td style={td}><strong style={{fontSize:13,color:p.score>=60?'#eac678':'#60deb2'}}>{p.score||0}</strong><span style={{color:'#849ca5',fontSize:10}}>/100</span></td>
      <td style={{...td,color:'#9fb6bf',fontSize:10,whiteSpace:'nowrap'}}>{time(p.lastEngagementAt||p.lastAt)}</td>
      <td style={td}><strong style={{fontSize:16,color:'#e8c780'}}>{meta[p.leadId]?.phone||p.phone||'—'}</strong></td>
      <td style={td}>{stamp(meta[p.leadId]?.lastCallAt)}{meta[p.leadId]?.outcome?' · '+meta[p.leadId].outcome:''}</td>
      <td style={td}><div style={{display:'flex',gap:4,whiteSpace:'nowrap'}}>{[['Contact Card',()=>onOpen?.(p)],['No Answer',()=>log(p,'no_answer')],['Left VM',()=>log(p,'left_voicemail')],['Meeting',()=>setMeeting({p,when:'',label:'Consultation',notes:'',duration:30,reminders:true})],['✦ AI',()=>{setAiTarget(p);setAiReply('');setAiDraft(null);setAiText('')}]].map(([label,fn])=><button key={label} disabled={!p.leadId||busy} onClick={fn} style={{padding:'4px 6px',borderRadius:5,border:'1px solid #48685e',background:'#1b3337',color:'#e4e9df',fontSize:10,cursor:'pointer'}}>{label}</button>)}</div></td>
     </tr>)}</tbody>
    </table>
    {!people.length&&<div style={{padding:30,textAlign:'center',color:'#93aeb8',fontSize:12}}>No contacts match these filters.</div>}
   </div>
   {people.length>limit&&<div style={{padding:8,textAlign:'center',borderTop:'1px solid #36535b'}}><button onClick={()=>setLimit(n=>n+pageSize)} style={{background:'#1b333f',border:'1px solid #5d7a73',borderRadius:8,color:'#eac476',padding:'7px 14px',cursor:'pointer',fontSize:11,fontWeight:760}}>Show more ({people.length-limit} remaining) <ChevronDown size={13} style={{display:'inline-block',verticalAlign:'middle'}}/></button></div>}
   {notice&&<div role="status" style={{padding:8,color:'#f3d49b'}}>{notice}</div>}
   {meeting&&<div style={{position:'fixed',inset:0,background:'#000b',zIndex:40000,display:'grid',placeItems:'center'}}><section role="dialog" aria-modal="true" aria-label="Schedule appointment" style={{padding:24,background:'#112536',color:'#e6f4ed',borderRadius:12,width:420,maxWidth:'95vw',display:'grid',gap:10}}><h3>Schedule · {meeting.p.name}</h3><label>Label <input value={meeting.label} onChange={e=>setMeeting(m=>({...m,label:e.target.value}))}/></label><label>Date / Time <input type="datetime-local" value={meeting.when} onChange={e=>setMeeting(m=>({...m,when:e.target.value}))}/></label><label>Minutes <select value={meeting.duration} onChange={e=>setMeeting(m=>({...m,duration:Number(e.target.value)}))}><option>15</option><option>30</option><option>60</option></select></label><label>Notes <textarea value={meeting.notes} onChange={e=>setMeeting(m=>({...m,notes:e.target.value}))}/></label><label><input type="checkbox" checked={meeting.reminders} onChange={e=>setMeeting(m=>({...m,reminders:e.target.checked}))}/> Send appointment reminder emails (night before / one hour)</label><small>Requires configured Gmail reminder automation and a valid client email.</small><div style={{display:'flex',gap:8}}><button disabled={busy||!meeting.when||!meeting.label} onClick={schedule}>Create</button><button onClick={()=>setMeeting(null)}>Cancel</button></div></section></div>}
   {aiTarget&&<div style={{position:'fixed',inset:0,background:'#000b',zIndex:40000,display:'grid',placeItems:'center'}}><section role="dialog" aria-modal="true" aria-label="Contact AI" style={{padding:24,background:'#112536',color:'#e6f4ed',borderRadius:12,width:430,maxWidth:'95vw',display:'grid',gap:10}}><h3>✦ Contact AI · {aiTarget.name}</h3><textarea value={aiText} onChange={e=>setAiText(e.target.value)} placeholder="Describe contact updates…"/><button onClick={ask} disabled={busy}>Ask AI</button><p>{aiReply}</p>{aiDraft&&Object.keys(aiDraft).length>0&&<><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(aiDraft,null,2)}</pre><button onClick={saveAI} disabled={busy}>Approve and Save</button></>}<button onClick={()=>setAiTarget(null)}>Close</button></section></div>}
   <div style={{padding:'10px 13px',color:'#8ea5ae',fontSize:10,borderTop:'1px solid #263f4a'}}>Highest milestone and hot-lead contacts are ranked first. Website checks = tracked redirects; audio = estimated playback; calendar open ≠ booked appointment.</div>
 </section>;
}
