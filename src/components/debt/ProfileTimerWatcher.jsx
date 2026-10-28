/**
 * Contact-card timers that survive closing the profile.
 * Absolute timestamps and per-agent database-backed settings.
 */
import {useState,useEffect,useCallback,useRef} from 'react';
import {getDebtCoachValue,setAllDebtCoachValues,getCachedDebtCoachValue} from '@/lib/debtCoachStorage';
import {normalizeProfileTimerSound,playProfileTimerSound} from './profileTimerSounds';
import {BellRing,X,ArrowUpRight} from 'lucide-react';

const MAX_MINUTES=1440;
const rows=v=>Array.isArray(v)?v:[];
const identity=t=>String(t.timerKey || t.leadId+':'+t.fireAt);
const snapshot=l=>({id:l.id,firstName:l.firstName||'',lastName:l.lastName||'',phone:l.phone||''});
const label=l=>[l.firstName,l.lastName].filter(Boolean).join(' ').trim()||'Contact';
const preference=username=>{
  const p=getCachedDebtCoachValue(username,'profile_timer_sound',{id:'bell'});
  const upload=getCachedDebtCoachValue(username,'profile_timer_uploaded_sound',null);
  return normalizeProfileTimerSound(p?.id==='custom'
    ?{id:'custom',url:upload?.url,name:upload?.name}:p);
};

/** For AI assistant requests, and reminders created when the card is closed. */
export async function addProfileTimerAsync(username,lead,minutes){
  if(!lead?.id||!username)return false;
  const duration=Number(minutes);
  if(!Number.isInteger(duration)||duration<1||duration>MAX_MINUTES)return false;
  return setProfileTimer(username,lead,0,duration);
}

/** Legacy hours argument retained for callers; contact-card UI takes minutes. */
export async function setProfileTimer(username,lead,hours,minutes,sound){
  if(!lead?.id||!username)return false;
  const amount=Number(hours||0)*60+Number(minutes||0);
  if(!Number.isInteger(amount)||amount<1||amount>MAX_MINUTES)return false;
  const existing=rows(await getDebtCoachValue(username,'profile_timers',[]));
  const fireAt=Date.now()+amount*60000;
  const timer={
    leadId:lead.id,leadSnapshot:snapshot(lead),label:label(lead),
    fireAt,timerKey:'manual_'+lead.id+'_'+fireAt,type:'profile',
    sound:normalizeProfileTimerSound(sound||preference(username)),
  };
  const saved=await setAllDebtCoachValues(username,{profile_timers:[
    ...existing.filter(t=>!(t.leadId===lead.id&&t.type!=='event')),timer
  ]});
  if(!saved)return false;
  window.dispatchEvent(new CustomEvent('profile_timer_set',{detail:timer}));
  return true;
}

/** Preserve existing appointment reminders as separate event timers. */
export async function setEventReminders(username,lead,eventISO,eventTitle){
  if(!lead?.id||!eventISO||!username)return;
  const eventTime=new Date(eventISO).getTime();
  if(!Number.isFinite(eventTime))return;
  const existing=rows(await getDebtCoachValue(username,'profile_timers',[]));
  const sound=preference(username);
  const incoming=[
    {offset:3600000,label:'1 hour'},{offset:300000,label:'5 minutes'},
  ].map(r=>({
    leadId:lead.id,leadSnapshot:snapshot(lead),label:label(lead),
    fireAt:eventTime-r.offset,type:'event',eventTitle:eventTitle||'Scheduled Event',
    offsetLabel:r.label,timerKey:'evt_'+lead.id+'_'+eventTime+'_'+r.offset,sound
  })).filter(t=>t.fireAt>Date.now());
  if(!incoming.length)return;
  const ids=new Set(incoming.map(identity));
  const saved=await setAllDebtCoachValues(username,{profile_timers:[
    ...existing.filter(t=>!ids.has(identity(t))),...incoming
  ]});
  if(saved)window.dispatchEvent(new CustomEvent('profile_timer_set'));
}

export async function cancelProfileTimer(username,leadId){
  if(!username||!leadId)return;
  const existing=rows(await getDebtCoachValue(username,'profile_timers',[]));
  const saved=await setAllDebtCoachValues(username,{profile_timers:
    existing.filter(t=>!(t.leadId===leadId&&t.type!=='event'))});
  if(saved)window.dispatchEvent(new CustomEvent('profile_timer_cancelled',{detail:{leadId}}));
  return saved;
}

export function getActiveTimer(username,leadId){
  if(!username||!leadId)return null;
  const timers=rows(getCachedDebtCoachValue(username,'profile_timers',[]));
  return timers.find(t=>t.leadId===leadId&&t.type!=='event'&&t.fireAt>Date.now())||null;
}

export default function ProfileTimerWatcher({username,onOpenProfile}){
  const [loaded,setLoaded]=useState(false);
  const [firedTimers,setFiredTimers]=useState([]);
  const checkingRef=useRef(false);
  const firedRef=useRef(new Set());

  useEffect(()=>{
    if(!username){setLoaded(false);return;}
    let mounted=true;
    setLoaded(false);
    getDebtCoachValue(username,'profile_timers',[]).then(()=>{
      if(mounted)setLoaded(true);
    }).catch(()=>{if(mounted)setLoaded(false);});
    return()=>{mounted=false;};
  },[username]);

  const checkTimers=useCallback(async()=>{
    if(!username||!loaded||checkingRef.current)return;
    const saved=rows(getCachedDebtCoachValue(username,'profile_timers',[]));
    const currentTime=Date.now();
    const due=saved.filter(t=>Number(t.fireAt)>0&&t.fireAt<=currentTime);
    if(!due.length)return;
    checkingRef.current=true;
    try{
      const ids=new Set(due.map(identity));
      const persisted=await setAllDebtCoachValues(username,{profile_timers:saved.filter(t=>!ids.has(identity(t)))});
      if(!persisted)console.warn('[ProfileTimer] Could not persist expired-timer cleanup.');
      const fresh=due.filter(t=>!firedRef.current.has(identity(t)));
      if(!fresh.length)return;
      fresh.forEach(t=>firedRef.current.add(identity(t)));
      setFiredTimers(prev=>{
        const old=new Set(prev.map(identity));
        return [...prev,...fresh.filter(t=>!old.has(identity(t)))];
      });
      // Play once for a batch; the visible popup works even when browser
      // autoplay policy, a device, or the audio file blocks sound.
      void playProfileTimerSound(fresh[0].sound||preference(username));
      if(typeof window!=='undefined'&&'Notification' in window&&Notification.permission==='granted'){
        fresh.forEach(t=>{
          try{
            new Notification('Contact reminder',{
              body:'Time to follow up with '+(t.label||'your contact')+'.'
            });
          }catch(error){console.warn('[ProfileTimer] Browser notification unavailable:',error?.message);}
        });
      }
    }catch(error){console.warn('[ProfileTimer] Reminder check failed:',error?.message);}
    finally{checkingRef.current=false;}
  },[username,loaded]);

  useEffect(()=>{
    if(!loaded)return;
    void checkTimers();
    const interval=setInterval(()=>{void checkTimers();},1000);
    const onVisible=()=>{if(document.visibilityState==='visible')void checkTimers();};
    const onSet=()=>{void checkTimers();};
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('profile_timer_set',onSet);
    return()=>{
      clearInterval(interval);
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('profile_timer_set',onSet);
    };
  },[checkTimers,loaded]);

  const dismiss=id=>setFiredTimers(prev=>prev.filter(t=>identity(t)!==id));
  const openProfile=timer=>{
    onOpenProfile?.(timer.leadSnapshot);
    dismiss(identity(timer));
  };
  if(!firedTimers.length)return null;
  return <div aria-label="Contact reminder alerts">
    {firedTimers.map((timer,index)=><aside
      key={identity(timer)} role="alertdialog"
      aria-label={'Reminder for '+(timer.label||'contact')}
      className="dcc-reminder-popup" style={{bottom:24+index*174}}>
      <header className="dcc-reminder-popup-head">
        <span><BellRing size={19}/> REMINDER IS DUE</span>
        <button type="button" title="Dismiss reminder" aria-label="Dismiss reminder"
          onClick={()=>dismiss(identity(timer))}><X size={18}/></button>
      </header>
      <div className="dcc-reminder-popup-body">
        <strong>{timer.type==='event'?(timer.eventTitle||'Scheduled Event'):(timer.label||'Contact follow-up')}</strong>
        <p>{timer.type==='event'
          ?(timer.offsetLabel||'Scheduled')+' reminder for '+(timer.label||'your contact')+'.'
          :'Your follow-up timer for '+(timer.label||'this contact')+' has finished.'}</p>
        <button type="button" onClick={()=>openProfile(timer)}>
          Open contact card <ArrowUpRight size={16}/>
        </button>
      </div>
    </aside>)}
  </div>;
}
