/**
 * InboundLineBar.jsx — Always-on answer bar for the shared inbound line.
 *
 * Registers its own Twilio device (identity `<username>_inbound`) as soon as the
 * /fronter page opens, so a call to the shared inbound number rings here and can
 * be answered even with no contact card open. Kept separate from the
 * contact-card dialer on purpose: answering a verification call creates no
 * transcript and no call report.
 */
import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Device } from '@twilio/voice-sdk';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';

export default function InboundLineBar({ username, lineNumber = '+18662908994' }) {
  const [status, setStatus] = useState('idle'); // idle | connected
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    const stopTimer = () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
    };

    const endCall = () => {
      stopTimer();
      callRef.current = null;
      setStatus('idle');
      setDuration(0);
      setMuted(false);
    };

    const wire = (call) => {
      call.on('accept', () => {
        setStatus('connected');
        startRef.current = Date.now();
        stopTimer();
        timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
      });
      call.on('disconnect', endCall);
      call.on('cancel', endCall);
      call.on('error', (e) => {
        // 31000 fires when a call already ended — not actionable
        const stale = e?.code === 31000 || /31000|no longer valid/i.test(e?.message || '');
        if (!stale) setError(e?.message || 'Call error');
        endCall();
      });
    };

    (async () => {
      try {
        const res = await base44.functions.invoke('fronterClientToken', { username: `${username}_inbound` });
        const token = res?.data?.token || res?.token;
        if (!token) throw new Error('No Twilio token');
        const device = new Device(token, { codecPreferences: ['opus', 'pcmu'], logLevel: 'error' });
        device.on('incoming', (call) => {
          if (callRef.current) { try { call.reject(); } catch {} return; }
          callRef.current = call;
          call.accept();
          wire(call);
        });
        device.on('error', (e) => setError(e?.message || 'Dialer error'));
        await device.register();
        if (cancelled) { try { device.destroy(); } catch {} return; }
        deviceRef.current = device;
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not start the inbound dialer');
      }
    })();

    return () => {
      cancelled = true;
      stopTimer();
      try { callRef.current?.disconnect(); } catch {}
      try { deviceRef.current?.destroy(); } catch {}
    };
  }, [username]);

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const active = status === 'connected';
  const tone = active ? GOLD : AMBER;

  const toggleMute = () => {
    if (!callRef.current) return;
    setMuted((prev) => {
      const next = !prev;
      try { callRef.current?.mute(next); } catch {}
      return next;
    });
  };

  const hangUp = () => {
    try { callRef.current?.disconnect(); } catch {}
    callRef.current = null;
    clearInterval(timerRef.current);
    setStatus('idle');
    setDuration(0);
    setMuted(false);
  };

  return (
    <div style={{ padding: '8px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontFamily: 'Georgia, serif' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? tone : GOLD, animation: active ? 'pulse 1s infinite' : 'none' }} />
      <span style={{ color: active ? tone : '#8a9ab8', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {active ? 'In call' : 'Inbound line ready'}
      </span>
      <span style={{ color: '#8a9ab8', fontSize: '12px' }}>{lineNumber}</span>
      {active && (
        <span style={{ color: tone, fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmt(duration)}</span>
      )}
      {active && (
        <>
          <button onClick={toggleMute} style={btn(muted ? RED : '#c4cdd8', muted)}>{muted ? '🔇 Unmute' : '🎤 Mute'}</button>
          <button onClick={hangUp} style={btn(RED, true)}>📵 Hang Up</button>
        </>
      )}
      <span style={{ marginLeft: 'auto', color: error ? RED : '#4a5568', fontSize: '10px' }}>
        {error || 'Calls to this number ring here'}
      </span>
    </div>
  );
}

function btn(color, active) {
  return {
    background: active ? `${color}22` : 'rgba(255,255,255,0.05)',
    color: active ? color : '#c4cdd8',
    border: `1px solid ${active ? color + '55' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
  };
}