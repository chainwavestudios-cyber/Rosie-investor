import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTwilioDevice } from '@/lib/TwilioDeviceContext';

const GOLD = '#b8933a';

export default function TwilioDialer({ initialLead, onClose, onCallLogged, onCallStart, onCallEnd, onCallStream, embedded }) {
  const { getDevice, ready, error: deviceError } = useTwilioDevice();

  const [lead, setLead]               = useState(initialLead || null);
  const [manualNumber, setManualNumber] = useState('');
  const [callStatus, setCallStatus]   = useState('idle');
  const [duration, setDuration]       = useState(0);
  const [muted, setMuted]             = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const [error, setError]             = useState('');
  const [statusMsg, setStatusMsg]     = useState('Ready');

  const timerRef     = useRef(null);
  const startTimeRef = useRef(null);
  const callRef      = useRef(null);

  const displayNumber = lead?.phone || manualNumber;

  const fmt = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = () => {
    startTimeRef.current = Date.now();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() =>
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
  };

  const stopTimer = () => clearInterval(timerRef.current);

  useEffect(() => () => {
    stopTimer();
    try { callRef.current?.disconnect(); } catch {}
  }, []);

  const dial = async () => {
    if (!displayNumber) { setError('No number to dial.'); return; }
    setError('');
    setCallStatus('calling');
    setStatusMsg('Calling…');
    setDuration(0);
    setKeypadInput('');

    try {
      const device = await getDevice();
      const call   = await device.connect({ params: { To: displayNumber } });
      callRef.current = call;

      call.on('ringing',    () => { setCallStatus('ringing'); setStatusMsg('Ringing…'); });
      call.on('accept',     (c) => {
        setCallStatus('connected'); setStatusMsg('Connected');
        startTimer(); onCallStart?.();
        try { onCallStream?.({ remoteStream: c.getRemoteStream?.() || null, localStream: c.getLocalStream?.() || null, call: c }); } catch {}
      });
      call.on('disconnect', () => { stopTimer(); setCallStatus('ended'); setStatusMsg('Call Ended'); logCall(callRef.current?.parameters?.CallSid); onCallEnd?.(); onCallStream?.(null); });
      call.on('error',      (e) => { setError(`Call error: ${e.message}`); stopTimer(); setCallStatus('ended'); });
    } catch (e) {
      setError(e.message || 'Call failed');
      setCallStatus('idle');
      setStatusMsg('Ready');
    }
  };

  const hangup = () => {
    stopTimer();
    const sid = callRef.current?.parameters?.CallSid;
    try { callRef.current?.disconnect(); } catch {}
    setCallStatus('ended'); setStatusMsg('Call Ended');
    logCall(sid); onCallEnd?.(); onCallStream?.(null);
  };

  const logCall = async (sid) => {
    if (!lead?.id) return;
    const dur = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    try {
      await base44.entities.LeadHistory.create({
        leadId: lead.id, type: 'call',
        content: `Outbound call — ${fmt(dur)}`,
        callDurationSeconds: dur, twilioCallSid: sid || '',
      });
      onCallLogged?.(lead.id);
    } catch {}
  };

  const pressKey = (k) => { setKeypadInput(p => p + k); try { callRef.current?.sendDigits(k); } catch {} };
  const reset    = () => { setCallStatus('idle'); setStatusMsg('Ready'); setDuration(0); setKeypadInput(''); setError(''); callRef.current = null; };

  const KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];
  const statusColor = { idle:'#4ade80', calling:'#f59e0b', ringing:'#f59e0b', connected:'#4ade80', ended:'#6b7280' };
  const isActive = ['calling','ringing','connected'].includes(callStatus);

  const content = (
    <div style={{ padding: '20px' }}>
      {lead ? (
        <div style={{ textAlign:'center', marginBottom:'16px' }}>
          <div style={{ color:'#e8e0d0', fontSize:'16px', fontWeight:'bold' }}>{lead.firstName} {lead.lastName}</div>
          <div style={{ color:GOLD, fontSize:'18px', letterSpacing:'2px', marginTop:'4px' }}>{lead.phone}</div>
        </div>
      ) : (
        <input value={manualNumber} onChange={e => setManualNumber(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !isActive) dial(); }}
          placeholder="Enter number…" disabled={isActive}
          style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'4px', padding:'10px', color:'#e8e0d0', fontSize:'18px', textAlign:'center', outline:'none', boxSizing:'border-box', marginBottom:'12px', letterSpacing:'3px' }} />
      )}

      <div style={{ textAlign:'center', color: statusColor[callStatus] || '#8a9ab8', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>
        {deviceError || statusMsg}
      </div>

      {(callStatus === 'connected' || callStatus === 'ended') && (
        <div style={{ textAlign:'center', color:'#4ade80', fontSize:'28px', fontWeight:'bold', fontFamily:'monospace', marginBottom:'12px' }}>
          {fmt(duration)}
        </div>
      )}

      {keypadInput && <div style={{ textAlign:'center', color:'#e8e0d0', fontSize:'16px', letterSpacing:'4px', marginBottom:'8px' }}>{keypadInput}</div>}

      {callStatus === 'connected' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginBottom:'14px' }}>
          {KEYS.map(k => <button key={k} onClick={() => pressKey(k)} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px', color:'#e8e0d0', fontSize:'16px', cursor:'pointer' }}>{k}</button>)}
        </div>
      )}

      <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
        {(callStatus === 'idle' || callStatus === 'ended') && callStatus !== 'ended' && (
          <button onClick={dial} disabled={!displayNumber} style={{ flex:1, background: displayNumber ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(74,222,128,0.2)', color:'#fff', border:'none', borderRadius:'50px', padding:'14px', cursor: displayNumber ? 'pointer' : 'not-allowed', fontSize:'20px' }}>📞</button>
        )}
        {isActive && callStatus !== 'connected' && (
          <button onClick={hangup} style={{ flex:1, background:'linear-gradient(135deg,#ef4444,#b91c1c)', color:'#fff', border:'none', borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'20px' }}>📵</button>
        )}
        {callStatus === 'connected' && (<>
          <button onClick={() => { const n = !muted; setMuted(n); try { callRef.current?.mute(n); } catch {} }}
            style={{ flex:1, background: muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)', color: muted ? '#ef4444' : '#8a9ab8', border:`1px solid ${muted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'16px' }}>
            {muted ? '🔇' : '🎙'}
          </button>
          <button onClick={hangup} style={{ flex:1, background:'linear-gradient(135deg,#ef4444,#b91c1c)', color:'#fff', border:'none', borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'20px' }}>📵</button>
        </>)}
        {callStatus === 'ended' && (
          <button onClick={reset} style={{ flex:1, background:'rgba(255,255,255,0.08)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'50px', padding:'12px', cursor:'pointer', fontSize:'13px' }}>↩ Redial</button>
        )}
      </div>

      {error && <div style={{ color:'#ef4444', fontSize:'12px', textAlign:'center', marginTop:'10px', lineHeight:1.4 }}>{error}</div>}
    </div>
  );

  if (embedded) return content;

  return (
    <div style={{ position:'fixed', bottom:'24px', right:'24px', width:'320px', background:'#0d1b2a', border:`1px solid rgba(184,147,58,0.4)`, borderRadius:'8px', boxShadow:'0 20px 80px rgba(0,0,0,0.9)', zIndex:10000, fontFamily:'Georgia, serif' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.2)', borderRadius:'8px 8px 0 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: statusColor[callStatus] || '#8a9ab8', boxShadow:`0 0 8px ${statusColor[callStatus] || '#8a9ab8'}` }} />
          <span style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Direct Dialer</span>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'18px' }}>×</button>
      </div>
      {content}
    </div>
  );
}