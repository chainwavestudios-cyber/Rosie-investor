/** Hot Lead Command Center — prioritized queue, context panel, shared appointment workflow. */
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Activity, AlertCircle, ArrowRight, CalendarDays, CheckCircle2, ChevronRight,
  CircleAlert, Clock3, ExternalLink, Flame, Headphones, LayoutDashboard, Mail,
  Map, Phone, RefreshCcw, Search, ShieldCheck, Sparkles, UserRound, Users, X
} from 'lucide-react';
import useHotLeads from '@/hooks/useHotLeads';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import HotLeadsCalendar from './HotLeadsCalendar';
import './HotLeadsTab.css';

const TZ='America/New_York';
const parseTime = value => {const v=value?new Date(value).getTime():NaN;return Number.isFinite(v)?v:null;};
const dayET = value => value?new Date(value).toLocaleDateString('en-US',{timeZone:TZ,month:'2-digit',day:'2-digit',year:'numeric'}):'';
const todayET = () => dayET(new Date().toISOString());
const formatDate = value => {
  const ms=parseTime(value);
  return ms===null?'—':new Date(ms).toLocaleString('en-US',{timeZone:TZ,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
};
const ago = value => {
  const ms=parseTime(value);
  if(ms===null)return '—';
  const min=Math.max(0,Math.floor((Date.now()-ms)/60000));
  return min<60?min+'m ago':min<1440?Math.floor(min/60)+'h ago':Math.floor(min/1440)+'d ago';
};
const currency = value => Number(value)>0?'$'+Math.round(Number(value)).toLocaleString('en-US'):'—';
const fullname = lead => [lead?.firstName,lead?.lastName].filter(Boolean).join(' ')||'Unnamed contact';
const engagement = lead => {
  const clickCount=['apptBbbClickedAt','apptTrustpilotClickedAt','apptWebsiteClickedAt'].filter(k=>Boolean(lead[k])).length;
  const opened=Boolean(lead.apptEmailOpenedAt||lead.apptHourReminderOpenedAt);
  const high=opened&&clickCount>=2;
  return {clickCount,opened,high,oneHour:Boolean(lead.apptHourReminderOpenedAt)};
};
const isClosed = lead => ['completed','declined','enrolled'].includes(lead.status);
const priorityFor = lead => {
  const now=Date.now(),callback=parseTime(lead.callbackAt),appointment=parseTime(lead.appointmentDate);
  const today=appointment!==null&&dayET(lead.appointmentDate)===todayET();
  const lastCall=parseTime(lead.lastCallAt);
  // A newer call can satisfy an old callback; avoid perpetually escalating it.
  const callbackOverdue=callback!==null && callback<now && (lastCall===null || lastCall<callback) && !isClosed(lead);
  // A newer call may likewise have handled an old appointment; flag only unreviewed cases.
  const apptPast=appointment!==null && appointment<now && (lastCall===null || lastCall<appointment) && !isClosed(lead) && !lead.rescheduleBookedAt;
  const change=Boolean(lead.appointmentChangeRequested) && !isClosed(lead);
  const engagementSignals=engagement(lead);
  let score=0;
  const reasons=[];
  if(change){score+=120;reasons.push('Change requested');}
  if(callbackOverdue){score+=100;reasons.push('Overdue callback');}
  if(today){score+=75;reasons.push('Appointment today');}
  if(apptPast){score+=45;reasons.push('Past appointment · review');}
  if(engagementSignals.high){score+=35;reasons.push('Strong email engagement');}
  if(engagementSignals.oneHour){score+=12;reasons.push('1-hour email opened');}
  if(Number(lead.intentScore)>=75){score+=15;reasons.push('High intent score');}
  if(Number(lead.dealScore)>=75){score+=10;reasons.push('High deal score');}
  const attention=change||callbackOverdue||(today&&!lead.appointmentConfirmed)||apptPast;
  let label='Follow up';
  let kind='normal';
  if(change||callbackOverdue){label='Action needed';kind='urgent';}
  else if(today){label='Today';kind='today';}
  else if(engagementSignals.high){label='Engaged';kind='engaged';}
  return {score,attention,label,kind,today,callbackOverdue,apptPast,change,...engagementSignals,reasons};
};

const FILTERS=[
  ['all','All hot leads'],
  ['attention','Needs attention'],
  ['today','Today'],
  ['engaged','Engaged'],
  ['overdue','Overdue']
];
function Stat({Icon,label,value,caption,tone='gold'}) {
  return <div className="hl-stat"><div className="hl-stat-top">{label}<Icon size={15} className={'hl-tone-'+tone}/></div>
    <strong>{value}</strong><div className="hl-stat-caption">{caption}</div></div>;
}
function Section({title,children}) {
  return <div className="hl-detail-section"><h4>{title}</h4>{children}</div>;
}
function DataPair({label,value}) {
  return <div className="hl-data-pair"><span>{label}</span><strong>{value??'—'}</strong></div>;
}

export default function HotLeadsTab({onOpenLead,onOpenHeatMap}) {
  const {user}=useDebtCoachAuth();
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [sort,setSort]=useState('priority');
  const [selectedId,setSelectedId]=useState(null);
  const [calendar,setCalendar]=useState([]);
  const [calendarLoading,setCalendarLoading]=useState(true);
  const [calendarError,setCalendarError]=useState('');
  const [removeBusy,setRemoveBusy]=useState('');
  const [removeError,setRemoveError]=useState('');
  const {leads,total,loading,refreshing,error:leadError,hasMore,loadingMore,loadMore,refresh:refreshLeads}=useHotLeads(search);

  const loadCalendar=useCallback(async()=>{
    setCalendarLoading(true);
    try{
      const res=await base44.functions.invoke('listCalendarEvents',{days:3});
      const out=res?.data||res;
      if(out?.error)throw new Error(out.error);
      setCalendar(Array.isArray(out.events)?out.events:[]);
      setCalendarError('');
    }catch(err){setCalendarError(err?.message||'Could not load the calendar.');}
    finally{setCalendarLoading(false);}
  },[]);
  useEffect(()=>{
    loadCalendar();
    const timer=setInterval(loadCalendar,60000);
    const refresh=()=>{if(!document.hidden)loadCalendar();};
    document.addEventListener('visibilitychange',refresh);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[loadCalendar]);

  const info=useMemo(()=>leads.map(lead=>({lead,p:priorityFor(lead)})),[leads,calendar]); // Calendar reload also refreshes time-based labels.
  const counts=useMemo(()=>({
    attention:info.filter(({p})=>p.attention).length,
    today:info.filter(({p})=>p.today).length,
    engaged:info.filter(({p})=>p.high).length,
    overdue:info.filter(({p})=>p.callbackOverdue||p.apptPast).length
  }),[info]);
  const visible=useMemo(()=>{
    const rows=info.filter(({p})=>
      filter==='all'||
      filter==='attention'&&p.attention||
      filter==='today'&&p.today||
      filter==='engaged'&&p.high||
      filter==='overdue'&&(p.callbackOverdue||p.apptPast)
    );
    rows.sort((a,b)=>{
      if(sort==='newest')return (parseTime(b.lead.hotLeadTaggedAt)||0)-(parseTime(a.lead.hotLeadTaggedAt)||0);
      if(sort==='appointment')return (parseTime(a.lead.appointmentDate)??Infinity)-(parseTime(b.lead.appointmentDate)??Infinity);
      if(sort==='debt')return Number(b.lead.debtAmount||0)-Number(a.lead.debtAmount||0);
      return b.p.score-a.p.score||(parseTime(b.lead.hotLeadTaggedAt)||0)-(parseTime(a.lead.hotLeadTaggedAt)||0);
    });
    return rows;
  },[info,filter,sort]);

  useEffect(()=>{
    const first=visible[0]?.lead.id || null;
    if(!visible.some(({lead})=>lead.id===selectedId) && selectedId!==first)setSelectedId(first);
  },[visible,selectedId]);
  const selected=leads.find(l=>l.id===selectedId);
  const selectedPriority=selected?priorityFor(selected):null;
  const selectedEngagement=selected?engagement(selected):null;
  const refresh=()=>{refreshLeads();loadCalendar();};

  const removeTag=async lead=>{
    if(!window.confirm('Remove the Hot Lead tag from '+fullname(lead)+'? This keeps the contact and all its history.'))return;
    setRemoveBusy(lead.id);setRemoveError('');
    try{
      await base44.entities.DebtLead.update(lead.id,{isHotLead:false,hotLeadTaggedAt:null,hotLeadTaggedBy:null});
      if(selectedId===lead.id)setSelectedId(null);
      refreshLeads();
    }catch(err){setRemoveError('Could not remove the tag: '+(err?.message||'Try again.'));}
    finally{setRemoveBusy('');}
  };

  return <div className="hl-root">
    <header className="hl-header">
      <div>
        <div className="hl-eyebrow"><Flame size={14}/>Settlement IQ · Priority pipeline</div>
        <h2>Hot Lead Command Center</h2>
        <p>Act on the next conversation, not just the newest tag. All priorities are suggestions based on saved activity.</p>
      </div>
      <div className="hl-header-actions">
        <button className="hl-btn secondary" type="button" disabled={refreshing||calendarLoading} onClick={refresh}><RefreshCcw size={14}/>Refresh</button>
        {onOpenHeatMap&&<button className="hl-btn secondary" type="button" onClick={onOpenHeatMap}><Map size={14}/>Deal heat map</button>}
      </div>
    </header>

    <div className="hl-metrics">
      <Stat Icon={Users} label="Hot leads" value={Number(total??leads.length).toLocaleString()} caption={search?'Matching tagged leads':'Tagged contacts'}/>
      <Stat Icon={CircleAlert} label="Needs attention" value={counts.attention} caption="Among loaded leads" tone="red"/>
      <Stat Icon={CalendarDays} label="Appointments today" value={counts.today} caption="Loaded hot leads" tone="blue"/>
      <Stat Icon={Activity} label="Highly engaged" value={counts.engaged} caption="Email + link signals" tone="green"/>
    </div>

    <div className="hl-tools">
      <label className="hl-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search hot leads by name, email, phone…" aria-label="Search hot leads"/></label>
      <div className="hl-filters" role="group" aria-label="Filter hot leads">
        {FILTERS.map(([id,label])=><button key={id} type="button" className="hl-filter" aria-pressed={filter===id} onClick={()=>setFilter(id)}>
          {label}{id!=='all'&&<span>{counts[id]}</span>}
        </button>)}
      </div>
      <select className="hl-select" aria-label="Sort hot leads" value={sort} onChange={e=>setSort(e.target.value)}>
        <option value="priority">Suggested priority</option>
        <option value="appointment">Appointment time</option>
        <option value="newest">Recently tagged</option>
        <option value="debt">Highest debt</option>
      </select>
    </div>

    {leadError&&<div className="hl-inline-error" role="alert"><AlertCircle size={14}/>Leads could not refresh. Showing the last loaded records, if available.</div>}
    {removeError&&<div className="hl-inline-error" role="alert"><AlertCircle size={14}/>{removeError}</div>}
    <div className="hl-columns">
      <section className="hl-queue">
        <div className="hl-panel-heading"><strong>Priority queue</strong><span>{visible.length} visible · {leads.length} loaded</span></div>
        {loading&&!leads.length
          ?<div className="hl-empty">Loading hot leads…</div>
          : !visible.length
          ?<div className="hl-empty">{search?'No matching contacts.':filter!=='all'?'No contacts in this category.':'No hot leads yet. Tag a contact to add it here.'}</div>
          :<div className="hl-queue-scroll" role="listbox" aria-label="Hot leads">
            <div className="hl-table-header" aria-hidden="true">
              <span>Contact</span><span>Debt / calls</span><span>Next touch / owner</span><span>Email activity</span><span>Priority</span>
            </div>
            {visible.map(({lead,p})=>{
              const nextIsCallback=lead.callbackAt && (!lead.appointmentDate || (parseTime(lead.callbackAt)||Infinity)<(parseTime(lead.appointmentDate)||Infinity));
              const nextDate=nextIsCallback?lead.callbackAt:lead.appointmentDate;
              return <button type="button" key={lead.id} className="hl-lead-row hl-data-row" role="option" aria-selected={selectedId===lead.id} onClick={()=>setSelectedId(lead.id)} title={"View intelligence for "+fullname(lead)}>
                <span className="hl-cell hl-cell-contact">
                  <strong>{fullname(lead)}</strong>
                  <small>{lead.phone||lead.email||'No phone saved'}</small>
                </span>
                <span className="hl-cell">
                  <strong>{currency(lead.debtAmount)}</strong>
                  <small>{Number(lead.callCount||0)} calls</small>
                </span>
                <span className="hl-cell">
                  <strong>{nextDate?(nextIsCallback?'Call ':'Appt ')+formatDate(nextDate):'No follow-up'}</strong>
                  <small>{lead.debtCoachOwner||'Unassigned'}</small>
                </span>
                <span className="hl-cell">
                  <strong>{p.clickCount?p.clickCount+'/3 links':p.opened?'Email opened':'No activity yet'}</strong>
                  <small>{lead.intentScore!=null?'Intent '+Math.round(Number(lead.intentScore)):'Not scored'}</small>
                </span>
                <span className="hl-cell hl-cell-priority">
                  <span className={'hl-lead-badge '+p.kind}>{p.label}</span>
                  <small>{p.reasons[0]||('Tagged '+ago(lead.hotLeadTaggedAt))}</small>
                </span>
              </button>;
            })}
          </div>}
        {hasMore&&<div className="hl-loadmore"><button type="button" disabled={loadingMore} onClick={loadMore}>{loadingMore?'Loading…':'Load more hot leads'}</button></div>}
        <div className="hl-queue-foot">Sorted within loaded leads. Load more to include older tagged contacts in the priority ranking.</div>
      </section>

      <aside className="hl-side">
        <HotLeadsCalendar events={calendar} loading={calendarLoading} error={calendarError} onRefresh={loadCalendar} leads={leads} username={user?.username} onOpenLead={onOpenLead}/>
        <section className="hl-detail">
          <div className="hl-panel-heading"><strong>Contact intelligence</strong><span>{selected?'Selected contact':'Select a lead'}</span></div>
          {!selected?<div className="hl-empty"><UserRound size={22}/>Select a lead from the queue to see recent signals, details and actions.</div>:
            <div className="hl-detail-inner">
              <div className="hl-person">
                <div><h3>{fullname(selected)}</h3><div className="hl-person-meta">{selected.leadNumber||'Contact'} {selected.status?' · '+selected.status:''}</div></div>
                <span className={'hl-lead-badge '+selectedPriority.kind}>{selectedPriority.label}</span>
              </div>
              {selectedPriority.reasons.length>0&&<div className="hl-priority-note"><Sparkles size={15}/><span><strong>Suggested next focus</strong>{selectedPriority.reasons.slice(0,2).join(' · ')}</span></div>}
              <div className="hl-quick-actions">
                <button className="hl-btn gold" type="button" onClick={()=>onOpenLead?.(selected)}><UserRound size={14}/>Open contact card</button>
                {selected.phone&&<a className="hl-btn secondary" href={'tel:'+selected.phone.replace(/[^+\d]/g,'')} title="Dial using your device's phone handler"><Phone size={14}/>Call</a>}
                {selected.email&&<a className="hl-btn secondary" href={'mailto:'+selected.email} title="Open your email app; tracked platform mailers are sent from the contact card"><Mail size={14}/>Email</a>}
              </div>
              <Section title="Contact snapshot">
                <div className="hl-data-grid">
                  <DataPair label="Total debt" value={currency(selected.debtAmount)}/>
                  <DataPair label="Assigned agent" value={selected.debtCoachOwner||'Unassigned'}/>
                  <DataPair label="Intent score" value={selected.intentScore!=null?Math.round(Number(selected.intentScore))+'/100':'Not scored'}/>
                  <DataPair label="Last call" value={selected.lastCallAt?ago(selected.lastCallAt):'No call logged'}/>
                  <DataPair label="Call count" value={Number(selected.callCount||0)}/>
                  <DataPair label="Tagged hot" value={selected.hotLeadTaggedAt?ago(selected.hotLeadTaggedAt):'—'}/>
                </div>
              </Section>
              <Section title="Appointment & follow-up">
                <DataPair label="Appointment" value={selected.appointmentDate?formatDate(selected.appointmentDate)+' ET':'Not scheduled'}/>
                <DataPair label="Confirmation" value={selected.appointmentDate?(selected.appointmentConfirmed?'Client confirmed':'Not confirmed'):'—'}/>
                <DataPair label="Callback" value={selected.callbackAt?formatDate(selected.callbackAt)+' ET':'Not scheduled'}/>
                {selected.appointmentChangeRequested&&<div className="hl-inline-alert"><CircleAlert size={13}/>Client requested a change</div>}
                {selected.appointmentEventHtmlLink&&<a className="hl-subtle-link" href={selected.appointmentEventHtmlLink} target="_blank" rel="noreferrer"><ExternalLink size={12}/>View appointment in Calendar</a>}
              </Section>
              <Section title="Engagement signals">
                <div className="hl-signal-grid">
                  <span className={selectedEngagement.opened?'active':''}><Mail size={13}/>{selectedEngagement.opened?'Reminder opened':'No reminder open tracked'}</span>
                  <span className={selectedEngagement.clickCount>=2?'active':''}><Activity size={13}/>{selectedEngagement.clickCount}/3 credibility links clicked</span>
                  <span className={selectedEngagement.oneHour?'active':''}><Clock3 size={13}/>{selectedEngagement.oneHour?'1-hour reminder opened':'No 1-hour open tracked'}</span>
                  <span className={selected.appointmentConfirmed?'active':''}><CheckCircle2 size={13}/>{selected.appointmentConfirmed?'Appointment confirmed':'Not confirmed'}</span>
                </div>
              </Section>
              {(selected.nextCallBriefing||selected.notes)&&<Section title={selected.nextCallBriefing?'Next-call briefing':'Contact notes'}>
                <p className="hl-briefing">{(selected.nextCallBriefing||selected.notes).slice(0,800)}</p>
              </Section>}
              <div className="hl-detail-bottom">
                <button className="hl-remove" type="button" disabled={removeBusy===selected.id} onClick={()=>removeTag(selected)}><X size={13}/>{removeBusy===selected.id?'Removing…':'Remove hot tag'}</button>
                <span>Credentials and tracked outreach are available in the contact card.</span>
              </div>
            </div>}
        </section>
      </aside>
    </div>
    <p className="hl-disclaimer">Priority is based on available saved signals—not a prediction of enrollment. Email opens and link clicks may be incomplete. Times use Eastern Time.</p>
  </div>;
}
