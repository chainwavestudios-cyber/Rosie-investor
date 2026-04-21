import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

export default function TwilioDialer({ initialLead, onClose, onCallLogged }) {
  const [lead, setLead] = useState(initialLead || null);
  const [manualNumber, setManualNumber] = useState('');
  const [callStatus, setCallStatus] = useState('idle'); // idle | calling | connected | ended
  const [callSid, setCallSid] = useState(null);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const [error, setError] = useState('');
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const pollRef = useRef(null);

  const displayNumber = lead?.phone || manualNumber;

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
    };
  }, []);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const dial = async () => {
    const to = displayNumber;
    if (!to) { setError('No number to dial.'); return; }
    setError('');
    setCallStatus('calling');
    setDuration(0);
    try {
      const res = await base44.functions.invoke('twilioCall', { action: 'makeCall', to });
      const sid = res.data?.callSid;
      setCallSid(sid);
      startTimer();
      setCallStatus('connected');

      // Poll for status
      pollRef.current = setInterval(async () => {
        try {
          const s = await base44.functions.invoke('twilioCall', { action: 'getCallStatus', callSid: sid });
          if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(s.data?.status)) {
            clearInterval(pollRef.current);
            stopTimer();
            setCallStatus('ended');
          }
        } catch {}
      }, 3000);
    } catch (e) {
      setError(e.message || 'Call failed');
      setCallStatus('idle');
    }
  };

  const hangup = async () => {
    stopTimer();
    if (callSid) {
      try { await base44.functions.invoke('twilioCall', { action: 'hangupCall', callSid }); } catch {}
    }
    setCallStatus('ended');
    // Log call in history if lead is set
    if (lead?.id) {
      try {
        await base44.entities.LeadHistory.create({
          leadId: lead.id,
          type: 'call',
          content: `Outbound call to ${lead.phone} — duration ${formatDuration(duration)}`,
          callDurationSeconds: duration,
          twilioCallSid: callSid || '',
        });
        onCallLogged && onCallLogged(lead.id);
      } catch {}
    }
  };

  const pressKey = (k) => setKeypadInput(prev => prev + k);

  const KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];

  const statusColor = { idle:'#8a9ab8', calling:'#f59e0b', connected:'#4ade80', ended:'#6b7280' };
  const statusLabel = { idle:'Ready', calling:'Calling…', connected:'Connected', ended:'Call Ended' };

  return (
    <div style={{ position:'fixed', bottom:'24px', right:'24px', width:'320px', background:'#0d1b2a', border:`1px solid rgba(184,147,58,0.4)`, borderRadius:'8px', boxShadow:'0 20px 80px rgba(0,0,0,0.9)', zIndex:10000, fontFamily:'Georgia, serif' }}>

      {/* Header */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.2)', borderRadius:'8px 8px 0 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:statusColor[callStatus], boxShadow:`0 0 8px ${statusColor[callStatus]}` }} />
          <span style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Dialer</span>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'18px' }}>×</button>
      </div>

      <div style={{ padding:'20px' }}>
        {/* Contact info or manual input */}
        {lead ? (
          <div style={{ textAlign:'center', marginBottom:'16px' }}>
            <div style={{ color:'#e8e0d0', fontSize:'16px', fontWeight:'bold' }}>{lead.firstName} {lead.lastName}</div>
            <div style={{ color:GOLD, fontSize:'18px', letterSpacing:'2px', marginTop:'4px' }}>{lead.phone}</div>
          </div>
        ) : (
          <input value={manualNumber} onChange={e=>setManualNumber(e.target.value)} placeholder="Enter number…" style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'4px', padding:'10px', color:'#e8e0d0', fontSize:'18px', textAlign:'center', outline:'none', boxSizing:'border-box', marginBottom:'12px', letterSpacing:'3px' }} />
        )}

        {/* Status */}
        <div style={{ textAlign:'center', color:statusColor[callStatus], fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>{statusLabel[callStatus]}</div>

        {/* Timer */}
        {(callStatus === 'connected' || callStatus === 'ended') && (
          <div style={{ textAlign:'center', color:'#4ade80', fontSize:'28px', fontWeight:'bold', fontFamily:'monospace', marginBottom:'12px' }}>{formatDuration(duration)}</div>
        )}

        {/* Keypad input display */}
        {keypadInput && (
          <div style={{ textAlign:'center', color:'#e8e0d0', fontSize:'16px', letterSpacing:'4px', marginBottom:'8px', minHeight:'24px' }}>{keypadInput}</div>
        )}

        {/* Keypad */}
        {callStatus === 'connected' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginBottom:'14px' }}>
            {KEYS.map(k => (
              <button key={k} onClick={() => pressKey(k)} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px', color:'#e8e0d0', fontSize:'16px', cursor:'pointer' }}>{k}</button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
          {callStatus === 'idle' && (
            <button onClick={dial} style={{ flex:1, background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'20px' }}>📞</button>
          )}
          {callStatus === 'calling' && (
            <button onClick={hangup} style={{ flex:1, background:'linear-gradient(135deg,#ef4444,#b91c1c)', color:'#fff', border:'none', borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'20px' }}>📵</button>
          )}
          {callStatus === 'connected' && (
            <>
              <button onClick={() => setMuted(m => !m)} style={{ flex:1, background:muted?'rgba(239,68,68,0.2)':'rgba(255,255,255,0.08)', color:muted?'#ef4444':'#8a9ab8', border:`1px solid ${muted?'rgba(239,68,68,0.4)':'rgba(255,255,255,0.15)'}`, borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'16px' }}>{muted?'🔇':'🎙'}</button>
              <button onClick={hangup} style={{ flex:1, background:'linear-gradient(135deg,#ef4444,#b91c1c)', color:'#fff', border:'none', borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'20px' }}>📵</button>
            </>
          )}
          {callStatus === 'ended' && (
            <button onClick={() => { setCallStatus('idle'); setDuration(0); setCallSid(null); setKeypadInput(''); }} style={{ flex:1, background:'rgba(255,255,255,0.08)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'50px', padding:'12px', cursor:'pointer', fontSize:'13px' }}>Redial</button>
          )}
        </div>

        {error && <div style={{ color:'#ef4444', fontSize:'12px', textAlign:'center', marginTop:'10px' }}>{error}</div>}
      </div>
    </div>
  );
}