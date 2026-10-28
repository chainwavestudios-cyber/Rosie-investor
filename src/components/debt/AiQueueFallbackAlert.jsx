/**
 * Read-only Alex warm-handoff queue alert in Debt Call Coach.
 * Backend owns the transfer queue and persists the prospect. This popup
 * merely notifies the logged-in advisor and links to that contact card.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, ArrowUpRight, Headphones, X } from 'lucide-react';

const asRows = v => Array.isArray(v) ? v : (v?.items || v?.entities || []);
const money = v => Number(v)>0 ? '$'+Number(v).toLocaleString('en-US') : 'Amount not confirmed';

export default function AiQueueFallbackAlert({ onOpenLead }) {
  const [alerts, setAlerts] = useState([]);
  const [hidden, setHidden] = useState(new Set());
  const [busyId,setBusyId] = useState('');
  const [error,setError]=useState('');

  const refresh = useCallback(async () => {
    try {
      const page = await base44.entities.FronterHeadsUp.filter({status:'active'},'-createdAt',40);
      const candidates=asRows(page)
        .filter(a=>a.routeType==='ai_agent' && a.routeState==='recording_queue' && a.migratedDebtLeadId)
        .filter(a=>!hidden.has(a.id));
      setAlerts(candidates);
    } catch(e) {
      console.warn('[AI queue alert] Could not refresh',e?.message);
    }
  },[hidden]);
  useEffect(()=>{
    refresh();
    const timer=setInterval(refresh,4000);
    return ()=>clearInterval(timer);
  },[refresh]);

  const openLead=async alert=>{
    if(!alert.migratedDebtLeadId)return;
    setBusyId(alert.id);setError('');
    try{
      const record=await base44.entities.DebtLead.get(alert.migratedDebtLeadId);
      if(!record?.id)throw new Error('The migrated prospect was not found.');
      onOpenLead?.(record);
      setHidden(previous=>new Set([...previous,alert.id]));
    }catch(e){setError(e?.message||'Could not open the contact card.')}
    finally{setBusyId('')}
  };
  const dismiss=alert=>setHidden(previous=>new Set([...previous,alert.id]));

  if(!alerts.length)return null;
  const alert=alerts[0];
  return <aside role="alertdialog" aria-label="Alex AI transfer needs attention" aria-live="assertive"
    style={{position:'fixed',zIndex:16050,top:22,right:22,width:'min(390px,calc(100vw - 30px))',border:'2px solid #deb574',
      background:'linear-gradient(145deg,#151b24,#090e17)',boxShadow:'0 18px 75px #000b,0 0 30px #d6ae4350',
      borderRadius:12,color:'#e9eee8',overflow:'hidden'}}>
     <header style={{display:'flex',alignItems:'center',gap:11,padding:'16px 17px',background:'#d1a75e15',borderBottom:'1px solid #d1a75e55'}}>
       <AlertCircle color="#eac683" size={24}/>
       <div style={{flex:1,minWidth:0}}>
         <strong style={{display:'block',fontSize:13,letterSpacing:'.06em',color:'#f0d29b'}}>ALEX · UNANSWERED WARM HANDOFF</strong>
         <span style={{fontSize:11,color:'#bbc8c6'}}>Both advisor phone attempts ended</span>
       </div>
       <button type="button" onClick={()=>dismiss(alert)} aria-label="Dismiss alert without cancelling queue" style={{background:'transparent',border:0,color:'#dfd0ae',cursor:'pointer'}}><X size={19}/></button>
     </header>
     <div style={{padding:'17px 19px'}}>
       <div style={{fontSize:19,fontWeight:750,marginBottom:7}}>{alert.leadName||'New AI caller'}</div>
       <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:12,color:'#c7d1cc',marginBottom:10}}>
        <span>{money(alert.debtAmount)} reported</span>
        <span>{alert.leadPhone||''}</span>
       </div>
       <p style={{fontSize:12,lineHeight:1.7,color:'#d7bc86',margin:'10px 0 14px'}}>
         <Headphones size={15} style={{display:'inline',verticalAlign:'middle',marginRight:6}}/>
         Caller is in the recorded waiting queue. A Debt Call Coach prospect card is ready.
       </p>
       {error&&<p role="alert" style={{color:'#ffa4a4',fontSize:12}}>{error}</p>}
       <button type="button" disabled={!!busyId} onClick={()=>openLead(alert)}
         style={{border:0,width:'100%',borderRadius:7,padding:'12px 15px',background:'linear-gradient(130deg,#efd097,#b8904b)',color:'#141513',fontWeight:850,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:8,cursor:'pointer'}}>
         {busyId?'Opening prospect…':'OPEN PROSPECT CONTACT CARD'} <ArrowUpRight size={16}/>
       </button>
       <p style={{fontSize:10,color:'#91a1a9',lineHeight:1.6,margin:'13px 0 0'}}>Closing this notice does not disconnect the caller or change their queue position.</p>
     </div>
  </aside>;
}