/** Two explicit saved hardware modes: no automatic overwrite on device changes. */
import { Check, CircleAlert, Laptop, Save, Smartphone, SlidersHorizontal } from 'lucide-react';
export default function AudioSetupSwitcher({setups=[],activeIndex=0,disabled=false,loading=false,onUse,onRename,onSave,dirty=false,validation,message=''}) {
  const active=setups[activeIndex]||setups[0]||{};
  const missing=!!active.saved&&validation&&!validation.valid;
  const status=loading?'Loading…':missing?'Device missing':!active.saved?'Not saved':dirty?'Unsaved changes':'Saved';
  const tone=missing?'#ffbc9a':!active.saved||dirty?'#eac67f':'#86e8c0';
  return <section aria-label="Audio modes" style={{width:'min(100%, 346px)',minWidth:280,background:'linear-gradient(130deg,#101f2e,#19312f)',border:'1px solid #3a625c',borderRadius:11,padding:'11px 12px',fontFamily:'system-ui,sans-serif'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,marginBottom:9}}>
      <strong style={{display:'flex',alignItems:'center',gap:6,color:'#dbeae3',fontSize:10,letterSpacing:1,textTransform:'uppercase'}}><SlidersHorizontal size={14} color="#edc77f"/>Audio Modes</strong>
      <span style={{display:'flex',alignItems:'center',gap:4,color:tone,fontSize:10,fontWeight:750}}>
        {!missing&&active.saved&&!dirty?<Check size={12}/>:<CircleAlert size={12}/>} {status}
      </span>
    </div>
    <div role="group" aria-label="Select an audio setup" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
      {setups.slice(0,2).map((s,i)=>{
        const Icon=i===0?Laptop:Smartphone;
        const chosen=activeIndex===i;
        return <button key={i} type="button" onClick={()=>onUse?.(i)} disabled={disabled||loading} aria-pressed={chosen}
          title={s.saved?`Saved agent: ${s.micLabel||'Unknown'}; customer: ${s.customerLabel||'None'}`:'Not configured—select devices and save'}
          style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'9px 6px',minWidth:0,border:'1px solid '+(chosen?'#65cfa5':'#355567'),borderRadius:7,background:chosen?'#1c5140':'#101d28',color:chosen?'#e8f8ee':'#9db8ba',fontSize:11,fontWeight:chosen?800:600,cursor:disabled||loading?'not-allowed':'pointer'}}>
          <Icon size={15}/><span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name}</span>{s.saved&&<Check size={11} color="#9bebcb"/>}
        </button>;
      })}
    </div>
    <div style={{display:'flex',gap:7,alignItems:'center',marginTop:9}}>
      <label htmlFor="dcc-audio-mode-name" style={{fontSize:10,color:'#94b4b8'}}>Name</label>
      <input id="dcc-audio-mode-name" value={active.name||''} onChange={e=>onRename?.(activeIndex,e.target.value)} disabled={disabled||loading} maxLength={38}
        style={{flex:1,minWidth:0,background:'#0b1a25',border:'1px solid #3c5865',borderRadius:6,padding:'7px 8px',color:'#e9f3ea',fontSize:11}}/>
      <button type="button" onClick={onSave} disabled={disabled||loading} title="Save mic, customer input, output preference and gains"
        style={{display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap',padding:'8px 10px',border:'1px solid #6bcc9f',borderRadius:7,background:'#1a7556',color:'#effaf2',fontSize:10,fontWeight:800,cursor:disabled||loading?'not-allowed':'pointer'}}><Save size={12}/>Save</button>
    </div>
    <div role="status" aria-live="polite" style={{color:missing?'#eab39e':'#9db6b9',fontSize:10,lineHeight:1.5,marginTop:7}}>
      {message|| (missing?validation.problems.join(' '):!active.saved?'Choose your hardware and press Save.':dirty?'Changes not saved yet.':'Saved to your profile.')}
    </div>
    <div style={{fontSize:9,color:'#809ca7',marginTop:5}}>Preferred output saved; actual audio playback uses browser/system routing.</div>
  </section>;
}
