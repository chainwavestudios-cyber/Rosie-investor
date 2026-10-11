/**
 * FronterDialer.jsx — Outbound Twilio call controls for the fronter/admin.
 * Full dialpad: call, mute, hold, transfer (cold), merge (conference in agent),
 * hang up / disconnect. Live call screen shows lead name, date/time, duration.
 * Deepgram live transcription with 5-second transcript saves to FronterCallTranscript.
 * Post-call report auto-generated at call end (script adherence, objections, sentiment).
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Device } from '@twilio/voice-sdk';
import { useFronterDeepgram } from '@/hooks/useFronterDeepgram';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

export default function FronterDialer({ lead, username, lineKey, lineNumber, onCallStarted, onCallEnded, onLeadCalled, autoDialTrigger = 0, onDial, onCallConnected, onTranscriptUpdate, embedded = false }) {
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
  const [transcriptLineCount, setTranscriptLineCount] = useState(0);
  const [generatingReport, setGeneratingReport] = useState(false);

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const clockRef = useRef(null);
  const startTimeRef = useRef(null);
  const transcriptIdRef = useRef(null);
  const saveIntervalRef = useRef(null);

  const deepgram = useFronterDeepgram();

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
    call.on('ringing', () => setCallStatus('ringing'));
    call.on('accept', async () => {
      setCallStatus('connected');
      startTimer();

      // Update DialerSession to on_call
      try {
        const sessions = await base44.entities.DialerSession.filter({ username });
        if (sessions?.[0]) {
          await base44.entities.DialerSession.update(sessions[0].id, {
            status: 'on_call',
            currentCallLeadId: lead?.id || '',
            currentCallLeadName: `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim(),
            currentCallStartedAt: new Date().toISOString(),
          });
        }
      } catch {}

      // Auto-open Q&A popup
      onCallConnected?.(lead);

      // Start Deepgram transcription
      const micDeviceId = localStorage.getItem('fronter_mic_device') || '';
      deepgram.start(micDeviceId).then(() => {
        setTranscriptLineCount(0);
      }).catch(e => console.error('Deepgram start failed:', e));

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

        // Start Twilio recording
        if (callSid) {
          try { await base44.functions.invoke('fronterCall', { action: 'startRecording', callSid }); } catch {}
        }

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
          });
        }
      } catch {}

      const dur = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
      const finalLines = deepgram.getLines();

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
      setMuted(false); setOnHold(false); setMerged(false); setConferenceName('');
      setTranscriptLineCount(0);
      onCallEnded?.();

      // Generate post-call report (async, non-blocking)
      generatePostCallReport(finalLines, dur);

      setTimeout(() => setCallStatus('idle'), 2000);
      transcriptIdRef.current = null;
    });
    call.on('cancel', () => {
      stopTimer();
      if (saveIntervalRef.current) { clearInterval(saveIntervalRef.current); saveIntervalRef.current = null; }
      deepgram.stop();
      setCallStatus('idle'); onCallEnded?.();
    });
    call.on('error', (e) => {
      setError(e.message); stopTimer();
      if (saveIntervalRef.current) { clearInterval(saveIntervalRef.current); saveIntervalRef.current = null; }
      deepgram.stop();
      setCallStatus('idle'); onCallEnded?.();
    });
  };

  const dial = async () => {
    if (!lead?.phone) { setError('No phone number'); return; }
    setError(''); setCallStatus('calling'); setDuration(0); setMuted(false); setOnHold(false); setMerged(false); setConferenceName(''); setTranscriptLineCount(0);
    onDial?.(lead);
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

  const handleMerge = async () => {
    if (!mergeNumber.trim()) { setError('Enter a number to merge'); return; }
    setBusy(true); setError('');
    try {
      const fronterCallSid = callRef.current?.parameters?.CallSid;
      const res = await base44.functions.invoke('fronterCall', {
        action: 'merge', fronterCallSid, agentPhone: mergeNumber.trim(), lineKey, conferenceName,
      });
      const data = res?.data || res;
      if (data?.conferenceName) {
        setConferenceName(data.conferenceName); setMerged(true); setShowMergeInput(false);
        // Save conference name to DialerSession for listen/barge
        try {
          const sessions = await base44.entities.DialerSession.filter({ username });
          if (sessions?.[0]) {
            await base44.entities.DialerSession.update(sessions[0].id, { currentCallConferenceName: data.conferenceName });
          }
        } catch {}
      }
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
      if (saveIntervalRef.current) { clearInterval(saveIntervalRef.current); saveIntervalRef.current = null; }
      deepgram.stop();
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