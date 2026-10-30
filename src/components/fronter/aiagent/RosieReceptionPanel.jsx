import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const textInput={width:'100%',boxSizing:'border-box',padding:'10px 12px',background:'#0a1120',color:'#f3eee3',border:'1px solid #354254',borderRadius:8,fontSize:13};
const group={background:'#0d1727',padding:20,borderRadius:12,border:'1px solid #2e394b'};
const label={display:'block',color:'#97a7ba',fontSize:11,fontWeight:700,marginBottom:7};
function formatDate(iso){try{return new Date(iso).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});}catch{return iso||'—';}}
export default function RosieReceptionPanel(){
  const { sessionUserId, sessionToken } = useDebtCoachAuth();
  const credentials={sessionUserId,sessionToken};
  const [config,setConfig]=useState(null),[records,setRecords]=useState([]);
  const [saving,setSaving]=useState(false),[loading,setLoading]=useState(true),[feedback,setFeedback]=useState('');
  const refresh=useCallback(async()=>{
    setFeedback('');
    try{
      const res=await base44.functions.invoke('rosieReceptionAdmin',{action:'status',...credentials});
      const data=res?.data||res;
      setConfig(data.config);
      setRecords(data.records||[]);
    }catch(e){setFeedback(e?.response?.data?.error||e?.message||'Cannot load Rosie corporate receptionist');}
    setLoading(false);
  },[sessionUserId,sessionToken]);
  useEffect(()=>{refresh()},[refresh]);
  const update=(key,value)=>setConfig(prev=>({...prev,[key]:value}));
  const save=async()=>{
    setSaving(true);setFeedback('');
    try {
      const res=await base44.functions.invoke('rosieReceptionAdmin',{action:'save',config,...credentials});
      const data=res?.data||res;
      setConfig(data.config);
      setRecords(data.records||[]);
      setFeedback('Rosie corporate receptionist settings saved.');
    }catch(e){setFeedback(e?.response?.data?.error||e?.message||'Save failed');}
    setSaving(false);
  };
  if(loading)return <div style={{padding:30,color:'#94a3b8'}}>Loading corporate reception…</div>;
  if(!config)return <div style={{padding:30,color:'#fca5a5'}}>{feedback||'Cannot load configuration.'}</div>;
  return <section style={{color:'#edf2f7',display:'grid',gap:17}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><div style={{color:'#e8c27b',fontSize:10,letterSpacing:2,fontWeight:700}}>ROSIE AI · CORPORATE FRONT DESK</div>
        <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:29,margin:'8px 0'}}>Meet Rosie — your official receptionist</h2>
        <p style={{maxWidth:720,lineHeight:1.6,fontSize:13,color:'#a6b0bc'}}>Dedicated AI receptionist for Rosie AI. This is not the debt-relief fronting agent and has no access to Debt Call Coach leads, scripts, or company credentials.</p>
      </div>
      <button type="button" onClick={save} disabled={saving} style={{background:'#d7ae6a',padding:'12px 20px',border:0,borderRadius:8,fontWeight:800,cursor:'pointer'}}>{saving?'Saving…':'Save Rosie Settings'}</button>
    </div>
    {feedback&&<div role="status" style={{background:'#0f2530',color:'#e2d2a8',padding:12,borderRadius:7,fontSize:12}}>{feedback}</div>}
    <div style={{...group,display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
      <div><label style={label}>Corporate toll-free number</label><div style={{fontSize:23,color:'#e0b778',letterSpacing:1}}>+1 (866) 290-8994</div><p style={{fontSize:11,color:'#8896a8',lineHeight:1.6}}>Corporate line handling is enabled only while Rosie is activated. Existing browser-dialer routing remains when she is off.</p></div>
      <div><label style={label}>Inbound call handling</label><label style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer',fontSize:14}}><input type="checkbox" checked={!!config.isActive} onChange={e=>update('isActive',e.target.checked)} style={{width:20,height:20,accentColor:'#d5af70'}} /><strong>{config.isActive?'Rosie will answer inbound calls':'Inactive — existing Fronter routing'}</strong></label><p style={{fontSize:11,color:'#8896a8'}}>Saving activates or deactivates the corporate route; no other AI agent profile is modified.</p></div>
      <div><label style={label}>Where Rosie sends messages and meeting requests</label><input style={textInput} value={config.notificationEmail||''} onChange={e=>update('notificationEmail',e.target.value)} type="email" placeholder="PR@Rosieai.tech"/></div>
      <div><label style={label}>Corporate Google Calendar ID (optional)</label><input style={textInput} value={config.calendarId||''} onChange={e=>update('calendarId',e.target.value)} placeholder="Rosie AI corporate calendar ID"/></div>
      <div><label style={label}>Meeting length</label><select style={textInput} value={config.meetingDurationMinutes||30} onChange={e=>update('meetingDurationMinutes',Number(e.target.value))}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></div>
      <div style={{fontSize:12,lineHeight:1.65,color:'#c8b995'}}>Meeting time zone: America/New_York. {config.calendarId?'A specific corporate calendar is configured; access and permissions must be tested.':'No Rosie corporate calendar selected: Rosie will take meeting requests but will not claim a meeting is booked until a corporate calendar is connected.'}</div>
    </div>
    <div style={group}>
      <div style={{color:'#d7b679',fontSize:11,fontWeight:800,letterSpacing:1.5,marginBottom:12}}>WHAT CALLERS HEAR</div>
      <p style={{fontFamily:'Georgia,serif',fontSize:17,lineHeight:1.7,color:'#f3ead9'}}>“Good morning or good afternoon. It’s a beautiful day here at Rosie AI headquarters! I’m Rosie, the official Rosie AI virtual receptionist. May I ask whom I’m speaking with?”</p>
      <p style={{fontSize:12,lineHeight:1.8,color:'#aeb9c8'}}>She then asks whether the caller wants Senior Management, PR/Media, Development, or Stephani Scheidt, our Managing Partner. For now she takes a message or arranges a meeting request, always collecting name, callback number, email and the reason for calling. She confirms the email aloud and asks whether the caller wants an email acknowledgement or meeting reminder. No calls are transferred by this version.</p>
    </div>
    <div style={group}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:15,marginBottom:12}}><h3 style={{margin:0,color:'#e9d09e',fontSize:15}}>Rosie call inbox</h3><button type="button" onClick={refresh} style={{background:'#182c3b',color:'#d7e3ee',padding:'8px 14px',border:'1px solid #354254',borderRadius:6,cursor:'pointer'}}>Refresh</button></div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:650}}>
          <thead><tr>{['Received','Caller','Department','Phone / Email','Type / Status'].map(x=><th key={x} style={{textAlign:'left',padding:'9px',borderBottom:'1px solid #3a4658',color:'#93a4b8'}}>{x}</th>)}</tr></thead>
          <tbody>{records.length?records.map(r=><tr key={r.id}><td style={{padding:10,borderBottom:'1px solid #253145'}}>{formatDate(r.createdAt||r.created_date)}</td><td style={{padding:10,borderBottom:'1px solid #253145'}}>{r.fullName||'Collecting…'}{r.message&&<div style={{fontSize:11,color:'#adb8c7',maxWidth:260,lineHeight:1.5,marginTop:5}}>{r.message}</div>}</td><td style={{padding:10,borderBottom:'1px solid #253145'}}>{r.department||'—'}</td><td style={{padding:10,borderBottom:'1px solid #253145'}}>{r.callerPhone||'—'}<div style={{color:'#adbdcf'}}>{r.email||'—'}</div></td><td style={{padding:10,borderBottom:'1px solid #253145'}}>{r.intent||'—'}<div style={{color:'#dfbb85'}}>{r.status||'—'}</div>{r.meetingStartISO&&<div style={{fontSize:11}}>{formatDate(r.meetingStartISO)}</div>}</td></tr>):<tr><td colSpan={5} style={{color:'#8da0b5',padding:'24px 12px',textAlign:'center'}}>No Rosie corporate calls logged yet.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  </section>;
}
