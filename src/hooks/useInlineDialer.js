import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useTwilioDevice } from '@/lib/TwilioDeviceContext';

export function useInlineDialer({ onCallStream, onCallLogged, agentName = 'admin' } = {}) {
  const { getDevice, incomingCall, setIncomingCall } = useTwilioDevice();

  const [dialerError, setDialerError] = useState('');
  const [callStatus,  setCallStatus]  = useState('idle');
  const [duration,    setDuration]    = useState(0);
  const [muted,       setMuted]       = useState(false);
  const [callerId,    setCallerId]    = useState('');
  const [lines,       setLines]       = useState([]);
  const [micDevices,  setMicDevices]  = useState([]);
  const [micDeviceId, setMicDeviceId] = useState('');
  const [callDirection, setCallDirection] = useState('outbound'); // 'outbound' | 'inbound'

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

  useEffect(() => () => {
    stopTimer();
    try { callRef.current?.disconnect(); } catch {}
  }, []);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const mics = devices.filter(d => d.kind === 'audioinput');
      setMicDevices(mics);
      if (mics.length > 0 && !micDeviceId) setMicDeviceId(mics[0].deviceId);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    base44.functions.invoke('twilioGetLines', {}).then(res => {
      const ls = res?.data?.lines || res?.lines || [];
      setLines(ls);
      if (ls.length > 0) setCallerId(ls[0].number);
    }).catch(() => {});
  }, []);

  // ── Shared call event wiring ─────────────────────────────────────────
  const wireCallEvents = useCallback((call) => {
    call.on('ringing',    () => setCallStatus('ringing'));
    call.on('accept',     (c) => {
      setCallStatus('connected');
      startTimer();
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
      setIncomingCall?.(null);
      onCallStream?.(null);
    });
    call.on('cancel', () => {
      stopTimer();
      setCallStatus('idle');
      setIncomingCall?.(null);
      onCallStream?.(null);
    });
    call.on('error', (e) => {
      setDialerError(`Call error: ${e.message}`);
      stopTimer();
      setCallStatus('ended');
      setIncomingCall?.(null);
      onCallStream?.(null);
    });
  }, [onCallStream, setIncomingCall]);

  // ── Outbound dial ────────────────────────────────────────────────────
  const dial = useCallback(async (phone) => {
    if (!phone) return;
    setDialerError('');
    setCallStatus('calling');
    setCallDirection('outbound');
    setDuration(0);
    setMuted(false);

    try {
      const device = await getDevice();
      const digits  = phone.replace(/\D/g, '');
      const e164    = digits.length === 10
        ? `+1${digits}`
        : digits.length === 11 && digits.startsWith('1')
          ? `+${digits}`
          : phone;
      const call = await device.connect({
        params: { To: e164, ...(callerId ? { CallerId: callerId } : {}) },
        ...(micDeviceId ? { rtcConstraints: { audio: { deviceId: { exact: micDeviceId } } } } : {}),
      });
      callRef.current = call;
      wireCallEvents(call);
    } catch (e) {
      setDialerError(e.message || 'Call failed');
      setCallStatus('idle');
    }
  }, [getDevice, callerId, micDeviceId, wireCallEvents]);

  // ── Answer inbound call ──────────────────────────────────────────────
  const answer = useCallback(() => {
    const call = incomingCall?.call;
    if (!call) return;
    setDialerError('');
    setCallStatus('connected');
    setCallDirection('inbound');
    setDuration(0);
    setMuted(false);
    callRef.current = call;
    call.accept();
    startTimer();
    wireCallEvents(call);
    setIncomingCall?.(null);
  }, [incomingCall, wireCallEvents, setIncomingCall]);

  // ── Reject inbound call ──────────────────────────────────────────────
  const reject = useCallback(() => {
    const call = incomingCall?.call;
    if (!call) return;
    try { call.reject(); } catch {}
    setIncomingCall?.(null);
    setCallStatus('idle');
  }, [incomingCall, setIncomingCall]);

  // ── Hangup ───────────────────────────────────────────────────────────
  const hangup = useCallback(() => {
    stopTimer();
    try { callRef.current?.disconnect(); } catch {}
    setCallStatus('ended');
    setIncomingCall?.(null);
    onCallStream?.(null);
  }, [onCallStream, setIncomingCall]);

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
    setCallStatus('idle');
    setDuration(0);
    setMuted(false);
    setDialerError('');
    setCallDirection('outbound');
    callRef.current = null;
  }, []);

  const logLeadCall = useCallback(async (leadId) => {
    const dur = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    try {
      await base44.entities.LeadHistory.create({
        leadId, type: 'call',
        content: `${callDirection === 'inbound' ? 'Inbound' : 'Outbound'} call — ${fmt(dur)} · by ${agentName}`,
        callDurationSeconds: dur,
        twilioCallSid: callRef.current?.parameters?.CallSid || '',
        createdBy: agentName,
      });
      onCallLogged?.(leadId);
    } catch {}
  }, [onCallLogged, agentName, callDirection]);

  const logInvestorCall = useCallback(async (investorId, investorEmail) => {
    const dur = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    try {
      await base44.entities.ContactNote.create({
        investorId, investorEmail, type: 'call',
        content: `${callDirection === 'inbound' ? 'Inbound' : 'Outbound'} call — ${fmt(dur)} · by ${agentName}`,
        createdAt: new Date().toISOString(),
        createdBy: agentName,
      });
      onCallLogged?.(investorId);
    } catch {}
  }, [onCallLogged, agentName, callDirection]);

  const isActive = ['calling', 'ringing', 'connected'].includes(callStatus);

  return {
    dialerError, callStatus, duration, muted, isActive,
    dial, hangup, answer, reject,
    toggleMute, sendDigit, reset,
    logLeadCall, logInvestorCall, fmt,
    callerId, setCallerId, lines,
    micDevices, micDeviceId, setMicDeviceId,
    callDirection,
    incomingCall,
  };
}