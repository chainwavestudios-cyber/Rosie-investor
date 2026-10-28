/** One review queue for AI KB Chat and BOB-derived suggestions.
 * Only deliberate staff approval promotes new content to the published KB.
 * No automated pathway can overwrite an existing answer.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { CheckCircle2, ChevronDown, ChevronUp, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

const toRows = value => Array.isArray(value) ? value : value?.items || [];
const clean = value => String(value || '').trim();
const categories = {
  debt_agent:'Agent script',debt_customer:'Customer Q&A',debt_faq:'FAQ',debt_hotpoints:'Coaching hotpoint',
  debt_doc:'Document knowledge',debt_web:'Website knowledge',debt_call:'Call-derived Q&A',
  debt_kb:'General KB',debt_qa_statements:'Q&A statements',debt_objections:'Objection response',
};
const panel={background:'#101d2d',border:'1px solid rgba(218,184,113,.25)',borderRadius:10,marginBottom:18,padding:14,color:'#e6e8ed',fontFamily:'Inter,system-ui,sans-serif'};
const button={border:'1px solid rgba(218,184,113,.3)',borderRadius:7,padding:'6px 10px',fontSize:11,fontWeight:700,cursor:'pointer',color:'#ebd2a1',background:'rgba(218,184,113,.1)'};
const field={width:'100%',borderRadius:7,background:'#0d1522',color:'#e7e8eb',padding:'8px 10px',border:'1px solid rgba(255,255,255,.14)',fontSize:12,boxSizing:'border-box'};
export default function DebtKBReviewQueue({readOnly=false,onPublished}) {
  const {user}=useDebtCoachAuth();
  const [open,setOpen]=useState(true);
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState('');
  const [drafts,setDrafts]=useState({});
  const load=useCallback(async()=>{
    setLoading(true);
    try {
      const records=await base44.entities.DebtKBProposal.filter({status:'pending_review'},{sort:'-created_date',limit:150});
      setRows(toRows(records));setError('');
    }catch(err){setError('Could not load proposed knowledge: '+(err?.message||String(err)));}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();const listener=()=>load();window.addEventListener('debt_kb_updated',listener);return()=>window.removeEventListener('debt_kb_updated',listener);},[load]);
  const change=(row,key,value)=>setDrafts(prev=>({...prev,[row.id]:{...prev[row.id],[key]:value}}));
  const finalize=async(row,approve)=>{
    if(busy||readOnly)return;
    const edit={...row,...drafts[row.id]};
    const question=clean(edit.question),answer=clean(edit.answer);
    if(approve&&(!question||!answer)){setError('A question/title and answer are both required.');return;}
    setBusy(row.id);setError('');
    try{
      let kbEntryId='';
      if(approve){
        const existing=toRows(await base44.entities.KnowledgeBase.list('-created_date',1000));
        // Idempotency first: a previous create can succeed even if the proposal
        // status update fails. Never create a duplicate on retry.
        const previous=existing.find(e=>(e.tags||'').split(',').some(t=>t.trim()==='proposal_id:'+row.id));
        if(previous)kbEntryId=previous.id;
        else {
          const same=existing.find(e=>
            e.question && clean(e.question).toLowerCase()===question.toLowerCase() &&
            (!e.kbName||e.kbName==='Debt Settlement')
          );
          if(same){throw new Error('A published entry already has this exact question. Review/edit that KB entry first; no existing answer was changed.');}
          const created=await base44.entities.KnowledgeBase.create({
            question,answer,answersJson:JSON.stringify([answer]),starredAnswerIndex:0,
            category:categories[edit.category]?edit.category:'debt_kb',
            kbName:'Debt Settlement',
            source:clean(row.source)||'AI proposal approved by staff',
            tags:[clean(row.tags),'proposal_id:'+row.id].filter(Boolean).join(', ')
          });
          kbEntryId=created?.id||'';
        }
      }
      await base44.entities.DebtKBProposal.update(row.id,{
        status:approve?'approved':'rejected',
        question,answer,category:edit.category,tags:clean(edit.tags),
        reviewedBy:user?.username||'KB reviewer',reviewedAt:new Date().toISOString(),
        kbEntryId
      });
      setRows(prev=>prev.filter(item=>item.id!==row.id));
      setDrafts(prev=>{const next={...prev};delete next[row.id];return next;});
      if(approve){onPublished?.();window.dispatchEvent(new CustomEvent('debt_kb_updated'));}
    }catch(err){setError((approve?'Approval':'Rejection')+' failed: '+(err?.message||String(err)));}
    finally{setBusy('');}
  };
  return <section style={panel} aria-label="Knowledge review queue">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <ShieldAlert size={17} color="#daba71"/>
        <div><strong style={{fontSize:13,color:'#f0dfbd'}}>Review Queue</strong>
          <div style={{fontSize:10,color:'#95a5b8'}}>AI Chat + BOB suggestions are drafts until someone approves them</div>
        </div>
        <span style={{fontSize:11,color:'#e7c887',borderRadius:99,background:'rgba(218,184,113,.12)',padding:'3px 8px'}}>{loading?'…':rows.length} pending</span>
      </div>
      <div style={{display:'flex',gap:6}}>
        <button style={button} type="button" onClick={load} title="Refresh pending suggestions"><RefreshCw size={13}/></button>
        <button style={button} type="button" onClick={()=>setOpen(v=>!v)}>{open?'Collapse':'Review'} {open?<ChevronUp size={12}/>:<ChevronDown size={12}/>}</button>
      </div>
    </div>
    {error&&<div role="alert" style={{padding:'9px 0',color:'#eeaaa4',fontSize:11}}>{error}</div>}
    {open&&(loading?<div style={{padding:15,color:'#8ca0b6',fontSize:11}}>Loading proposed knowledge…</div>
    :rows.length===0?<div style={{padding:'12px 0 0',color:'#89a1b5',fontSize:11}}>No pending suggestions. Published knowledge remains unchanged.</div>
    :<div style={{maxHeight:520,overflowY:'auto',display:'flex',flexDirection:'column',gap:9,marginTop:13}}>
      {rows.map(row=>{
        const edit={...row,...drafts[row.id]};
        return <article key={row.id} style={{border:'1px solid rgba(255,255,255,.09)',background:'rgba(255,255,255,.025)',borderRadius:8,padding:12}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:8,fontSize:10,color:'#daba71'}}>
            <strong>{categories[edit.category]||edit.category||'Proposed knowledge'}</strong>
            <span style={{color:'#92a5b9'}}>{row.source||'AI proposal'} · Not live</span>
          </div>
          <label style={{display:'block',fontSize:10,color:'#99a9ba',marginBottom:5}}>Question or title</label>
          <input value={edit.question||''} disabled={readOnly||busy===row.id} onChange={e=>change(row,'question',e.target.value)} style={{...field,marginBottom:8}}/>
          <label style={{display:'block',fontSize:10,color:'#99a9ba',marginBottom:5}}>Proposed answer — verify all claims before publishing</label>
          <textarea rows={3} value={edit.answer||''} disabled={readOnly||busy===row.id} onChange={e=>change(row,'answer',e.target.value)} style={{...field,resize:'vertical',lineHeight:1.5}}/>
          {!readOnly&&<div style={{display:'flex',gap:8,marginTop:10}}>
            <button style={{...button,background:'linear-gradient(130deg,#dbb974,#f0d391)',color:'#151d29'}} disabled={!!busy} type="button" onClick={()=>finalize(row,true)}><CheckCircle2 size={13} style={{verticalAlign:'middle',marginRight:5}}/>{busy===row.id?'Saving…':'Approve & publish'}</button>
            <button style={{...button,color:'#eba5a0',borderColor:'rgba(239,100,100,.25)',background:'rgba(239,100,100,.07)'}} disabled={!!busy} type="button" onClick={()=>finalize(row,false)}><XCircle size={13} style={{verticalAlign:'middle',marginRight:5}}/> Reject</button>
          </div>}
        </article>;
      })}
    </div>)}
  </section>;
}
