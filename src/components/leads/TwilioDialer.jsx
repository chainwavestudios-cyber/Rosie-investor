import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTwilioDevice } from '@/lib/TwilioDeviceContext';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import VoiceFXPanel from '@/components/shared/VoiceFXPanel';
import { fireScorecardCall } from '@/components/admin/ScoreCard';

const GOLD = '#b8933a';
const ADMIN_USERS = ['admin', 'steph'];

export default function TwilioDialer({ initialLead, onClose, onCallLogged, onCallStart, onCallEnd, onCallStream, embedded }) {
  const { portalUser } = usePortalAuth();
  const currentUsername = portalUser?.username || 'admin';
  const isAdmin = ADMIN_USERS.includes(currentUsername);
  const { getDevice, ready, error: deviceError, incomingCall, setIncomingCall } = useTwilioDevice();

  const [showFX, setShowFX] = useState(false);

  const [lead, setLead]               = useState(initialLead || null);
  const [manualNumber, setManualNumber] = useState('');
  const [callStatus, setCallStatus]   = useState('idle');
  const [duration, setDuration]       = useState(0);
  const [muted, setMuted]             = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const [error, setError]             = useState('');
  const [statusMsg, setStatusMsg]     = useState('Ready');
  const [callDirection, setCallDirection] = useState('outbound');

  const [callerId, setCallerId] = useState('');
  const [lines,    setLines]    = useState([]);
  const [lastCallInfo, setLastCallInfo] = useState(null); // { calledAt, name } or null
  const lookupTimerRef = useRef(null);

  const timerRef      = useRef(null);
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

  useEffect(() => {
    base44.functions.invoke('twilioGetLines', {}).then(res => {
      const ls = res?.data?.lines || res?.lines || [];
      setLines(ls);
      if (ls.length > 0) setCallerId(ls[0].number);
    }).catch(() => {});
  }, []);

  // ── Last-called lookup when manual number changes ────────────────────
  useEffect(() => {
    if (lead) { setLastCallInfo(null); return; } // lead card mode — not needed
    setLastCallInfo(null);
    if (!manualNumber || manualNumber.replace(/\D/g, '').length < 7) return;

    clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = setTimeout(async () => {
      try {
        const digits = manualNumber.replace(/\D/g, '');
        // Search LeadHistory for calls to this number (stored in content)
        const history = await base44.entities.LeadHistory.filter({ type: 'call' }, '-created_date', 50);
        // Also check Lead entity for a phone match to get the name
        const leads = await base44.entities.Lead.list('-updated_date', 500);
        const matched = leads.find(l => {
          const p = (l.phone || '').replace(/\D/g, '');
          return p === digits || p.slice(-10) === digits.slice(-10);
        });

        // Find the most recent call log for this lead
        let lastCall = null;
        if (matched) {
          const leadCalls = history.filter(h => h.leadId === matched.id);
          if (leadCalls.length > 0) lastCall = leadCalls[0]; // already sorted desc
        }

        // Also check InvestorUser
        if (!matched || !lastCall) {
          const investors = await base44.entities.InvestorUser.list('-updated_date', 500);
          const matchedInv = investors.find(u => {
            const p = (u.phone || '').replace(/\D/g, '');
            return p === digits || p.slice(-10) === digits.slice(-10);
          });
          if (matchedInv) {
            const notes = await base44.entities.ContactNote.filter({ investorId: matchedInv.id, type: 'call' }, '-createdAt', 5);
            if (notes?.length > 0) {
              setLastCallInfo({ calledAt: notes[0].createdAt || notes[0].created_date, name: matchedInv.name });
              return;
            }
          }
        }

        if (lastCall) {
          setLastCallInfo({ calledAt: lastCall.created_date, name: matched ? `${matched.firstName} ${matched.lastName}`.trim() : null });
        }
      } catch {}
    }, 600);
  }, [manualNumber, lead]);

  // ── Shared call event wiring ─────────────────────────────────────────
  const wireCallEvents = (call) => {
    call.on('ringing', () => { setCallStatus('ringing'); setStatusMsg('Ringing…'); });
    call.on('accept', (c) => {
      setCallStatus('connected');
      setStatusMsg('Connected');
      startTimer();
      onCallStart?.();
      setTimeout(() => {
        try {
          onCallStream?.({
            remoteStream: c.getRemoteStream?.() || null,
            localStream:  c.getLocalStream?.()  || null,
            call: c,
          });
        } catch {}
      }, 1000);
    });
    call.on('disconnect', () => {
      stopTimer();
      setCallStatus('ended');
      setStatusMsg('Call Ended');
      logCall(callRef.current?.parameters?.CallSid);
      onCallEnd?.();
      onCallStream?.(null);
      setIncomingCall?.(null);
    });
    call.on('cancel', () => {
      stopTimer();
      setCallStatus('idle');
      setStatusMsg('Ready');
      setIncomingCall?.(null);
      onCallStream?.(null);
    });
    call.on('error', (e) => {
      setError(`Call error: ${e.message}`);
      stopTimer();
      setCallStatus('ended');
      setIncomingCall?.(null);
    });
  };

  // ── Outbound dial ─────────────────────────────────────────────────────
  const dial = async () => {
    if (!displayNumber) { setError('No number to dial.'); return; }
    setError('');
    setCallStatus('calling');
    setStatusMsg('Calling…');
    setCallDirection('outbound');
    setDuration(0);
    setKeypadInput('');
    fireScorecardCall(currentUsername);

    try {
      const device = await getDevice();
      const call   = await device.connect({
        params: { To: displayNumber, ...(callerId ? { CallerId: callerId } : {}) },
      });
      callRef.current = call;
      wireCallEvents(call);
    } catch (e) {
      setError(e.message || 'Call failed');
      setCallStatus('idle');
      setStatusMsg('Ready');
    }
  };

  // ── Answer inbound call ───────────────────────────────────────────────
  const answer = () => {
    const call = incomingCall?.call;
    if (!call) return;
    setError('');
    setCallStatus('connected');
    setStatusMsg('Connected');
    setCallDirection('inbound');
    setDuration(0);
    callRef.current = call;
    call.accept();
    startTimer();
    onCallStart?.();
    wireCallEvents(call);
    setIncomingCall?.(null);
  };

  // ── Reject inbound call ───────────────────────────────────────────────
  const rejectCall = () => {
    const call = incomingCall?.call;
    if (!call) return;
    try { call.reject(); } catch {}
    setIncomingCall?.(null);
    setCallStatus('idle');
    setStatusMsg('Ready');
  };

  // ── Hangup ───────────────────────────────────────────────────────────
  const hangup = () => {
    stopTimer();
    const sid = callRef.current?.parameters?.CallSid;
    try { callRef.current?.disconnect(); } catch {}
    setCallStatus('ended');
    setStatusMsg('Call Ended');
    logCall(sid);
    onCallEnd?.();
    onCallStream?.(null);
    setIncomingCall?.(null);
  };

  const logCall = async (sid) => {
    if (!lead?.id) return;
    const dur = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    try {
      await base44.entities.LeadHistory.create({
        leadId: lead.id, type: 'call',
        content: `${callDirection === 'inbound' ? 'Inbound' : 'Outbound'} call — ${fmt(dur)} · by ${currentUsername}`,
        callDurationSeconds: dur,
        twilioCallSid: sid || '',
        createdBy: currentUsername,
      });
      onCallLogged?.(lead.id);
    } catch {}
  };

  const pressKey = (k) => { setKeypadInput(p => p + k); try { callRef.current?.sendDigits(k); } catch {} };
  const reset    = () => { setCallStatus('idle'); setStatusMsg('Ready'); setDuration(0); setKeypadInput(''); setError(''); callRef.current = null; };

  const KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];
  const statusColor = { idle:'#4ade80', calling:'#f59e0b', ringing:'#f59e0b', connected:'#4ade80', ended:'#6b7280' };
  const isActive = ['calling','ringing','connected'].includes(callStatus);

  // ── Incoming call UI ──────────────────────────────────────────────────
  const showIncoming = incomingCall && callStatus === 'idle';
  const incomingCallerName = incomingCall?.lead
    ? (`${incomingCall.lead.firstName || ''} ${incomingCall.lead.lastName || ''}`.trim() || incomingCall.lead.name || incomingCall.from)
    : (incomingCall?.from || 'Unknown Caller');

  const content = (
    <div style={{ padding: '20px' }}>

      {/* ── INBOUND CALL BANNER ── */}
      {showIncoming && (
        <div style={{
          background: 'rgba(74,222,128,0.08)',
          border: '1px solid rgba(74,222,128,0.5)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          textAlign: 'center',
          animation: 'incoming-ring 1s ease-in-out infinite',
        }}>
          <style>{`
            @keyframes incoming-ring {
              0%, 100% { box-shadow: 0 0 0 rgba(74,222,128,0); }
              50%       { box-shadow: 0 0 20px rgba(74,222,128,0.25); }
            }
          `}</style>
          <div style={{ fontSize: '28px', marginBottom: '6px' }}>📲</div>
          <div style={{ color: '#4ade80', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
            Incoming Call
          </div>
          <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold', marginBottom: '2px' }}>
            {incomingCallerName}
          </div>
          <div style={{ color: '#4a5568', fontSize: '12px', marginBottom: '14px' }}>
            {incomingCall?.from}
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={answer} style={{
              flex: 1, background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              color: '#fff', border: 'none', borderRadius: '50px',
              padding: '12px', cursor: 'pointer', fontSize: '18px',
            }}>📞</button>
            <button onClick={rejectCall} style={{
              flex: 1, background: 'linear-gradient(135deg,#ef4444,#b91c1c)',
              color: '#fff', border: 'none', borderRadius: '50px',
              padding: '12px', cursor: 'pointer', fontSize: '18px',
            }}>📵</button>
          </div>
        </div>
      )}

      {/* ── NORMAL DIALER UI ── */}
      {!showIncoming && (
        <>
          {lead ? (
            <div style={{ textAlign:'center', marginBottom:'16px' }}>
              <div style={{ color:'#e8e0d0', fontSize:'16px', fontWeight:'bold' }}>
                {callDirection === 'inbound' ? '📲 ' : ''}{lead.firstName} {lead.lastName}
              </div>
              <div style={{ color:GOLD, fontSize:'18px', letterSpacing:'2px', marginTop:'4px' }}>{lead.phone}</div>
            </div>
          ) : (
            <input value={manualNumber} onChange={e => setManualNumber(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !isActive) dial(); }}
              placeholder="Enter number…" disabled={isActive}
              style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'4px', padding:'10px', color:'#e8e0d0', fontSize:'18px', textAlign:'center', outline:'none', boxSizing:'border-box', marginBottom:'12px', letterSpacing:'3px' }} />
          )}

          {/* ── Last called info ── */}
          {lastCallInfo && !isActive && (() => {
            const d = new Date(lastCallInfo.calledAt);
            const today = new Date();
            const isToday = d.toDateString() === today.toDateString();
            const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div style={{
                marginBottom: '10px',
                padding: '8px 10px',
                borderRadius: '4px',
                background: isToday ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${isToday ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.25)'}`,
                fontSize: '11px',
                color: isToday ? '#ef4444' : '#f59e0b',
                textAlign: 'center',
                lineHeight: 1.5,
              }}>
                {isToday ? '⚠️ Called today' : '📞 Last called'} at {timeStr}{!isToday && ` on ${dateStr}`}
                {lastCallInfo.name && <span style={{ color: '#8a9ab8' }}> · {lastCallInfo.name}</span>}
              </div>
            );
          })()}

          {lines.length > 1 && (
            <div style={{ marginBottom:'10px' }}>
              <select value={callerId} onChange={e => setCallerId(e.target.value)} disabled={isActive}
                style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'6px 10px', color:'#8a9ab8', fontSize:'11px', outline:'none', cursor: isActive ? 'not-allowed' : 'pointer' }}>
                {lines.map(l => <option key={l.number} value={l.number}>📞 Call from: {l.label} ({l.number})</option>)}
              </select>
            </div>
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
            {(callStatus === 'idle') && (<>
              <button onClick={dial} disabled={!displayNumber} style={{ flex:1, background: displayNumber ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(74,222,128,0.2)', color:'#fff', border:'none', borderRadius:'50px', padding:'14px', cursor: displayNumber ? 'pointer' : 'not-allowed', fontSize:'20px' }}>📞</button>
              {isAdmin && (
                <button onClick={() => setShowFX(true)}
                  style={{ background:'rgba(184,147,58,0.1)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'50px', padding:'14px 16px', cursor:'pointer', fontSize:'14px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                  🎙 FX
                </button>
              )}
            </>)}
            {isActive && callStatus !== 'connected' && (
              <button onClick={hangup} style={{ flex:1, background:'linear-gradient(135deg,#ef4444,#b91c1c)', color:'#fff', border:'none', borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'20px' }}>📵</button>
            )}
            {callStatus === 'connected' && (<>
              <button onClick={() => { const n = !muted; setMuted(n); try { callRef.current?.mute(n); } catch {} }}
                style={{ flex:1, background: muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)', color: muted ? '#ef4444' : '#8a9ab8', border:`1px solid ${muted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'16px' }}>
                {muted ? '🔇' : '🎙'}
              </button>
              {isAdmin && (
                <button onClick={() => setShowFX(true)}
                  style={{ flex:1, background:'rgba(184,147,58,0.12)', color:GOLD, border:'1px solid rgba(184,147,58,0.35)', borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
                  🎙 FX
                </button>
              )}
              <button onClick={hangup} style={{ flex:1, background:'linear-gradient(135deg,#ef4444,#b91c1c)', color:'#fff', border:'none', borderRadius:'50px', padding:'14px', cursor:'pointer', fontSize:'20px' }}>📵</button>
            </>)}
            {callStatus === 'ended' && (
              <button onClick={reset} style={{ flex:1, background:'rgba(255,255,255,0.08)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'50px', padding:'12px', cursor:'pointer', fontSize:'13px' }}>↩ Redial</button>
            )}
          </div>

          {error && <div style={{ color:'#ef4444', fontSize:'12px', textAlign:'center', marginTop:'10px', lineHeight:1.4 }}>{error}</div>}
        </>
      )}

      {showFX && <VoiceFXPanel onClose={() => setShowFX(false)} />}
    </div>
  );

  if (embedded) return content;

  return (
    <div style={{ position:'fixed', bottom:'24px', right:'24px', width:'320px', background:'#0d1b2a', border:`1px solid ${showIncoming ? 'rgba(74,222,128,0.6)' : 'rgba(184,147,58,0.4)'}`, borderRadius:'8px', boxShadow:'0 20px 80px rgba(0,0,0,0.9)', zIndex:10000, fontFamily:'Georgia, serif', transition:'border-color 0.3s' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.2)', borderRadius:'8px 8px 0 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: showIncoming ? '#4ade80' : (statusColor[callStatus] || '#8a9ab8'), boxShadow:`0 0 8px ${showIncoming ? '#4ade80' : (statusColor[callStatus] || '#8a9ab8')}`, animation: showIncoming ? 'pulse 1s infinite' : 'none' }} />
          <span style={{ color: showIncoming ? '#4ade80' : GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
            {showIncoming ? 'Incoming Call' : 'Direct Dialer'}
          </span>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'18px' }}>×</button>
      </div>
      {content}
    </div>
  );
}