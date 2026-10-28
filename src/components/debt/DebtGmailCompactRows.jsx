/**
 * Compact, full-contact Gmail engagement roster. Every line shows the same
 * estimated audio and tracked-link milestones available on the large cards.
 */
import { useEffect, useState } from 'react';
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
 const [limit,setLimit]=useState(pageSize);
 useEffect(()=>setLimit(pageSize),[people,pageSize]);
 return <section aria-label={title} className="dcc-email-roster" style={{border:'1px solid #365560',borderRadius:12,overflow:'hidden',background:'#0f1f2c',margin:'0 0 15px'}}>
   <style>{`
     .dcc-email-roster tr:hover td{background:rgba(41,102,92,.12)}
     .dcc-email-roster button:focus-visible{outline:2px solid #d8b168;outline-offset:2px}
     @media(prefers-reduced-motion:reduce){.dcc-email-roster *{transition:none!important}}
   `}</style>
   <div style={{overflowX:'auto',maxHeight:730,overflowY:'auto'}}>
    <table style={{width:'100%',minWidth:1080,borderCollapse:'separate',borderSpacing:0,tableLayout:'fixed'}}>
     <colgroup><col style={{width:'23%'}}/><col style={{width:'14%'}}/><col style={{width:'6%'}}/><col style={{width:'9%'}}/><col style={{width:'8%'}}/><col style={{width:'9%'}}/><col style={{width:'14%'}}/><col style={{width:'5%'}}/><col style={{width:'8%'}}/><col style={{width:'4%'}}/></colgroup>
     <thead><tr><th style={th}>Priority · Contact</th><th style={th}>Audio</th><th style={th}>BBB</th><th style={th}>Trustpilot</th><th style={th}>Company</th><th style={th}>Calendar</th><th style={th}>Milestone</th><th style={th}>Score</th><th style={th}>Activity</th><th style={th}>Open</th></tr></thead>
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
      <td style={td}>{onOpen&&p.leadId&&p.onFile?<button type="button" onClick={()=>onOpen(p)} title={'Open contact '+(p.name||p.email||'')} aria-label={'Open contact '+(p.name||p.email||'')} style={{width:23,height:23,display:'inline-grid',placeItems:'center',borderRadius:6,background:'#1c3936',color:'#9deec6',border:'1px solid #36755c',cursor:'pointer'}}><ExternalLink size={13}/></button>:<span style={{color:'#81939d'}}>—</span>}</td>
     </tr>)}</tbody>
    </table>
    {!people.length&&<div style={{padding:30,textAlign:'center',color:'#93aeb8',fontSize:12}}>No contacts match these filters.</div>}
   </div>
   {people.length>limit&&<div style={{padding:8,textAlign:'center',borderTop:'1px solid #36535b'}}><button onClick={()=>setLimit(n=>n+pageSize)} style={{background:'#1b333f',border:'1px solid #5d7a73',borderRadius:8,color:'#eac476',padding:'7px 14px',cursor:'pointer',fontSize:11,fontWeight:760}}>Show more ({people.length-limit} remaining) <ChevronDown size={13} style={{display:'inline-block',verticalAlign:'middle'}}/></button></div>}
   <div style={{padding:'10px 13px',color:'#8ea5ae',fontSize:10,borderTop:'1px solid #263f4a'}}>Highest milestone and hot-lead contacts are ranked first. Website checks = tracked redirects; audio = estimated playback; calendar open ≠ booked appointment.</div>
 </section>;
}
