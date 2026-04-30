import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useTwilioDevice } from '@/lib/TwilioDeviceContext';

export function useInlineDialer({ onCallStream, onCallLogged } = {}) {
  const { getDevice } = useTwilioDevice();

  const [dialerError, setDialerError] = useState('');
  const [callStatus,  setCallStatus]  = useState('idle');
  const [duration,    setDuration]    = useState(0);
  const [muted,       setMuted]       = useState(false);
  const [callerId,    setCallerId]    = useState('');
  const [lines,       setLines]       = useState([]);

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
    base44.functions.invoke('twilioGetLines', {}).then(res => {
      const ls = res?.data?.lines || res?.lines || [];
      setLines(ls);
      if (ls.length > 0) setCallerId(ls[0].number);
    }).catch(() => {});
  }, []);

  const dial = useCallback(async (phone) => {
    if (!phone) return;
    setDialerError('');
    setCallStatus('calling');
    setDuration(0);
    setMuted(false);

    try {
      const device = await getDevice();
      const digits  = phone.replace(/\D/g, '');
      const e164    = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : phone;
      const call    = await device.connect({ params: { To: e164, ...(callerId ? { CallerId: callerId } : {}) } });
      callRef.current = call;

      call.on('ringing',    () => setCallStatus('ringing'));
      call.on('accept',     (c) => {
        setCallStatus('connected'); startTimer();
        // Delay 500ms so RTCPeerConnection ontrack fires first and _remoteStream is populated
        setTimeout(() => {
          try { onCallStream?.({ remoteStream: c.getRemoteStream?.() || null, localStream: c.getLocalStream?.() || null, call: c }); } catch {}
        }, 1000);
      });
      call.on('disconnect', () => { stopTimer(); setCallStatus('ended'); onCallStream?.(null); });
      call.on('error',      (e) => { setDialerError(`Call error: ${e.message}`); stopTimer(); setCallStatus('ended'); onCallStream?.(null); });
    } catch (e) {
      setDialerError(e.message || 'Call failed');
      setCallStatus('idle');
    }
  }, [getDevice, onCallStream]);

  const hangup = useCallback(() => {
    stopTimer();
    try { callRef.current?.disconnect(); } catch {}
    setCallStatus('ended');
    onCallStream?.(null);
  }, [onCallStream]);

  const toggleMute = useCallback(() => {
    setMuted(prev => { const next = !prev; try { callRef.current?.mute(next); } catch {} return next; });
  }, []);

  const sendDigit  = useCallback((k) => { try { callRef.current?.sendDigits(k); } catch {} }, []);

  const reset = useCallback(() => {
    setCallStatus('idle'); setDuration(0); setMuted(false); setDialerError(''); callRef.current = null;
  }, []);

  const logLeadCall = useCallback(async (leadId) => {
    const dur = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    try {
      await base44.entities.LeadHistory.create({
        leadId, type: 'call', content: `Outbound call — ${fmt(dur)}`,
        callDurationSeconds: dur, twilioCallSid: callRef.current?.parameters?.CallSid || '',
      });
      onCallLogged?.(leadId);
    } catch {}
  }, [onCallLogged]);

  const logInvestorCall = useCallback(async (investorId, investorEmail) => {
    const dur = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    try {
      await base44.entities.ContactNote.create({
        investorId, investorEmail, type: 'call',
        content: `Outbound call — ${fmt(dur)}`,
        createdAt: new Date().toISOString(), createdBy: 'admin',
      });
      onCallLogged?.(investorId);
    } catch {}
  }, [onCallLogged]);

  const isActive = ['calling','ringing','connected'].includes(callStatus);

  return { dialerError, callStatus, duration, muted, isActive, dial, hangup, toggleMute, sendDigit, reset, logLeadCall, logInvestorCall, fmt, callerId, setCallerId, lines };
}