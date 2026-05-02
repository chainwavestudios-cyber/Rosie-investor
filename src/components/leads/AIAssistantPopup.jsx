import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const QUESTION_PATTERN = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain)\b.{5,80}\?/gi;

// ── Status Dot ────────────────────────────────────────────────────────────────
function Dot({ status, size = 7 }) {
  const colors = { idle: '#4a5568', connecting: '#f59e0b', connected: '#4ade80', error: '#ef4444' };
  const color  = colors[status] || '#4a5568';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color, boxShadow: status === 'connected' ? `0 0 6px ${color}` : 'none',
      animation: status === 'connecting' ? 'pulse 0.8s infinite' : status === 'connected' ? 'pulse 2.5s infinite' : 'none',
    }} />
  );
}

// ── Column header ─────────────────────────────────────────────────────────────
function ColHeader({ label, color, active, onToggle }) {
  return (
    <div style={{
      padding: '8px 14px', background: 'rgba(0,0,0,0.25)',
      borderBottom: `1px solid ${active ? color + '44' : 'rgba(255,255,255,0.07)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <span style={{ color: active ? color : '#6b7280', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        background: active ? `${color}18` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? `${color}44` : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '20px', color: active ? color : '#4a5568',
        padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold',
      }}>
        <Dot status={active ? 'connected' : 'idle'} size={5} />
        {active ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

// ── Q&A Column ───────────────────────────────────────────────────────────────
function QAPanel({ transcript, transcriptRef, kbEntries, active, qaKeywords }) {
  const [questions,  setQuestions]  = useState([]);
  const [dividerPct, setDividerPct] = useState(50);
  const containerRef = useRef(null);
  const dragging     = useRef(false);
  const seenQ        = useRef(new Set());
  const lastAutoRef  = useRef(0);

  const buildKeywordRegex = useCallback(() => {
    if (!qaKeywords?.trim()) return null;
    const terms = qaKeywords.split(',').map(k => k.trim()).filter(Boolean);
    if (!terms.length) return null;
    const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
  }, [qaKeywords]);

  useEffect(() => {
    if (!transcript.length) return;
    const last = transcript[transcript.length - 1];
    const matches = [...(last.text.matchAll(QUESTION_PATTERN) || [])].map(m => m[0].trim());
    matches.forEach(q => {
      if (!seenQ.current.has(q)) {
        seenQ.current.add(q);
        setQuestions(prev => [...prev, { id: Date.now() + Math.random(), text: q, time: new Date(), answer: '', answering: false, answered: false, autoTriggered: false }]);
      }
    });
    const now = Date.now();
    if (active && now - lastAutoRef.current > 3000) {
      const kwRegex = buildKeywordRegex();
      if (kwRegex && kwRegex.test(last.text)) {
        lastAutoRef.current = now;
        const autoId = Date.now() + Math.random();
        const autoQ = last.text.slice(0, 120);
        if (!seenQ.current.has(autoQ)) {
          seenQ.current.add(autoQ);
          setQuestions(prev => [...prev, { id: autoId, text: autoQ, time: new Date(), answer: '', answering: true, answered: false, autoTriggered: true }]);
          base44.functions.invoke('liveAssistantAI', { question: autoQ, transcript: transcriptRef.current.slice(-10), kbEntries })
            .then(res => {
              const answer = res?.data?.answer || 'No answer found.';
              setQuestions(prev => prev.map(x => x.id === autoId ? { ...x, answering: false, answered: true, answer } : x));
            }).catch(e => {
              setQuestions(prev => prev.map(x => x.id === autoId ? { ...x, answering: false, answer: `Error: ${e.message}` } : x));
            });
        }
      }
    }
  }, [transcript, active, buildKeywordRegex]);

  const answerQ = async (id) => {
    const q = questions.find(x => x.id === id);
    if (!q) return;
    setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: true } : x));
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { question: q.text, transcript: transcriptRef.current.slice(-10), kbEntries });
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answered: true, answer: res?.data?.answer || 'No answer found.' } : x));
    } catch (e) {
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answer: `Error: ${e.message}` } : x));
    }
  };

  const onDividerDown = (e) => { dragging.current = true; e.preventDefault(); };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
      setDividerPct(Math.max(20, Math.min(80, pct)));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  QAPanel.getLog = () => questions.map(q => ({ question: q.text, answered: q.answered, answer: q.answer }));

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Questions */}
      <div style={{ height: `${dividerPct}%`, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ color: '#f59e0b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px', flexShrink: 0 }}>
          ❓ Detected Questions ({questions.length})
        </div>
        {questions.length === 0 && (
          <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
            {active ? 'Listening for questions…' : 'Enable Q&A and start stream'}
          </div>
        )}
        {questions.map(q => (
          <div key={q.id} style={{ background: q.autoTriggered ? 'rgba(96,165,250,0.05)' : 'rgba(245,158,11,0.05)', border: `1px solid ${q.answered ? 'rgba(74,222,128,0.3)' : q.autoTriggered ? 'rgba(96,165,250,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '4px', padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '2px' }}>
                {q.autoTriggered && <span style={{ fontSize: '8px', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '3px', padding: '1px 5px' }}>AUTO</span>}
                <div style={{ color: q.answered ? '#4ade80' : '#e8e0d0', fontSize: '11px', lineHeight: 1.4 }}>{q.text}</div>
              </div>
              <div style={{ color: '#4a5568', fontSize: '9px' }}>{q.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
            </div>
            {!q.answered && !q.answering && (
              <button onClick={() => answerQ(q.id)} style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>
                Answer
              </button>
            )}
            {q.answering && <div style={{ color: '#60a5fa', fontSize: '10px', flexShrink: 0 }}>⏳</div>}
            {q.answered && <div style={{ color: '#4ade80', fontSize: '10px', flexShrink: 0 }}>✓</div>}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div onMouseDown={onDividerDown} style={{ height: 6, background: 'rgba(255,255,255,0.05)', cursor: 'row-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.25)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
        <div style={{ width: 30, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
      </div>

      {/* Answers */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ color: '#4ade80', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px', flexShrink: 0 }}>💡 Answers</div>
        {questions.filter(q => q.answered || q.answering).length === 0 && (
          <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px' }}>Answers appear here</div>
        )}
        {questions.filter(q => q.answered || q.answering).map(q => (
          <div key={q.id} style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: '4px', padding: '8px 10px' }}>
            <div style={{ color: '#f59e0b', fontSize: '9px', marginBottom: '4px', fontStyle: 'italic' }}>Re: "{q.text.slice(0, 50)}{q.text.length > 50 ? '…' : ''}"</div>
            {q.answering && <div style={{ color: '#6b7280', fontSize: '11px' }}>⏳ Searching knowledge base…</div>}
            {!q.answering && <div style={{ color: '#e8e0d0', fontSize: '11px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{q.answer}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Coach Column ──────────────────────────────────────────────────────────────
function CoachPanel({ transcript, kbEntries, coachRules, active }) {
  const [tips,      setTips]      = useState([]);
  const [streaming, setStreaming] = useState(false);
  const lastFired    = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active || !transcript.length) return;
    const now = Date.now();
    if (now - lastFired.current < 4000) return;
    lastFired.current = now;
    streamCoach();
  }, [transcript, active]);

  const streamCoach = async () => {
    if (streaming) return;
    setStreaming(true);
    const tipId = Date.now();
    setTips(prev => [...prev, { id: tipId, text: '', streaming: true, time: new Date() }]);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { transcript: transcript.slice(-15), kbEntries, mode: 'coach_stream', coachRules });
      const text = res?.data?.answer || res?.answer || '';
      setTips(prev => prev.map(t => t.id === tipId ? { ...t, text, streaming: false } : t));
    } catch (e) {
      setTips(prev => prev.map(t => t.id === tipId ? { ...t, text: `Error: ${e.message}`, streaming: false } : t));
    }
    setStreaming(false);
    setTimeout(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, 100);
  };

  CoachPanel.getTips = () => tips.filter(t => t.text).map(t => t.text);

  return (
    <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ color: '#a78bfa', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0 }}>
        🎯 Live Coach {active ? '● live' : '○ paused'}
      </div>
      {tips.length === 0 && (
        <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '30px' }}>
          {active ? 'Waiting for conversation…' : 'Enable Coach to start'}
        </div>
      )}
      {[...tips].reverse().map((tip, i) => (
        <div key={tip.id} style={{ background: i === 0 ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 0 ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ color: '#4a5568', fontSize: '8px', marginBottom: '4px' }}>{tip.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
          {tip.streaming
            ? <div style={{ color: '#6b7280', fontSize: '11px', display: 'flex', gap: 6, alignItems: 'center' }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD, animation: 'pulse 0.8s infinite' }} />Thinking…</div>
            : <div style={{ color: i === 0 ? '#e8e0d0' : '#8a9ab8', fontSize: '12px', lineHeight: 1.6 }}>{tip.text}</div>
          }
        </div>
      ))}
    </div>
  );
}

// ── Intent Column ─────────────────────────────────────────────────────────────
function IntentPanel({ transcript, engagementScore, intentRules, active, onIntentResult }) {
  const [liveSegments, setLiveSegments] = useState([]);
  const [finalResult,  setFinalResult]  = useState(null);
  const [analyzing,    setAnalyzing]    = useState(false);

  useEffect(() => {
    if (!transcript.length) return;
    const last = transcript[transcript.length - 1];
    if (last.sentiment) {
      setLiveSegments(prev => [...prev.slice(-50), { text: last.text, sentiment: last.sentiment, sentScore: last.sentScore, time: new Date() }]);
    }
  }, [transcript]);

  const runFinalAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { transcript, mode: 'intent_final', intentRules, engagementScore });
      const result = res?.data?.intent || res?.intent;
      if (result) { setFinalResult(result); onIntentResult?.(result); }
    } catch (e) { console.error('Intent analysis failed:', e); }
    setAnalyzing(false);
  };

  IntentPanel.runFinal = runFinalAnalysis;
  IntentPanel.getResult = () => finalResult;

  const sentColor = { positive: '#4ade80', negative: '#ef4444', neutral: '#8a9ab8' };
  const posCount  = liveSegments.filter(s => s.sentiment === 'positive').length;
  const negCount  = liveSegments.filter(s => s.sentiment === 'negative').length;
  const neuCount  = liveSegments.filter(s => s.sentiment === 'neutral').length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Live sentiment */}
      <div>
        <div style={{ color: '#60a5fa', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>📡 Live Sentiment</div>
        {liveSegments.length === 0
          ? <div style={{ color: '#4a5568', fontSize: '11px' }}>{active ? 'Waiting for sentiment data…' : 'Enable Intent to track'}</div>
          : (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                {[['Positive', posCount, '#4ade80'], ['Negative', negCount, '#ef4444'], ['Neutral', neuCount, '#8a9ab8']].map(([label, count, color]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ color, fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>{count}</div>
                    <div style={{ color: '#4a5568', fontSize: '8px' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '160px', overflowY: 'auto' }}>
                {[...liveSegments].reverse().slice(0, 20).map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: sentColor[s.sentiment] || '#4a5568', flexShrink: 0, marginTop: 4 }} />
                    <span style={{ color: '#6b7280', fontSize: '9px', flexShrink: 0 }}>{s.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
                    <span style={{ color: '#8a9ab8', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.text.slice(0, 70)}</span>
                  </div>
                ))}
              </div>
            </>
          )
        }
      </div>

      {/* Post-call */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '10px' }}>
        <div style={{ color: '#f59e0b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>📊 Post-Call Analysis</div>
        {!finalResult && (
          <button onClick={runFinalAnalysis} disabled={analyzing || transcript.length < 3}
            style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: analyzing || transcript.length < 3 ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: transcript.length < 3 ? 0.4 : 1 }}>
            {analyzing ? '⏳ Analyzing…' : '🔍 Run Intent Analysis'}
          </button>
        )}
        {finalResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: finalResult.intentScore >= 70 ? '#4ade80' : finalResult.intentScore >= 40 ? '#f59e0b' : '#ef4444', fontFamily: 'monospace' }}>{finalResult.intentScore}</div>
                <div style={{ color: '#4a5568', fontSize: '9px' }}>Intent Score</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '1px 8px', color: '#e8e0d0', fontSize: '10px' }}>{finalResult.animalType === 'cow' ? '🐄 Cow' : finalResult.animalType === 'duck' ? '🦆 Duck' : '❓ Unknown'}</span>
                  <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '1px 8px', color: '#e8e0d0', fontSize: '10px' }}>Interest: {finalResult.interestLevel}</span>
                  <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '1px 8px', color: '#e8e0d0', fontSize: '10px' }}>Tone: {finalResult.tonality}</span>
                </div>
                <div style={{ color: '#8a9ab8', fontSize: '9px' }}>AI: {finalResult.rawAiScore} + Engagement: +{finalResult.engagementContribution}</div>
              </div>
            </div>
            {[['Tonality Notes', finalResult.tonalityNotes], ['Interest Reason', finalResult.interestReason], ['Sentiment Arc', `${finalResult.sentimentArc} — ${finalResult.sentimentArcNotes}`], ['Next Step', finalResult.recommendedNextStep]].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '7px 10px' }}>
                <div style={{ color: GOLD, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>{label}</div>
                <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.4 }}>{value}</div>
              </div>
            ))}
            {finalResult.keyMoments?.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '7px 10px' }}>
                <div style={{ color: GOLD, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Key Moments</div>
                {finalResult.keyMoments.map((m, i) => <div key={i} style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.4 }}>• {m}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Export — Full-width 3-column panel ───────────────────────────────────
export default function AIAssistantPopup({
  lead, transcript, transcriptRef, kbEntries, portalCfg, engagementScore,
  qaActive, coachActive, intentActive,
  onToggleQA, onToggleCoach, onToggleIntent,
  onClose, onIntentResult,
}) {
  const qaRef     = useRef(null);
  const coachRef  = useRef(null);
  const intentRef = useRef(null);
  const [height, setHeight] = useState(380);
  const resizing  = useRef(false);
  const startY    = useRef(0);
  const startH    = useRef(0);

  // Resize from top edge
  useEffect(() => {
    const onMove = (e) => {
      if (!resizing.current) return;
      const dy = startY.current - e.clientY;
      setHeight(Math.max(220, Math.min(window.innerHeight * 0.85, startH.current + dy)));
    };
    const onUp = () => { resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const colStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
    borderRight: '1px solid rgba(255,255,255,0.07)',
  };

  return (
    <div style={{
      position: 'fixed',
      left: 0, right: 0, bottom: 0,
      height,
      background: '#0d1b2a',
      borderTop: `1px solid rgba(184,147,58,0.4)`,
      boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
      zIndex: 20000,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Georgia, serif',
    }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Resize handle — drag up/down to resize panel height */}
      <div
        onMouseDown={e => { resizing.current = true; startY.current = e.clientY; startH.current = height; e.preventDefault(); }}
        style={{ height: 6, background: 'rgba(255,255,255,0.04)', cursor: 'row-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      >
        <div style={{ width: 48, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
      </div>

      {/* Panel title bar */}
      <div style={{ padding: '5px 16px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(184,147,58,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🧠 AI Assistant</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}>×</button>
      </div>

      {/* 3 columns */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Q&A */}
        <div style={{ ...colStyle }}>
          <ColHeader label="❓ Q&A" color="#f59e0b" active={qaActive} onToggle={onToggleQA} />
          <QAPanel ref={qaRef} transcript={transcript} transcriptRef={transcriptRef} kbEntries={kbEntries} active={qaActive} qaKeywords={portalCfg?.intentTriggerKeywords} />
        </div>

        {/* Coach */}
        <div style={{ ...colStyle }}>
          <ColHeader label="🎯 Coach" color="#a78bfa" active={coachActive} onToggle={onToggleCoach} />
          <CoachPanel ref={coachRef} transcript={transcript} kbEntries={kbEntries} coachRules={{ focusAreas: portalCfg?.coachFocusAreas, style: portalCfg?.coachStyle, additionalContext: portalCfg?.coachAdditionalContext }} active={coachActive} />
        </div>

        {/* Intent */}
        <div style={{ ...colStyle, borderRight: 'none' }}>
          <ColHeader label="🦆 Intent" color="#60a5fa" active={intentActive} onToggle={onToggleIntent} />
          <IntentPanel ref={intentRef} transcript={transcript} engagementScore={engagementScore} intentRules={{ duckDefinition: portalCfg?.intentDuckDefinition, cowDefinition: portalCfg?.intentCowDefinition, positiveSignals: portalCfg?.intentPositiveSignals, negativeSignals: portalCfg?.intentNegativeSignals }} active={intentActive} onIntentResult={onIntentResult} />
        </div>

      </div>
    </div>
  );
}