/**
 * Contact-card calling controls:
 * Live Call listens without dialing, Dial starts Twilio + the same coaching
 * tools, and Connect Main Line builds the held two-leg office conference.
 */
import { useEffect, useState } from 'react';
import { Headphones, PhoneCall, PhoneForwarded, GitMerge, PhoneOff } from 'lucide-react';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const actionStyle=(primary=false)=>({
  display:'inline-flex',gap:6,alignItems:'center',border:'1px solid '+(primary?'#d5b278':'#648e80'),
  borderRadius:7,background:primary?'linear-gradient(110deg,#e9cf98,#cda55e)':'#173e38',
  color:primary?'#12221e':'#c2f2db',fontSize:11,padding:'8px 12px',
  cursor:'pointer',fontWeight:760
});

export default function DebtCallBar({lead, onLaunch}) {
  const {user} = useDebtCoachAuth();
  const officeAllowed = ['admin','super_admin'].includes(user?.role);
  const [office,setOffice]=useState(()=>window.__debtOfficeBridgeState||null);
  useEffect(()=>{
    const sync=(event)=>setOffice(event.detail);
    window.addEventListener('debt_office_bridge_state',sync);
    return ()=>window.removeEventListener('debt_office_bridge_state',sync);
  },[]);
  if(!lead?.id)return null;
  const active=office?.leadId===lead.id?office:null;
  const dispatch=mode=>onLaunch?onLaunch(mode):window.dispatchEvent(new CustomEvent('debt_launch_live',{detail:{leadId:lead.id,mode}}));
  const act=action=>window.dispatchEvent(new CustomEvent('debt_office_bridge_action',{detail:{action}}));
  const name=[lead.firstName,lead.lastName].filter(Boolean).join(' ')||'Client';
  const officeConnected=active?.officeStatus==='in-progress';
  const hasClient=active?.clientStatus&&active.clientStatus!=='not_called';
  return <div className="dcc-call-actions" style={{display:'flex',flexDirection:'column',gap:8}}>
    <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
      <button type="button" onClick={()=>dispatch('listen')} disabled={!!active} style={actionStyle(false)}
        title="Start listening on the saved Computer/Cell audio setup. No outbound call.">
        <Headphones size={14}/> Live Call · Listen
      </button>
      <button type="button" onClick={()=>dispatch('dial')} disabled={!lead.phone||!!active} style={actionStyle(true)}
        title="Dial the customer with Twilio WebRTC and start Live Call, transcription, Q&A and Coach when connected.">
        <PhoneCall size={14}/> Dial + Live Coach
      </button>
      {officeAllowed&&<button type="button" onClick={()=>dispatch('office')} disabled={!!active} style={actionStyle(false)}
        title="Ring your office main line, then connect the customer and merge into the same conference.">
        <PhoneForwarded size={14}/> Connect Main Line
      </button>}
    </div>
    {active&&<div className="dcc-office-bridge-controls" role="group" aria-label="Office conference controls"
      style={{display:'flex',flexDirection:'column',gap:7,padding:'9px 11px',border:'1px solid rgba(216,179,110,.36)',borderRadius:8,background:'rgba(11,30,38,.87)'}}>
      <div style={{color:'#e2c486',fontSize:11,fontWeight:800}}>
        Office line {active.officeNumber||'(connecting)'} · {officeConnected?'Connected':'Status: '+(active.officeStatus||'calling')}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
        <button type="button" style={actionStyle(true)} disabled={!officeConnected||!!hasClient||active.busy||!lead.phone}
          onClick={()=>act('contact')}><PhoneCall size={13}/> Contact {name} · Client</button>
        {hasClient&&<span style={{color:'#b7cbc3',fontSize:10}}>Client: {active.clientAnswered?'Connected — ready to merge':active.clientStatus}</span>}
        {hasClient&&!active.merged&&<button type="button" onClick={()=>act('merge')}
          disabled={!officeConnected||!active.clientAnswered||active.busy} style={actionStyle(true)}>
          <GitMerge size={13}/> Merge Calls
        </button>}
        {active.merged&&<span style={{color:'#91e2b8',fontSize:10,fontWeight:800}}>✓ Office + customer merged</span>}
        <button type="button" onClick={()=>act('end')} disabled={active.busy} style={{...actionStyle(false),color:'#ffb5a6',borderColor:'#a06459'}}>
          <PhoneOff size={13}/> End Bridge
        </button>
      </div>
      <div style={{fontSize:10,color:'#9caeb3'}}>Browser mic muted. Speak through the office line; the app monitors and transcribes. Client hears hold audio until you click Merge Calls.</div>
    </div>}
  </div>;
}
