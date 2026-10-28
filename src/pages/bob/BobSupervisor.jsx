import { useEffect, useRef, useState } from 'react';
import { AudioLines, Ear, Headphones, Lock, Mic, MicOff, RefreshCw, ShieldAlert, Users, Volume2 } from 'lucide-react';
import { openRecording } from '@/lib/bobAudioCrypto';
import useBobLiveMonitor from '@/hooks/useBobLiveMonitor';
import './BobSite.css';
export default function BobSupervisor({org,vaultKey,api,canManageRecording=false,onRecordingChanged}){
 const [sessions,setSessions]=useState([]),[recordings,setRecordings]=useState([]),[error,setError]=useState(''),[playing,setPlaying]=useState(null),
 [selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[talkAllowed,setTalkAllowed]=useState(false);
 const live=useBobLiveMonitor(),urls=useRef([]);
 const refresh=async()=>{
  const [liveData,recordingData]=await Promise.all([
   api('liveSessions',{organizationId:org.id}),api('recordings',{organizationId:org.id})
  ]);
  setSessions(liveData.sessions||[]);setRecordings(recordingData.recordings||[]);
 };
 useEffect(()=>{
  setSelected(null);setPlaying(null);setError('');
  refresh().catch(e=>setError(e.message));
  const timer=setInterval(()=>{refresh().catch(()=>{});},20000);
  return()=>{clearInterval(timer);urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];};
 },[org.id]);
 const join=async(s)=>{
  setBusy(true);setError('');
  try{const result=await live.join({organizationId:org.id,presenceId:s.id,mode:'manager',talk:!!s.coachTalkConsent});
   setSelected(s);setTalkAllowed(result.coachTalkAllowed);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const playback=async(recording)=>{
  if(!vaultKey){setError('Unlock the customer-owned encryption vault to listen to a saved recording.');return;}
  setBusy(true);setError('');
  try{
   const signed=await api('recordingPlayback',{organizationId:org.id,recordingId:recording.id});
   const response=await fetch(signed.encryptedUrl);
   if(!response.ok)throw new Error('Could not retrieve the private encrypted recording.');
   const blob=await openRecording(vaultKey,await response.arrayBuffer(),signed.iv,org.id);
   const url=URL.createObjectURL(blob);
   urls.current.forEach(x=>URL.revokeObjectURL(x));urls.current=[url];
   setPlaying({id:recording.id,url});
  }catch(e){setError(e.message||'Unable to decrypt recording.');}finally{setBusy(false);}
 };
 return <div className="bob-stack">
  <div className="bob-panel"><div className="bob-panel-title"><h3><Users size={18} color="#d7b978" style={{display:'inline',marginRight:7}}/>Manager training cockpit</h3><button className="bob-btn bob-btn-ghost" onClick={()=>refresh().catch(e=>setError(e.message))}><RefreshCw size={14}/> Refresh</button></div>
   <p className="bob-tiny">Only sessions that trainees explicitly opted into appear for listening. A manager can listen to that trainee's live microphone. Coach talk-in lets a manager speak to the trainee's headphones when separately consented; it does not inject audio into the AI agent or take over a real phone line.</p>
   {!org.allowLiveMonitoring&&<div className="bob-message"><ShieldAlert size={14} style={{display:'inline',marginRight:6}}/>Live monitoring is disabled in organization settings. An administrator must enable it.</div>}
   {error&&<div className="bob-message error">{error}</div>}
   {sessions.length===0?<div className="bob-empty">No current trainees are connected to a live monitored session.</div>:<div className="bob-table-wrap"><table className="bob-table"><thead><tr><th>Trainee</th><th>Training stage</th><th>Started</th><th>Monitoring consent</th><th/></tr></thead><tbody>{sessions.map(s=><tr key={s.id}><td>{s.traineeEmail}</td><td>{s.stage||'Training'}</td><td>{new Date(s.startedAt).toLocaleTimeString()}</td><td>{s.liveMonitorConsent?'Yes':'No'}</td><td><button disabled={busy||!s.liveMonitorConsent||!org.allowLiveMonitoring} className="bob-btn bob-btn-ghost" onClick={()=>join(s)}><Ear size={14}/> Listen with consent</button></td></tr>)}</tbody></table></div>}
   {selected&&<div className="bob-panel" style={{marginTop:18,background:'#0d2631'}}><div className="bob-panel-title"><h3>Monitoring: {selected.traineeEmail}</h3><span className="bob-pill">{live.connected?'Audio connected':'Connecting / disconnected'}</span></div><p className="bob-tiny">The trainee consented to microphone relay for this call. Listening to an AI-generated customer may include audio from the trainee’s speakers depending on their audio setup. Headphones are recommended.</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{talkAllowed&&<button className="bob-btn bob-btn-gold" onClick={()=>live.toggleTalk().catch(e=>setError(e.message))}>{live.talking?<MicOff size={14}/>:<Mic size={14}/>} {live.talking?'Mute coach talk-in':'Speak to trainee'}</button>}<button className="bob-btn bob-btn-ghost" onClick={()=>{live.disconnect();setSelected(null);}}><Headphones size={14}/> Leave session</button></div></div>}
  </div>
  <div className="bob-panel"><div className="bob-panel-title"><h3><AudioLines size={17} color="#d7b978" style={{display:'inline',marginRight:8}}/>Previously recorded practice calls</h3><span className="bob-pill">{recordings.length} private recordings</span></div>
   <p className="bob-tiny">Audio is stored encrypted in private storage. To replay, a manager must have the organization vault passphrase. Sessions are recorded only when both the organization recording policy and the trainee's call-specific consent are enabled.</p>
   {canManageRecording&&<div className="bob-panel" style={{background:'#0b2230',padding:16,marginBottom:18}}>
    <div className="bob-panel-title"><h3>Recording policy</h3><span className="bob-pill">Separate trainee opt-in required</span></div>
    <label style={{display:'flex',gap:10,alignItems:'center',fontSize:13,color:'#dce9ed'}}><input type="checkbox" checked={!!org.allowSessionRecording} disabled={busy} onChange={async e=>{
      setBusy(true);setError('');
      try{
        await api('setRecordingPolicy',{organizationId:org.id,allowSessionRecording:e.target.checked});
        await onRecordingChanged?.();
      }catch(err){setError(err.message||'Could not update recording policy.');}
      finally{setBusy(false);}
    }}/> Enable optional encrypted practice-call recording for this organization</label>
    <p className="bob-tiny">This setting only makes recording available. Each trainee must still consent separately for every call. Recordings are encrypted with the customer's browser-held key.</p>
   </div>}
   {!org.allowSessionRecording&&<div className="bob-message">Audio recording is currently disabled for this company.</div>}
   {recordings.length===0?<div className="bob-empty">No opt-in encrypted call recordings have been saved.</div>:<div className="bob-table-wrap"><table className="bob-table"><thead><tr><th>Trainee</th><th>Recorded</th><th>Duration</th><th>Size</th><th/></tr></thead><tbody>{recordings.map(r=><tr key={r.id}><td>{r.traineeEmail}</td><td>{new Date(r.createdAt).toLocaleString()}</td><td>{Math.ceil((r.durationSeconds||0)/60)} min</td><td>{Math.round((r.sizeBytes||0)/1024)} KB</td><td><button disabled={busy||!vaultKey} onClick={()=>playback(r)} className="bob-btn bob-btn-ghost"><Volume2 size={14}/> Decrypt & listen</button></td></tr>)}</tbody></table></div>}
   {playing&&<div className="bob-panel" style={{marginTop:18,background:'#0e2835'}}><div className="bob-panel-title"><h3>Private audio playback</h3><button className="bob-btn bob-btn-ghost" onClick={()=>{URL.revokeObjectURL(playing.url);setPlaying(null);}}>Close</button></div><audio controls style={{width:'100%'}} src={playing.url}/><p className="bob-tiny">Decryption occurs in this browser only. Plaintext audio is held transiently in this tab.</p></div>}
   {!vaultKey&&<p className="bob-message"><Lock size={14} style={{display:'inline',marginRight:8}}/>Unlock the company vault before reviewing encrypted calls.</p>}
  </div>
 </div>;
}
