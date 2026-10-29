import { useState } from 'react';
import { RotateCcw, Save, PanelsTopLeft, Captions, FileText, BrainCircuit, ContactRound, CheckCircle2, MonitorCog, Monitor, ChevronDown, RefreshCw } from 'lucide-react';
import { DISPLAY_CHOICES, detectDisplayProfile, displayProfileName } from '@/lib/liveWorkspaceLayout';
import './LiveWindowChrome.css';

export default function LiveWorkspaceToolbar({
  phase, panels, showProfile, setShowProfile, hasLead, onSave, onReset,
  saving, message, layoutMode='auto', onLayoutModeChange,
  activeProfile, availableProfiles=[], viewport, onApplyProfile
}) {
  const [showDisplaySettings,setShowDisplaySettings]=useState(false);
  const detected=detectDisplayProfile(viewport);
  const saved=availableProfiles.includes(activeProfile);
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
    <button type="button" aria-expanded={showDisplaySettings} aria-controls="dcc-display-profile-settings"
      className="dcc-layout-screen-btn" onClick={()=>setShowDisplaySettings(value=>!value)}
      title="Choose a different screen-resolution profile and load its saved window layout">
      <MonitorCog size={15}/> Display Settings <ChevronDown size={13} style={{transform:showDisplaySettings?'rotate(180deg)':'none'}}/>
    </button>
    <button type="button" onClick={onReset} disabled={saving} title="Reset only this screen profile; other display layouts remain saved">
      <RotateCcw size={14}/>Reset This Screen
    </button>
    <button className="dcc-layout-save" type="button" disabled={saving} onClick={onSave}
      title="Save these window positions and sizes for the currently selected screen profile">
      {saving?<CheckCircle2 size={15}/>:<Save size={15}/>}
      {saving?'Saving…':'Save This Screen Layout'}
    </button>
    {message && <span className="dcc-layout-msg" role="status">{message}</span>}
    {phase==='live'&&<span style={{fontSize:10,fontWeight:750,color:'#f3ab9f',marginLeft:'auto'}}>● LIVE · Layout preserved</span>}
    {showDisplaySettings&&<div id="dcc-display-profile-settings" className="dcc-display-settings" role="region" aria-label="Screen size layout settings">
      <div className="dcc-display-settings-header">
        <div>
          <strong><Monitor size={16}/> Display &amp; Window Profiles</strong>
          <p>Give each desktop resolution its own saved Live Call layout. Switch displays without losing your preferred arrangement.</p>
        </div>
        <span className={'dcc-display-save-state'+(saved?' is-saved':'')}>
          {saved?'● Saved screen profile':'○ Default arrangement'}
        </span>
      </div>
      <div className="dcc-display-settings-main">
        <label htmlFor="dcc-screen-mode">
          <span>Active screen layout</span>
          <select id="dcc-screen-mode" value={layoutMode} disabled={saving}
            onChange={e=>onLayoutModeChange?.(e.target.value)}>
            {DISPLAY_CHOICES.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <div className="dcc-display-readout">
          <span><small>BROWSER WORKSPACE</small><strong>{viewport?.width||'—'} × {viewport?.height||'—'}</strong></span>
          <span><small>MONITOR REPORTED</small><strong>{viewport?.displayWidth||'—'} × {viewport?.displayHeight||'—'}</strong></span>
          <span><small>{layoutMode==='auto'?'AUTO SELECTED':'SELECTED PROFILE'}</small><strong>{displayProfileName(activeProfile)}</strong></span>
        </div>
      </div>
      <div className="dcc-display-profile-actions">
        <button type="button" disabled={saving} onClick={onApplyProfile} title="Restore the saved arrangement for this profile or load its clean default">
          <RefreshCw size={15}/>Load This Screen
        </button>
        <button type="button" disabled={saving} onClick={onSave} className="dcc-layout-save">
          <Save size={15}/>Save This Screen
        </button>
        <span>Automatic selection detects your browser size. At 3840 × 1080, the four primary windows use a spacious side-by-side layout.</span>
      </div>
      <p className="dcc-display-settings-footer">
        Profiles are saved per Debt Call Coach user. Drag and resize your Transcript, Script, AI Assistant and Contact Card, then click Save This Screen.
        Display layouts do not change audio devices, USB multitrack channels, Deepgram or your call settings.
      </p>
    </div>}
  </section>;
}