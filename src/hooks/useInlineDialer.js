import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Device } from '@twilio/voice-sdk';

/**
 * useInlineDialer
 * Shared hook powering the inline call bar in LeadContactCard and ContactCardModal.
 * Manages the Twilio Device lifecycle, call state, timer, and call logging.
 *
 * @param {object} opts
 *   onCallStream(streamObj|null)  — forwarded to ScriptAssistant
 *   onCallLogged(leadId|userId)   — called after call is logged
 */
export function useInlineDialer({ onCallStream, onCallLogged } = {}) {
  const [dialerReady, setDialerReady] = useState(false);
  const [dialerError, setDialerError] = useState('');
  const [callStatus,  setCallStatus]  = useState('idle');
  // idle | initializing | ready | calling | ringing | connected | ended
  const [duration,    setDuration]    = useState(0);
  const [muted,       setMuted]       = useState(false);

  const deviceRef    = useRef(null);
  const callRef      = useRef(null);
  const timerRef     = useRef(null);
  const startTimeRef = useRef(null);
  const initializing = useRef(false);

  // ── Format mm:ss ────────────────────────────────────────────────────
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

  // ── Initialise Twilio Device (lazy — called on first dial attempt) ──
  const initDevice = useCallback(async () => {
    if (deviceRef.current || initializing.current) return;
    initializing.current = true;
    setCallStatus('initializing');
    setDialerError('');

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setDialerError('Microphone access denied');
      setCallStatus('idle');
      initializing.current = false;
      return;
    }

    try {
      const res   = await base44.functions.invoke('twilioClientToken', {});
      const token = res?.token || res?.data?.token;
      if (!token) throw new Error('No Twilio token received');

      const device = new Device(token, {
        codecPreferences: ['opus', 'pcmu'],
        fakeLocalDTMF: true,
        enableRingingState: true,
        logLevel: 'error',
      });

      device.on('registered',   () => { setCallStatus('ready'); setDialerReady(true); setDialerError(''); });
      device.on('error',        (e) => setDialerError(`Twilio: ${e.message}`));
      device.on('unregistered', ()  => setDialerError('Twilio disconnected — refresh to reconnect'));
      device.on('tokenWillExpire', async () => {
        try {
          const r = await base44.functions.invoke('twilioClientToken', {});
          const t = r?.token || r?.data?.token;
          if (t) device.updateToken(t);
        } catch {}
      });

      await device.register();
      deviceRef.current = device;
    } catch (e) {
      setDialerError(`Init failed: ${e.message}`);
      setCallStatus('idle');
    }

    initializing.current = false;
  }, []);

  // ── Destroy on unmount ────────────────────────────────────────────
  useEffect(() => () => {
    stopTimer();
    try { callRef.current?.disconnect(); } catch {}
    try { deviceRef.current?.destroy();  } catch {}
  }, []);

  // ── Dial ─────────────────────────────────────────────────────────
  const dial = useCallback(async (phone) => {
    if (!phone) return;
    if (!deviceRef.current) { await initDevice(); }
    if (!deviceRef.current) return; // init failed

    setDialerError('');
    setCallStatus('calling');
    setDuration(0);
    setMuted(false);

    try {
      const call = await deviceRef.current.connect({ params: { To: phone } });
      callRef.current = call;

      call.on('ringing', () => setCallStatus('ringing'));

      call.on('accept', (c) => {
        setCallStatus('connected');
        startTimer();
        try {
          onCallStream?.({
            remoteStream: c.getRemoteStream?.() || null,
            localStream:  c.getLocalStream?.()  || null,
            call: c,
          });
        } catch {}
      });

      call.on('disconnect', () => {
        stopTimer();
        setCallStatus('ended');
        onCallStream?.(null);
      });

      call.on('error', (e) => {
        setDialerError(`Call error: ${e.message}`);
        stopTimer();
        setCallStatus('ended');
        onCallStream?.(null);
      });
    } catch (e) {
      setDialerError(e.message || 'Call failed');
      setCallStatus('ready');
    }
  }, [initDevice, onCallStream]);

  // ── Hangup ───────────────────────────────────────────────────────
  const hangup = useCallback(() => {
    stopTimer();
    try { callRef.current?.disconnect(); } catch {}
    setCallStatus('ended');
    onCallStream?.(null);
  }, [onCallStream]);

  // ── Mute toggle ──────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      try { callRef.current?.mute(next); } catch {}
      return next;
    });
  }, []);

  // ── DTMF ─────────────────────────────────────────────────────────
  const sendDigit = useCallback((k) => {
    try { callRef.current?.sendDigits(k); } catch {}
  }, []);

  // ── Reset after call ended ────────────────────────────────────────
  const reset = useCallback(() => {
    setCallStatus(deviceRef.current ? 'ready' : 'idle');
    setDuration(0);
    setMuted(false);
    setDialerError('');
    callRef.current = null;
  }, []);

  // ── Log call to LeadHistory ───────────────────────────────────────
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

  // ── Log call to InvestorUser ContactNote ─────────────────────────
  const logInvestorCall = useCallback(async (investorId, investorEmail) => {
    const dur = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    try {
      await base44.entities.ContactNote.create({
        investorId,
        investorEmail,
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
    // state
    dialerReady, dialerError, callStatus, duration, muted, isActive,
    // actions
    dial, hangup, toggleMute, sendDigit, reset, initDevice,
    logLeadCall, logInvestorCall,
    // helpers
    fmt,
  };
}