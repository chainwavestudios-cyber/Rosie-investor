/**
 * Debt Call Coach's compact, two-row navigation.
 * Keeps SavedLayout per-user drag ordering, deep-link tab IDs and permissions.
 * The quick-jump menu is an additional view into the SAME tab registry.
 */
import { useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Radio, ScrollText, Flag, Phone, Inbox, Flame, GraduationCap,
  Target, BrainCircuit, KanbanSquare, Mic2, Mail, Send, Search,
  ChartNoAxesCombined, ShieldCheck, BookOpen, MessageSquareText,
  UsersRound, BarChart3, WalletCards, FileBarChart2, Video,
  Settings2, RotateCcw, GripVertical, ChevronDown
} from 'lucide-react';

const ICONS={
  live:Radio,scripts:ScrollText,closing:Flag,calls:Phone,
  newleads:Inbox,hotleads:Flame,bob:GraduationCap,leadgen:Target,
  smartleads:BrainCircuit,pipeline:KanbanSquare,pitches:Mic2,
  emails:Mail,campaigns:Send,emailfinder:Search,
  engagement:ChartNoAxesCombined,objections:ShieldCheck,kb:BookOpen,
  kbchat:MessageSquareText,profile:UsersRound,stats:BarChart3,
  compliance:ShieldCheck,aicredits:WalletCards,aireports:FileBarChart2,
  protoface:Video,admin:Settings2,
};
const cleanLabel=(label='')=>label.replace(/^[^ ]+\s+/u,'').trim()||label;

export default function CoachTabBar({ rows, tabMap, active, onSelect, onMove, onReset }) {
  const firstRow=useRef(null),secondRow=useRef(null);
  const handleDragEnd=({source,destination})=>{
    if(!destination) return;
    if(source.droppableId===destination.droppableId&&source.index===destination.index)return;
    onMove(
      {row:Number(source.droppableId),index:source.index},
      {row:Number(destination.droppableId),index:destination.index}
    );
  };
  // The active tab remains findable even when the saved row has many entries.
  useEffect(()=>{
    for (const row of [firstRow.current,secondRow.current]){
      const button=Array.from(row?.querySelectorAll('[data-coach-tab]')||[])
        .find(el=>el.dataset.coachTab===active);
      if(button&&row){
        const left=button.offsetLeft-row.offsetLeft;
        if(left<row.scrollLeft || left+button.offsetWidth>row.scrollLeft+row.clientWidth){
          row.scrollTo({left:Math.max(0,left-24),behavior:'auto'});
        }
      }
    }
  },[active,rows]);

  const visible=Object.keys(tabMap).map(id=>({id, label:cleanLabel(tabMap[id].label)}));
  return <div className="dcc-tab-wrap" role="region" aria-label="Debt Call Coach sections">
    <div className="dcc-tab-toolbar">
      <div className="dcc-tab-toolbar-title"><span className="dcc-tab-toolbar-dot"/> COACH SECTIONS <span className="dcc-tab-count">{visible.length}</span></div>
      <div className="dcc-tab-toolbar-actions">
        <label className="dcc-tab-jump">
          <Search size={14} aria-hidden="true"/>
          <span className="sr-only">Jump to section</span>
          <select aria-label="Jump to section" value={active} onChange={e=>onSelect(e.target.value)}>
            <option value="" disabled>Jump to section…</option>
            {visible.map(({id,label})=><option key={id} value={id}>{label}</option>)}
          </select>
          <ChevronDown size={13} aria-hidden="true"/>
        </label>
        <button type="button" onClick={onReset} className="dcc-tab-reset" title="Restore the default tab order" aria-label="Reset tab arrangement"><RotateCcw size={13}/> Reset</button>
      </div>
    </div>
    <DragDropContext onDragEnd={handleDragEnd}>
      {[0,1].map(index=><div key={index} className={'dcc-tab-row'+(index===1?' is-core':'')}>
        <span className="dcc-tab-row-label" title={index===1?'Day-to-day calling tools':'Additional tools'}>
          {index===1?'CALLING':'TOOLS'}
        </span>
        <Droppable droppableId={String(index)} direction="horizontal">
          {(provided,snapshot)=><div
            ref={node=>{provided.innerRef(node);(index===0?firstRow:secondRow).current=node;}}
            {...provided.droppableProps}
            className={'dcc-tab-scroll'+(snapshot.isDraggingOver?' is-dropping':'')}
            role="tablist" aria-label={index===1?'Calling tabs':'Tool tabs'}>
            {(rows[index]||[]).map((id,tabIndex)=>{
              const definition=tabMap[id]; if(!definition)return null;
              const Icon=ICONS[id]||BookOpen;
              const selected=id===active;
              return <Draggable key={id} draggableId={id} index={tabIndex}>
                {(drag,dragState)=><button
                  ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}
                  data-coach-tab={id}
                  role="tab" aria-selected={selected}
                  className={'dcc-tab-item'+(selected?' is-active':'')+(dragState.isDragging?' is-dragging':'')}
                  onClick={()=>onSelect(id)}
                  title={cleanLabel(definition.label)+' — select; drag to rearrange'}>
                  <Icon size={14} strokeWidth={1.9} aria-hidden="true"/>
                  <span>{cleanLabel(definition.label)}</span>
                  {selected&&<span className="dcc-tab-active-dot" aria-hidden="true"/>}
                </button>}
              </Draggable>;
            })}
            {provided.placeholder}
          </div>}
        </Droppable>
        <GripVertical className="dcc-tab-grip-hint" size={14} aria-hidden="true"/>
      </div>)}
    </DragDropContext>
  </div>;
}
