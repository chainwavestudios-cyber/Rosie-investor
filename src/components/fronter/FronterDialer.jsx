/**
 * FronterDialer.jsx — Outbound Twilio call controls for the fronter.
 * Call → Merge (conference in agent) → Disconnect (leave customer + agent).
 * Uses the fronterClientToken for per-user Twilio identity.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Device } from '@twilio/voice-sdk';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function FronterDialer({ lead, username, lineKey, lineNumber, onCallStarted, onCallEnded, onLeadCalled }) {
  const [callStatus, setCallStatus] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [merged, setMerged] = useState(false);
  const [mergeNumber, setMergeNumber] = useState('');
  const [conferenceName, setConferenceName] = useState('');
  const [showMergeInput, setShowMergeInput] = useState(false);

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const startTimer = () => {
    startTimeRef.current = Date.now();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  useEffect(() => () => {
    stopTimer();
    try { callRef.current?.disconnect(); } catch {}
    try { deviceRef.current?.destroy(); } catch {}
  }, []);

  const getDevice = async () => {
    if (deviceRef.current) return deviceRef.current;
    const res = await base44.functions.invoke('fronterClientToken', { username });
    const token = res?.data?.token || res?.token;
    if (!token) throw new Error('No Twilio token');
    const device = new Device(token, {
      codecPreferences: ['opus', 'pcmu'],
      fakeLocalDTMF: true,
      enableRingingState: true,
      logLevel: 'error',
    });
    await new Promise((resolve, reject) => {
      device.once('registered', resolve);
      device.once('error', reject);
      device.register();
    });
    deviceRef.current = device;
    return device;
  };

  const wireCall = (call) => {
    call.on('ringing', () => setCallStatus('ringing'));
    call.on('accept', () => { setCallStatus('connected'); startTimer(); });
    call.on('disconnect', () => {
      stopTimer();
      setCallStatus('ended');
      setMerged(false);
      setConferenceName('');
      onCallEnded?.();
      setTimeout(() => setCallStatus('idle'), 2000);
    });
    call.on('cancel', () => { stopTimer(); setCallStatus('idle'); onCallEnded?.(); });
    call.on('error', (e) => { setError(e.message); stopTimer(); setCallStatus('idle'); onCallEnded?.(); });
  };

  const dial = async () => {
    if (!lead?.phone) { setError('No phone number'); return; }
    setError(''); setCallStatus('calling'); setDuration(0); setMuted(false); setMerged(false); setConferenceName('');
    try {
      const device = await getDevice();
      const digits = lead.phone.replace(/\D/g, '');
      const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : lead.phone;
      const call = await device.connect({
        params: { To: e164, CallerId: lineNumber },
      });
      callRef.current = call;
      wireCall(call);
      onCallStarted?.(lead);
    } catch (e) { setError(e.message || 'Call failed'); setCallStatus('idle'); }
  };

  const handleMerge = async () => {
    if (!mergeNumber.trim()) { setError('Enter a number to merge'); return; }
    setError('');
    try {
      const fronterCallSid = callRef.current?.parameters?.CallSid;
      if (!fronterCallSid) { setError('No active call to merge'); return; }
      const res = await base44.functions.invoke('fronterCall', {
        action: 'merge', fronterCallSid, agentPhone: mergeNumber.trim(), lineKey,
      });
      const data = res?.data || res;
      if (data?.conferenceName) {
        setConferenceName(data.conferenceName);
        setMerged(true);
        setShowMergeInput(false);
      }
    } catch (e) { setError('Merge failed: ' + (e?.message || String(e))); }
  };

  const disconnect = () => {
    // If merged, just drop the fronter's leg — customer + agent stay in conference
    try { callRef.current?.disconnect(); } catch {}
    stopTimer();
  };

  const toggleMute = () => {
    setMuted(prev => {
      const next = !prev;
      try { callRef.current?.mute(next); } catch {}
      return next;
    });
  };

  const handleCallResult = async (result) => {
    if (!lead?.id) return;
    try {
      const newCount = (lead.callCount || 0) + 1;
      const updates = {
        callCount: newCount,
        lastCalledAt: new Date().toISOString(),
        lastCallResult: result,
      };
      if (newCount >= 3) updates.status = 'removed';
      await base44.entities.FronterLead.update(lead.id, updates);
      onLeadCalled?.(lead.id, newCount);
    } catch {}
  };

  const isActive = ['calling', 'ringing', 'connected'].includes(callStatus);

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📞 Dialer</div>
        {lineNumber && <div style={{ color: '#6b7280', fontSize: '10px' }}>Line: {lineNumber}</div>}
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '8px' }}>⚠ {error}</div>}

      {/* Call status */}
      {isActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '8px 12px', background: 'rgba(16,185,129,0.06)', borderRadius: '4px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: callStatus === 'connected' ? '#4ade80' : '#f59e0b', animation: 'pulse 1s infinite' }} />
          <span style={{ color: callStatus === 'connected' ? '#4ade80' : '#f59e0b', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{callStatus}</span>
          {callStatus === 'connected' && <span style={{ color: '#c4cdd8', fontSize: '14px', fontFamily: 'monospace', marginLeft: 'auto' }}>{fmt(duration)}</span>}
          {merged && <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>· Merged</span>}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {!isActive ? (
          <button onClick={dial} disabled={!lead?.phone} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: !lead?.phone ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: !lead?.phone ? 0.5 : 1 }}>
            📞 Call {lead?.firstName ? lead.firstName : ''}
          </button>
        ) : (
          <>
            {callStatus === 'connected' && (
              <>
                <button onClick={toggleMute} style={{ background: muted ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: muted ? '#ef4444' : '#c4cdd8', border: `1px solid ${muted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                  {muted ? '🔇 Unmute' : '🎤 Mute'}
                </button>
                {!merged ? (
                  <button onClick={() => setShowMergeInput(p => !p)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                    🔗 Merge
                  </button>
                ) : null}
              </>
            )}
            <button onClick={disconnect} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {merged ? '👋 Disconnect (Leave)' : '📵 Hang Up'}
            </button>
          </>
        )}
      </div>

      {/* Merge input */}
      {showMergeInput && !merged && callStatus === 'connected' && (
        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', padding: '10px', background: 'rgba(16,185,129,0.06)', borderRadius: '4px' }}>
          <input value={mergeNumber} onChange={e => setMergeNumber(e.target.value)} placeholder="Agent number (e.g. +1 555-123-4567)" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none' }} onKeyDown={e => { if (e.key === 'Enter') handleMerge(); }} />
          <button onClick={handleMerge} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Merge In</button>
        </div>
      )}

      {/* Call result buttons (after call connects) */}
      {callStatus === 'connected' && !merged && (
        <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ color: '#6b7280', fontSize: '10px', width: '100%', marginBottom: '2px' }}>Call result:</span>
          {[
            { label: 'No Answer', val: 'no_answer' },
            { label: 'Voicemail', val: 'voicemail' },
            { label: 'Connected', val: 'connected' },
          ].map(r => (
            <button key={r.val} onClick={() => handleCallResult(r.val)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px' }}>{r.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}