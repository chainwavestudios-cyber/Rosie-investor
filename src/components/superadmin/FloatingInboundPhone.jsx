/**
 * FloatingInboundPhone.jsx — the super admin's floating inbound handset.
 *
 * Registers the browser dialer as `<username>_inbound` — the identity a call to
 * the toll-free line rings first. Nothing answers on its own: the caller hears
 * two rings while this handset shows its Answer button, and the AI agent picks
 * the call up on the third ring.
 */
import { useState, useRef, useEffect } from 'react';
import { Device } from '@twilio/voice-sdk';
import { base44 } from '@/api/base44Client';
import InboundPhonePanel from '@/components/superadmin/InboundPhonePanel';

export default function FloatingInboundPhone({ username }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | ringing | connected
  const [from, setFrom] = useState('');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    const stopTimer = () => { clearInterval(timerRef.current); timerRef.current = null; };

    const reset = () => {
      stopTimer();
      callRef.current = null;
      setStatus('idle');
      setFrom('');
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
      call.on('disconnect', reset);
      call.on('cancel', reset);
      call.on('reject', reset);
      call.on('error', (e) => {
        // 31000 fires when a call already ended — not actionable
        const stale = e?.code === 31000 || /31000|no longer valid/i.test(e?.message || '');
        if (!stale) setError(e?.message || 'Call error');
        reset();
      });
    };

    (async () => {
      try {
        const res = await base44.functions.invoke('fronterClientToken', { username: `${username}_inbound` });
        const token = res?.data?.token || res?.token;
        if (!token) throw new Error('No Twilio token');
        const device = new Device(token, {
          codecPreferences: ['opus', 'pcmu'], fakeLocalDTMF: true, enableRingingState: true, logLevel: 'error',
        });
        device.on('incoming', (call) => {
          if (callRef.current) { try { call.reject(); } catch {} return; }
          callRef.current = call;
          setFrom(call.parameters?.From || '');
          setStatus('ringing');
          setOpen(true);
          wire(call);
        });
        device.on('error', (e) => setError(e?.message || 'Phone error'));
        await device.register();
        if (cancelled) { try { device.destroy(); } catch {} return; }
        deviceRef.current = device;
        setError('');
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not start the inbound phone');
      }
    })();

    return () => {
      cancelled = true;
      stopTimer();
      try { callRef.current?.disconnect(); } catch {}
      try { deviceRef.current?.destroy(); } catch {}
    };
  }, [username]);

  const answer = () => { try { callRef.current?.accept(); } catch {} };
  const decline = () => { try { callRef.current?.reject(); } catch {} };
  const hangUp = () => { try { callRef.current?.disconnect(); } catch {} };
  const toggleMute = () => {
    if (!callRef.current) return;
    const next = !muted;
    try { callRef.current.mute(next); } catch {}
    setMuted(next);
  };

  return (
    <div style={{ position: 'fixed', right: '20px', bottom: '20px', zIndex: 900 }}>
      <InboundPhonePanel
        open={open}
        status={status}
        from={from}
        duration={duration}
        muted={muted}
        error={error}
        onAnswer={answer}
        onDecline={decline}
        onHangUp={hangUp}
        onToggleMute={toggleMute}
        onToggle={() => setOpen((v) => !v)}
      />
    </div>
  );
}