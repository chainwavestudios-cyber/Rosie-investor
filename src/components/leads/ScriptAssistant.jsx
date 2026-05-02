import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { loadPortalSettings } from '@/lib/portalSettings';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const QUESTION_PATTERN = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain)\b.{5,80}\?/gi;

// ── Draggable / Resizable Popup Shell ────────────────────────────────────────
function FloatingPopup({ children, onClose, defaultWidth, defaultHeight }) {
  const [pos,  setPos]  = useState({ x: window.innerWidth / 2 - defaultWidth / 2, y: 60 });
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight });
  const dragging   = useRef(false);
  const resizing   = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const startSize  = useRef({ w: 0, h: 0, mx: 0, my: 0 });

  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current) {
        setPos({ x: e.clientX - dragOffset.current.x, y: Math.max(0, e.clientY - dragOffset.current.y) });
      }
      if (resizing.current) {
        const dw = e.clientX - startSize.current.mx;
        const dh = e.clientY - startSize.current.my;
        setSize({ w: Math.max(480, startSize.current.w + dw), h: Math.max(300, startSize.current.h + dh) });
      }
    };
    const onUp = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const onHeaderMouseDown = (e) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  const onResizeMouseDown = (e) => {
    resizing.current = true;
    startSize.current = { w: size.w, h: size.h, mx: e.clientX, my: e.clientY };
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h,
      background: '#0d1b2a', border: `1px solid rgba(184,147,58,0.35)`,
      borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.85)',
      zIndex: 20000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'Georgia, serif',
    }}>
      {/* Drag handle */}
      <div onMouseDown={onHeaderMouseDown} style={{
        padding: '8px 14px', background: 'rgba(0,0,0,0.3)',
        borderBottom: `1px solid rgba(184,147,58,0.2)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'grab', flexShrink: 0, userSelect: 'none',
      }}>
        <span style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>🧠 AI Assistant</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {children}
      </div>

      {/* Resize handle */}
      <div onMouseDown={onResizeMouseDown} style={{
        position: 'absolute', right: 0, bottom: 0, width: 16, height: 16,
        cursor: 'se-resize', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 3,
      }}>
        <div style={{ width: 8, height: 8, borderRight: `2px solid rgba(255,255,255,0.2)`, borderBottom: `2px solid rgba(255,255,255,0.2)` }} />
      </div>
    </div>
  );
}

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

// ── Q&A Tab ───────────────────────────────────────────────────────────────────
function QAPanel({ transcript, transcriptRef, kbEntries, active, qaKeywords }) {
  const [questions,  setQuestions]  = useState([]);   // { id, text, time, answer, answering, answered, autoTriggered }
  const [dividerPct, setDividerPct] = useState(50);
  const containerRef = useRef(null);
  const dragging     = useRef(false);
  const seenQ        = useRef(new Set());
  const lastAutoRef  = useRef(0);

  // Build keyword regex from portal settings (replaces hardcoded TRIGGER_PATTERNS)
  const buildKeywordRegex = useCallback(() => {
    if (!qaKeywords?.trim()) return null;
    const terms = qaKeywords.split(',').map(k => k.trim()).filter(Boolean);
    if (!terms.length) return null;
    const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
  }, [qaKeywords]);

  // Detect questions from incoming transcript
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

    // Auto-trigger KB lookup when keyword detected (portal-configured, replaces hardcoded patterns)
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
          base44.functions.invoke('liveAssistantAI', {
            question: autoQ,
            transcript: transcriptRef.current.slice(-10),
            kbEntries,
          }).then(res => {
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
      const res = await base44.functions.invoke('liveAssistantAI', {
        question: q.text,
        transcript: transcriptRef.current.slice(-10),
        kbEntries,
      });
      const answer = res?.data?.answer || 'No answer found.';
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answered: true, answer } : x));
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

  // Expose qa log for report
  QAPanel.getLog = () => questions.map(q => ({ question: q.text, answered: q.answered, answer: q.answer }));

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Questions — top */}
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
                <div style={{ color: q.answered ? '#4ade80' : '#e8e0d0', fontSize: '12px', lineHeight: 1.4 }}>{q.text}</div>
              </div>
              <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '2px' }}>{q.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
            </div>
            {!q.answered && !q.answering && (
              <button onClick={() => answerQ(q.id)}
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>
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

      {/* Answers — bottom */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ color: '#4ade80', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px', flexShrink: 0 }}>💡 Answers</div>
        {questions.filter(q => q.answered || q.answering).length === 0 && (
          <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px' }}>Answers appear here when you click Answer</div>
        )}
        {questions.filter(q => q.answered || q.answering).map(q => (
          <div key={q.id} style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: '4px', padding: '8px 10px' }}>
            <div style={{ color: '#f59e0b', fontSize: '9px', marginBottom: '4px', fontStyle: 'italic' }}>Re: "{q.text.slice(0, 60)}{q.text.length > 60 ? '…' : ''}"</div>
            {q.answering && <div style={{ color: '#6b7280', fontSize: '11px' }}>⏳ Searching knowledge base…</div>}
            {!q.answering && <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{q.answer}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Coach Tab ─────────────────────────────────────────────────────────────────
function CoachPanel({ transcript, kbEntries, coachRules, active }) {
  const [tips,      setTips]      = useState([]);
  const [streaming, setStreaming] = useState(false);
  const lastFired   = useRef(0);
  const containerRef = useRef(null);

  // Fire on every new transcript segment when active
  useEffect(() => {
    if (!active || !transcript.length) return;
    const now = Date.now();
    if (now - lastFired.current < 4000) return; // debounce 4s
    lastFired.current = now;
    streamCoach();
  }, [transcript, active]);

  const streamCoach = async () => {
    if (streaming) return;
    setStreaming(true);
    const tipId = Date.now();
    setTips(prev => [...prev, { id: tipId, text: '', streaming: true, time: new Date() }]);

    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        transcript: transcript.slice(-15),
        kbEntries,
        mode: 'coach_stream',
        coachRules,
      });
      // liveAssistantAI returns streamed SSE — read the full text
      const text = res?.data?.answer || res?.answer || '';
      setTips(prev => prev.map(t => t.id === tipId ? { ...t, text, streaming: false } : t));
    } catch (e) {
      setTips(prev => prev.map(t => t.id === tipId ? { ...t, text: `Error: ${e.message}`, streaming: false } : t));
    }
    setStreaming(false);
    // Scroll to bottom
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

// ── Intent Tab ────────────────────────────────────────────────────────────────
function IntentPanel({ transcript, engagementScore, intentRules, active, onIntentResult }) {
  const [liveSegments, setLiveSegments] = useState([]);
  const [finalResult,  setFinalResult]  = useState(null);
  const [analyzing,    setAnalyzing]    = useState(false);

  // Collect live Deepgram sentiment
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
      const res = await base44.functions.invoke('liveAssistantAI', {
        transcript, mode: 'intent_final', intentRules, engagementScore,
      });
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

      {/* Live sentiment ticker */}
      <div>
        <div style={{ color: '#60a5fa', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>📡 Live Sentiment</div>
        {liveSegments.length === 0
          ? <div style={{ color: '#4a5568', fontSize: '11px' }}>{active ? 'Waiting for sentiment data…' : 'Enable Intent to track'}</div>
          : (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                {[['Positive', posCount, '#4ade80'], ['Negative', negCount, '#ef4444'], ['Neutral', neuCount, '#8a9ab8']].map(([label, count, color]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ color, fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>{count}</div>
                    <div style={{ color: '#4a5568', fontSize: '8px' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '120px', overflowY: 'auto' }}>
                {[...liveSegments].reverse().slice(0, 15).map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: sentColor[s.sentiment] || '#4a5568', flexShrink: 0, marginTop: 4 }} />
                    <span style={{ color: '#6b7280', fontSize: '9px', flexShrink: 0 }}>{s.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
                    <span style={{ color: '#8a9ab8', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.text.slice(0, 60)}</span>
                  </div>
                ))}
              </div>
            </>
          )
        }
      </div>

      {/* Post-call analysis */}
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
            {/* Score */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: finalResult.intentScore >= 70 ? '#4ade80' : finalResult.intentScore >= 40 ? '#f59e0b' : '#ef4444', fontFamily: 'monospace' }}>{finalResult.intentScore}</div>
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
            {/* Details */}
            {[
              ['Tonality Notes', finalResult.tonalityNotes],
              ['Interest Reason', finalResult.interestReason],
              ['Sentiment Arc', `${finalResult.sentimentArc} — ${finalResult.sentimentArcNotes}`],
              ['Next Step', finalResult.recommendedNextStep],
            ].filter(([, v]) => v).map(([label, value]) => (
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

// ── Main Export ───────────────────────────────────────────────────────────────
function AIAssistantPopup({
  lead, transcript, transcriptRef, kbEntries, portalCfg, engagementScore,
  qaActive, coachActive, intentActive,
  onToggleQA, onToggleCoach, onToggleIntent,
  onClose, onIntentResult,
}) {
  const [activeTab, setActiveTab] = useState(qaActive ? 'qa' : coachActive ? 'coach' : 'intent');

  const qaRef     = useRef(null);
  const coachRef  = useRef(null);
  const intentRef = useRef(null);

  // Switch to activated tab
  useEffect(() => { if (qaActive)     setActiveTab('qa');     }, [qaActive]);
  useEffect(() => { if (coachActive)  setActiveTab('coach');  }, [coachActive]);
  useEffect(() => { if (intentActive) setActiveTab('intent'); }, [intentActive]);

  const screenW = window.innerWidth;
  const defaultW = Math.round(screenW * 0.5);
  const defaultH = Math.round(defaultW / 2.4);

  const TABS = [
    { id: 'qa',     label: '❓ Q&A',    active: qaActive,     toggle: onToggleQA,     color: '#f59e0b' },
    { id: 'coach',  label: '🎯 Coach',  active: coachActive,  toggle: onToggleCoach,  color: '#a78bfa' },
    { id: 'intent', label: '🦆 Intent', active: intentActive, toggle: onToggleIntent, color: '#60a5fa' },
  ];

  return (
    <FloatingPopup onClose={onClose} defaultWidth={defaultW} defaultHeight={defaultH}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Sidebar */}
      <div style={{ width: 110, background: 'rgba(0,0,0,0.2)', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', padding: '10px 8px', gap: '6px', flexShrink: 0 }}>
        {TABS.map(tab => (
          <div key={tab.id}>
            <button onClick={() => setActiveTab(tab.id)}
              style={{ width: '100%', background: activeTab === tab.id ? `${tab.color}18` : 'transparent', border: `1px solid ${activeTab === tab.id ? `${tab.color}44` : 'rgba(255,255,255,0.06)'}`, borderRadius: '4px', color: activeTab === tab.id ? tab.color : '#4a5568', padding: '7px 8px', cursor: 'pointer', fontSize: '10px', textAlign: 'left', fontWeight: 'bold', marginBottom: '3px' }}>
              {tab.label}
            </button>
            <button onClick={tab.toggle}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '5px', background: tab.active ? `${tab.color}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${tab.active ? `${tab.color}33` : 'rgba(255,255,255,0.06)'}`, borderRadius: '4px', color: tab.active ? tab.color : '#4a5568', padding: '4px 8px', cursor: 'pointer', fontSize: '9px' }}>
              <Dot status={tab.active ? 'connected' : 'idle'} size={5} />
              {tab.active ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeTab === 'qa' && (
          <QAPanel ref={qaRef} transcript={transcript} transcriptRef={transcriptRef} kbEntries={kbEntries} active={qaActive} qaKeywords={portalCfg?.intentTriggerKeywords} />
        )}
        {activeTab === 'coach' && (
          <CoachPanel ref={coachRef} transcript={transcript} kbEntries={kbEntries} coachRules={{ focusAreas: portalCfg?.coachFocusAreas, style: portalCfg?.coachStyle, additionalContext: portalCfg?.coachAdditionalContext }} active={coachActive} />
        )}
        {activeTab === 'intent' && (
          <IntentPanel ref={intentRef} transcript={transcript} engagementScore={engagementScore} intentRules={{ duckDefinition: portalCfg?.intentDuckDefinition, cowDefinition: portalCfg?.intentCowDefinition, positiveSignals: portalCfg?.intentPositiveSignals, negativeSignals: portalCfg?.intentNegativeSignals }} active={intentActive} onIntentResult={onIntentResult} />
        )}
      </div>
    </FloatingPopup>
  );
}
// ── Self-contained wrapper — used by LeadContactCard ─────────────────────────
// Manages its own Deepgram stream, KB loading, and portalCfg so that
// AIAssistantPopup can be rendered as a tab without any parent setup.
export function ScriptAssistant({ lead, twilioStream, onExpandCard }) {
  const [transcript,     setTranscript]  = useState([]);
  const [kbEntries,      setKbEntries]   = useState([]);
  const [portalCfg,      setPortalCfg]   = useState({});
  const [qaActive,       setQaActive]    = useState(false);
  const [coachActive,    setCoachActive] = useState(false);
  const [intentActive,   setIntentActive]= useState(false);
  const [listening,      setListening]   = useState(false);
  const transcriptRef = useRef([]);
  const wsRef         = useRef(null);
  const processorRef  = useRef(null);
  const contextRef    = useRef(null);

  // Load KB and portal config on mount
  useEffect(() => {
    base44.entities.KnowledgeBase.list('-created_date', 200).then(setKbEntries).catch(() => {});
    loadPortalSettings().then(setPortalCfg).catch(() => {});
  }, []);

  // Connect Deepgram when a Twilio stream is available
  useEffect(() => {
    if (twilioStream && !listening) startListening(twilioStream);
    return () => stopListening();
  }, [twilioStream]);

  const startListening = async (stream) => {
    try {
      const tokenRes = await base44.functions.invoke('deepgramToken', {});
      const dgKey = tokenRes?.data?.key || '';
      if (!dgKey) return;
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&endpointing=300&sentiment=true`,
        ['token', dgKey]
      );
      ws.onopen = () => {
        setListening(true);
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        contextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
          ws.send(pcm.buffer);
        };
        source.connect(processor);
        processor.connect(audioCtx.destination);
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const alt = data?.channel?.alternatives?.[0];
          if (!alt?.transcript?.trim() || !data.is_final) return;
          const entry = {
            text:      alt.transcript.trim(),
            time:      new Date(),
            final:     true,
            sentiment: data.channel?.sentiment || alt?.sentiment || null,
            sentScore: data.channel?.sentiment_score ?? null,
            speaker:   alt?.words?.[0]?.speaker ?? null,
          };
          const newT = [...transcriptRef.current, entry];
          transcriptRef.current = newT;
          setTranscript([...newT]);
        } catch {}
      };
      ws.onclose = () => setListening(false);
      wsRef.current = ws;
    } catch {}
  };

  const stopListening = () => {
    try { wsRef.current?.close(); }          catch {}
    try { processorRef.current?.disconnect(); } catch {}
    try { contextRef.current?.close(); }     catch {}
    setListening(false);
  };

  return (
    <AIAssistantPopup
      lead={lead}
      transcript={transcript}
      transcriptRef={transcriptRef}
      kbEntries={kbEntries}
      portalCfg={portalCfg}
      engagementScore={lead?.engagementScore || 0}
      qaActive={qaActive}
      coachActive={coachActive}
      intentActive={intentActive}
      onToggleQA={() => setQaActive(v => !v)}
      onToggleCoach={() => setCoachActive(v => !v)}
      onToggleIntent={() => setIntentActive(v => !v)}
      onClose={onExpandCard}
      onIntentResult={() => {}}
    />
  );
}

export default ScriptAssistant;