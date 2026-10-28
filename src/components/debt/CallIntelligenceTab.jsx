import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { CallDetail } from '@/components/debt/CallsTab';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import { Activity, ArrowUpRight, AudioLines, BarChart3, BrainCircuit, Clock3, FileText, Headphones, MessageSquare, Phone, RefreshCcw, Search, Sparkles, UserRound } from 'lucide-react';
import './CallIntelligenceTab.css';

const safeText = v => typeof v === 'string' ? v.trim() : '';
const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
const when = date => { if (!date || Number.isNaN(new Date(date).getTime())) return 'No date'; return new Date(date).toLocaleString('en-US', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); };
const dur = seconds => seconds == null || !Number.isFinite(Number(seconds)) ? '—' : Math.floor(Math.max(0,Number(seconds))/60) + 'm ' + String(Math.floor(Math.max(0,Number(seconds))%60)).padStart(2,'0') + 's';
const highIntent = c => c.intentScore != null && Number(c.intentScore) >= 75;
const followUp = c => Boolean(safeText(c.followUpReport) || safeText(parse(c.intentPlaybookJson).recommendedNextStep) || safeText(parse(c.callAnalysisJson).detailedFollowUp?.recommendedApproach));
const reviewPending = c => Boolean((c.intentReport || c.callAnalysisJson || c.intentPlaybookJson) && !c.reportAcknowledgedAt);

const FILTERS = [['all','All calls'],['followup','Follow-up signals'],['review','Unacknowledged'],['high','High intent'],['audio','With audio']];

function Metric({Icon,label,value,note}) {
  return <div className="ci-metric"><div className="ci-metric-label">{label}<Icon size={15}/></div><div className="ci-metric-value">{value}</div><div className="ci-metric-note">{note}</div></div>;
}
function GradeBar({label,value}) {
  const valid = value != null && Number.isFinite(Number(value));
  const width = valid ? Math.max(0,Math.min(100,Number(value))) : 0;
  return <div className="ci-score"><div className="ci-score-title"><span>{label}</span><strong>{valid ? Math.round(width)+'/100' : '—'}</strong></div><div className="ci-score-track"><div style={{width:width+'%'}} /></div></div>;
}
function extract(c) {
  const a = parse(c.callAnalysisJson), i = parse(c.intentPlaybookJson);
  const m = a.managerReport || {}, f = a.detailedFollowUp || {};
  return {
    summary: safeText(m.summary) || safeText(i.summary) || safeText(i.callSummary) || safeText(c.intentReport).slice(0,440),
    next: safeText(i.recommendedNextStep) || safeText(f.recommendedApproach) || safeText(i.nextCallPlaybook?.recommendedNextStep) || safeText(c.followUpReport).slice(0,380),
    moments: Array.isArray(a.timeline) ? a.timeline.filter(t=>Number.isFinite(Number(t.offsetSeconds))) : [],
    points: Array.isArray(f.talkingPoints) ? f.talkingPoints : [],
    objections: Array.isArray(i.objections) ? i.objections : [],
    manager: m,
  };
}
const clock = s => Math.floor(Number(s)/60) + ':' + String(Math.floor(Number(s)%60)).padStart(2,'0');

export default function CallIntelligenceTab() {
  const { user, isDialerRole, canManage } = useDebtCoachAuth();
  const [calls,setCalls] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [selectedId,setSelectedId] = useState(null);
  const [search,setSearch] = useState('');
  const [filter,setFilter] = useState('all');
  const [dates,setDates] = useState('all');
  const [agent,setAgent] = useState('all');
  const [profile,setProfile] = useState(null);
  const [openingProfile,setOpeningProfile] = useState(false);
  const [detail,setDetail] = useState({section:'transcript',seek:null,token:0});

  const loadCalls = useCallback(async () => {
    if (isDialerRole && !user?.username) {setCalls([]);setLoading(false);return;}
    setLoading(true);setError('');
    try {
      // Maintain exactly the original access scope; do not infer phone joins
      // or introduce unscoped dialer logs from unrelated systems.
      const response = isDialerRole
        ? await base44.entities.DebtCallTranscript.filter({agentId:user.username},'-callDate',200)
        : await base44.entities.DebtCallTranscript.list('-callDate',200);
      const rows = Array.isArray(response) ? response : response?.items || [];
      const ids = [...new Set(rows.map(c=>c.leadId).filter(Boolean))], names = {};
      if (ids.length) {
        try {
          const result = await base44.entities.DebtLead.filter({id:{$in:ids}});
          for(const l of (Array.isArray(result) ? result : result?.items || [])) {
            names[l.id] = [l.firstName,l.lastName].filter(Boolean).join(' ');
          }
        } catch(e) {console.warn('Unable to resolve some contact names',e);}
      }
      const next = rows.map(c=>({...c,resolvedLeadName:names[c.leadId]||c.leadName||''}));
      setCalls(next);
      setSelectedId(old=>next.some(c=>c.id===old) ? old : (next[0]?.id || null));
    } catch(e) { console.error('Call history failed',e); setError('Could not load call history. Refresh to retry.'); }
    finally {setLoading(false);}
  },[isDialerRole,user?.username]);
  useEffect(()=>{loadCalls();},[loadCalls]);

  const agents=useMemo(()=>[...new Set(calls.map(c=>c.agentName||c.agentId).filter(Boolean))].sort(),[calls]);
  const visible=useMemo(()=>{
    const q=search.trim().toLowerCase(), now=Date.now();
    const since=dates==='all'?null:now-(Number(dates)*86400000);
    return calls.filter(c=>{
      if (since && (!c.callDate || new Date(c.callDate).getTime()<since)) return false;
      if (agent!=='all' && (c.agentName||c.agentId)!==agent) return false;
      if (filter==='followup' && !followUp(c)) return false;
      if (filter==='review' && !reviewPending(c)) return false;
      if (filter==='high' && !highIntent(c)) return false;
      if (filter==='audio' && !c.recordingUrl) return false;
      return !q || [c.resolvedLeadName,c.leadNumber,c.agentName,c.agentId,c.callMode,c.callType].some(v=>String(v||'').toLowerCase().includes(q));
    });
  },[calls,search,filter,dates,agent]);
  const selected = visible.find(c=>c.id===selectedId) || visible[0] || null;
  const intel = useMemo(()=>selected?extract(selected):null,[selected]);
  const scored=visible.filter(c=>c.intentScore!=null && Number.isFinite(Number(c.intentScore)));
  const mean=scored.length?Math.round(scored.reduce((total,c)=>total+Number(c.intentScore),0)/scored.length):null;
  const average=visible.length?Math.round(visible.reduce((total,c)=>total+(Number(c.durationSeconds)||0),0)/visible.length):null;

  const openSection=(section,seek=null)=>setDetail(old=>({section,seek,token:old.token+1}));
  const openLead=async()=>{
    if (!selected?.leadId)return;
    setOpeningProfile(true);setError('');
    try {const result=await base44.entities.DebtLead.get(selected.leadId); if(result)setProfile(result);else setError('Contact not found.');}
    catch {setError('Could not load contact card.');}
    finally {setOpeningProfile(false);}
  };

  return <div className="ci-root">
    <header className="ci-header">
      <div><div className="ci-eyebrow">Settlement IQ · Call review</div><h2>Call Intelligence Center</h2><p className="ci-sub">Compact call history, AI insights, recordings and follow-up context — one workspace.</p></div>
      <button className="ci-btn" onClick={loadCalls} disabled={loading}><RefreshCcw size={14}/>{loading?'Refreshing…':'Refresh'}</button>
    </header>
    <div className="ci-metrics">
      <Metric Icon={Phone} label="Recorded calls" value={visible.length} note="In current view" />
      <Metric Icon={Clock3} label="Avg. duration" value={average===null?'—':dur(average)} note="Saved calls" />
      <Metric Icon={Activity} label="Avg. intent" value={mean===null?'—':mean+'/100'} note={scored.length+' scored calls'} />
      <Metric Icon={MessageSquare} label="Follow-up signals" value={visible.filter(followUp).length} note="AI suggested, not booked" />
    </div>
    <div className="ci-controls">
      <label className="ci-search"><Search size={15}/><input aria-label="Search calls" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search names, agents, lead numbers…"/></label>
      <select className="ci-select" aria-label="Date range" value={dates} onChange={e=>setDates(e.target.value)}>
        <option value="all">All saved dates</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option>
      </select>
      {!isDialerRole && agents.length>1 && <select className="ci-select" aria-label="Filter agent" value={agent} onChange={e=>setAgent(e.target.value)}>
        <option value="all">All agents</option>{agents.map(a=><option key={a} value={a}>{a}</option>)}
      </select>}
    </div>
    <div className="ci-filters" role="group" aria-label="Call list filters">
      {FILTERS.map(([value,label])=><button key={value} className="ci-pill" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}
    </div>
    {error && <div className="ci-panel" role="alert" style={{color:'#ffad92'}}>{error}</div>}
    <div className="ci-workspace">
      <section className="ci-list" aria-label="Saved call list">
        <div className="ci-sectionhead">Call history <span className="ci-count">{visible.length}</span></div>
        {loading&&!calls.length?<div className="ci-empty">Loading calls…</div>:
          visible.length===0?<div className="ci-empty">{calls.length?'No calls match these filters.':'No recorded conversations yet.'}</div>:
          <div className="ci-list-scroll" role="listbox" aria-label="Saved conversations">
            {visible.map(c=><button role="option" aria-selected={selected?.id===c.id} className="ci-row" key={c.id} onClick={()=>{setSelectedId(c.id);setDetail({section:'transcript',seek:null,token:0});}}>
              <div className="ci-row-top"><span className="ci-name">{c.resolvedLeadName||'Unnamed contact'}</span><span className="ci-date">{when(c.callDate)}</span></div>
              <div className="ci-row-bottom">
                <span className="ci-row-details">{dur(c.durationSeconds)} · {c.agentName||c.agentId||'Agent unknown'}{c.leadNumber?' · '+c.leadNumber:''}</span>
                <span className="ci-badges">
                  {c.intentScore!=null && <span className={'ci-mini '+(highIntent(c)?'ci-mini-gold':'')}>{c.intentScore}</span>}
                  {followUp(c)&&<span className="ci-mini ci-mini-gold" title="AI suggested follow-up">Follow-up</span>}
                  {reviewPending(c)&&<span className="ci-mini ci-mini-orange" title="Report not acknowledged">Review</span>}
                  {c.recordingUrl&&<span className="ci-mini ci-mini-green" title="Recording available">♪</span>}
                </span>
              </div>
            </button>)}
          </div>
        }
      </section>
      <section className="ci-detail" aria-label="Call intelligence">
        {!selected?<div className="ci-empty"><Headphones style={{display:'block',margin:'0 auto 12px'}}/>Choose a call to see its analysis.</div>:<>
          <div className="ci-detailhead">
            <div className="ci-eyebrow" style={{fontSize:9}}>Selected conversation</div>
            <h3>{selected.resolvedLeadName||'Unnamed contact'}</h3>
            <div className="ci-detailmeta">
              <span>{when(selected.callDate)}</span><span>·</span><span>{dur(selected.durationSeconds)}</span><span>·</span><span>{selected.callMode==='close'?'Closing':'Opening'}</span><span>·</span><span>{selected.agentName||selected.agentId||'Agent unknown'}</span>
              {selected.intentScore!=null&&<span className="ci-mini ci-mini-gold">Intent {selected.intentScore}/100</span>}
            </div>
            <div className="ci-actions">
              {selected.leadId&&<button className="ci-btn" onClick={openLead} disabled={openingProfile}><UserRound size={13}/>{openingProfile?'Opening…':'Contact card'}<ArrowUpRight size={12}/></button>}
              <button className="ci-btn ci-btn-alt" onClick={()=>openSection('transcript')}><FileText size={13}/>Transcript</button>
              {selected.recordingUrl&&<button className="ci-btn ci-btn-alt" onClick={()=>openSection('recording')}><Headphones size={13}/>Recording</button>}
              <button className="ci-btn ci-btn-alt" onClick={()=>openSection('intent')}><BarChart3 size={13}/>AI report</button>
              <button className="ci-btn ci-btn-alt" onClick={()=>openSection('comments')}><MessageSquare size={13}/>Manager notes</button>
            </div>
          </div>
          <div className="ci-body">
            <div className="ci-panel">
              <div className="ci-paneltitle"><BrainCircuit size={14}/> AI conversation briefing</div>
              {intel.summary?<p>{intel.summary}</p>:<span className="ci-muted">No AI summary saved for this call. Full transcript and other reports are available below.</span>}
            </div>
            <div className="ci-panel" style={{borderColor:'rgba(218,184,113,.29)',background:'rgba(218,184,113,.045)'}}>
              <div className="ci-paneltitle"><Sparkles size={14}/> Recommended next conversation</div>
              {intel.next?<p>{intel.next}</p>:<span className="ci-muted">No follow-up recommendation recorded.</span>}
              {intel.points.slice(0,2).map((p,i)=><p key={i} style={{marginTop:6}}>• {typeof p==='string'?p:safeText(p?.text)}</p>)}
            </div>
            <div className="ci-two">
              <div className="ci-panel">
                <div className="ci-paneltitle"><Activity size={14}/> Conversation highlights</div>
                {intel.objections.length?intel.objections.slice(0,3).map((o,i)=><p key={i} style={{marginBottom:6}}>• {typeof o==='string'?o:safeText(o?.text)||safeText(o?.objection)||'Objection noted'}</p>):<span className="ci-muted">No objections extracted in the saved analysis.</span>}
              </div>
              <div className="ci-panel">
                <div className="ci-paneltitle"><BarChart3 size={14}/> Quality review</div>
                {Object.keys(intel.manager).length?<>
                  {intel.manager.overallGrade&&<p>Overall grade: {intel.manager.overallGrade}</p>}
                  <GradeBar label="Clarity" value={intel.manager.clarityScore}/><GradeBar label="Objections" value={intel.manager.objectionHandlingScore}/><GradeBar label="Call control" value={intel.manager.callControlScore}/><GradeBar label="Closing" value={intel.manager.closingScore}/>
                </>:<span className="ci-muted">No saved manager-quality analysis yet.</span>}
              </div>
            </div>
            <div className="ci-panel">
              <div className="ci-paneltitle"><AudioLines size={14}/> Interactive call timeline</div>
              {!intel.moments.length?<span className="ci-muted">No timecoded key moments on this call. Recordings and transcripts remain accessible below.</span>:<>
                <div className="ci-timeline"><div className="ci-timeline-track"/>
                  {intel.moments.map((m,i)=>{
                    const max=Math.max(1,Number(selected.durationSeconds)||0,...intel.moments.map(t=>Number(t.offsetSeconds)||0));
                    const pct=Math.max(1,Math.min(99,Number(m.offsetSeconds)/max*100));
                    return <button key={i} data-kind={m.type} title={(m.label||'Key moment')+' at '+clock(m.offsetSeconds)} style={{left:pct+'%'}} onClick={()=>openSection(selected.recordingUrl?'recording':'transcript',Number(m.offsetSeconds))}>{m.type==='issue'?'!':m.type==='strength'?'+':'•'}</button>;
                  })}
                </div>
                {intel.moments.slice(0,6).map((m,i)=><button className="ci-moment" key={i} onClick={()=>openSection(selected.recordingUrl?'recording':'transcript',Number(m.offsetSeconds))}>
                  <time>{clock(m.offsetSeconds)}</time><span style={{flex:1}}><strong>{m.label||'Key moment'}</strong>{m.detail&&<span style={{display:'block',color:'#91a0b4',marginTop:2}}>{m.detail}</span>}</span><ArrowUpRight size={13}/>
                </button>)}
                <div className="ci-muted" style={{marginTop:8}}>Timeline markers reference approximate AI-generated offsets.</div>
              </>}
            </div>
            <div className="ci-legacy">
              <div className="ci-sectionhead">Full call record <span className="ci-count">{detail.section}</span></div>
              <CallDetail key={selected.id+'-'+detail.token} call={selected} canManage={canManage} managerUsername={user?.username} initialSection={detail.section} seekSeconds={detail.seek}/>
            </div>
            <div className="ci-footnote">Shows up to 200 most recent accessible saved conversations, not all dial attempts. Scores and recommended actions are AI analysis, not confirmed customer decisions.</div>
          </div>
        </>}
      </section>
    </div>
    {profile&&<ClientProfileModal lead={profile} onClose={()=>setProfile(null)} onSave={updated=>setProfile(updated)}/>}
  </div>;
}
