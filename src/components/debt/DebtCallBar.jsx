/**
 * Explicit contact call actions. Dial goes to the Twilio SDK inside Live Call,
 * while Listen starts the local computer/cell capture without dialing.
 * Both continue in the same Live Q&A/Coach workspace.
 */
import { Headphones, PhoneCall } from 'lucide-react';

export default function DebtCallBar({ lead }) {
  if (!lead?.id) return null;
  const dispatch = (mode) => {
    window.dispatchEvent(new CustomEvent('debt_launch_live', {
      detail: { leadId: lead.id, mode }
    }));
  };
  return <div className="dcc-call-actions" style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
    <button type="button" onClick={()=>dispatch('listen')} title="Start Live Call listening with saved computer or cell audio; do not dial the contact"
      style={{display:'inline-flex',gap:6,alignItems:'center',border:'1px solid #648e80',borderRadius:7,background:'#173e38',color:'#c2f2db',fontSize:11,padding:'8px 12px',cursor:'pointer',fontWeight:760}}>
      <Headphones size={14}/> Live Call · Listen
    </button>
    <button type="button" onClick={()=>dispatch('dial')} disabled={!lead.phone}
      title={lead.phone?'Dial with Twilio and activate Live Call transcript, Q&A and coaching from the Twilio audio stream':'Add a phone number to dial'}
      style={{display:'inline-flex',gap:6,alignItems:'center',border:'1px solid #d5b278',borderRadius:7,background:'linear-gradient(110deg,#e9cf98,#cda55e)',color:'#12221e',fontSize:11,padding:'8px 12px',cursor:lead.phone?'pointer':'not-allowed',fontWeight:800}}>
      <PhoneCall size={14}/> Dial + Live Coach
    </button>
    {lead.phone&&<span style={{fontSize:10,color:'#9eb6b7',wordBreak:'break-all'}}>{lead.phone}</span>}
  </div>;
}
