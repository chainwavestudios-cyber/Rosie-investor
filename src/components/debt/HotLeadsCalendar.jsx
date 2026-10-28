import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronUp, Clock3, ExternalLink, Maximize2, Minimize2, RefreshCcw, RotateCcw, X, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ET = 'America/New_York';
const toList = value => Array.isArray(value) ? value : value?.items || [];
const etDay = iso => {
  const date = new Date(iso || 0);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US',{timeZone:ET,year:'numeric',month:'2-digit',day:'2-digit'});
};
const currentDay = () => etDay(new Date().toISOString());
const fmtTime = iso => new Date(iso).toLocaleTimeString('en-US',{timeZone:ET,hour:'numeric',minute:'2-digit'});
const fmtGroup = iso => new Date(iso).toLocaleDateString('en-US',{timeZone:ET,weekday:'short',month:'short',day:'numeric'});
const lower = text => String(text || '').trim().toLowerCase();
const BOOKING_URL = 'https://calendar.app.google/c9kk3wXrzPH21ARW7';
const escaped = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const eventPhone = event => (event.title || '').match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || '';

export function findCalendarLead(event, leads) {
  const byEvent = leads.filter(l => l.appointmentEventId && l.appointmentEventId === event.id);
  if (byEvent.length === 1) return byEvent[0];
  if (byEvent.length > 1) return null;
  const emails = (event.attendees || []).map(lower).filter(Boolean);
  const byEmail = leads.filter(l => l.email && emails.includes(lower(l.email)));
  return byEmail.length === 1 ? byEmail[0] : null;
}

export default function HotLeadsCalendar({events, loading, error, onRefresh, leads, username, onOpenLead}) {
  const [collapsed,setCollapsed] = useState(false);
  const [todayOnly,setTodayOnly] = useState(true);
  const [popped,setPopped] = useState(false);
  const [position,setPosition] = useState({x:110,y:90});
  const [size,setSize] = useState({w:430,h:590});
  const [statuses,setStatuses] = useState({});
  const [statusError,setStatusError] = useState('');
  const [busy,setBusy] = useState('');
  const [rescheduling,setRescheduling] = useState('');
  const [sent,setSent] = useState({});
  const [matchBusy,setMatchBusy] = useState('');
  const drag = useRef(null);
  const recent = useMemo(() => [...events].filter(e=> e.id && e.startISO && Number.isFinite(new Date(e.startISO).getTime())).sort((a,b)=>new Date(a.startISO)-new Date(b.startISO)),[events]);
  const today = currentDay();
  const todayCount=recent.filter(ev=>etDay(ev.startISO)===today).length;
  const upcomingToday=recent.filter(ev=>etDay(ev.startISO)===today && new Date(ev.startISO).getTime() >= Date.now()).length;

  useEffect(()=>{
    let live=true;
    if (!recent.length) {setStatuses({});return;}
    base44.entities.DebtCalendarEventStatus.list('-reviewedAt',500).then(rows=>{
      if(!live)return;
      const visibleIds=new Set(recent.map(e=>e.id));
      const next={};
      for(const row of toList(rows)) if(visibleIds.has(row.eventId) && !next[row.eventId]) next[row.eventId]=row;
      setStatuses(next);setStatusError('');
    }).catch(()=>{if(live)setStatusError('Shared appointment review status could not load.');});
    return()=>{live=false;};
  },[recent]);

  const updateStatus = async (event, nextStatus) => {
    if(busy)return;
    setBusy(event.id);
    setStatusError('');
    const matched=findCalendarLead(event,leads);
    try {
      const now=new Date().toISOString();
      const patch={
        eventId:event.id, leadId:matched?.id || statuses[event.id]?.leadId || '',
        status:nextStatus,updatedBy:username || 'staff',
        completedAt:nextStatus==='completed'?now:null,reviewedAt:now
      };
      const old=statuses[event.id];
      const updated=old?.id
        ? await base44.entities.DebtCalendarEventStatus.update(old.id,patch)
        : await base44.entities.DebtCalendarEventStatus.create(patch);
      setStatuses(prev=>({...prev,[event.id]:updated||{...patch,id:old?.id}}));
    }catch(err){setStatusError('Could not save appointment status: '+(err?.message||'Try again.'));}
    finally{setBusy('');}
  };

  // Never use first-name or surname substring matching. Look for an exact
  // Calendar event ID or a unique, exact email match in the complete lead store.
  const resolveLead = async event => {
    const immediate = findCalendarLead(event,leads);
    if(immediate)return immediate;
    const byId=toList(await base44.entities.DebtLead.filter({appointmentEventId:event.id},{limit:2}));
    if(byId.length===1)return byId[0];
    if(byId.length>1)return null;
    const candidates=new Map();
    for(const email of (event.attendees||[]).filter(v=>String(v).includes('@')).slice(0,6)){
      const exact=escaped(String(email).trim());
      const rows=toList(await base44.entities.DebtLead.filter({email:{$regex:'^'+exact+'$',$options:'i'}},{limit:3}));
      for(const row of rows)candidates.set(row.id,row);
    }
    if(candidates.size>1)return null;
    if(candidates.size===1)return [...candidates.values()][0];
    // Restore legacy title-based rebooking without its unsafe partial-name matches.
    // A full, two-part name is acceptable ONLY if the database returns one unique lead.
    const stripped=String(event.title||'').replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,'').replace(/\s*[-–—]\s*.*$/,'').trim();
    const full=stripped.match(/^([A-Za-z][A-Za-z'’-]*)\s+([A-Za-z][A-Za-z'’-]*)$/);
    if(!full)return null;
    const byName=toList(await base44.entities.DebtLead.filter({
      firstName:{$regex:'^'+escaped(full[1])+'$',$options:'i'},
      lastName:{$regex:'^'+escaped(full[2])+'$',$options:'i'}
    },{limit:2}));
    return byName.length===1?byName[0]:null;
  };

  const openEventLead = async event => {
    setMatchBusy(event.id);
    try {
      const found=await resolveLead(event);
      if(found)onOpenLead?.(found);
      else setStatusError('No unique contact match for this event. Open it in Calendar or find the contact manually; no contact was changed.');
    }catch(err){setStatusError('Could not match this calendar event to a contact.');}
    finally{setMatchBusy('');}
  };
  const sendReschedule = async event => {
    if(rescheduling)return;
    setRescheduling(event.id);
    setStatusError('');
    try {
      const found=await resolveLead(event);
      if(!found?.id||!found?.email){
        // Keep the original fallback: an unmatched event still has a way to rebook.
        const opened=window.open(BOOKING_URL,'_blank','noopener,noreferrer');
        setStatusError(opened ? 'No uniquely matched contact. Opened the booking calendar; no email was sent.' : 'No uniquely matched contact. Use the Booking link to choose a new time; no email was sent.');
        return;
      }
      const res=await base44.functions.invoke('sendMissedApptReschedule',{leadId:found.id});
      const out=res?.data||res;
      if(!out?.success)throw new Error(out?.error||'Sending failed.');
      setSent(prev=>({...prev,[event.id]:true}));
    }catch(err){setStatusError('Rebooking email not sent: '+(err?.message||'Please retry.'));}
    finally{setRescheduling('');}
  };

  const shown=recent.filter(ev=>!todayOnly || etDay(ev.startISO)===today);
  const grouped=shown.reduce((acc,ev)=>{
    const k=etDay(ev.startISO);
    if(!acc[k])acc[k]={label:fmtGroup(ev.startISO),items:[]};
    acc[k].items.push(ev);
    return acc;
  },{});

  const content=(
    <div className="hl-calendar-inner">
      <div className="hl-calendar-toolbar">
        <div className="hl-calendar-title"><CalendarDays size={15}/><strong>{todayOnly?"Today's appointments":"Next 3 days"}</strong><span className="hl-small-count">{upcomingToday} upcoming · {todayCount} today</span></div>
        <div className="hl-calendar-controls">
          <button className={'hl-small-btn '+(todayOnly?'on':'')} type="button" onClick={()=>setTodayOnly(v=>!v)}>{todayOnly?'Show next 3 days':'Show today'}</button>
          <button className="hl-icon-btn" type="button" onClick={onRefresh} disabled={loading} title="Refresh calendar"><RefreshCcw size={14}/></button>
          <button className="hl-icon-btn" type="button" onClick={()=>setPopped(v=>!v)} title={popped?'Dock calendar':'Pop out calendar'}>{popped?<Minimize2 size={14}/>:<Maximize2 size={14}/>}</button>
          {!popped&&<button className="hl-icon-btn" type="button" onClick={()=>setCollapsed(true)} title="Collapse appointments"><ChevronUp size={15}/></button>}
        </div>
      </div>
      {error && <div className="hl-inline-error" role="alert">{error}</div>}
      {statusError && <div className="hl-inline-error" role="alert"><AlertCircle size={13}/>{statusError}</div>}
      {loading && !recent.length?<div className="hl-empty">Loading appointments…</div>:
       !shown.length?<div className="hl-empty">{todayOnly?'No appointments today. Select “Show next 3 days” to see what is coming.':'No appointments in the next 3 days.'}</div>:
       <div className="hl-calendar-list">
         {Object.entries(grouped).map(([day,group])=>(
           <div key={day}>
             <div className="hl-calendar-day">{group.label}<span>{group.items.length}</span></div>
             {group.items.map(event=>{
               const reviewed=statuses[event.id]?.status||'scheduled';
               const completed=reviewed==='completed';
               const noShow=reviewed==='no_show';
               const past=new Date(event.startISO).getTime()<Date.now();
               const matched=findCalendarLead(event,leads);
               const attendee=(event.attendees||[])[0];
               const phone=matched?.phone||eventPhone(event);
               return <div className={'hl-calendar-event '+(past&&!completed&&!noShow?'hl-calendar-past':'')} key={event.id}>
                 <time className="hl-event-time">{fmtTime(event.startISO)}</time>
                 <div className="hl-event-content">
                   <div className="hl-event-line"><strong title={event.title}>{event.title||'Untitled event'}</strong>
                     {completed?<span className="hl-state good">Completed</span>:noShow?<span className="hl-state bad">No-show</span>:past?<span className="hl-state due">Past · review</span>:null}
                   </div>
                   <div className="hl-event-meta">{phone?'Phone: '+phone:attendee||'No linked contact'}{statuses[event.id]?.updatedBy?' · Reviewed by '+statuses[event.id].updatedBy:''}</div>
                   <div className="hl-event-actions">
                     <button type="button" onClick={()=>openEventLead(event)} disabled={matchBusy===event.id} className="hl-small-btn">{matchBusy===event.id?'Matching…':'Contact card'}</button>
                     {event.htmlLink&&<a className="hl-small-btn" href={event.htmlLink} target="_blank" rel="noreferrer"><ExternalLink size={11}/>Calendar</a>}
                     {completed||noShow
                       ? <button type="button" disabled={busy===event.id} className="hl-small-btn" onClick={()=>updateStatus(event,'scheduled')}><RotateCcw size={11}/>Undo</button>
                       : <>
                           <button type="button" disabled={busy===event.id} className="hl-small-btn hl-done" onClick={()=>updateStatus(event,'completed')}><Check size={12}/>Done</button>
                           {past&&<button type="button" disabled={busy===event.id} className="hl-small-btn" onClick={()=>updateStatus(event,'no_show')}>No-show</button>}
                         </>
                     }
                     {past&&!completed&&!sent[event.id]&&<button type="button" disabled={rescheduling===event.id} className="hl-small-btn hl-rebook" title="Send the missed-appointment rebooking email, or open the booking calendar if no unique contact is found" onClick={()=>sendReschedule(event)}>{rescheduling===event.id?'Rebooking…':'Rebook'}</button>}
                     {sent[event.id]&&<span className="hl-sent">Reschedule email sent</span>}
                     <a className="hl-small-btn" href={BOOKING_URL} target="_blank" rel="noreferrer" title="Open the appointment booking calendar"><CalendarDays size={11}/>Booking link</a>
                   </div>
                 </div>
               </div>;
             })}
           </div>
         ))}
       </div>}
      <div className="hl-calendar-foot">All of today's events remain visible, including past appointments. Rebook sends the existing missed-appointment email when a unique contact is found; the Booking link always works. Times ET · Staff reviews are shared.</div>
    </div>
  );
  return <>
    {!popped&&(collapsed
      ?<button type="button" onClick={()=>setCollapsed(false)} className="hl-calendar-collapsed"><CalendarDays size={16}/><strong>Today's appointments</strong><span>{upcomingToday} upcoming · {todayCount} today</span><ChevronDown size={16}/></button>
      :<section className="hl-calendar-docked">{content}</section>)}
    {popped&&<>
      <button className="hl-calendar-collapsed" type="button" onClick={()=>setPopped(false)}><CalendarDays size={16}/>Calendar is popped out <Minimize2 size={14}/></button>
      <aside className="hl-calendar-pop" style={{left:position.x,top:position.y,width:size.w,height:size.h}}>
        <div className="hl-pop-handle" onMouseDown={e=>{
          if(e.target.closest('button'))return;
          const original={x:e.clientX-position.x,y:e.clientY-position.y};
          const move=ev=>setPosition({x:Math.max(0,ev.clientX-original.x),y:Math.max(0,ev.clientY-original.y)});
          const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
          document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
        }}>Drag calendar <button type="button" className="hl-icon-btn" onClick={()=>setPopped(false)} title="Dock"><X size={15}/></button></div>
        {content}
        <div className="hl-pop-resizer" onMouseDown={e=>{
          e.preventDefault();
          const start={x:e.clientX,y:e.clientY,w:size.w,h:size.h};
          const move=ev=>setSize({w:Math.max(340,start.w+ev.clientX-start.x),h:Math.max(310,start.h+ev.clientY-start.y)});
          const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
          document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
        }}/>
      </aside>
    </>}
  </>;
}
