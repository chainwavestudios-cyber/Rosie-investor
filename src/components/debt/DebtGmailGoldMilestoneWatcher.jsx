/**
 * Debt Call Coach-wide admin gold milestone notification.
 * Tracks actual newly observed completions, not the historical report on load.
 * No sound, no page navigation, no pop-up blocking; reduced-motion respected.
 */
import { useEffect, useRef, useState } from 'react';
import { Crown, Headphones, Medal, Sparkles, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const particles = Array.from({length:76},(_,i)=>({
  left:((i*47.371)%100).toFixed(2)+'%',
  delay:(i%18)*.07+'s',
  duration:2.35+(i%9)*.17+'s',
  drift:(i%2?1:-1)*(22+(i%7)*18)+'px',
  tilt:(i*53%720)+'deg',
  background:['#f1cc75','#ffedb1','#ce9e3e','#fff8db','#b78634'][i%5],
  width:5+(i%5),height:10+(i%5)*2,
}));

function storageKey(id){return 'coach_gold_completed_v1_'+String(id||'admin');}
function loadSeen(id) {
  try {const value=JSON.parse(localStorage.getItem(storageKey(id))||'[]');return new Set(Array.isArray(value)?value:[]);} catch {return new Set();}
}
function storeSeen(id,seen) {
  try {localStorage.setItem(storageKey(id),JSON.stringify([...seen].slice(-750)));} catch {}
}
function todayTime(d) {try{return new Date(d).getTime()||0;}catch{return 0;}}

export default function DebtGmailGoldMilestoneWatcher() {
  const { isAdmin, sessionUserId, sessionToken } = useDebtCoachAuth();
  const seen = useRef(new Set());
  const initialized = useRef(false);
  const [toast,setToast] = useState(null);
  const [celebration,setCelebration] = useState(false);
  const timer = useRef(null);
  const cleanupTimer=useRef(null);
  const [motionAllowed,setMotionAllowed]=useState(true);

  useEffect(()=>{
    if (typeof window.matchMedia !== 'function') return;
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setMotionAllowed(!query.matches);
    update();query.addEventListener?.('change',update);
    return ()=>query.removeEventListener?.('change',update);
  },[]);

  useEffect(()=>{
    if (!isAdmin || !sessionUserId || !sessionToken) return;
    let active=true;
    let running=false;
    initialized.current=false;
    seen.current=loadSeen(sessionUserId);

    const poll=async()=>{
      if (!active || running || document.visibilityState==='hidden') return;
      running=true;
      try {
        const response=await base44.functions.invoke('sendDebtEmail',{
          action:'gmailReport',sessionUserId,sessionToken,days:30,view:'report'
        });
        if (!active) return;
        const sends=response?.data?.timeline||[];
        const completed=sends.filter(s=>s.audioCompleted && s.sendId && s.audioFullAt);
        const fresh=initialized.current ? completed.filter(s=>!seen.current.has(String(s.sendId))) : [];
        for(const item of completed) seen.current.add(String(item.sendId));
        storeSeen(sessionUserId,seen.current);
        initialized.current=true;
        if(fresh.length){
          // One display at a time; the remaining send IDs are already de-duped.
          const newest=[...fresh].sort((a,b)=>todayTime(b.audioFullAt)-todayTime(a.audioFullAt))[0];
          const label=newest.contactName||newest.contactEmail||'A contact';
          setToast({name:label,sendId:newest.sendId,
            estimated:!!newest.audioCompletionEstimated,
            when:newest.audioFullAt,
            extra:fresh.length>1?fresh.length-1:0});
          setCelebration(true);
          if(timer.current)clearTimeout(timer.current);
          if(cleanupTimer.current)clearTimeout(cleanupTimer.current);
          timer.current=setTimeout(()=>setCelebration(false),4700);
          cleanupTimer.current=setTimeout(()=>setToast(null),9500);
        }
      }catch{
        // Silent: reporting dashboard surfaces its own backend errors.
        // Do not clear initialized: a temporary failure must not cause false confetti.
      }finally{running=false;}
    };

    poll();
    const interval=setInterval(poll,30000);
    const wake=()=>{if(document.visibilityState==='visible')poll();};
    document.addEventListener('visibilitychange',wake);
    return ()=>{
      active=false;clearInterval(interval);document.removeEventListener('visibilitychange',wake);
      if(timer.current)clearTimeout(timer.current);
      if(cleanupTimer.current)clearTimeout(cleanupTimer.current);
    };
  },[isAdmin,sessionUserId,sessionToken]);

  if(!isAdmin || !toast) return null;
  return <>
    <style>{`
      @keyframes coach-gold-rain {
        0% { transform:translate3d(0,-12vh,0) rotate(0deg);opacity:0 }
        10% {opacity:1}
        85% {opacity:1}
        100% { transform:translate3d(var(--gold-drift),115vh,0) rotate(var(--gold-tilt));opacity:0 }
      }
      @keyframes coach-gold-toast {
        from {opacity:0;transform:translateY(-18px) scale(.96)}
        to {opacity:1;transform:translateY(0) scale(1)}
      }
      .coach-gold-pop {animation:coach-gold-toast .4s cubic-bezier(.2,.8,.2,1) both}
      @media(prefers-reduced-motion:reduce){
        .coach-gold-confetti{display:none!important}
        .coach-gold-pop{animation:none!important}
      }
    `}</style>
    {celebration&&motionAllowed&&<div aria-hidden="true" className="coach-gold-confetti" style={{position:'fixed',inset:0,zIndex:40000,overflow:'hidden',pointerEvents:'none'}}>
      {particles.map((p,i)=><span key={i} style={{position:'absolute',top:'-14vh',left:p.left,width:p.width,height:p.height,
        borderRadius:i%3===0?'50%':'2px',background:p.background,
        boxShadow:'0 0 8px rgba(249,213,126,.34)',opacity:0,
        '--gold-drift':p.drift,'--gold-tilt':p.tilt,
        animation:'coach-gold-rain '+p.duration+' '+p.delay+' cubic-bezier(.27,.6,.65,1) forwards'}}/>)}
    </div>}
    <div className="coach-gold-pop" role="status" aria-live="polite" style={{
      position:'fixed',right:'clamp(12px,3vw,35px)',top:20,zIndex:40001,
      pointerEvents:'auto',maxWidth:'min(415px,calc(100vw - 25px))',
      background:'linear-gradient(135deg,#3b2c11,#302a20 48%,#102d2c)',
      border:'1px solid #e9c36f',borderRadius:13,boxShadow:'0 15px 60px rgba(0,0,0,.62),0 0 42px rgba(217,174,76,.22)',
      padding:'17px 42px 16px 17px',color:'#f9eac7',fontFamily:'system-ui,sans-serif' }}>
      <button type="button" aria-label="Dismiss Gold Listener celebration" onClick={()=>{setToast(null);setCelebration(false);}}
        style={{position:'absolute',top:12,right:10,padding:5,background:'transparent',color:'#f0dba7',border:0,cursor:'pointer'}}><X size={16}/></button>
      <div style={{display:'flex',alignItems:'center',gap:9,fontSize:10,fontWeight:850,letterSpacing:1.7,color:'#e6be5f',marginBottom:9}}><Crown size={17}/> GOLD LISTENER UNLOCKED <Sparkles size={15}/></div>
      <div style={{font:'normal 22px Georgia,serif',marginBottom:6}}>{toast.name}</div>
      <div style={{fontSize:12,lineHeight:1.6,color:'#e5d3a9'}}>
        <Headphones size={14} style={{display:'inline-block',verticalAlign:'middle',marginRight:5}}/>
        {toast.estimated ? 'Reached estimated full playback.' : 'Completed the personal audio message.'}
        {toast.extra>0?' Plus '+toast.extra+' other new full listen'+(toast.extra===1?'':'s')+'.':''}
      </div>
    </div>
  </>;
}
