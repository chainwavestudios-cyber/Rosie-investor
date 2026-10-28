/**
 * Prospect Intelligence Center — compact CRM roster + actionable AI briefing.
 * Preserves role-scoped lead reads, full contact-card editor, AI profile metrics,
 * memories, migrated Fronter leads, and explicit report acknowledgement.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Activity, ArrowUpRight, BarChart3, CalendarClock, CalendarDays, CheckCircle2,
  ChevronDown, FileText, Flame, Headphones, Mail, Phone, Plus,
  RefreshCcw, Search, Sparkles, UserRound, Users, X
} from 'lucide-react';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import IntentReportModal from '@/components/debt/IntentReportModal';
import MigratedLeadsPanel from '@/components/debt/MigratedLeadsPanel';
import KeyFactsPanel from '@/components/debt/KeyFactsPanel';
import NextCallBriefing from '@/components/debt/NextCallBriefing';
import CardTypeChip from '@/components/debt/CardTypeChip';
import { cardTypeOf } from '@/lib/cardTypes';
import './DebtUserProfile.css';

const PAGE = 200;
const asRows = r => Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : [];
const parseJson = v => { try { return typeof v === 'string' ? JSON.parse(v) : v || {}; } catch { return {}; } };
const safe = v => typeof v === 'string' ? v.trim() : '';
const fullName = l => [l?.firstName, l?.lastName].filter(Boolean).join(' ').trim() || 'Unnamed prospect';
const money = n => Number(n) > 0 ? '$' + Math.round(Number(n)).toLocaleString('en-US') : '—';
const dateText = s => {
  if (!s || Number.isNaN(new Date(s).getTime())) return '—';
  return new Date(s).toLocaleString('en-US', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
};
const timeNum = s => s && Number.isFinite(new Date(s).getTime()) ? new Date(s).getTime() : 0;
const prospectType = l => cardTypeOf(l) === 'campaign' ? 'campaign' : 'prospect';
const upcoming = l => {
  const timestamp = timeNum(l?.callbackAt) || timeNum(l?.appointmentDate);
  return timestamp > Date.now() ? timestamp : 0;
};
const needsAction = l => {
  const callback = timeNum(l?.callbackAt);
  const booked = timeNum(l?.appointmentDate);
  const last = timeNum(l?.lastCallAt);
  if (['declined','enrolled','completed'].includes(l?.status)) return false;
  return Boolean(l?.appointmentChangeRequested || (callback && callback < Date.now() && last < callback) || (booked && booked < Date.now() && last < booked));
};
const nextStep = call => {
  if (!call) return '';
  const intent = parseJson(call.intentPlaybookJson), analysis = parseJson(call.callAnalysisJson);
  return safe(intent.recommendedNextStep) ||
    safe(intent.nextCallPlaybook?.recommendedNextStep) ||
    safe(analysis.detailedFollowUp?.recommendedApproach) ||
    safe(call.followUpReport);
};
const callSummary = call => {
  if (!call) return '';
  const intent = parseJson(call.intentPlaybookJson), analysis = parseJson(call.callAnalysisJson);
  return safe(analysis.managerReport?.summary) || safe(intent.summary) || safe(intent.callSummary) ||
    safe(call.intentReport).slice(0,450);
};
const FILTERS = [
  ['prospect','Prospects'], ['campaign','Campaign'], ['all','All contacts']
];
const PRIORITY = [
  ['all','All'],['hot','Hot leads'],['attention','Needs action'],
  ['upcoming','Upcoming'],['high','High intent']
];
function Metric({Icon,label,value,sub}) {
  return <div className="pic-metric"><div className="pic-metric-name">{label}<Icon size={15}/></div><strong>{value}</strong><span>{sub}</span></div>;
}
function LabelValue({label,value}) {
  return <div className="pic-kv"><span>{label}</span><strong>{value || '—'}</strong></div>;
}
function Insight({label,value,note}) {
  return <div className="pic-insight"><span>{label}</span><strong>{value ?? '—'}</strong>{note && <small>{note}</small>}</div>;
}

export default function DebtUserProfile({ debtCoachUser, onGoToCalls }) {
  const [leads,setLeads] = useState([]);
  const [selectedId,setSelectedId] = useState(null);
  const [loading,setLoading] = useState(true);
  const [loadingMore,setLoadingMore] = useState(false);
  const [hasMore,setHasMore] = useState(false);
  const [error,setError] = useState('');
  const [creating,setCreating] = useState(false);
  const [promoting,setPromoting] = useState(false);
  const [cardView,setCardView] = useState('prospect');
  const [priority,setPriority] = useState('all');
  const [search,setSearch] = useState('');
  const [sort,setSort] = useState('recent');
  const [subView,setSubView] = useState('all');
  const [profileView,setProfileView] = useState(null);
  const [reportOpen,setReportOpen] = useState(false);
  const [calls,setCalls] = useState([]);
  const [callsLoading,setCallsLoading] = useState(false);
  const [callsError,setCallsError] = useState('');
  const [showAnalysis,setShowAnalysis] = useState(false);
  const cursorRef = useRef(0);
  const requestRef = useRef(0);

  // Preserve original access: dialers read only assigned DebtLead records.
  const readPage = useCallback(async (skip) => {
    const who = debtCoachUser?.username;
    if (debtCoachUser?.role === 'dialer') {
      if (!who) return [];
      return asRows(await base44.entities.DebtLead.filter({ debtCoachOwner: who }, '-updated_date', PAGE, skip));
    }
    return asRows(await base44.entities.DebtLead.list('-updated_date', PAGE, skip));
  },[debtCoachUser?.role,debtCoachUser?.username]);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);setError('');
    try {
      const page = await readPage(0);
      if (request !== requestRef.current) return;
      cursorRef.current = page.length;
      setHasMore(page.length === PAGE);
      setLeads(page.filter(l => !l.deletedAt));
    } catch(e) {
      if (request === requestRef.current) setError('Could not load prospects: ' + (e?.message || 'Please retry.'));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  },[readPage]);

  useEffect(()=>{load();return()=>{requestRef.current++;};},[load]);

  const loadMore = async () => {
    if (loadingMore || loading || !hasMore) return;
    const request = requestRef.current;
    setLoadingMore(true);setError('');
    try {
      const next = await readPage(cursorRef.current);
      if (request !== requestRef.current) return;
      cursorRef.current += next.length;
      setHasMore(next.length === PAGE);
      setLeads(prev => {
        const seen = new Set(prev.map(l=>l.id));
        return [...prev,...next.filter(l=>!l.deletedAt&&!seen.has(l.id))];
      });
    } catch(e) {
      if (request === requestRef.current) setError('Could not load additional prospects: ' + (e?.message || 'Please retry.'));
    } finally {setLoadingMore(false);}
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = leads.filter(l => {
      if (cardView !== 'all' && prospectType(l) !== cardView) return false;
      if (priority==='hot' && !l.isHotLead) return false;
      if (priority==='attention' && !needsAction(l)) return false;
      if (priority==='upcoming' && !upcoming(l)) return false;
      if (priority==='high' && !(Number(l.intentScore) >= 75 && l.intentScore != null)) return false;
      return !q || [fullName(l),l.email,l.phone,l.leadNumber,l.city,l.state,l.status]
        .some(v => String(v||'').toLowerCase().includes(q));
    });
    return rows.sort((a,b)=>{
      if (sort==='intent') return (Number(b.intentScore)||0)-(Number(a.intentScore)||0);
      if (sort==='debt') return (Number(b.debtAmount)||0)-(Number(a.debtAmount)||0);
      if (sort==='calls') return (Number(b.callCount)||0)-(Number(a.callCount)||0);
      if (sort==='name') return fullName(a).localeCompare(fullName(b));
      return timeNum(b.updated_date||b.lastCallAt)-timeNum(a.updated_date||a.lastCallAt);
    });
  },[leads,cardView,priority,search,sort]);

  // Selection is *always* from the current view: no stale campaign card
  // hanging in the detail pane after switching to Prospects.
  const selected = visible.find(l=>l.id===selectedId) || visible[0] || null;
  const profile = useMemo(()=>parseJson(selected?.profileJson),[selected?.profileJson]);
  const latest = calls[0] || null;
  const latestReport = calls.find(c=>safe(c.intentReport)) || null;
  const next = nextStep(latest) || safe(profile.recommendedApproach);
  const summary = callSummary(latest) || safe(profile.lastCallSummary);
  const outstanding = leads.filter(needsAction).length;

  useEffect(()=>{
    let cancelled = false;
    if (!selected?.id) {setCalls([]);setCallsLoading(false);setCallsError('');return undefined;}
    setCalls([]);setCallsLoading(true);setCallsError('');setReportOpen(false);setShowAnalysis(false);
    base44.entities.DebtCallTranscript.filter({leadId:selected.id},'-callDate',10)
      .then(r=>{if(!cancelled)setCalls(asRows(r));})
      .catch(()=>{if(!cancelled)setCallsError('Recent call details could not be loaded.');})
      .finally(()=>{if(!cancelled)setCallsLoading(false);});
    return ()=>{cancelled=true;};
  },[selected?.id]);

  const createNewProspect = async () => {
    setCreating(true);setError('');
    try {
      // Keep the original sequential lead-number convention.
      const recent = asRows(await base44.entities.DebtLead.list('-created_date',500));
      const largest = recent.reduce((max,l)=>{
        const n = parseInt(String(l.leadNumber||'').replace('#',''),10);
        return Number.isFinite(n)?Math.max(max,n):max;
      },0);
      const created = await base44.entities.DebtLead.create({
        firstName:'New',lastName:'Prospect',status:'new',callCount:0,
        isProspect:true,leadNumber:'#'+String(largest+1).padStart(5,'0'),
        debtCoachOwner:debtCoachUser?.username||null
      });
      setCardView('prospect');setPriority('all');setSearch('');
      await load();
      setLeads(prev=>prev.some(l=>l.id===created.id)?prev:[created,...prev]);
      setSelectedId(created.id);
      setProfileView({lead:created,initialTab:'overview'});
    } catch(e) {setError('Failed to create prospect: '+(e?.message||String(e)));}
    finally {setCreating(false);}
  };
  const promote = async () => {
    if (!selected?.id||promoting)return;
    setPromoting(true);setError('');
    try {
      const patch={isProspect:true,prospectTaggedAt:new Date().toISOString(),
        prospectTaggedBy:debtCoachUser?.username||''};
      const saved=await base44.entities.DebtLead.update(selected.id,patch);
      setLeads(prev=>prev.map(l=>l.id===selected.id?{...l,...patch,...saved}:l));
    } catch(e){setError('Could not promote the contact: '+(e?.message||String(e)));}
    finally{setPromoting(false);}
  };
  const openProfile = initialTab => {
    if(selected)setProfileView({lead:selected,initialTab});
  };
  const onProfileSave = updated => {
    if (!updated?.id)return;
    setLeads(prev=>prev.map(l=>l.id===updated.id?{...l,...updated}:l));
    setProfileView(prev=>prev?.lead.id===updated.id?{...prev,lead:{...prev.lead,...updated}}:prev);
  };
  const closeProfile = () => {
    setProfileView(null);
    load();
  };
  const acknowledgeReport = async () => {
    if (!latestReport?.id) {setReportOpen(false);return;}
    try {
      const stamp = new Date().toISOString();
      await base44.entities.DebtCallTranscript.update(latestReport.id,{reportAcknowledgedAt:stamp});
      setCalls(prev=>prev.map(c=>c.id===latestReport.id?{...c,reportAcknowledgedAt:stamp}:c));
      setReportOpen(false);
    } catch(e) {setError('Could not acknowledge the intent report: '+(e?.message||String(e)));}
  };

  if (subView==='migrated') {
    return <div className="pic-root">
      <div className="pic-migrate-nav">
        <button className="pic-btn" onClick={()=>setSubView('all')}><UserRound size={14}/> All prospects</button>
        <span className="pic-muted">Migrated from Fronter</span>
      </div>
      <MigratedLeadsPanel debtCoachUser={debtCoachUser}/>
    </div>;
  }

  return <div className="pic-root">
    <header className="pic-header">
      <div><span className="pic-eyebrow">Settlement IQ · Customer intelligence</span>
        <h2>Prospect Intelligence Center</h2>
        <p>Every prospect, conversation, next action and customer insight in one workspace.</p>
      </div>
      <div className="pic-header-actions">
        <button className="pic-btn pic-btn-soft" onClick={()=>setSubView('migrated')}><Users size={14}/> Fronter migrations</button>
        <button className="pic-btn pic-btn-soft" onClick={load} disabled={loading}><RefreshCcw size={14}/> {loading?'Refreshing…':'Refresh'}</button>
        <button className="pic-btn pic-btn-primary" onClick={createNewProspect} disabled={creating}><Plus size={15}/>{creating?'Creating…':'New prospect'}</button>
      </div>
    </header>
    <div className="pic-metrics">
      <Metric Icon={Users} label="Loaded contacts" value={leads.length} sub={hasMore?'More records available':'In your access scope'}/>
      <Metric Icon={UserRound} label="Prospects" value={leads.filter(l=>prospectType(l)==='prospect').length} sub="Excludes unpromoted campaigns"/>
      <Metric Icon={Flame} label="Hot leads" value={leads.filter(l=>l.isHotLead).length} sub="Manually flagged contacts"/>
      <Metric Icon={CalendarClock} label="Need attention" value={outstanding} sub="From available appointment data"/>
    </div>
    <div className="pic-toolbar">
      <label className="pic-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, phone, lead number…" aria-label="Search prospects"/></label>
      <select className="pic-select" value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort prospects">
        <option value="recent">Recently updated</option><option value="intent">Highest intent</option>
        <option value="debt">Highest debt</option><option value="calls">Most calls</option>
        <option value="name">Name A–Z</option>
      </select>
    </div>
    <div className="pic-tabline" role="group" aria-label="Contact classification">
      {FILTERS.map(([value,label])=><button key={value} className="pic-tab" aria-pressed={cardView===value} onClick={()=>{setCardView(value);setSelectedId(null);}}>{label}<span>{leads.filter(l=>value==='all'||prospectType(l)===value).length}</span></button>)}
    </div>
    <div className="pic-chipline" role="group" aria-label="Prospect priorities">
      {PRIORITY.map(([value,label])=><button key={value} className="pic-chip" aria-pressed={priority===value} onClick={()=>{setPriority(value);setSelectedId(null);}}>{label}</button>)}
    </div>
    {error&&<div className="pic-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X size={14}/></button></div>}
    <div className="pic-workspace">
      <section className="pic-roster" aria-label="Prospect list">
        <div className="pic-panel-heading"><span>Contact roster</span><span>{visible.length} shown{hasMore?' · more available':''}</span></div>
        {loading&&!leads.length?<div className="pic-empty">Loading prospects…</div>:
          visible.length===0?<div className="pic-empty">No contacts match this view. Change the filters or search.</div>:
          <div className="pic-roster-scroll">
            {visible.map(l=><button key={l.id} type="button" className="pic-contact" aria-pressed={selected?.id===l.id} onClick={()=>setSelectedId(l.id)}>
              <div className="pic-contact-top"><strong>{fullName(l)}</strong><span>{l.intentScore==null?'':String(l.intentScore)+'/100'}</span></div>
              <div className="pic-contact-bottom"><span>{l.leadNumber||l.phone||'No contact number'} · {money(l.debtAmount)}</span>
                <span className="pic-mini-flags">{l.isHotLead&&<Flame size={12} className="pic-hot" aria-label="Hot lead"/>}
                  {needsAction(l)&&<CalendarClock size={12} className="pic-alert" aria-label="Needs action"/>}
                  {upcoming(l)>0&&<CalendarDays size={12} className="pic-green" aria-label="Upcoming appointment"/>}
                  {prospectType(l)==='campaign'&&<Mail size={12} aria-label="Campaign"/>}
                </span>
              </div>
            </button>)}
          </div>
        }
        {hasMore&&<button className="pic-loadmore" disabled={loadingMore||loading} onClick={loadMore}>
          <ChevronDown size={14}/>{loadingMore?'Loading…':'Load more contacts'}
        </button>}
        <div className="pic-roster-foot">Compact records · filters search loaded results. {hasMore?'Load more to expand your search.':'All available records loaded.'}</div>
      </section>
      <section className="pic-detail" aria-label="Prospect intelligence">
        {!selected?<div className="pic-empty pic-empty-large">Select a contact to review their history and next steps.</div>:<>
          <div className="pic-person">
            <div className="pic-person-head">
              <div><div className="pic-eyebrow">Customer briefing · {selected.leadNumber||'Contact record'}</div>
                <h3>{fullName(selected)}</h3>
                <div className="pic-identity">{selected.phone&&<span><Phone size={12}/>{selected.phone}</span>}
                  {selected.email&&<span><Mail size={12}/>{selected.email}</span>}
                </div>
                <div className="pic-tags"><CardTypeChip lead={selected}/><span className="pic-status">{selected.status||'new'}</span>
                  {selected.isHotLead&&<span className="pic-flag-hot"><Flame size={11}/> Hot lead</span>}
                  {needsAction(selected)&&<span className="pic-flag-alert">Follow-up needs attention</span>}
                </div>
              </div>
              <div className="pic-intent"><strong>{selected.intentScore!=null?selected.intentScore:'—'}</strong><span>Intent /100</span></div>
            </div>
            <div className="pic-actions">
              <button className="pic-btn pic-btn-primary" onClick={()=>openProfile('overview')}><UserRound size={14}/> Contact card <ArrowUpRight size={12}/></button>
              <button className="pic-btn" onClick={()=>openProfile('activity')}><CalendarDays size={14}/> Follow-up / rebook</button>
              <NextCallBriefing key={selected.id} lead={selected} agentUsername={debtCoachUser?.username} compact/>
              <button className="pic-btn" onClick={()=>setReportOpen(true)} disabled={!latestReport||callsLoading}><FileText size={14}/> Intent report</button>
              {onGoToCalls&&<button className="pic-btn pic-btn-soft" onClick={onGoToCalls}><Headphones size={14}/> Calls tab</button>}
              {prospectType(selected)==='campaign'&&<button className="pic-btn pic-btn-soft" onClick={promote} disabled={promoting}><CheckCircle2 size={14}/>{promoting?'Promoting…':'Promote to prospect'}</button>}
            </div>
          </div>
          <div className="pic-detail-scroll">
            <div className="pic-financial">
              <LabelValue label="Total unsecured debt" value={money(selected.debtAmount)}/>
              <LabelValue label="Creditors" value={selected.creditorCount||'—'}/>
              <LabelValue label="Monthly income" value={money(selected.monthlyIncome)}/>
              <LabelValue label="Credit score" value={selected.creditScore||'—'}/>
            </div>
            <div className="pic-two-cards">
              <article className="pic-info-card pic-featured"><h4><Sparkles size={15}/> Recommended next action</h4>
                {callsLoading?<p className="pic-muted">Loading last call…</p>:next?<p>{next}</p>:<p className="pic-muted">No next-step recommendation recorded. Review the contact card and call history.</p>}
                {selected.appointmentChangeRequested&&<div className="pic-reminder">Appointment change requested</div>}
                {selected.callbackAt&&<div className="pic-reminder">Callback: {dateText(selected.callbackAt)}</div>}
                {selected.appointmentDate&&<div className="pic-reminder">Appointment: {dateText(selected.appointmentDate)}{selected.appointmentConfirmed?' · Confirmed':''}</div>}
              </article>
              <article className="pic-info-card"><h4><Activity size={15}/> Last conversation</h4>
                {callsLoading?<p className="pic-muted">Loading call history…</p>:
                  summary?<p>{summary}</p>:
                    selected.notes?<p>{String(selected.notes).slice(0,420)}</p>:
                      <p className="pic-muted">No saved AI summary for this contact.</p>}
                <div className="pic-meta">{latest?.callDate?'Last recorded call · '+dateText(latest.callDate):selected.lastCallAt?'Last call · '+dateText(selected.lastCallAt):'No saved calls'} · {selected.callCount||0} logged calls</div>
                {callsError&&<div className="pic-muted" role="status">{callsError}</div>}
              </article>
            </div>
            <article className="pic-info-card"><h4><CalendarClock size={15}/> Contact & follow-up</h4>
              <div className="pic-followup-grid">
                <LabelValue label="Last contacted" value={dateText(selected.lastCallAt)}/>
                <LabelValue label="Next appointment" value={dateText(selected.appointmentDate)}/>
                <LabelValue label="Callback" value={dateText(selected.callbackAt)}/>
                <LabelValue label="Last updated" value={dateText(selected.updated_date)}/>
              </div>
            </article>
            <article className="pic-info-card">
              <div className="pic-cardtop"><h4><BarChart3 size={15}/> AI behavioral analysis</h4>
                <button className="pic-link" onClick={()=>setShowAnalysis(v=>!v)} aria-expanded={showAnalysis}>{showAnalysis?'Hide details':'View full analysis'} <ChevronDown size={13}/></button>
              </div>
              <div className="pic-insight-grid">
                <Insight label="Engagement" value={profile.engagementScore!=null?profile.engagementScore+'/100':'—'}/>
                <Insight label="Commitment" value={profile.commitmentLevel}/>
                <Insight label="Emotional state" value={profile.emotionalState}/>
                <Insight label="Rapport" value={profile.rapportLevel!=null?profile.rapportLevel+'/100':'—'}/>
              </div>
              {showAnalysis&&<div className="pic-analysis-expanded">
                <div className="pic-insight-grid">
                  <Insight label="Excitement" value={profile.excitementLevel} note={profile.excitementNotes}/>
                  <Insight label="Pace" value={profile.pace} note={profile.paceNotes}/>
                  <Insight label="Questions asked" value={profile.questionCount}/>
                  <Insight label="Talk ratio" value={profile.talkRatioProspect!=null?profile.talkRatioProspect+'%':'—'}/>
                  <Insight label="Hesitations" value={profile.hesitationCount}/>
                  <Insight label="Animal type" value={profile.animalType||selected.animalType} note={profile.animalConfidence!=null?profile.animalConfidence+'% confidence':''}/>
                  <Insight label="Call duration" value={profile.callDurationSeconds != null ? Math.floor(profile.callDurationSeconds/60)+'m '+(profile.callDurationSeconds%60)+'s' : '—'}/>
                  <Insight label="Clarity / rapport" value={profile.rapportLevel!=null?profile.rapportLevel+'/100':'—'} note={profile.rapportNotes}/>
                </div>
                {profile.overallIntentLabel&&<p><strong>Overall intent:</strong> {profile.overallIntentLabel}</p>}
                {profile.engagementNotes&&<p><strong>Engagement:</strong> {profile.engagementNotes}</p>}
                {profile.emotionalNotes&&<p><strong>Emotional read:</strong> {profile.emotionalNotes}</p>}
                {profile.commitmentDetails&&<p><strong>Commitment:</strong> {profile.commitmentDetails}</p>}
                {profile.paceNotes&&<p><strong>Conversation pace:</strong> {profile.paceNotes}</p>}
                {Array.isArray(profile.keyObservations)&&profile.keyObservations.length>0&&<div><strong>Key observations</strong>{profile.keyObservations.map((p,i)=><p key={i}>• {typeof p==='string'?p:JSON.stringify(p)}</p>)}</div>}
                {profile.recommendedApproach&&<p><strong>Approach:</strong> {profile.recommendedApproach}</p>}
                {profile.traits&&typeof profile.traits==='object'&&<div className="pic-traits">{Object.entries(profile.traits).filter(([,v])=>v).map(([key])=><span key={key}>{key.replace(/([A-Z])/g,' $1')}</span>)}</div>}
              </div>}
            </article>
            <article className="pic-info-card"><h4><Users size={15}/> Key facts & memory</h4>
              <KeyFactsPanel key={selected.id} leadId={selected.id} leadName={fullName(selected)}/>
            </article>
            {selected.notes&&<article className="pic-info-card"><h4><FileText size={15}/> Agent notes</h4><p className="pic-notes">{selected.notes}</p></article>}
          </div>
        </>}
      </section>
    </div>
    {profileView&&<ClientProfileModal key={profileView.lead.id} lead={profileView.lead} username={debtCoachUser?.username}
      initialTab={profileView.initialTab} onClose={closeProfile} onSave={onProfileSave}/>}
    {reportOpen&&latestReport&&selected&&<IntentReportModal
      report={latestReport.intentReport} callDate={latestReport.callDate}
      leadName={fullName(selected)} onAcknowledge={acknowledgeReport}
      onDismiss={()=>setReportOpen(false)}/>}
  </div>;
}
