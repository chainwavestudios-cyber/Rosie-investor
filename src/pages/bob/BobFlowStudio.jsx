import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Bot, ChevronRight, FilePlus, GitBranch, Lock, MessageSquare, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { decryptCustomerContent, encryptCustomerContent } from '@/lib/bobKnowledgeCrypto';
import { BOB_ACTIONS,BOB_FLOW_STAGES,BOB_VARIABLES,STAGE_LABELS,actionFromCue,createFlow,newStage,validateFlow } from '@/lib/bobSimulation';
import './BobSite.css';
const uid=()=>Math.random().toString(36).slice(2,12);
const input=(val,onChange,extra={})=><input className="bob-input" value={val??''} onChange={e=>onChange(e.target.value)} {...extra}/>;
const textArea=(val,onChange,extra={})=><textarea className="bob-input" style={{minHeight:110,resize:'vertical'}} value={val??''} onChange={e=>onChange(e.target.value)} {...extra}/>;
export default function BobFlowStudio({org,vaultKey,canDesign,api,notify}){
 const [view,setView]=useState('flows'),[flows,setFlows]=useState([]),[scripts,setScripts]=useState([]),
 [flow,setFlow]=useState(null),[script,setScript]=useState(null),[saving,setSaving]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),
 [chat,setChat]=useState([]),[question,setQuestion]=useState(''),[suggestion,setSuggestion]=useState(null);
 const [selectedStage,setSelectedStage]=useState(0);
 const refresh=async()=>{
  if(!vaultKey)return;
  const [f,s]=await Promise.all([api('listFlows',{organizationId:org.id}),api('listScripts',{organizationId:org.id})]);
  const decode=async item=>{try{return{...await decryptCustomerContent(vaultKey,item.encryptedPayload,org.id),dbId:item.id}}catch{return null}};
  setFlows((await Promise.all((f.items||[]).map(decode))).filter(Boolean));
  setScripts((await Promise.all((s.items||[]).map(decode))).filter(Boolean));
 };
 useEffect(()=>{setFlow(null);setScript(null);setFlows([]);setScripts([]);setSuggestion(null);
  refresh().catch(e=>setError(e.message));},[vaultKey,org.id]);
 const save=async(type,payload)=>{
  if(!vaultKey||!canDesign)throw new Error('Editor permission and an unlocked vault are required.');
  setSaving(true);setError('');
  try{
   const data=type==='flow'?validateFlow(payload):payload;
   const encryptedPayload=await encryptCustomerContent(vaultKey,data,org.id);
   await api(type==='flow'?'saveFlow':'saveScript',{organizationId:org.id,itemId:payload.dbId,encryptedPayload});
   await refresh();
   if(type==='flow')setFlow(null);else setScript(null);
   window.dispatchEvent(new CustomEvent('bob_flow_saved',{detail:{organizationId:org.id}}));
   notify?.('Saved to your encrypted organization training library.');
  }catch(e){setError(e.message||'Could not save.');}finally{setSaving(false);}
 };
 const remove=async(type,item)=>{
  if(!window.confirm('Permanently delete this '+type+'?'))return;
  setBusy(true);setError('');
  try{await api(type==='flow'?'deleteFlow':'deleteScript',{organizationId:org.id,itemId:item.dbId});await refresh();window.dispatchEvent(new CustomEvent('bob_flow_saved',{detail:{organizationId:org.id}}));}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const setField=(key,value)=>setFlow(current=>({...current,[key]:value}));
 const setStage=(key,value)=>setFlow(current=>({...current,stages:current.stages.map((s,i)=>i===selectedStage?{...s,[key]:value}:s)}));
 const move=(from,direction)=>setFlow(current=>{
  const next=[...current.stages],to=from+direction;
  if(to<0||to>=next.length)return current;
  [next[from],next[to]]=[next[to],next[from]];setSelectedStage(to);
  return {...current,stages:next};
 });
 const design=async(e)=>{
  e.preventDefault();if(!question.trim()||!vaultKey||!canDesign)return;
  const prompt=question.trim();setQuestion('');setChat(c=>[...c,{role:'user',text:prompt}]);setBusy(true);setError('');
  try{
   const response=await api('designFlow',{organizationId:org.id,
     request:prompt,currentFlow:flow?validateFlow(flow):null});
   const answer=response?.explanation||'Here is a configurable training workflow.';
   const proposed=response?.flow?validateFlow(response.flow):null;
   if(proposed)setSuggestion(proposed);
   setChat(c=>[...c,{role:'assistant',text:answer}]);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 const active=flow?.stages?.[selectedStage];
 const snippets=useMemo(()=>['@@DEBT_CONFIRM@@','@@AI_INPUT@@','@@SEND_EMAIL@@','@@SEND_TEXT@@','@@COMPLETED_STEPS@@',
  '@@BOB:TRANSFER@@','@@BOB:MOCK_CREDIT@@','@@BOB:FOLLOW_UP@@'],[]);
 if(!vaultKey)return <div className="bob-empty"><Lock size={30}/> Unlock your organization vault to edit scripts and full-call workflows.</div>;
 return <div className="bob-stack">
  <div className="bob-tabbar">{[['flows','Workflow builder',GitBranch],['scripts','BOB script editor',BookOpen],['agent','AI flow designer',Bot]].map(([id,label,Icon])=><button className={view===id?'active':''} key={id} onClick={()=>setView(id)}><Icon size={15}/>{label}</button>)}</div>
  {error&&<p className="bob-message error">{error}</p>}
  {view==='flows'&&<div className="bob-grid-2"><div className="bob-panel"><div className="bob-panel-title"><h3>Encrypted call workflows · {flows.length}</h3>{canDesign&&<button className="bob-btn bob-btn-gold" onClick={()=>{setFlow(createFlow('inbound'));setSelectedStage(0);}}><Plus size={14}/> New</button>}</div>
   {canDesign&&<div className="bob-field"><label>Start from a complete call template</label><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{[['inbound','Transfer'],['outbound','Cold call'],['queue','Inbound queue'],['follow_up','Follow-up']].map(([type,label])=><button key={type} className="bob-btn bob-btn-ghost" onClick={()=>{setFlow(createFlow(type));setSelectedStage(0);}}>{label}</button>)}</div></div>}
   {flows.length===0?<div className="bob-empty">No workflows yet. Choose a template or ask the AI flow designer to build one.</div>:flows.map(f=><div key={f.dbId} style={{padding:'12px 0',borderBottom:'1px solid #ffffff20',display:'flex',alignItems:'center',justifyContent:'space-between',gap:9}}><div><strong>{f.title}</strong><div className="bob-tiny">{f.type} · {f.stages?.length||0} stages</div></div><div style={{display:'flex',gap:6}}><button className="bob-btn bob-btn-ghost" onClick={()=>{setFlow({...f});setSelectedStage(0);}}>Open</button>{canDesign&&<button className="bob-btn bob-btn-danger" onClick={()=>remove('flow',f)}><Trash2 size={13}/></button>}</div></div>)}
  </div>
  <div className="bob-panel"><div className="bob-panel-title"><h3>{flow?'Flow editor':'Select a workflow'}</h3>{flow&&canDesign&&<button className="bob-btn bob-btn-gold" disabled={saving} onClick={()=>save('flow',flow)}><Save size={15}/>{saving?'Saving…':'Encrypt & save'}</button>}</div>
   {!flow?<div className="bob-empty">Define each phase of the journey: queue, transfer agent, customer, mock credit check, AI closer and follow-up.</div>:<div className="bob-stack">
    <div className="bob-field"><label>Workflow title</label>{input(flow.title,v=>setField('title',v),{disabled:!canDesign})}</div>
    <div className="bob-field"><label>Training objective</label>{textArea(flow.description,v=>setField('description',v),{disabled:!canDesign})}</div>
    <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>{flow.stages.map((s,i)=><button key={s.id} className={'bob-btn '+(selectedStage===i?'bob-btn-gold':'bob-btn-ghost')} onClick={()=>setSelectedStage(i)}>{i+1}. {s.label}</button>)}{canDesign&&<button className="bob-btn bob-btn-ghost" onClick={()=>{setFlow(o=>({...o,stages:[...o.stages,newStage()]}));setSelectedStage(flow.stages.length);}}><Plus size={13}/> Stage</button>}</div>
    {active&&<div className="bob-panel" style={{background:'#091825',padding:18}}><div className="bob-panel-title"><h3>Stage {selectedStage+1} · {active.label}</h3><div style={{display:'flex',gap:6}}>{canDesign&&<><button className="bob-btn bob-btn-ghost" disabled={selectedStage===0} onClick={()=>move(selectedStage,-1)}><ArrowUp size={14}/></button><button className="bob-btn bob-btn-ghost" disabled={selectedStage===flow.stages.length-1} onClick={()=>move(selectedStage,1)}><ArrowDown size={14}/></button><button className="bob-btn bob-btn-danger" disabled={flow.stages.length===1} onClick={()=>{setFlow(o=>({...o,stages:o.stages.filter((_,i)=>i!==selectedStage)}));setSelectedStage(0);}}><Trash2 size={14}/></button></>}</div></div>
    <div className="bob-form-grid"><div className="bob-field"><label>Stage type</label><select className="bob-input" value={active.type} disabled={!canDesign} onChange={e=>setStage('type',e.target.value)}>{BOB_FLOW_STAGES.map(t=><option key={t} value={t}>{STAGE_LABELS[t]}</option>)}</select></div><div className="bob-field"><label>Display label</label>{input(active.label,v=>setStage('label',v),{disabled:!canDesign})}</div></div>
    <div className="bob-field"><label>Target outcome</label>{textArea(active.goal,v=>setStage('goal',v),{disabled:!canDesign,placeholder:'What must the trainee accomplish in this stage?'})}</div><div className="bob-field"><label>AI customer / transfer agent instructions</label>{textArea(active.instructions,v=>setStage('instructions',v),{disabled:!canDesign,placeholder:'Objections, voice behavior, handoff script, callback conditions…'})}</div>
    <div className="bob-field"><label>Opening line / queue greeting</label>{input(active.introMessage,v=>setStage('introMessage',v),{disabled:!canDesign})}</div>
    <div className="bob-field"><label>Script for this stage</label><select className="bob-input" value={active.scriptId} disabled={!canDesign} onChange={e=>setStage('scriptId',e.target.value)}><option value="">No linked script</option>{scripts.map(sc=><option key={sc.dbId} value={sc.dbId}>{sc.title}</option>)}</select></div>
    <div className="bob-field"><label>Available simulated trainee actions</label><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:8}}>{BOB_ACTIONS.map(a=><label key={a.id} style={{display:'flex',gap:7,fontSize:12,alignItems:'center',color:'#c6d2dc'}}><input type="checkbox" disabled={!canDesign} checked={active.actions.includes(a.id)} onChange={e=>setStage('actions',e.target.checked?[...active.actions,a.id]:active.actions.filter(x=>x!==a.id))}/>{a.label}</label>)}</div></div>
    </div>}
   </div>}</div></div>}
  {view==='scripts'&&<div className="bob-grid-2"><div className="bob-panel"><div className="bob-panel-title"><h3>Company training scripts</h3>{canDesign&&<button className="bob-btn bob-btn-gold" onClick={()=>setScript({title:'Untitled call script',type:'discovery',content:'Hello {{first name}}, this is {{agent name}}.\n\n@@AI_INPUT@@\n\n@@DEBT_CONFIRM@@\n\n@@COMPLETED_STEPS@@'})}><FilePlus size={15}/> New script</button>}</div>
   {scripts.length===0?<div className="bob-empty">Create an encrypted script for your call stages.</div>:scripts.map(sc=><div key={sc.dbId} style={{display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #ffffff1b',padding:'12px 0',gap:10}}><div><strong>{sc.title}</strong><p className="bob-tiny">{sc.type}</p></div><div style={{display:'flex',gap:5}}><button className="bob-btn bob-btn-ghost" onClick={()=>setScript({...sc})}>Open</button>{canDesign&&<button className="bob-btn bob-btn-danger" onClick={()=>remove('script',sc)}><Trash2 size={14}/></button>}</div></div>)}
  </div><div className="bob-panel"><div className="bob-panel-title"><h3>BOB script editor</h3>{script&&canDesign&&<button className="bob-btn bob-btn-gold" disabled={saving} onClick={()=>save('script',script)}><Save size={15}/> Encrypt & save</button>}</div>
   {!script?<div className="bob-empty">Full call-script markup with variables, editable fields, checklists and mock action cues.</div>:<div className="bob-stack">
    <div className="bob-form-grid"><div className="bob-field"><label>Script title</label>{input(script.title,v=>setScript(sc=>({...sc,title:v})),{disabled:!canDesign})}</div><div className="bob-field"><label>Stage category</label><select className="bob-input" value={script.type} disabled={!canDesign} onChange={e=>setScript(sc=>({...sc,type:e.target.value}))}>{['open','discovery','objections','close','handoff','follow_up','custom'].map(x=><option key={x} value={x}>{x}</option>)}</select></div></div>
    <div className="bob-field"><label>Variable tags</label><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{BOB_VARIABLES.map(t=><button key={t} className="bob-btn bob-btn-ghost" type="button" disabled={!canDesign} onClick={()=>setScript(sc=>({...sc,content:sc.content+' '+t}))}>{t}</button>)}</div></div>
    <div className="bob-field"><label>Script actions · all are simulations, not actual sends or credit pulls</label><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{snippets.map(t=><button key={t} className="bob-btn bob-btn-ghost" type="button" disabled={!canDesign} onClick={()=>setScript(sc=>({...sc,content:sc.content+'\n'+t+'\n'}))}>{BOB_ACTIONS.find(a=>a.cue===t)?.label||t}</button>)}</div></div>
    <div className="bob-field"><label>Full script with call actions</label>{textArea(script.content,v=>setScript(sc=>({...sc,content:v})),{disabled:!canDesign,style:{minHeight:350}})}</div>
    <div className="bob-panel" style={{background:'#0b1a28'}}><strong style={{fontSize:13}}>Available action buttons in this script</strong><div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>{actionFromCue(script.content).map(a=><span className="bob-pill" key={a}>{BOB_ACTIONS.find(x=>x.id===a)?.label||a}</span>)}</div><p className="bob-tiny">Only the BOB simulation executes these controls. Real Debt Call Coach contact fields, dialers, messages and credit services are not called.</p></div>
   </div>}</div></div>}
  {view==='agent'&&<div className="bob-grid-2"><div className="bob-panel"><div className="bob-panel-title"><h3>BOB workflow architect</h3><Sparkles size={18} color="#d7b978"/></div><p>Describe your sales process conversationally. BOB can draft stages, transfer instructions, callbacks, and actions for you to edit and approve.</p><p className="bob-tiny">Messages and draft flow details are processed by a third-party AI model. Avoid confidential customer information. Drafts stay in this browser until you explicitly encrypt and save them.</p><div className="bob-timeline" style={{maxHeight:310}}>{chat.map((msg,i)=><div key={i} className={'bob-chat '+(msg.role==='assistant'?'bob':'')}><small>{msg.role==='user'?'YOU':'BOB WORKFLOW ARCHITECT'}</small><p>{msg.text}</p></div>)}</div><form onSubmit={design}><div className="bob-field"><label>Describe the entire experience you want to simulate</label><textarea required maxLength={4000} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Example: Inbound lead from queue, AI receptionist transfers to discovery rep. The rep completes a mock credit check, transfers to AI closer, and schedules a callback. On callback, remember the previous objections…"/></div><button className="bob-btn bob-btn-gold" disabled={busy||!canDesign}><MessageSquare size={15}/>{busy?'Designing…':'Design this workflow'}</button></form></div>
  <div className="bob-panel"><div className="bob-panel-title"><h3>Suggested flow</h3>{suggestion&&<button className="bob-btn bob-btn-gold" onClick={()=>{setFlow(suggestion);setSelectedStage(0);setView('flows');setSuggestion(null);}}>Edit proposal <ChevronRight size={14}/></button>}</div>{!suggestion?<div className="bob-empty">The AI's suggested call flow will appear here. It will never overwrite your saved workflow without your approval.</div>:<div className="bob-stack"><h3>{suggestion.title}</h3><p>{suggestion.description}</p>{suggestion.stages.map((st,i)=><div key={st.id} className="bob-panel" style={{padding:14}}><div style={{fontSize:13,fontWeight:700}}>{i+1}. {st.label}</div><p className="bob-tiny">{st.goal}</p></div>)}</div>}</div></div>}
 </div>;
}
