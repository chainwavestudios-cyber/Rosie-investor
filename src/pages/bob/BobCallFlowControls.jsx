import { BookOpen, CalendarClock, ClipboardCheck, CreditCard, GitBranch, PhoneForwarded, ShieldCheck, UserRound, Zap } from 'lucide-react';
import { BOB_ACTIONS, actionFromCue, applyTokens, clearCues } from '@/lib/bobSimulation';
import './BobSite.css';
export default function BobCallFlowControls({
 flows,selectedFlowId,setSelectedFlowId,selectedFlow,stageIndex,setStageIndex,
 scripts,customer,report,history,previousSessionId,setPreviousSessionId,
 sessions,onAction,actionLog,liveActive,canAdvance,onAdvance
}){
 const stage=selectedFlow?.stages?.[stageIndex];
 const script=scripts.find(s=>s.dbId===stage?.scriptId);
 const actions=[...new Set([...(stage?.actions||[]),...actionFromCue(script?.content||'')])];
 return <div className="bob-stack">
  <div className="bob-panel"><div className="bob-panel-title"><h3><GitBranch size={16} style={{display:'inline',marginRight:7,color:'#d7b978'}}/>Assigned full-call workflow</h3><span className="bob-pill">{selectedFlow?.stages?.length||0} stages</span></div>
   <div className="bob-field"><label>Simulation journey</label><select className="bob-input" value={selectedFlowId} disabled={liveActive} onChange={e=>{setSelectedFlowId(e.target.value);setStageIndex(0);}}>
     <option value="">Standalone practice · no linked flow</option>{flows.filter(f=>f.active!==false).map(f=><option key={f.dbId} value={f.dbId}>{f.title}</option>)}
   </select></div>
   {stage?<><div style={{display:'flex',gap:7,flexWrap:'wrap',margin:'14px 0'}}>{selectedFlow.stages.map((s,i)=><button className={'bob-btn '+(i===stageIndex?'bob-btn-gold':'bob-btn-ghost')} type="button" disabled={liveActive} key={s.id} onClick={()=>setStageIndex(i)}>{i+1}. {s.label}</button>)}</div><div className="bob-panel" style={{background:'#0d2833',padding:15}}><strong style={{fontSize:13}}>{stage.label}</strong><p>{stage.goal||'Practice this stage of the customer journey.'}</p><p className="bob-tiny">{stage.instructions}</p></div></>:<p className="bob-tiny">Design and assign full-call scenarios from the Workflow Studio. Stages can include an AI receptionist, cold call, queue intake, simulated closer, mock credit report, and follow-up.</p>}
   <div className="bob-field" style={{marginTop:15}}><label>Continue from a previous conversation</label><select className="bob-input" value={previousSessionId} disabled={liveActive} onChange={e=>setPreviousSessionId(e.target.value)}>
     <option value="">Start with a new mock customer</option>{sessions.map(s=><option key={s.id} value={s.id}>{new Date(s.createdAt).toLocaleString()} · {s.traineeEmail}</option>)}
   </select></div>
  </div>
  <div className="bob-panel"><div className="bob-panel-title"><h3><BookOpen size={17} color="#d7b978" style={{display:'inline',marginRight:7}}/>Live training script & actions</h3></div>
    {script?<div style={{background:'#071521',border:'1px solid #405869',borderRadius:12,padding:16,maxHeight:290,overflow:'auto',whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.75}}>{applyTokens(clearCues(script.content),customer)}</div>:<div className="bob-tiny">No script linked to this stage. An organization admin or delegated manager can create scripts with editable variable tags and simulated action buttons.</div>}
    {actions.length>0?<div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:15}}>{actions.map(a=><button key={a} type="button" className="bob-btn bob-btn-ghost" onClick={()=>onAction(a)}><Zap size={12}/>{BOB_ACTIONS.find(x=>x.id===a)?.label||a}</button>)}</div>:null}
    {selectedFlow&&<button className="bob-btn bob-btn-gold" style={{marginTop:15}} disabled={stageIndex>=selectedFlow.stages.length-1||!canAdvance} onClick={onAdvance}><PhoneForwarded size={14}/> {liveActive?'End current stage & advance':'Continue to next stage'} →</button>}
    <p className="bob-tiny">Actions update only this fictional training workspace. They do not send real emails, order credit checks, move real prospects, or transfer a customer’s phone call.</p>
  </div>
  {report&&<div className="bob-panel" style={{borderColor:'#cfb06f66'}}><div className="bob-panel-title"><h3><CreditCard size={16} color="#d7b978" style={{display:'inline',marginRight:7}}/>SIMULATED credit report</h3><span className="bob-pill">TRAINING ONLY</span></div><div className="bob-dashboard-grid" style={{gridTemplateColumns:'repeat(2,1fr)'}}><div className="bob-stat"><span>Simulated credit score</span><strong>{report.creditScore}</strong></div><div className="bob-stat"><span>Mock balances</span><strong style={{fontSize:21}}>${report.debtAmount.toLocaleString()}</strong></div><div className="bob-stat"><span>Open accounts</span><strong>{report.openAccounts}</strong></div><div className="bob-stat"><span>Utilization</span><strong>{report.creditUtilization}%</strong></div></div><p className="bob-tiny">Synthetic data, generated inside the browser. Not a real bureau report, not a FCRA consumer report and not financial advice. No credit bureau API is contacted.</p></div>}
  {actionLog.length>0&&<div className="bob-panel"><div className="bob-panel-title"><h3><ClipboardCheck size={16} style={{display:'inline',marginRight:7,color:'#d7b978'}}/>Simulation event log</h3></div>{actionLog.slice(-8).map((a,i)=><div key={i} className="bob-tiny" style={{padding:'8px 0',borderBottom:'1px solid #ffffff1b'}}><span style={{color:'#d7b978'}}>{a.time}</span> · {a.message}</div>)}</div>}
  {history&&<div className="bob-panel"><div className="bob-panel-title"><h3><CalendarClock size={16} color="#d7b978" style={{display:'inline',marginRight:7}}/>Follow-up memory</h3><span className="bob-pill"><ShieldCheck size={12}/> Unlocked locally</span></div><p className="bob-tiny">BOB will receive a short prior-call history when this next practice call begins, so the mock customer remembers what was said.</p><div style={{maxHeight:150,overflow:'auto'}}>{history.slice(-6).map((t,i)=><p className="bob-tiny" key={i}><strong>{t.role==='bob'?'BOB':'Trainee'}:</strong> {t.text}</p>)}</div></div>}
 </div>;
}
