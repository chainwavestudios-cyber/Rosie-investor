import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Device } from '@twilio/voice-sdk';
import useAssistantLineStatus from '@/components/assistant/useAssistantLineStatus';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

export default function AssistantDialer({ username, prefilledNumber, prefilledName, autoDial }) {
  const [number, setNumber] = useState('');
  const [lines, setLines] = useState([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [callStatus, setCallStatus] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [busy, setBusy] = useState(false);

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  // Publish this dialpad's status to the fronter workspace (available / on a call / offline).
  const broadcast = useAssistantLineStatus(username);

  useEffect(() => {
    base44.functions.invoke('twilioGetLines', {}).then(res => {
      const l = res?.data?.lines || res?.lines || [];
      setLines(l);
      // Default to the line assigned to this user (Fronter admin → Lines).
      const mine = l.find(x => (x.assignedTo || '').toLowerCase() === String(username || '').toLowerCase());
      const pick = mine || l[0];
      if (pick) setSelectedLine(pick.number);
    }).catch(e => setError('Could not load Twilio lines: ' + e.message));
  }, [username]);

  useEffect(() => { if (prefilledNumber) setNumber(prefilledNumber); }, [prefilledNumber]);
  useEffect(() => { if (autoDial && prefilledNumber && callStatus === 'idle') { const t = setTimeout(dial, 300); return () => clearTimeout(t); } }, [autoDial, prefilledNumber]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    try { callRef.current?.disconnect(); } catch {}
    try { deviceRef.current?.destroy(); } catch {}
  }, []);

  const fmt = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const startTimer = () => { startRef.current = Date.now(); clearInterval(timerRef.current); timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startRef.current) / 1000)), 1000); };
  const stopTimer = () => clearInterval(timerRef.current);

  const getDevice = async () => {
    if (deviceRef.current) return deviceRef.current;
    const res = await base44.functions.invoke('fronterClientToken', { username });
    const token = res?.data?.token || res?.token;
    if (!token) throw new Error('No Twilio token');
    const device = new Device(token, { codecPreferences: ['opus', 'pcmu'], fakeLocalDTMF: true, enableRingingState: true, logLevel: 'error' });
    await new Promise((resolve, reject) => { device.once('registered', resolve); device.once('error', reject); device.register(); });
    deviceRef.current = device;
    return device;
  };

  const wireCall = (call) => {
    call.on('ringing', () => setCallStatus('ringing'));
    call.on('accept', () => { setCallStatus('connected'); startTimer(); broadcast.markOnCall(prefilledName || number, number); });
    call.on('disconnect', () => { callRef.current = null; stopTimer(); setCallStatus('idle'); setMuted(false); setShowTransfer(false); broadcast.markAvailable(); });
    call.on('cancel', () => { callRef.current = null; stopTimer(); setCallStatus('idle'); broadcast.markAvailable(); });
    call.on('error', (e) => { if (e?.code !== 31000) setError(e.message); callRef.current = null; stopTimer(); setCallStatus('idle'); broadcast.markAvailable(); });
  };

  const dial = async () => {
    const digits = number.replace(/\D/g, '');
    const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : number;
    if (!/^\+[1-9]\d{7,14}$/.test(e164)) { setError('Enter a valid phone number'); return; }
    if (!selectedLine) { setError('Select a Twilio line first'); return; }
    setError(''); setCallStatus('calling'); setDuration(0);
    try {
      const device = await getDevice();
      const call = await device.connect({ params: { To: e164, CallerId: selectedLine } });
      callRef.current = call;
      wireCall(call);
    } catch (e) { setError(e.message || String(e)); setCallStatus('idle'); }
  };

  const hangup = () => { try { callRef.current?.disconnect(); } catch {} callRef.current = null; stopTimer(); setCallStatus('idle'); };

  const toggleMute = () => {
    if (!callRef.current) return;
    setMuted(p => { const n = !p; try { callRef.current?.mute(n); } catch {} return n; });
  };

  const transfer = async () => {
    const t = transferNumber.trim();
    if (!t) { setError('Enter a number to transfer to'); return; }
    if (!confirm(`Cold transfer to ${t}? You will be dropped from the call.`)) return;
    setBusy(true); setError('');
    try {
      const sid = callRef.current?.parameters?.CallSid;
      await base44.functions.invoke('fronterCall', { action: 'transfer', fronterCallSid: sid, transferTo: t, lineKey: selectedLine });
      setShowTransfer(false); hangup();
    } catch (e) { setError('Transfer failed: ' + (e.message || String(e))); }
    setBusy(false);
  };

  const isActive = ['calling', 'ringing', 'connected'].includes(callStatus);
  const statusColor = callStatus === 'connected' ? '#4ade80' : callStatus === 'ringing' ? AMBER : AMBER;

  const press = (d) => setNumber(p => p + d);

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>☎️ Twilio Dialer</div>
      <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '16px' }}>Make outbound calls and cold-transfer prospects to coaches. Uses your Twilio Voice SDK softphone.</div>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '16px', maxWidth: '360px' }}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Outbound Line</label>
          <select value={selectedLine} onChange={e => setSelectedLine(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', marginTop: '4px' }}>
            {lines.map(l => <option key={l.key} value={l.number}>{l.number} {l.assignedTo ? `(${l.assignedTo})` : ''}</option>)}
          </select>
        </div>

        {prefilledName && <div style={{ color: BLUE, fontSize: '12px', marginBottom: '8px' }}>👤 {prefilledName}</div>}

        <input value={number} onChange={e => setNumber(e.target.value)} placeholder="+1 555-123-4567" onKeyDown={e => { if (e.key === 'Enter' && !isActive) dial(); }} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '12px', color: '#e8e0d0', fontSize: '18px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />

        {!isActive && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
              <button key={d} onClick={() => press(d)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '12px', color: '#e8e0d0', fontSize: '16px', cursor: 'pointer' }}>{d}</button>
            ))}
          </div>
        )}

        {error && <div style={{ color: RED, fontSize: '11px', marginBottom: '8px' }}>⚠ {error}</div>}

        {isActive && (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${statusColor}33`, borderRadius: '6px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, animation: 'pulse 1s infinite' }} />
              <span style={{ color: statusColor, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>{callStatus}{muted ? ' · MUTED' : ''}</span>
            </div>
            <div style={{ color: statusColor, fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'center' }}>{callStatus === 'connected' ? fmt(duration) : '--:--'}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px' }}>
          {!isActive ? (
            <button onClick={dial} style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>📞 Call</button>
          ) : (
            <>
              {callStatus === 'connected' && <button onClick={toggleMute} style={{ background: muted ? `${RED}22` : 'rgba(255,255,255,0.05)', color: muted ? RED : '#c4cdd8', border: `1px solid ${muted ? RED + '55' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{muted ? '🔇' : '🎤'}</button>}
              {callStatus === 'connected' && <button onClick={() => setShowTransfer(p => !p)} style={{ background: `${PURPLE}22`, color: PURPLE, border: `1px solid ${PURPLE}55`, borderRadius: '4px', padding: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>↗</button>}
              <button onClick={hangup} style={{ flex: 1, background: `${RED}22`, color: RED, border: `1px solid ${RED}55`, borderRadius: '4px', padding: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>📵 Hang Up</button>
            </>
          )}
        </div>

        {showTransfer && callStatus === 'connected' && (
          <div style={{ marginTop: '10px', padding: '10px', background: `${PURPLE}0d`, border: `1px solid ${PURPLE}33`, borderRadius: '4px' }}>
            <div style={{ color: PURPLE, fontSize: '10px', marginBottom: '6px' }}>↗ Cold transfer (you will be dropped)</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input value={transferNumber} onChange={e => setTransferNumber(e.target.value)} placeholder="+1 555-123-4567" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none' }} />
              <button onClick={transfer} disabled={busy} style={{ background: PURPLE, color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{busy ? '⏳' : 'Transfer'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}