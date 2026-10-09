/**
 * FronterDialer.jsx — Outbound Twilio call controls for the fronter/admin.
 * Full dialpad: call, mute, hold, transfer (cold), merge (conference in agent),
 * hang up / disconnect. Live call screen shows lead name, date/time, duration.
 * Uses the fronterClientToken for per-user Twilio identity.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Device } from '@twilio/voice-sdk';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

export default function FronterDialer({ lead, username, lineKey, lineNumber, onCallStarted, onCallEnded, onLeadCalled }) {
  const [callStatus, setCallStatus] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [merged, setMerged] = useState(false);
  const [conferenceName, setConferenceName] = useState('');
  const [showMergeInput, setShowMergeInput] = useState(false);
  const [showTransferInput, setShowTransferInput] = useState(false);
  const [mergeNumber, setMergeNumber] = useState('');
  const [transferNumber, setTransferNumber] = useState('');
  const [busy, setBusy] = useState(false);

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const clockRef = useRef(null);
  const startTimeRef = useRef(null);

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const startTimer = () => {
    startTimeRef.current = Date.now();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  // Live clock for the date/time display
  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockRef.current);
  }, []);

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
      setMuted(false); setOnHold(false); setMerged(false); setConferenceName('');
      onCallEnded?.();
      setTimeout(() => setCallStatus('idle'), 2000);
    });
    call.on('cancel', () => { stopTimer(); setCallStatus('idle'); onCallEnded?.(); });
    call.on('error', (e) => { setError(e.message); stopTimer(); setCallStatus('idle'); onCallEnded?.(); });
  };

  const dial = async () => {
    if (!lead?.phone) { setError('No phone number'); return; }
    setError(''); setCallStatus('calling'); setDuration(0); setMuted(false); setOnHold(false); setMerged(false); setConferenceName('');
    try {
      const device = await getDevice();
      const digits = lead.phone.replace(/\D/g, '');
      const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : lead.phone;
      const call = await device.connect({ params: { To: e164, CallerId: lineNumber } });
      callRef.current = call;
      wireCall(call);
      onCallStarted?.(lead);
    } catch (e) { setError(e.message || 'Call failed'); setCallStatus('idle'); }
  };

  const toggleMute = () => {
    setMuted(prev => {
      const next = !prev;
      try { callRef.current?.mute(next); } catch {}
      return next;
    });
  };

  const handleHold = async () => {
    const fronterCallSid = callRef.current?.parameters?.CallSid;
    if (!fronterCallSid && !conferenceName) { setError('No active call to hold'); return; }
    setBusy(true); setError('');
    try {
      const res = await base44.functions.invoke('fronterCall', {
        action: onHold ? 'unhold' : 'hold', fronterCallSid, conferenceName, lineKey,
      });
      const data = res?.data || res;
      if (data?.conferenceName && !conferenceName) setConferenceName(data.conferenceName);
      setOnHold(!onHold);
    } catch (e) { setError('Hold failed: ' + (e?.message || String(e))); }
    setBusy(false);
  };

  const handleMerge = async () => {
    if (!mergeNumber.trim()) { setError('Enter a number to merge'); return; }
    setBusy(true); setError('');
    try {
      const fronterCallSid = callRef.current?.parameters?.CallSid;
      const res = await base44.functions.invoke('fronterCall', {
        action: 'merge', fronterCallSid, agentPhone: mergeNumber.trim(), lineKey, conferenceName,
      });
      const data = res?.data || res;
      if (data?.conferenceName) { setConferenceName(data.conferenceName); setMerged(true); setShowMergeInput(false); }
    } catch (e) { setError('Merge failed: ' + (e?.message || String(e))); }
    setBusy(false);
  };

  const handleTransfer = async () => {
    if (!transferNumber.trim()) { setError('Enter a number to transfer to'); return; }
    if (!confirm(`Cold transfer ${lead?.firstName} to ${transferNumber.trim()}? You will be dropped from the call.`)) return;
    setBusy(true); setError('');
    try {
      const fronterCallSid = callRef.current?.parameters?.CallSid;
      await base44.functions.invoke('fronterCall', {
        action: 'transfer', fronterCallSid, transferTo: transferNumber.trim(), lineKey, conferenceName,
      });
      setShowTransferInput(false);
      stopTimer();
      setCallStatus('idle'); setMuted(false); setOnHold(false); setMerged(false); setConferenceName('');
      onCallEnded?.();
    } catch (e) { setError('Transfer failed: ' + (e?.message || String(e))); }
    setBusy(false);
  };

  const disconnect = () => {
    try { callRef.current?.disconnect(); } catch {}
    stopTimer();
  };

  const handleCallResult = async (result) => {
    if (!lead?.id) return;
    try {
      const newCount = (lead.callCount || 0) + 1;
      const updates = { callCount: newCount, lastCalledAt: new Date().toISOString(), lastCallResult: result };
      if (newCount >= 3) updates.status = 'removed';
      await base44.entities.FronterLead.update(lead.id, updates);
      onLeadCalled?.(lead.id, newCount);
    } catch {}
  };

  const isActive = ['calling', 'ringing', 'connected'].includes(callStatus);
  const statusColor = callStatus === 'connected' ? '#4ade80' : callStatus === 'ringing' ? AMBER : callStatus === 'calling' ? AMBER : '#4a5568';

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📞 Dialer</div>
        {lineNumber && <div style={{ color: '#6b7280', fontSize: '10px' }}>Line: {lineNumber}</div>}
      </div>

      {error && <div style={{ color: RED, fontSize: '11px', marginBottom: '8px' }}>⚠ {error}</div>}

      {/* ── Call info screen ── */}
      {isActive && (
        <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${statusColor}33`, borderRadius: '6px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, animation: 'pulse 1s infinite' }} />
            <span style={{ color: statusColor, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{callStatus}</span>
            {muted && <span style={{ color: RED, fontSize: '10px', fontWeight: 'bold' }}>· MUTED</span>}
            {onHold && <span style={{ color: AMBER, fontSize: '10px', fontWeight: 'bold' }}>· ON HOLD</span>}
            {merged && <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold' }}>· MERGED</span>}
          </div>
          <div style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
            {lead?.firstName} {lead?.lastName}
          </div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '6px' }}>{lead?.phone}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
            <div style={{ color: '#8a9ab8', fontSize: '11px' }}>
              {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ color: statusColor, fontSize: '20px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {callStatus === 'connected' ? fmt(duration) : '--:--'}
            </div>
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {!isActive ? (
          <button onClick={dial} disabled={!lead?.phone} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: !lead?.phone ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: !lead?.phone ? 0.5 : 1 }}>
            📞 Call {lead?.firstName ? lead.firstName : ''}
          </button>
        ) : (
          <>
            {callStatus === 'connected' && (
              <>
                <button onClick={toggleMute} style={ctrlBtn(muted ? RED : '#c4cdd8', muted)}>
                  {muted ? '🔇 Unmute' : '🎤 Mute'}
                </button>
                <button onClick={handleHold} disabled={busy} style={ctrlBtn(onHold ? AMBER : BLUE, onHold)}>
                  {busy ? '⏳' : onHold ? '▶ Unhold' : '⏸ Hold'}
                </button>
                {!merged && !onHold && (
                  <button onClick={() => setShowMergeInput(p => !p)} style={ctrlBtn(GOLD, false)}>
                    🔗 Merge
                  </button>
                )}
                <button onClick={() => setShowTransferInput(p => !p)} style={ctrlBtn(PURPLE, false)}>
                  ↗ Transfer
                </button>
              </>
            )}
            <button onClick={disconnect} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {merged ? '👋 Leave' : '📵 Hang Up'}
            </button>
          </>
        )}
      </div>

      {/* Merge input */}
      {showMergeInput && !merged && callStatus === 'connected' && (
        <div style={inputBox(GOLD)}>
          <div style={{ color: GOLD, fontSize: '10px', marginBottom: '6px' }}>🔗 Merge in an agent (conference)</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={mergeNumber} onChange={e => setMergeNumber(e.target.value)} placeholder="Agent number (+1 555-123-4567)" style={inputStyle()} onKeyDown={e => { if (e.key === 'Enter') handleMerge(); }} />
            <button onClick={handleMerge} disabled={busy} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{busy ? '⏳' : 'Merge'}</button>
          </div>
        </div>
      )}

      {/* Transfer input */}
      {showTransferInput && callStatus === 'connected' && (
        <div style={inputBox(PURPLE)}>
          <div style={{ color: PURPLE, fontSize: '10px', marginBottom: '6px' }}>↗ Cold transfer (you will be dropped)</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={transferNumber} onChange={e => setTransferNumber(e.target.value)} placeholder="Transfer to (+1 555-123-4567)" style={inputStyle()} onKeyDown={e => { if (e.key === 'Enter') handleTransfer(); }} />
            <button onClick={handleTransfer} disabled={busy} style={{ background: PURPLE, color: DARK, border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{busy ? '⏳' : 'Transfer'}</button>
          </div>
        </div>
      )}

      {/* Call result buttons */}
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

function ctrlBtn(color, active) {
  return {
    background: active ? `${color}22` : 'rgba(255,255,255,0.05)',
    color: active ? color : '#c4cdd8',
    border: `1px solid ${active ? color + '55' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: '4px',
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
  };
}
function inputBox(color) {
  return { marginTop: '10px', padding: '10px', background: `${color}0d`, border: `1px solid ${color}33`, borderRadius: '4px' };
}
function inputStyle() {
  return { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none' };
}