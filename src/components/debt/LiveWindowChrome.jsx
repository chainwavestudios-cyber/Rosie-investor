import { GripHorizontal, LocateFixed, PanelTopClose, Save } from 'lucide-react';
import './LiveWindowChrome.css';

export function WindowSizeActions({panel, onDock, showSave=false, label='Window'}) {
  const presets=[
    {name:'S',w:360,h:480},
    {name:'M',w:540,h:680},
    {name:'L',w:800,h:820},
  ];
  return <div className="dcc-window-actions" data-no-drag>
    <span className="dcc-window-size-label">SIZE</span>
    {presets.map(p=><button key={p.name} type="button" title={label+' '+p.name+' size'}
      aria-label={'Resize '+label+' to '+p.name}
      onClick={()=>{panel.bringToFront();panel.setSize({width:Math.min(p.w,window.innerWidth-16),height:Math.min(p.h,window.innerHeight-16)});}}
      className="dcc-window-btn dcc-window-size">{p.name}</button>)}
    <button className="dcc-window-btn" type="button" onClick={()=>{panel.center();panel.bringToFront();}} title={'Center '+label} aria-label={'Center '+label}><LocateFixed size={14}/></button>
    {showSave&&<button className="dcc-window-btn" type="button" title={'Remember '+label+' size and position'} onClick={panel.saveLayout}><Save size={14}/></button>}
    {onDock&&<button className="dcc-window-btn dcc-window-close" type="button" onClick={onDock} title={'Dock '+label} aria-label={'Dock '+label}><PanelTopClose size={14}/><span>Dock</span></button>}
  </div>;
}

export default function LiveWindowChrome({panel,title,subtitle,icon:Icon,onDock,children,className='',showSave=false}) {
  return <section role="region" aria-label={title} onMouseDownCapture={panel.bringToFront}
    className={'dcc-window-shell '+className} style={panel.floatingStyle}>
    <div className="dcc-window-heading" onMouseDown={panel.onDragStart} title="Drag to position window">
      <div className="dcc-window-heading-title">
        <GripHorizontal size={16} className="dcc-window-grip"/>
        {Icon&&<Icon size={17} className="dcc-window-icon"/>}
        <div className="dcc-window-heading-text"><strong>{title}</strong>{subtitle&&<small>{subtitle}</small>}</div>
      </div>
      <WindowSizeActions panel={panel} onDock={onDock} showSave={showSave} label={title}/>
    </div>
    <div className="dcc-window-content">{children}</div>
    {panel.resizeHandles}
  </section>;
}
