import { RotateCcw, Save, PanelsTopLeft, Captions, FileText, BrainCircuit, ContactRound, CheckCircle2 } from 'lucide-react';
import './LiveWindowChrome.css';

export default function LiveWorkspaceToolbar({
  phase, panels, showProfile, setShowProfile, hasLead, onSave, onReset,
  saving, message
}) {
  const entries=[
    {key:'transcript',name:'Transcript',Icon:Captions,visible:panels.transcript.poppedOut,open:panels.transcript.openAtSavedPosition,close:panels.transcript.toggle},
    {key:'scripts',name:'Script',Icon:FileText,visible:panels.scripts.poppedOut,open:panels.scripts.openAtSavedPosition,close:panels.scripts.toggle},
    {key:'ai',name:'AI Assistant',Icon:BrainCircuit,visible:panels.ai.poppedOut,open:panels.ai.openAtSavedPosition,close:panels.ai.toggle},
    {key:'profile',name:'Contact',Icon:ContactRound,visible:showProfile,open:()=>setShowProfile(true),close:()=>setShowProfile(false),disabled:!hasLead}
  ];
  return <section className="dcc-workspace-layout-actions" aria-label="Live Call window layout controls">
    <span className="dcc-layout-heading">WORKSPACE</span>
    {entries.map(item=><button key={item.key} type="button" aria-pressed={item.visible}
      disabled={item.disabled} title={item.visible?'Close '+item.name+' window':'Open '+item.name+' window'}
      onClick={()=>item.visible?item.close():item.open()}>
      <item.Icon size={14} />{item.name} {item.visible?'✓':''}
    </button>)}
    <button type="button" onClick={()=>{panels.transcript.openAtSavedPosition();panels.scripts.openAtSavedPosition();panels.ai.openAtSavedPosition();if(hasLead)setShowProfile(true);}}
      title="Show all Live Call windows"><PanelsTopLeft size={14}/>Show All</button>
    <button type="button" onClick={onReset} title="Put all windows into a clean, non-overlapping starting arrangement"><RotateCcw size={14}/>Reset</button>
    <button className="dcc-layout-save" type="button" disabled={saving} onClick={onSave}
      title="Save these exact positions and sizes as your default for every new call">
      {saving?<CheckCircle2 size={15}/>:<Save size={15}/>}
      {saving?'Saving…':'Save Default Layout'}
    </button>
    {message && <span className="dcc-layout-msg" role="status">{message}</span>}
    {phase==='live'&&<span style={{fontSize:10,fontWeight:750,color:'#f3ab9f',marginLeft:'auto'}}>● LIVE · Your layout stays in place</span>}
  </section>;
}
