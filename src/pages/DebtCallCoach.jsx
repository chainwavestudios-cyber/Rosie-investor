/**
 * DebtCallCoach.jsx — Standalone live-call coaching page for debt settlement.
 * Captures headset mic audio, streams to Deepgram (diarize + sentiment),
 * and runs live Q&A / Coach / Intent analysis against the debt settlement KB.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };

const DEBT_KB_CATEGORIES = ['debt_kb', 'debt_faq'];

export default function DebtCallCoach() {
  const [micDevices, setMicDevices] = useState([]);
  const [micDeviceId, setMicDeviceId] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | live | ended
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState([]); // { speaker, text, sentiment, time }
  const [kbEntries, setKbEntries] = useState([]);
  const [kbLoading, setKbLoading] = useState(true);

  // AI tools
  const [qaActive, setQaActive] = useState(true);
  const [coachActive, setCoachActive] = useState(true);
  const [intentActive, setIntentActive] = useState(true);
  const [qaItems, setQaItems] = useState([]);
  const [coachTips, setCoachTips] = useState([]);
  const [intentScore, setIntentScore] = useState(null);
  const [intentLabel, setIntentLabel] = useState('');

  // Post-call
  const [report, setReport] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);

  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const processorRef = useRef(null);
  const transcriptRef = useRef([]);
  const lastCoachTime = useRef(0);
  const lastIntentTime = useRef(0);
  const callStartRef = useRef(null);

  // Load debt settlement KB
  useEffect(() => {
    base44.entities.KnowledgeBase.list('-created_date', 500)
      .then(all => setKbEntries((all || []).filter(e => DEBT_KB_CATEGORIES.includes(e.category))))
      .catch(() => {})
      .finally(() => setKbLoading(false));
  }, []);

  // Load mic devices
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => navigator.mediaDevices.enumerateDevices())
      .then(devices => {
        const mics = devices.filter(d => d.kind === 'audioinput');
        setMicDevices(mics);
        if (mics.length > 0 && !micDeviceId) setMicDeviceId(mics[0].deviceId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  const addTranscriptEntry = useCallback((entry) => {
    setTranscript(prev => [...prev, entry]);
  }, []);

  const handleQa = useCallback((question) => {
    const id = Date.now() + Math.random();
    setQaItems(prev => [...prev, { id, question, answer: '', loading: true }]);
    base44.functions.invoke('liveAssistantAI', {
      question,
      transcript: transcriptRef.current.slice(-8),
      kbEntries,
      kbName: 'Debt Settlement KB',
    })
      .then(res => {
        const answer = res?.answer || res?.data?.answer || 'Check knowledge base.';
        setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer, loading: false } : x));
      })
      .catch(() => setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer: 'Unable to answer.', loading: false } : x)));
  }, [kbEntries]);

  const handleCoach = useCallback(() => {
    base44.functions.invoke('liveAssistantAI', {
      transcript: transcriptRef.current.slice(-6),
      kbEntries,
      mode: 'coach',
    })
      .then(res => {
        const tip = res?.tip || res?.response || res?.answer || '';
        if (tip) setCoachTips(prev => [{ tip, time: new Date() }, ...prev].slice(0, 8));
      })
      .catch(() => {});
  }, [kbEntries]);

  const handleIntent = useCallback(() => {
    base44.functions.invoke('liveAssistantAI', {
      transcript: transcriptRef.current.slice(-12),
      kbEntries,
      mode: 'intent',
    })
      .then(res => {
        const score = res?.intent?.intentScore ?? res?.intentScore ?? res?.data?.intentScore;
        const level = res?.intent?.interestLevel || res?.interestLevel || '';
        if (score !== undefined) {
          setIntentScore(score);
          setIntentLabel(level);
        }
      })
      .catch(() => {});
  }, [kbEntries]);

  const processNewEntry = useCallback((entry) => {
    addTranscriptEntry(entry);
    const text = entry.text || '';

    // Q&A — detect questions from the customer (speaker 1)
    if (qaActive && entry.speaker === 1) {
      const qPat = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain|show me|prove|numbers|how much|what's the)\b.{3,80}[?!]/gi;
      const matches = [...(text.matchAll(qPat) || [])].map(m => m[0].trim());
      matches.forEach(q => handleQa(q));
    }

    // Coach — trigger on objection keywords or every 20s
    const objWords = ['prove', 'doubt', 'skeptical', 'risky', 'guarantee', 'fail', 'burned', 'scam', 'catch', 'cost', 'fee', 'how much', 'too much', 'can\'t afford', 'credit score', 'trust'];
    const now = Date.now();
    if (coachActive && (objWords.some(w => text.toLowerCase().includes(w)) || now - lastCoachTime.current > 20000)) {
      lastCoachTime.current = now;
      handleCoach();
    }

    // Intent — every 30s
    if (intentActive && now - lastIntentTime.current > 30000) {
      lastIntentTime.current = now;
      handleIntent();
    }
  }, [qaActive, coachActive, intentActive, addTranscriptEntry, handleQa, handleCoach, handleIntent]);

  const startCall = useCallback(async () => {
    setError(''); setTranscript([]); setQaItems([]); setCoachTips([]); setIntentScore(null); setIntentLabel(''); setReport('');
    setPhase('live');
    callStartRef.current = new Date();
    lastCoachTime.current = Date.now();
    lastIntentTime.current = Date.now();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
      });
      streamRef.current = stream;
    } catch (micErr) {
      setError('Microphone access denied — please allow microphone in your browser settings.');
      setPhase('idle');
      return;
    }

    // Get Deepgram token
    let dgKey = '';
    try {
      const tokenRes = await base44.functions.invoke('deepgramToken2', {});
      dgKey = tokenRes?.key || tokenRes?.data?.key || '';
    } catch {
      // fallback to env var if available
      dgKey = import.meta.env.VITE_DEEPGRAM_API_KEY || '';
    }
    if (!dgKey) {
      setError('Could not get Deepgram API key. Check the deepgram2 secret.');
      setPhase('idle');
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    const dgUrl = 'wss://api.deepgram.com/v1/listen?model=nova-3&diarize=true&smart_format=true&punctuate=true&sentiment=true&utterances=true&interim_results=false';
    const ws = new WebSocket(dgUrl, ['token', dgKey]);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      processor.onaudioprocess = (ev) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = ev.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        ws.send(int16.buffer);
      };
      source.connect(processor);
      const silence = ctx.createGain();
      silence.gain.value = 0;
      processor.connect(silence);
      silence.connect(ctx.destination);
    };

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== 'Results' || !msg.is_final) return;
        const alt = msg.channel?.alternatives?.[0];
        if (!alt || !alt.transcript?.trim()) return;
        const speaker = alt.speaker ?? (msg.speaker ?? 0);
        const sentiment = msg.sentiment || alt.sentiment || null;
        const entry = {
          speaker,
          text: alt.transcript,
          sentiment,
          time: new Date().toISOString(),
        };
        processNewEntry(entry);
      } catch {}
    };

    ws.onerror = () => {
      setError('Deepgram connection error. Check your network or API key.');
    };

    ws.onclose = () => {
      // connection closed
    };
  }, [micDeviceId, processNewEntry]);

  const stopCall = useCallback(async () => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
    setPhase('ended');

    // Generate post-call report
    if (transcriptRef.current.length > 0) {
      setGeneratingReport(true);
      try {
        const res = await base44.functions.invoke('liveAssistantAI', {
          transcript: transcriptRef.current,
          kbEntries,
          kbName: 'Debt Settlement KB',
          mode: 'full_report',
          usedCoach: coachActive,
          usedQA: qaActive,
          usedIntent: intentActive,
          coachTips: coachTips.map(t => t.tip),
          qaLog: qaItems.map(q => ({ question: q.question, answer: q.answer })),
        });
        setReport(res?.report || res?.data?.report || '');
      } catch {
        setReport('Failed to generate report.');
      }
      setGeneratingReport(false);
    }
  }, [kbEntries, coachActive, qaActive, intentActive, coachTips, qaItems]);

  const saveTranscript = useCallback(async () => {
    if (transcriptRef.current.length === 0) return;
    try {
      const duration = callStartRef.current ? Math.round((Date.now() - callStartRef.current.getTime()) / 1000) : 0;
      await base44.entities.BobSession.create({
        sessionLabel: `Debt Call Coach — ${new Date().toLocaleString()}`,
        bobName: 'Live Call',
        transcriptJson: JSON.stringify(transcriptRef.current),
        transcriptLineCount: transcriptRef.current.length,
        durationSeconds: duration,
        createdAt: new Date().toISOString(),
      });
      alert('Transcript saved to BOB sessions!');
    } catch (e) {
      alert('Save failed: ' + (e?.message || String(e)));
    }
  }, []);

  const phaseColor = { idle: '#6b7280', live: '#ef4444', ended: '#8a9ab8' }[phase];
  const phaseLabel = { idle: 'Ready', live: '● LIVE', ended: 'Ended' }[phase];

  return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, color: '#e8e0d0', padding: '24px 32px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'normal', color: '#e8e0d0' }}>
            💳 Debt Settlement Call Coach
          </h1>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>
            Live Headset Coaching · Debt Settlement KB
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: `${phaseColor}18`, border: `1px solid ${phaseColor}44`, borderRadius: '20px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: phaseColor, animation: phase === 'live' ? 'pulse 1s infinite' : 'none' }} />
            <span style={{ color: phaseColor, fontSize: '11px', fontWeight: 'bold' }}>{phaseLabel}</span>
          </span>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '8px 14px', textAlign: 'center' }}>
            <div style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'bold' }}>{transcript.length}</div>
            <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Lines</div>
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div style={{ marginBottom: '20px', padding: '16px 20px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ ...ls, marginBottom: 0 }}>🎙 Microphone</label>
          <select
            value={micDeviceId}
            onChange={e => setMicDeviceId(e.target.value)}
            disabled={phase === 'live'}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none', cursor: 'pointer', minWidth: '240px' }}
          >
            {micDevices.length === 0 && <option>Default microphone</option>}
            {micDevices.map(m => (
              <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0, 6)}`}</option>
            ))}
          </select>
        </div>

        {phase !== 'live' ? (
          <button
            onClick={startCall}
            disabled={kbLoading}
            style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '12px 28px', cursor: kbLoading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: kbLoading ? 0.5 : 1 }}
          >
            {kbLoading ? 'Loading KB…' : '🔴 Start Live Call'}
          </button>
        ) : (
          <button
            onClick={stopCall}
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '12px 28px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}
          >
            ⏹ End Call
          </button>
        )}

        {phase === 'ended' && transcript.length > 0 && (
          <>
            <button
              onClick={saveTranscript}
              style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '12px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              💾 Save Transcript
            </button>
            <button
              onClick={startCall}
              style={{ background: 'rgba(255,255,255,0.05)', color: '#c4cdd8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '12px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              🔄 New Call
            </button>
          </>
        )}

        <div style={{ color: '#6b7280', fontSize: '11px', marginLeft: 'auto', maxWidth: '380px' }}>
          {phase === 'idle' && 'Put on your headset, start the call, and the AI will transcribe both sides and coach you live using the Debt Settlement KB.'}
          {phase === 'live' && 'Speak naturally — Deepgram separates speakers and the AI tools analyze in real time.'}
          {phase === 'ended' && 'Call ended. Review the transcript and report below.'}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#ef4444', fontSize: '12px' }}>
          ⚠ {error}
        </div>
      )}

      {/* Main layout: transcript + AI tools */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 460px', gap: '20px', alignItems: 'start' }}>
        {/* Transcript */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📋 Live Transcript</div>
            <div style={{ color: '#6b7280', fontSize: '10px' }}>
              <span style={{ color: '#60a5fa' }}>● You (Agent)</span> · <span style={{ color: '#f59e0b' }}>● Customer</span>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
            {transcript.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0', fontSize: '13px' }}>
                {phase === 'live' ? 'Listening… start speaking.' : 'No transcript yet. Start a call to begin.'}
              </div>
            ) : transcript.map((msg, i) => {
              const isAgent = msg.speaker === 0;
              const sentColor = msg.sentiment === 'positive' ? '#4ade80' : msg.sentiment === 'negative' ? '#ef4444' : '#6b7280';
              return (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '12px', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '80%', background: isAgent ? 'rgba(96,165,250,0.1)' : 'rgba(245,158,11,0.08)', border: `1px solid ${isAgent ? 'rgba(96,165,250,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: isAgent ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: isAgent ? '#60a5fa' : '#f59e0b', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {isAgent ? '🎙 You' : '👤 Customer'}
                      </span>
                      {msg.sentiment && <span style={{ color: sentColor, fontSize: '9px' }}>● {msg.sentiment}</span>}
                    </div>
                    <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.5 }}>{msg.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Assistant */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>🤖 AI Live Assistant</div>
            <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>Debt Settlement coaching</div>
          </div>

          {/* Toggles */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px' }}>
            {[
              { key: 'qa', label: 'Q&A', active: qaActive, toggle: () => setQaActive(p => !p), color: '#34d399' },
              { key: 'coach', label: 'Coach', active: coachActive, toggle: () => setCoachActive(p => !p), color: '#f59e0b' },
              { key: 'intent', label: 'Intent', active: intentActive, toggle: () => setIntentActive(p => !p), color: '#f472b6' },
            ].map(f => (
              <button
                key={f.key}
                onClick={f.toggle}
                style={{
                  flex: 1, padding: '8px', borderRadius: '4px',
                  border: `1px solid ${f.active ? f.color + '66' : 'rgba(255,255,255,0.1)'}`,
                  background: f.active ? `${f.color}18` : 'transparent',
                  color: f.active ? f.color : '#6b7280',
                  cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase',
                }}
              >
                {f.active ? '● ' : '○ '}{f.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Intent Score */}
            {intentScore !== null && (
              <div style={{ background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ color: '#f472b6', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>📊 Intent Score</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${intentScore}%`, height: '100%', background: 'linear-gradient(90deg,#ef4444,#f59e0b,#4ade80)', borderRadius: '3px', transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ color: '#f472b6', fontSize: '14px', fontWeight: 'bold', minWidth: '36px' }}>{intentScore}</span>
                </div>
                {intentLabel && <div style={{ color: '#8a9ab8', fontSize: '10px', marginTop: '4px', textTransform: 'capitalize' }}>{intentLabel} interest</div>}
              </div>
            )}

            {/* Coach Tips */}
            {coachTips.length > 0 && (
              <div>
                <div style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>💡 Coach Tips</div>
                {coachTips.map((t, i) => (
                  <div key={i} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '4px', padding: '10px 12px', marginBottom: '6px', fontSize: '12px', color: '#c4cdd8', lineHeight: 1.5 }}>
                    {t.tip}
                    <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '4px' }}>{new Date(t.time).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Q&A */}
            {qaItems.length > 0 && (
              <div>
                <div style={{ color: '#34d399', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>🔍 Q&A from KB</div>
                {qaItems.map(item => (
                  <div key={item.id} style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '4px', padding: '10px 12px', marginBottom: '8px' }}>
                    <div style={{ color: '#34d399', fontSize: '11px', marginBottom: '4px' }}>Q: {item.question}</div>
                    <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{item.loading ? '⏳ Analyzing…' : `A: ${item.answer}`}</div>
                  </div>
                ))}
              </div>
            )}

            {qaItems.length === 0 && coachTips.length === 0 && intentScore === null && (
              <div style={{ color: '#4a5568', fontSize: '12px', textAlign: 'center', padding: '30px 0' }}>
                {phase === 'live' ? 'AI tools are listening…' : 'Toggle Q&A, Coach, or Intent and start a call.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post-call report */}
      {phase === 'ended' && (
        <div style={{ marginTop: '20px', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '20px' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📄 Post-Call Report</div>
          {generatingReport ? (
            <div style={{ color: '#6b7280', fontSize: '12px' }}>⏳ Generating report…</div>
          ) : report ? (
            <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{report}</div>
          ) : (
            <div style={{ color: '#4a5568', fontSize: '12px' }}>No report generated.</div>
          )}
        </div>
      )}
    </div>
  );
}