/**
 * FronterDialer.jsx — Outbound Twilio call controls for the fronter/admin.
 * Full dialpad: call, mute, hold, transfer (cold), merge (conference in agent),
 * hang up / disconnect. Live call screen shows lead name, date/time, duration.
 * Deepgram live transcription with 5-second transcript saves to FronterCallTranscript.
 * Post-call report auto-generated at call end (script adherence, objections, sentiment).
 */
import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Device } from '@twilio/voice-sdk';
import { useFronterDeepgram } from '@/hooks/useFronterDeepgram';
import { useCallRecorder } from '@/hooks/useCallRecorder';
import { useAIContactFiller } from '@/hooks/useAIContactFiller';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { checkCallCutoff } from '@/lib/phoneTimeZone';
import CallCutoffOverride from '@/components/fronter/CallCutoffOverride';
import callError from '@/components/fronter/callError';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

export default function FronterDialer({ lead, username, lineKey, lineNumber, onCallStarted, onCallEnded, onLeadCalled, autoDialTrigger = 0, onDial, onCallConnected, onCallSid, onTranscriptUpdate, embedded = false, hangupSignal = 0 }) {
  const { isSuperAdmin, sessionUserId, sessionToken, user } = useDebtCoachAuth();
  const canOverride = isSuperAdmin || user?.username === 'firstfronter';
  const [overrideCutoff, setOverrideCutoff] = useState(false);
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
  const [mergeStep, setMergeStep] = useState('idle');
  const [mergeNumbers, setMergeNumbers] = useState([]);
  const [selectedMergeNumber, setSelectedMergeNumber] = useState('');
  const [customMergeNumber, setCustomMergeNumber] = useState('');
  const [transferNumber, setTransferNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [transcriptLineCount, setTranscriptLineCount] = useState(0);
  const [generatingReport, setGeneratingReport] = useState(false);

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const clockRef = useRef(null);
  const startTimeRef = useRef(null);
  const transcriptIdRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const mergeStepRef = useRef('idle');
  const conferenceNameRef = useRef('');
  const ringbackRef = useRef(null);
  const ringbackTimersRef = useRef([]);

  // ── External hangup signal: when hangupSignal changes (and is non-zero),
  //    disconnect the call immediately. Used after merge/no-connect to hang up
  //    the fronter's browser leg without waiting for the backend to remove them.
  useEffect(() => {
    if (hangupSignal > 0 && callRef.current) {
      try { callRef.current.disconnect(); } catch {}
      callRef.current = null;
      stopTimer();
      if (saveIntervalRef.current) { clearInterval(saveIntervalRef.current); saveIntervalRef.current = null; }
      try { deepgram.stop(); } catch {}
      setCallStatus('idle'); setMuted(false); setOnHold(false); setMerged(false); setConferenceName(''); setMergeStep('idle');
      onCallEnded?.();
    }
  }, [hangupSignal]);

  // ── Ringback tone (US pattern: 440Hz + 480Hz, 2s on / 4s off) ──
  const startRingback = () => {
    stopRingback();
    try {
      const ctx = new AudioContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      gain.gain.value = 0;
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      ringbackRef.current = { ctx, osc1, osc2, gain };
      const playCycle = () => {
        if (!ringbackRef.current) return;
        const { ctx, gain } = ringbackRef.current;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime + 2);
        ringbackTimersRef.current.push(setTimeout(playCycle, 6000));
      };
      playCycle();
    } catch {}
  };
  const stopRingback = () => {
    ringbackTimersRef.current.forEach(t => clearTimeout(t));
    ringbackTimersRef.current = [];
    if (ringbackRef.current) {
      try { ringbackRef.current.osc1.stop(); ringbackRef.current.osc2.stop(); ringbackRef.current.ctx.close(); } catch {}
      ringbackRef.current = null;
    }
  };

  const deepgram = useFronterDeepgram();
  const recorder = useCallRecorder();
  const recorderRef = useRef(recorder);
  useEffect(() => { recorderRef.current = recorder; }, [recorder]);
  const { runFiller: runContactFiller } = useAIContactFiller({ leadId: lead?.id, leadType: 'fronter', transcript: deepgram.lines, isActive: callStatus === 'connected' });
  const runContactFillerRef = useRef(runContactFiller);
  useEffect(() => { runContactFillerRef.current = runContactFiller; }, [runContactFiller]);

  // Sync refs for use in disconnect handler
  useEffect(() => { mergeStepRef.current = mergeStep; }, [mergeStep]);
  useEffect(() => { conferenceNameRef.current = conferenceName; }, [conferenceName]);

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const startTimer = () => {
    startTimeRef.current = Date.now();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockRef.current);
  }, []);

  useEffect(() => () => {
    stopTimer();
    stopRingback();
    if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    try { callRef.current?.disconnect(); } catch {}
    try { deviceRef.current?.destroy(); } catch {}
    deepgram.stop();
  }, []);

  useEffect(() => {
    if (autoDialTrigger > 0 && lead?.phone) dial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDialTrigger]);

  // Push live transcript lines to parent for real-time display
  useEffect(() => {
    if (onTranscriptUpdate) onTranscriptUpdate(deepgram.lines);
  }, [deepgram.lines, onTranscriptUpdate]);

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

  // ── Post-call report generation ──
  const generatePostCallReport = async (finalLines, callDur) => {
    if (!finalLines || finalLines.length < 2) return;
    setGeneratingReport(true);
    try {
      // Load scripts for adherence analysis
      const scripts = await base44.entities.FronterScript.list('sortOrder', 50);
      const scriptsText = (scripts || []).map(s => `=== ${s.name} ===\n${s.content}`).join('\n\n');
      const transcriptText = finalLines.map(l => `${l.speaker === 0 ? 'Agent' : 'Customer'}: ${l.text}`).join('\n');

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a call center supervisor analyzing a fronter's outbound call for debt settlement. Analyze the following call transcript and provide a structured report.

SCRIPTS (what the fronter should have followed):
${scriptsText || '(no scripts configured)'}

CALL TRANSCRIPT (${finalLines.length} lines, ${callDur}s):
${transcriptText}

Provide your analysis as JSON with these fields:
- scriptAdherence: How well did the fronter stick to the script? Did they follow the opening, qualification questions, and flow? (2-3 sentences)
- objectionHandling: How quickly and effectively did the fronter handle objections? Were they caught off guard or did they respond smoothly? (2-3 sentences)
- sentiment: Overall sentiment of the call — one of: "very positive", "positive", "neutral", "negative", "very negative" plus a brief reason
- personalityReview: Review of the customer's personality, demeanor, and communication style. Were they receptive, guarded, hostile, friendly? (2-3 sentences)
- customerInterest: Level of interest the customer showed — one of: "high", "medium", "low", "none" plus a brief reason
- fullReport: A comprehensive narrative summary of the call covering the flow, key moments, outcome, and coaching recommendations (3-5 paragraphs)`,
        response_json_schema: {
          type: 'object',
          properties: {
            scriptAdherence: { type: 'string' },
            objectionHandling: { type: 'string' },
            sentiment: { type: 'string' },
            personalityReview: { type: 'string' },
            customerInterest: { type: 'string' },
            fullReport: { type: 'string' },
          },
        },
      });

      if (res) {
        await base44.entities.FronterCallReport.create({
          transcriptId: transcriptIdRef.current || '',
          leadId: lead?.id || '',
          leadName: `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim(),
          fronterUsername: username,
          callDate: new Date().toISOString(),
          durationSeconds: callDur,
          scriptAdherence: res.scriptAdherence || '',
          objectionHandling: res.objectionHandling || '',
          sentiment: res.sentiment || '',
          personalityReview: res.personalityReview || '',
          customerInterest: res.customerInterest || '',
          fullReport: res.fullReport || '',
        });
      }
    } catch (e) {
      console.error('Post-call report failed:', e);
    }
    setGeneratingReport(false);
  };

  const wireCall = (call) => {
    call.on('ringing', () => { setCallStatus('ringing'); startRingback(); });
    call.on('accept', async () => {
      stopRingback();
      setCallStatus('connected');
      startTimer();

      // Expose the Twilio call SID to the parent (used by the merge popup)
      onCallSid?.(call.parameters?.CallSid || callRef.current?.parameters?.CallSid || '');

      // Auto-open Q&A popup FIRST — don't block on async SDK calls
      onCallConnected?.(lead);

      // Start Deepgram transcription
      const micDeviceId = localStorage.getItem('fronter_mic_device') || '';
      // Pass the customer's call audio so their side is transcribed too.
      // The remote stream may not be established the instant `accept` fires,
      // so retry briefly until it has audio tracks.
      let remoteStream = null;
      try {
        for (let i = 0; i < 6; i++) {
          remoteStream = call.getRemoteStream?.() || null;
          if (remoteStream && remoteStream.getAudioTracks().length > 0) break;
          await new Promise(r => setTimeout(r, 300));
        }
        if (!remoteStream || remoteStream.getAudioTracks().length === 0) {
          console.warn('Fronter transcription: no remote call audio after retries — customer will not be transcribed');
          remoteStream = null;
        }
      } catch { remoteStream = null; }
      deepgram.start(micDeviceId, remoteStream).then(() => {
        setTranscriptLineCount(0);
        // Start native browser recording (replaces paid Twilio recording)
        const micStream = deepgram.getMicStream();
        if (micStream || remoteStream) {
          recorderRef.current.start(micStream, remoteStream);
        }
      }).catch(e => console.error('Deepgram start failed:', e));

      // Update DialerSession to on_call (non-blocking)
      const callSidForSession = call.parameters?.CallSid || callRef.current?.parameters?.CallSid || '';
      base44.entities.DialerSession.filter({ username }).then(sessions => {
        if (sessions?.[0]) {
          base44.entities.DialerSession.update(sessions[0].id, {
            status: 'on_call',
            currentCallLeadId: lead?.id || '',
            currentCallLeadName: `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim(),
            currentCallStartedAt: new Date().toISOString(),
            currentCallConferenceName: callSidForSession ? `fronter_conf_${callSidForSession}` : '',
          });
        }
      }).catch(() => {});

      // Create transcript record
      try {
        const callSid = callRef.current?.parameters?.CallSid || '';
        const rec = await base44.entities.FronterCallTranscript.create({
          leadId: lead?.id || '',
          leadName: `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim(),
          fronterUsername: username,
          transcriptJson: '[]',
          transcriptLineCount: 0,
          durationSeconds: 0,
          callDate: new Date().toISOString(),
          callSid,
        });
        transcriptIdRef.current = rec.id;

        // Save transcript every 5 seconds
        saveIntervalRef.current = setInterval(async () => {
          const lines = deepgram.getLines();
          const dur = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
          setTranscriptLineCount(lines.length);
          try {
            await base44.entities.FronterCallTranscript.update(transcriptIdRef.current, {
              transcriptJson: JSON.stringify(lines),
              transcriptLineCount: lines.length,
              durationSeconds: dur,
            });
          } catch {}
        }, 5000);
      } catch (e) { console.error('Transcript record creation failed:', e); }
    });
    call.on('disconnect', async () => {
      stopRingback();
      // Auto-connect merge if fronter disconnects during connected phase
      if (mergeStepRef.current === 'connected' && conferenceNameRef.current) {
        try { await base44.functions.invoke('fronterCall', { action: 'mergeConnect', conferenceName: conferenceNameRef.current, fronterCallSid: callRef.current?.parameters?.CallSid }); } catch {}
      }
      callRef.current = null;
      stopTimer();
      if (saveIntervalRef.current) { clearInterval(saveIntervalRef.current); saveIntervalRef.current = null; }
      deepgram.stop();

      // Update DialerSession to logged_in
      try {
        const sessions = await base44.entities.DialerSession.filter({ username });
        if (sessions?.[0]) {
          await base44.entities.DialerSession.update(sessions[0].id, {
            status: 'logged_in',
            currentCallLeadId: '',
            currentCallLeadName: '',
            currentCallStartedAt: null,
            currentCallConferenceName: '',
          });
        }
      } catch {}

      const dur = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
      const finalLines = deepgram.getLines();

      // Stop native browser recording and save to transcript
      const recUri = await recorderRef.current.stop();
      if (recUri && transcriptIdRef.current) {
        try { await base44.entities.FronterCallTranscript.update(transcriptIdRef.current, { recordingUrl: recUri }); } catch {}
      }

      // Final transcript save
      if (transcriptIdRef.current) {
        try {
          await base44.entities.FronterCallTranscript.update(transcriptIdRef.current, {
            transcriptJson: JSON.stringify(finalLines),
            transcriptLineCount: finalLines.length,
            durationSeconds: dur,
          });
        } catch {}
      }

      // Update lead with duration
      if (lead?.id && dur > 0) {
        try { await base44.entities.FronterLead.update(lead.id, { lastCallDurationSeconds: dur }); } catch {}
      }

      setCallStatus('ended');
      setMuted(false); setOnHold(false); setMerged(false); setConferenceName(''); setMergeStep('idle');
      setTranscriptLineCount(0);
      onCallEnded?.();

      // Generate post-call report (async, non-blocking)
      generatePostCallReport(finalLines, dur);

      // Run AI Contact Filler at call end — auto-populate contact card from transcript
      runContactFillerRef.current?.(true, finalLines);

      setTimeout(() => setCallStatus('idle'), 2000);
      transcriptIdRef.current = null;
    });
    call.on('cancel', () => {
      stopRingback();
      callRef.current = null;
      stopTimer();
      if (saveIntervalRef.current) { clearInterval(saveIntervalRef.current); saveIntervalRef.current = null; }
      deepgram.stop();
      recorderRef.current.cancel();
      setCallStatus('idle'); onCallEnded?.();
    });
    call.on('error', (e) => {
      stopRingback();
      callRef.current = null;
      // 31000 "Call is no longer valid" fires when the call already ended — not actionable, suppress it
      const isStaleCall = (e?.code === 31000 || /31000|no longer valid/i.test(e?.message || ''));
      if (!isStaleCall) setError(e.message);
      stopTimer();
      if (saveIntervalRef.current) { clearInterval(saveIntervalRef.current); saveIntervalRef.current = null; }
      deepgram.stop();
      recorderRef.current.cancel();
      setCallStatus('idle'); onCallEnded?.();
    });
  };

  const dial = async () => {
    if (!lead?.phone) { setError('No phone number'); return; }
    const bypass = canOverride && overrideCutoff;
    const cutoff = checkCallCutoff(lead.phone);
    if (cutoff.blocked && !bypass) {
      setError(`${cutoff.localTime} ${cutoff.tzLabel} — outside the 8am–8pm calling window.`);
      return;
    }
    setError(''); setCallStatus('calling'); setDuration(0); setMuted(false); setOnHold(false); setMerged(false); setConferenceName(''); setMergeStep('idle'); setTranscriptLineCount(0);
    try {
      let overrideToken = '';
      if (bypass) {
        const permission = await base44.functions.invoke('fronterClientToken', {
          action: 'authorizeOverride', phone: lead.phone, sessionUserId, sessionToken,
        });
        overrideToken = permission.data?.overrideToken || '';
        if (!overrideToken) throw new Error('Calling-hours override was not authorized.');
      }
      const inventory = await base44.functions.invoke('twilioGetLines', {});
      const liveLine = (inventory.data?.lines || []).find(l => lineNumber ? l.number === lineNumber : l.key === lineKey);
      if (!liveLine) throw new Error('Your assigned line is not a live voice number in this Twilio account. Contact your admin.');
      if (!isSuperAdmin && liveLine.assignedTo && liveLine.assignedTo.toLowerCase() !== (username || '').toLowerCase()) {
        throw new Error('This line is assigned to another fronter. Contact your admin.');
      }
      const digits = lead.phone.replace(/\D/g, '');
      const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : lead.phone;
      if (!/^\+[1-9]\d{7,14}$/.test(e164)) throw new Error('Please enter a valid destination phone number.');
      const device = await getDevice();
      onDial?.(lead);
      const call = await device.connect({ params: { To: e164, CallerId: liveLine.number, ...(overrideToken ? { CallCutoffOverride: overrideToken } : {}) } });
      callRef.current = call;
      wireCall(call);
      onCallStarted?.(lead);
    } catch (e) { setError(callError(e)); setCallStatus('idle'); }
  };

  const toggleMute = () => {
    if (!callRef.current) return;
    setMuted(prev => {
      const next = !prev;
      try { callRef.current?.mute(next); } catch {}
      deepgram.setMicMuted(next);
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
      if (data?.conferenceName && !conferenceName) {
        setConferenceName(data.conferenceName);
        // Save conference name to DialerSession for listen/barge
        try {
          const sessions = await base44.entities.DialerSession.filter({ username });
          if (sessions?.[0]) {
            await base44.entities.DialerSession.update(sessions[0].id, { currentCallConferenceName: data.conferenceName });
          }
        } catch {}
      }
      setOnHold(!onHold);
    } catch (e) { setError('Hold failed: ' + (e?.message || String(e))); }
    setBusy(false);
  };

  const handleMergeDial = async () => {
    const number = selectedMergeNumber === '__custom__' ? customMergeNumber.trim() : selectedMergeNumber;
    if (!number) { setError('Select or enter a number'); return; }
    setBusy(true); setError('');
    setMergeStep('dialing');
    try {
      const fronterCallSid = callRef.current?.parameters?.CallSid;
      const res = await base44.functions.invoke('fronterCall', {
        action: 'mergeDial', fronterCallSid, agentPhone: number, lineKey, conferenceName, leadId: lead?.id, leadEmail: lead?.email,
      });
      const data = res?.data || res;
      if (data?.conferenceName) {
        setConferenceName(data.conferenceName);
        setMergeStep('connected');
        try {
          const sessions = await base44.entities.DialerSession.filter({ username });
          if (sessions?.[0]) {
            await base44.entities.DialerSession.update(sessions[0].id, { currentCallConferenceName: data.conferenceName });
          }
        } catch {}
      }
    } catch (e) { setError('Merge dial failed: ' + (e?.message || String(e))); setMergeStep('select'); }
    setBusy(false);
  };

  const saveMergeNumber = async () => {
    const phoneNumber = customMergeNumber.trim();
    if (!phoneNumber) return;
    const label = prompt('Name for this number (e.g. Closer - Mike):');
    if (!label?.trim()) return;
    const rec = await base44.entities.ClosingPhoneNumber.create({ label: label.trim(), phoneNumber, sortOrder: mergeNumbers.length + 1 });
    setMergeNumbers(prev => [...prev, rec]);
    setSelectedMergeNumber(phoneNumber);
  };

  const handleMergeConnect = async () => {
    setBusy(true); setError('');
    try {
      await base44.functions.invoke('fronterCall', { action: 'mergeConnect', conferenceName, fronterCallSid: callRef.current?.parameters?.CallSid });
      setMerged(true); setMergeStep('idle'); setShowMergeInput(false);
    } catch (e) { setError('Connect failed: ' + (e?.message || String(e))); }
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
      if (saveIntervalRef.current) { clearInterval(saveIntervalRef.current); saveIntervalRef.current = null; }
      deepgram.stop();
      setCallStatus('idle'); setMuted(false); setOnHold(false); setMerged(false); setConferenceName(''); setMergeStep('idle');
      onCallEnded?.();
    } catch (e) { setError('Transfer failed: ' + (e?.message || String(e))); }
    setBusy(false);
  };

  const disconnect = () => {
    try { callRef.current?.disconnect(); } catch {}
    callRef.current = null;
    stopTimer();
  };

  const handleCallResult = async (result) => {
    if (!lead?.id) return;
    try {
      const newCount = (lead.callCount || 0) + 1;
      const dur = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
      const updates = { callCount: newCount, lastCalledAt: new Date().toISOString(), lastCallResult: result, lastCallDurationSeconds: dur };
      if (newCount >= 3) updates.status = 'removed';
      await base44.entities.FronterLead.update(lead.id, updates);
      onLeadCalled?.(lead.id, newCount);
    } catch {}
  };

  const isActive = ['calling', 'ringing', 'connected'].includes(callStatus);
  const statusColor = callStatus === 'connected' ? '#4ade80' : callStatus === 'ringing' ? AMBER : callStatus === 'calling' ? AMBER : '#4a5568';

  return (
    <div style={embedded ? { display: 'flex', flexDirection: 'column' } : { background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '14px' }}>
      {(!embedded || deepgram.connected || generatingReport) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: embedded ? 'flex-end' : 'space-between', marginBottom: embedded ? '4px' : '10px', gap: '8px' }}>
          {!embedded && <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📞 Dialer</div>}
          {deepgram.connected && <span style={{ color: BLUE, fontSize: '10px', fontWeight: 'bold' }}>🎙️ Transcribing ({transcriptLineCount} lines)</span>}
          {generatingReport && <span style={{ color: PURPLE, fontSize: '10px', fontWeight: 'bold' }}>⏳ Generating report…</span>}
          {!embedded && lineNumber && <div style={{ color: '#6b7280', fontSize: '10px' }}>Line: {lineNumber}</div>}
        </div>
      )}

      {error && <div style={{ color: RED, fontSize: '11px', marginBottom: '8px' }}>⚠ {error}</div>}

      {/* Call info screen */}
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

      <CallCutoffOverride enabled={canOverride && overrideCutoff} onChange={setOverrideCutoff} disabled={isActive} buttonStyle={ctrlBtn(AMBER, canOverride && overrideCutoff)} />

      {/* Controls */}
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
                <button onClick={() => setShowTransferInput(p => !p)} style={ctrlBtn(PURPLE, false)}>
                  ↗ Transfer
                </button>
              </>
            )}
            <button onClick={disconnect} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {merged || mergeStep === 'connected' ? '👋 Leave' : '📵 Hang Up'}
            </button>
          </>
        )}
      </div>

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