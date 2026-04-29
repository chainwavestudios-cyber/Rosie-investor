import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Device } from '@twilio/voice-sdk';

/**
 * useInlineDialer
 * Mirrors TwilioDialer.jsx exactly — init on mount, dial on demand.
 * No lazy init, no race condition.
 */
export function useInlineDialer({ onCallStream, onCallLogged } = {}) {
  const [dialerReady, setDialerReady] = useState(false);
  const [dialerError, setDialerError] = useState('');
  const [callStatus,  setCallStatus]  = useState('idle');
  const [duration,    setDuration]    = useState(0);
  const [muted,       setMuted]       = useState(false);

  const deviceRef    = useRef(null);
  const callRef      = useRef(null);
  const timerRef     = useRef(null);
  const startTimeRef = useRef(null);

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

  // ── Init on mount — same as TwilioDialer.jsx ─────────────────────────
  useEffect(() => {
    let device = null;

    const init = async () => {
      setCallStatus('initializing');
      setDialerError('');

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setDialerError('Microphone access denied');
        setCallStatus('idle');
        return;
      }

      try {
        const res   = await base44.functions.invoke('twilioClientToken', {});
        const token = res?.data?.token || res?.token;
        if (!token) throw new Error('No token received');

        device = new Device(token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true,
          logLevel: 'error',
        });

        device.on('registered', () => {
          setCallStatus('ready');
          setDialerReady(true);
          setDialerError('');
        });

        device.on('error', (e) => {
          setDialerError(`Twilio: ${e.message || 'Unknown error'}`);
        });

        device.on('tokenWillExpire', async () => {
          try {
            const r = await base44.functions.invoke('twilioClientToken', {});
            const t = r?.data?.token || r?.token;
            if (t) device.updateToken(t);
          } catch {}
        });

        device.on('unregistered', () => {
          setDialerError('Twilio disconnected — refresh to reconnect');
        });

        await device.register();
        deviceRef.current = device;

      } catch (e) {
        setDialerError(`Init failed: ${e.message}`);
        setCallStatus('idle');
      }
    };

    init();

    return () => {
      stopTimer();
      try { callRef.current?.disconnect(); } catch {}
      try { device?.destroy(); } catch {}
    };
  }, []);

  // ── Dial ─────────────────────────────────────────────────────────────
  const dial = useCallback(async (phone) => {
    if (!phone) return;
    if (!deviceRef.current) { setDialerError('Dialer not ready yet.'); return; }

    const digits = phone.replace(/\D/g, '');
    let e164 = '';
    if (digits.length === 10)                              e164 = `+1${digits}`;
    else if (digits.length === 11 && digits.startsWith('1')) e164 = `+${digits}`;
    else if (digits.length > 7)                            e164 = `+${digits}`;
    else { setDialerError(`Invalid number: ${phone}`); return; }

    setDialerError('');
    setCallStatus('calling');
    setDuration(0);
    setMuted(false);

    try {
      const call = await deviceRef.current.connect({ params: { To: e164 } });
      callRef.current = call;

      call.on('ringing',     () => setCallStatus('ringing'));
      call.on('accept',      (c) => {
        setCallStatus('connected');
        startTimer();
        try { onCallStream?.({ remoteStream: c.getRemoteStream?.() || null, localStream: c.getLocalStream?.() || null, call: c }); } catch {}
      });
      call.on('disconnect',  () => { stopTimer(); setCallStatus('ended'); onCallStream?.(null); });
      call.on('error',       (e) => { setDialerError(`Call error: ${e.message}`); stopTimer(); setCallStatus('ended'); onCallStream?.(null); });

    } catch (e) {
      setDialerError(e.message || 'Call failed');
      setCallStatus('ready');
    }
  }, [onCallStream]);

  const hangup = useCallback(() => {
    stopTimer();
    try { callRef.current?.disconnect(); } catch {}
    setCallStatus('ended');
    onCallStream?.(null);
  }, [onCallStream]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      try { callRef.current?.mute(next); } catch {}
      return next;
    });
  }, []);

  const sendDigit = useCallback((k) => {
    try { callRef.current?.sendDigits(k); } catch {}
  }, []);

  const reset = useCallback(() => {
    setCallStatus(deviceRef.current ? 'ready' : 'idle');
    setDuration(0);
    setMuted(false);
    setDialerError('');
    callRef.current = null;
  }, []);

  const logLeadCall = useCallback(async (leadId) => {
    const dur = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    try {
      await base44.entities.LeadHistory.create({
        leadId,
        type: 'call',
        content: `Outbound call — ${fmt(dur)}`,
        callDurationSeconds: dur,
        twilioCallSid: callRef.current?.parameters?.CallSid || '',
      });
      onCallLogged?.(leadId);
    } catch {}
  }, [onCallLogged]);

  const logInvestorCall = useCallback(async (investorId, investorEmail) => {
    const dur = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    try {
      await base44.entities.ContactNote.create({
        investorId, investorEmail,
        type: 'call',
        content: `Outbound call — ${fmt(dur)}`,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      });
      onCallLogged?.(investorId);
    } catch {}
  }, [onCallLogged]);

  const isActive = ['calling', 'ringing', 'connected'].includes(callStatus);

  return {
    dialerReady, dialerError, callStatus, duration, muted, isActive,
    dial, hangup, toggleMute, sendDigit, reset,
    logLeadCall, logInvestorCall,
    fmt,
  };
}