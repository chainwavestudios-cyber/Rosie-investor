import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

import { Device } from '@twilio/voice-sdk';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

export default function TwilioDialer({ initialLead, onClose, onCallLogged }) {
  const [lead, setLead]               = useState(initialLead || null);
  const [manualNumber, setManualNumber] = useState('');
  const [callStatus, setCallStatus]   = useState('idle');
  const [callSid, setCallSid]         = useState(null);
  const [duration, setDuration]       = useState(0);
  const [muted, setMuted]             = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const [error, setError]             = useState('');
  const [statusMsg, setStatusMsg]     = useState('Initializing…');
  const [micDevices, setMicDevices]   = useState([]);
  const [selectedMicId, setSelectedMicId] = useState('');

  const timerRef     = useRef(null);
  const startTimeRef = useRef(null);
  const pollRef      = useRef(null);
  const deviceRef    = useRef(null);
  const callRef      = useRef(null);

  const displayNumber = lead?.phone || manualNumber;

  // ── Format helpers ────────────────────────────────────────────────────
  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = () => {
    startTimeRef.current = Date.now();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
  };

  // ── Init Twilio Device on mount ───────────────────────────────────────
  useEffect(() => {
    let device = null;

    const init = async () => {
      setCallStatus('initializing');
      setStatusMsg('Requesting microphone…');

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');
        setMicDevices(mics);
        if (mics.length > 0) setSelectedMicId(mics[0].deviceId);
      } catch {
        setError('Microphone access denied — please allow mic and refresh');
        setCallStatus('idle');
        return;
      }

      setStatusMsg('Connecting…');

      try {
        const tokenRes = await base44.functions.invoke('twilioClientToken', {});
        const token = tokenRes?.data?.token;
        if (!token) throw new Error('No token received');

        device = new Device(token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true,
          logLevel: 'error',
          ...(selectedMicId ? { audioConstraints: { deviceId: { exact: selectedMicId } } } : {}),
        });

        device.on('registered', () => {
          setCallStatus('ready');
          setStatusMsg('Ready');
          setError('');
        });

        device.on('error', (err) => {
          setError(`Twilio: ${err.message || 'Unknown error'}`);
        });

        device.on('tokenWillExpire', async () => {
          try {
            const res = await base44.functions.invoke('twilioClientToken', {});
            if (res?.data?.token) device.updateToken(res.data.token);
          } catch {}
        });

        device.on('unregistered', () => {
          setStatusMsg('Disconnected');
          setError('Twilio device disconnected — please refresh');
        });

        await device.register();
        deviceRef.current = device;

      } catch (e) {
        setError(`Init failed: ${e.message}`);
        setCallStatus('idle');
        setStatusMsg('Failed to connect');
      }
    };

    init();

    return () => {
      stopTimer();
      try { callRef.current?.disconnect(); } catch {}
      try { device?.destroy(); } catch {}
    };
  }, []);

  // ── Dial ──────────────────────────────────────────────────────────────
  const dial = async () => {
    const to = displayNumber;
    if (!to) { setError('No number to dial.'); return; }
    if (!deviceRef.current) { setError('Dialer not ready yet.'); return; }

    setError('');
    setCallStatus('calling');
    setStatusMsg('Calling…');
    setDuration(0);
    setKeypadInput('');

    try {
      // Make the outbound call via Twilio REST API (server-side)
      const res = await base44.functions.invoke('twilioCall', {
        action: 'makeCall',
        toNumber: to,
      });

      const sid = res.data?.callSid;
      if (!sid) throw new Error(res.data?.error || 'No call SID returned');

      setCallSid(sid);
      setCallStatus('ringing');
      setStatusMsg('Ringing…');

      // Connect browser audio to the outbound call
      const call = await deviceRef.current.connect({ params: { CallSid: sid } });
      callRef.current = call;

      call.on('accept', () => {
        setCallStatus('connected');
        setStatusMsg('Connected');
        startTimer();
      });

      call.on('ringing', () => {
        setCallStatus('ringing');
        setStatusMsg('Ringing…');
      });

      call.on('disconnect', () => {
        stopTimer();
        setCallStatus('ended');
        setStatusMsg('Call Ended');
        logCall(sid);
      });

      call.on('error', (err) => {
        setError(`Call error: ${err.message}`);
        stopTimer();
        setCallStatus('ended');
      });

    } catch (e) {
      setError(e.message || 'Call failed');
      setCallStatus('ready');
      setStatusMsg('Ready');
    }
  };

  // ── Hangup ────────────────────────────────────────────────────────────
  const hangup = () => {
    stopTimer();
    try { callRef.current?.disconnect(); } catch {}
    if (callSid) {
      base44.functions.invoke('twilioCall', { action: 'hangupCall', callSid }).catch(() => {});
    }
    setCallStatus('ended');
    setStatusMsg('Call Ended');
    logCall(callSid);
  };

  // ── Log call to lead history ──────────────────────────────────────────
  const logCall = async (sid) => {
    if (!lead?.id) return;
    const dur = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    try {
      await base44.entities.LeadHistory.create({
        leadId: lead.id,
        type: 'call',
        content: `Outbound call — ${formatDuration(dur)}`,
        callDurationSeconds: dur,
        twilioCallSid: sid || '',
      });
      onCallLogged?.(lead.id);
    } catch {}
  };

  // ── DTMF keypad ───────────────────────────────────────────────────────
  const pressKey = (k) => {
    setKeypadInput(prev => prev + k);
    try { callRef.current?.sendDigits(k); } catch {}
  };

  // ── Reset for redial ──────────────────────────────────────────────────
  const reset = () => {
    setCallStatus('ready');
    setStatusMsg('Ready');
    setDuration(0);
    setCallSid(null);
    setKeypadInput('');
    setError('');
    callRef.current = null;
  };

  const KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];

  const statusColor = {
    idle: '#8a9ab8', initializing: '#f59e0b', ready: '#4ade80',
    calling: '#f59e0b', ringing: '#f59e0b', connected: '#4ade80', ended: '#6b7280',
  };

  const isActive = ['calling', 'ringing', 'connected'].includes(callStatus);

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', width: '320px', background: '#0d1b2a', border: `1px solid rgba(184,147,58,0.4)`, borderRadius: '8px', boxShadow: '0 20px 80px rgba(0,0,0,0.9)', zIndex: 10000, fontFamily: 'Georgia, serif' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px 8px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor[callStatus], boxShadow: `0 0 8px ${statusColor[callStatus]}` }} />
          <span style={{ color: GOLD, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Direct Dialer</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>×</button>
      </div>

      <div style={{ padding: '20px' }}>

        {/* Contact or manual number */}
        {lead ? (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{lead.firstName} {lead.lastName}</div>
            <div style={{ color: GOLD, fontSize: '18px', letterSpacing: '2px', marginTop: '4px' }}>{lead.phone}</div>
          </div>
        ) : (
          <input
            value={manualNumber}
            onChange={e => setManualNumber(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && callStatus === 'ready') dial(); }}
            placeholder="Enter number…"
            disabled={isActive}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '10px', color: '#e8e0d0', fontSize: '18px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: '12px', letterSpacing: '3px' }}
          />
        )}

        {/* Mic selector */}
        {micDevices.length > 1 && !isActive && (
          <div style={{ marginBottom: '12px' }}>
            <select value={selectedMicId} onChange={e => setSelectedMicId(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#8a9ab8', fontSize: '11px', outline: 'none', cursor: 'pointer' }}>
              {micDevices.map(d => <option key={d.deviceId} value={d.deviceId}>🎙 {d.label || `Mic ${d.deviceId.slice(0,6)}`}</option>)}
            </select>
          </div>
        )}

        {/* Status */}
        <div style={{ textAlign: 'center', color: statusColor[callStatus], fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
          {statusMsg}
        </div>

        {/* Timer */}
        {(callStatus === 'connected' || callStatus === 'ended') && (
          <div style={{ textAlign: 'center', color: '#4ade80', fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '12px' }}>
            {formatDuration(duration)}
          </div>
        )}

        {/* DTMF keypad display */}
        {keypadInput && (
          <div style={{ textAlign: 'center', color: '#e8e0d0', fontSize: '16px', letterSpacing: '4px', marginBottom: '8px' }}>
            {keypadInput}
          </div>
        )}

        {/* Keypad — show when connected */}
        {callStatus === 'connected' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '14px' }}>
            {KEYS.map(k => (
              <button key={k} onClick={() => pressKey(k)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px', color: '#e8e0d0', fontSize: '16px', cursor: 'pointer' }}>
                {k}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>

          {/* Dial button */}
          {(callStatus === 'ready') && (
            <button onClick={dial} disabled={!displayNumber} style={{ flex: 1, background: displayNumber ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(74,222,128,0.2)', color: '#fff', border: 'none', borderRadius: '50px', padding: '14px', cursor: displayNumber ? 'pointer' : 'not-allowed', fontSize: '20px' }}>
              📞
            </button>
          )}

          {/* Initializing state */}
          {callStatus === 'initializing' && (
            <div style={{ flex: 1, textAlign: 'center', color: '#f59e0b', fontSize: '12px', padding: '14px' }}>
              ⏳ Connecting…
            </div>
          )}

          {/* Ringing / calling — can cancel */}
          {(callStatus === 'calling' || callStatus === 'ringing') && (
            <button onClick={hangup} style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', border: 'none', borderRadius: '50px', padding: '14px', cursor: 'pointer', fontSize: '20px' }}>
              📵
            </button>
          )}

          {/* Connected — mute + hangup */}
          {callStatus === 'connected' && (
            <>
              <button onClick={() => {
                const newMuted = !muted;
                setMuted(newMuted);
                try { newMuted ? callRef.current?.mute() : callRef.current?.mute(false); } catch {}
              }} style={{ flex: 1, background: muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)', color: muted ? '#ef4444' : '#8a9ab8', border: `1px solid ${muted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: '50px', padding: '14px', cursor: 'pointer', fontSize: '16px' }}>
                {muted ? '🔇' : '🎙'}
              </button>
              <button onClick={hangup} style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', border: 'none', borderRadius: '50px', padding: '14px', cursor: 'pointer', fontSize: '20px' }}>
                📵
              </button>
            </>
          )}

          {/* Ended — redial */}
          {callStatus === 'ended' && (
            <button onClick={reset} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50px', padding: '12px', cursor: 'pointer', fontSize: '13px' }}>
              ↩ Redial
            </button>
          )}
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: '12px', textAlign: 'center', marginTop: '10px', lineHeight: 1.4 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}