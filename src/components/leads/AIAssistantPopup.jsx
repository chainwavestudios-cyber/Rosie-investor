import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

// ── Much broader question detection ──────────────────────────────────────────
const QUESTION_PATTERNS = [
  /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain|describe|show me|walk me through|give me)\b.{4,120}\?/gi,
  /\b(what('?s| is| are| was| were)?|how (much|many|does|do|long|soon|often)|why (is|are|would|did)|who (is|are|runs|manages|owns)|when (is|does|will|can)|where (is|are|does)|can (you|i|we)|could (you|i|we)|would (you|i|we)|tell me (about|more|how)|walk me through|explain (the|how|why|what)|what happens (if|when)|is (this|there|it)|are (there|you|we)|do (you|i|we)|does (it|this|that))\b.{4,100}/gi,
];

const TOPIC_FRAGMENTS = [
  /\b(minimum|invest(ment|ing)?|return|ROI|interest rate|conversion|uplisting?|nasdaq|discount|share price|revenue|margin|EBITDA|valuation|enterprise value|cap table|capital structure|use of proceeds|timeline|roadmap|team|founder|CEO|CTO|attorney|broker|auditor|accredited|Reg D|506c|risk|exit|liquidity|lock.?up|nightowl|magnus|AI platform|commercial market|TAM|addressable market|comparable|comps|patent|drone|product|camera|NVR|recorder|doorbell)\b/gi,
];

function extractQuestions(text) {
  const found = new Set();
  for (const pattern of QUESTION_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = [...text.matchAll(pattern)];
    matches.forEach(m => { const q = m[0].trim(); if (q.length > 8 && q.length < 200) found.add(q); });
  }
  return [...found];
}

function hasTopicFragment(text) {
  return TOPIC_FRAGMENTS.some(p => { p.lastIndex = 0; return p.test(text); });
}

function Dot({ active, color, size = 6 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: active ? color : '#4a5568', boxShadow: active ? `0 0 6px ${color}` : 'none', animation: active ? 'aipulse 2s ease-in-out infinite' : 'none' }} />;
}

function SectionHeader({ label, color, active, onToggle, collapsed, onCollapse }) {
  return (
    <div onClick={onCollapse} style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.3)', borderBottom: `1px solid ${active ? color + '33' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}>
      <Dot active={active} color={color} />
      <span style={{ color: active ? color : '#6b7280', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', flex: 1 }}>{label}</span>
      <button onClick={e => { e.stopPropagation(); onToggle(); }} style={{ background: active ? `${color}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? color + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: '20px', color: active ? color : '#4a5568', padding: '2px 9px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>{active ? 'ON' : 'OFF'}</button>
      <span style={{ color: '#4a5568', fontSize: '11px' }}>{collapsed ? '▸' : '▾'}</span>
    </div>
  );
}

function DragHandle({ onDragStart }) {
  return (
    <div onMouseDown={onDragStart} style={{ height: 5, background: 'rgba(255,255,255,0.04)', cursor: 'row-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
      <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
    </div>
  );
}

function Btn({ onClick, disabled, children, color = '#8a9ab8', bg = 'rgba(255,255,255,0.05)', border = 'rgba(255,255,255,0.1)', style: s = {} }) {
  return <button onClick={onClick} disabled={disabled} style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: '4px', padding: '3px 10px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap', ...s }}>{children}</button>;
}

// ── Q&A Section ───────────────────────────────────────────────────────────────
function QASection({ transcript, transcriptRef, kbEntries, active, qaKeywords, manualQ, setManualQ, collapsed, qaOnly }) {
  const [questions, setQuestions] = useState([]);
  const [asking,    setAsking]    = useState(false);
  const [addInfoId, setAddInfoId] = useState(null);
  const [splitPct,  setSplitPct]  = useState(50);

  const seenQ         = useRef(new Set());
  const lastAutoRef   = useRef(0);
  const qListRef      = useRef(null);
  const aListRef      = useRef(null);
  const containerRef  = useRef(null);
  const splitDragging = useRef(false);

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
    if (!last?.text) return;

    const detected = extractQuestions(last.text);
    detected.forEach(q => {
      if (!seenQ.current.has(q)) {
        seenQ.current.add(q);
        setQuestions(prev => [...prev, { id: Date.now() + Math.random(), text: q, time: new Date(), answer: '', answering: false, answered: false, auto: false, manual: false }]);
      }
    });

    const now = Date.now();
    if (active && now - lastAutoRef.current > 2500) {
      const kwRegex = buildKeywordRegex();
      const hit = (kwRegex && kwRegex.test(last.text)) || hasTopicFragment(last.text);
      if (hit && detected.length === 0) {
        lastAutoRef.current = now;
        const autoId = Date.now() + Math.random();
        const autoQ  = last.text.trim().slice(0, 150);
        if (!seenQ.current.has(autoQ)) {
          seenQ.current.add(autoQ);
          setQuestions(prev => [...prev, { id: autoId, text: autoQ, time: new Date(), answer: '', answering: true, answered: false, auto: true, manual: false }]);
          base44.functions.invoke('liveAssistantAI', { question: autoQ, transcript: transcriptRef.current.slice(-12), kbEntries, mode: 'qa' })
            .then(res => setQuestions(prev => prev.map(x => x.id === autoId ? { ...x, answering: false, answered: true, answer: res?.data?.answer || 'No matching information found.' } : x)))
            .catch(e => setQuestions(prev => prev.map(x => x.id === autoId ? { ...x, answering: false, answer: `Error: ${e.message}` } : x)));
        }
      }
    }
  }, [transcript, active, buildKeywordRegex]);

  useEffect(() => { if (qListRef.current) qListRef.current.scrollTop = qListRef.current.scrollHeight; }, [questions]);

  useEffect(() => {
    const onMove = (e) => {
      if (!splitDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSplitPct(Math.max(15, Math.min(85, Math.round(((e.clientY - rect.top) / rect.height) * 100))));
    };
    const onUp = () => { splitDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const answerQ = async (id) => {
    const q = questions.find(x => x.id === id);
    if (!q || q.answering) return;
    setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: true } : x));
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { question: q.text, transcript: transcriptRef.current.slice(-12), kbEntries, mode: 'qa' });
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answered: true, answer: res?.data?.answer || 'No matching information found.' } : x));
    } catch (e) {
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answer: `Error: ${e.message}` } : x));
    }
  };

  const getMoreInfo = async (id) => {
    const q = questions.find(x => x.id === id);
    if (!q || !q.answered) return;
    setAddInfoId(id);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { question: `Give me more detailed information about: ${q.text}`, transcript: transcriptRef.current.slice(-12), kbEntries, previousAnswer: q.answer, mode: 'qa_expand' });
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answer: x.answer + '\n\n— Additional Detail —\n' + (res?.data?.answer || 'No additional information found.') } : x));
    } catch (e) {
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answer: x.answer + `\n\nError: ${e.message}` } : x));
    }
    setAddInfoId(null);
  };

  const askManual = async () => {
    if (!manualQ.trim() || asking) return;
    const q = manualQ.trim(); setManualQ(''); setAsking(true);
    const id = Date.now() + Math.random();
    setQuestions(prev => [...prev, { id, text: q, time: new Date(), answer: '', answering: true, answered: false, auto: false, manual: true }]);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { question: q, transcript: transcriptRef.current.slice(-12), kbEntries, mode: 'qa' });
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answered: true, answer: res?.data?.answer || 'No matching information found.' } : x));
    } catch (e) {
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answer: `Error: ${e.message}` } : x));
    }
    setAsking(false);
  };

  const dismissQ = (id) => setQuestions(prev => prev.filter(x => x.id !== id));

  const answered   = questions.filter(q => q.answered || q.answering);
  const unanswered = questions.filter(q => !q.answered && !q.answering);

  const AskBar = () => (
    <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '6px', flexShrink: 0 }}>
      <input value={manualQ} onChange={e => setManualQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') askManual(); }} placeholder="Ask anything about this deal…"
        style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif' }} />
      <Btn onClick={askManual} disabled={!manualQ.trim() || asking} bg={manualQ.trim() && !asking ? 'linear-gradient(135deg,#b8933a,#d4aa50)' : undefined} color={manualQ.trim() && !asking ? '#0a0f1e' : undefined} s={{ padding: '6px 14px', fontSize: '11px' }}>{asking ? '⏳' : 'Ask →'}</Btn>
    </div>
  );

  const QuestionCard = ({ q, compact = false }) => (
    <div key={q.id} style={{ background: q.manual ? 'rgba(184,147,58,0.04)' : q.auto ? 'rgba(96,165,250,0.04)' : 'rgba(245,158,11,0.04)', border: `1px solid ${q.answered ? 'rgba(74,222,128,0.2)' : q.auto ? 'rgba(96,165,250,0.18)' : q.manual ? 'rgba(184,147,58,0.2)' : 'rgba(245,158,11,0.18)'}`, borderRadius: '5px', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '5px 10px' : '7px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: (!compact && (q.answered || q.answering)) ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          {q.manual && <span style={{ fontSize: '8px', background: 'rgba(184,147,58,0.15)', color: GOLD, border: '1px solid rgba(184,147,58,0.3)', borderRadius: '3px', padding: '1px 5px' }}>MANUAL</span>}
          {q.auto   && <span style={{ fontSize: '8px', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '3px', padding: '1px 5px' }}>AUTO</span>}
          {!q.manual && !q.auto && <span style={{ fontSize: '8px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '3px', padding: '1px 5px' }}>DETECTED</span>}
        </div>
        <div style={{ flex: 1, color: q.answered ? '#8a9ab8' : '#e8e0d0', fontSize: '12px', lineHeight: 1.4 }}>{q.text}</div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          {!q.answered && !q.answering && <Btn onClick={() => answerQ(q.id)} color="#f59e0b" bg="rgba(245,158,11,0.15)" border="rgba(245,158,11,0.35)">Answer</Btn>}
          {q.answering && <span style={{ color: '#60a5fa', fontSize: '12px' }}>⏳</span>}
          {q.answered  && <span style={{ color: '#4ade80', fontSize: '12px' }}>✓</span>}
          <button onClick={() => dismissQ(q.id)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      </div>
      {!compact && (q.answered || q.answering) && (
        <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.15)' }}>
          {q.answering
            ? <div style={{ color: '#6b7280', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD, animation: 'aipulse 0.8s infinite' }} />Searching knowledge base…</div>
            : <div>
                <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: '6px' }}>💡 {q.answer}</div>
                <Btn onClick={() => getMoreInfo(q.id)} disabled={addInfoId === q.id} color="#60a5fa" bg="rgba(96,165,250,0.08)" border="rgba(96,165,250,0.2)" s={{ fontSize: '9px', padding: '2px 8px' }}>{addInfoId === q.id ? '⏳ Loading…' : '+ Additional Information'}</Btn>
              </div>
          }
        </div>
      )}
    </div>
  );

  if (collapsed) return null;

  // ── Q&A ONLY MODE ─────────────────────────────────────────────────────────
  if (qaOnly) {
    return (
      <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <AskBar />

        {/* Questions pane */}
        <div style={{ height: `${splitPct}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 40 }}>
          <div style={{ padding: '5px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ color: '#f59e0b', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', flex: 1 }}>❓ Questions ({questions.length})</span>
            {questions.length > 0 && <Btn onClick={() => { setQuestions([]); seenQ.current.clear(); }} color="#ef4444" s={{ padding: '2px 8px', fontSize: '9px' }}>Clear All</Btn>}
          </div>
          <div ref={qListRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {questions.length === 0 && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '18px' }}>{active ? '🎙 Listening for questions — or type one above' : 'Enable Q&A and start audio stream'}</div>}
            {questions.map(q => <QuestionCard key={q.id} q={q} compact={true} />)}
          </div>
        </div>

        {/* Draggable split divider */}
        <div onMouseDown={e => { splitDragging.current = true; e.preventDefault(); }}
          style={{ height: 6, background: 'rgba(245,158,11,0.08)', cursor: 'row-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid rgba(245,158,11,0.15)', borderBottom: '1px solid rgba(245,158,11,0.15)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}>
          <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(245,158,11,0.3)' }} />
        </div>

        {/* Answers pane */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 40 }}>
          <div style={{ padding: '5px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ color: '#4ade80', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', flex: 1 }}>💡 Answers ({answered.length})</span>
            {answered.length > 0 && <Btn onClick={() => setQuestions(prev => prev.filter(q => !q.answered && !q.answering))} color="#ef4444" s={{ padding: '2px 8px', fontSize: '9px' }}>Clear Answers</Btn>}
          </div>
          <div ref={aListRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {answered.length === 0 && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '18px' }}>Answers appear here when questions are answered</div>}
            {answered.map(q => (
              <div key={q.id} style={{ background: 'rgba(74,222,128,0.03)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ padding: '5px 10px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#f59e0b', fontSize: '10px', flex: 1, fontStyle: 'italic' }}>Re: "{q.text.slice(0, 60)}{q.text.length > 60 ? '…' : ''}"</span>
                  {q.answered && !q.answering && <Btn onClick={() => getMoreInfo(q.id)} disabled={addInfoId === q.id} color="#60a5fa" bg="rgba(96,165,250,0.1)" border="rgba(96,165,250,0.25)" s={{ padding: '2px 8px', fontSize: '9px' }}>{addInfoId === q.id ? '⏳' : '+ More Info'}</Btn>}
                  <button onClick={() => setQuestions(prev => prev.filter(x => x.id !== q.id))} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}>×</button>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {q.answering
                    ? <div style={{ color: '#6b7280', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD, animation: 'aipulse 0.8s infinite' }} />Searching knowledge base…</div>
                    : <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{q.answer}</div>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── NORMAL STACKED MODE ───────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <AskBar />
      <div ref={qListRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {questions.length === 0 && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '18px' }}>{active ? '🎙 Listening — questions auto-detected or type one above' : 'Enable Q&A and start the audio stream'}</div>}
        {questions.map(q => <QuestionCard key={q.id} q={q} compact={false} />)}
      </div>
    </div>
  );
}

// ── Coach Section ─────────────────────────────────────────────────────────────
function CoachSection({ transcript, kbEntries, coachRules, active, collapsed }) {
  const [tips, setTips] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const lastFired = useRef(0);
  const listRef   = useRef(null);

  useEffect(() => {
    if (!active || !transcript.length || collapsed) return;
    const now = Date.now();
    if (now - lastFired.current < 4000) return;
    lastFired.current = now;
    if (streaming) return;
    setStreaming(true);
    const tipId = Date.now();
    setTips(prev => [...prev, { id: tipId, text: '', streaming: true, time: new Date() }]);
    base44.functions.invoke('liveAssistantAI', { transcript: transcript.slice(-15), kbEntries, mode: 'coach_stream', coachRules })
      .then(res => setTips(prev => prev.map(t => t.id === tipId ? { ...t, text: res?.data?.answer || '', streaming: false } : t)))
      .catch(e => setTips(prev => prev.map(t => t.id === tipId ? { ...t, text: `Error: ${e.message}`, streaming: false } : t)))
      .finally(() => { setStreaming(false); setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, 100); });
  }, [transcript, active, collapsed]);

  if (collapsed) return null;
  return (
    <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
      {tips.length === 0 && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px' }}>{active ? 'Listening — tips fire automatically…' : 'Enable Coach to receive live tips'}</div>}
      {[...tips].reverse().map((tip, i) => (
        <div key={tip.id} style={{ background: i === 0 ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 0 ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ color: '#4a5568', fontSize: '8px', marginBottom: '5px' }}>{tip.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
          {tip.streaming ? <div style={{ color: '#6b7280', fontSize: '11px', display: 'flex', gap: 6, alignItems: 'center' }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa', animation: 'aipulse 0.8s infinite' }} />Thinking…</div> : <div style={{ color: i === 0 ? '#e8e0d0' : '#8a9ab8', fontSize: '12px', lineHeight: 1.7 }}>{tip.text}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Intent Section ────────────────────────────────────────────────────────────
function IntentSection({ transcript, active, collapsed }) {
  const [segments, setSegments] = useState([]);
  const listRef = useRef(null);
  useEffect(() => {
    if (!transcript.length || collapsed) return;
    const last = transcript[transcript.length - 1];
    if (last.sentiment) setSegments(prev => [...prev.slice(-80), { text: last.text, sentiment: last.sentiment, time: new Date() }]);
  }, [transcript, collapsed]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [segments]);
  const sentColor = { positive: '#4ade80', negative: '#ef4444', neutral: '#8a9ab8' };
  const posCount = segments.filter(s => s.sentiment === 'positive').length;
  const negCount = segments.filter(s => s.sentiment === 'negative').length;
  const neuCount = segments.filter(s => s.sentiment === 'neutral').length;
  const total = segments.length || 1;
  if (collapsed) return null;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {segments.length === 0 ? <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px' }}>{active ? 'Waiting for sentiment data…' : 'Enable Intent to track live sentiment'}</div> : (
        <>
          <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
            {[['😊','Positive',posCount,'#4ade80'],['😟','Negative',negCount,'#ef4444'],['😐','Neutral',neuCount,'#8a9ab8']].map(([icon,label,count,color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ fontSize: '13px' }}>{icon}</span><div><div style={{ color, fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1 }}>{count}</div><div style={{ color: '#4a5568', fontSize: '8px' }}>{Math.round((count/total)*100)}% {label}</div></div></div>
            ))}
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(posCount/total)*100}%`, background: '#4ade80', transition: 'width 0.4s' }} />
              <div style={{ width: `${(neuCount/total)*100}%`, background: '#8a9ab8', transition: 'width 0.4s' }} />
              <div style={{ width: `${(negCount/total)*100}%`, background: '#ef4444', transition: 'width 0.4s' }} />
            </div>
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[...segments].reverse().slice(0,40).map((s,i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: sentColor[s.sentiment]||'#4a5568', flexShrink: 0, marginTop: 4 }} />
                <span style={{ color: '#4a5568', fontSize: '9px', flexShrink: 0, minWidth: '56px' }}>{s.time.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})}</span>
                <span style={{ color: sentColor[s.sentiment], fontSize: '9px', flexShrink: 0, minWidth: '48px', textTransform: 'uppercase', fontWeight: 'bold' }}>{s.sentiment}</span>
                <span style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.4 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIAssistantPopup({
  lead, transcript, transcriptRef, kbEntries, portalCfg, engagementScore,
  qaActive, coachActive, intentActive,
  onToggleQA, onToggleCoach, onToggleIntent,
  onClose, onIntentResult,
  allKbEntries, kbNames, selectedKbName, onKbChange,
}) {
  const [pos,    setPos]    = useState({ x: 20, y: Math.max(20, window.innerHeight - 540) });
  const [width,  setWidth]  = useState(Math.min(860, window.innerWidth - 40));
  const [height, setHeight] = useState(520);
  const [qaH,    setQaH]    = useState(42);
  const [coachH, setCoachH] = useState(33);
  const [qaCollapsed,     setQaCollapsed]     = useState(false);
  const [coachCollapsed,  setCoachCollapsed]  = useState(false);
  const [intentCollapsed, setIntentCollapsed] = useState(false);
  const [qaOnly,  setQaOnly]  = useState(false);
  const [manualQ, setManualQ] = useState('');

  const draggingPanel = useRef(false);
  const dragStart     = useRef({ mx:0,my:0,px:0,py:0 });
  const resizingTop   = useRef(false);
  const resizeTopY    = useRef(0); const resizeTopH = useRef(0); const resizeTopPY = useRef(0);
  const resizingDiv   = useRef(null);
  const divStartY     = useRef(0); const divStartH = useRef(0);

  useEffect(() => {
    const onMove = (e) => {
      if (draggingPanel.current) setPos({ x: Math.max(0,Math.min(window.innerWidth-width, dragStart.current.px+e.clientX-dragStart.current.mx)), y: Math.max(0,Math.min(window.innerHeight-height, dragStart.current.py+e.clientY-dragStart.current.my)) });
      if (resizingTop.current) { const dy=resizeTopY.current-e.clientY; const newH=Math.max(200,Math.min(window.innerHeight*0.92,resizeTopH.current+dy)); setHeight(newH); setPos(p=>({...p,y:Math.max(0,resizeTopPY.current-(newH-resizeTopH.current))})); }
      if (resizingDiv.current) { const dy=e.clientY-divStartY.current; const pct=(dy/(height-56))*100; if(resizingDiv.current==='qa-coach') setQaH(prev=>Math.max(10,Math.min(78,divStartH.current+pct))); else setCoachH(prev=>Math.max(10,Math.min(78,divStartH.current+pct))); }
    };
    const onUp = () => { draggingPanel.current=false; resizingTop.current=false; resizingDiv.current=null; };
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
    return () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
  }, [width, height]);

  return (
    <div style={{ position:'fixed', left:pos.x, top:pos.y, width, height, background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.4)', borderRadius:'8px', boxShadow:'0 12px 60px rgba(0,0,0,0.9)', zIndex:20000, display:'flex', flexDirection:'column', fontFamily:'Georgia, serif', overflow:'hidden' }}>
      <style>{`@keyframes aipulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>

      {/* Top resize handle */}
      <div onMouseDown={e=>{resizingTop.current=true;resizeTopY.current=e.clientY;resizeTopH.current=height;resizeTopPY.current=pos.y;e.preventDefault();}} style={{height:5,background:'rgba(255,255,255,0.03)',cursor:'n-resize',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(184,147,58,0.2)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
        <div style={{width:48,height:3,borderRadius:2,background:'rgba(255,255,255,0.12)'}} />
      </div>

      {/* Title bar */}
      <div onMouseDown={e=>{if(e.target.closest('button,select,input'))return;draggingPanel.current=true;dragStart.current={mx:e.clientX,my:e.clientY,px:pos.x,py:pos.y};e.preventDefault();}} style={{padding:'6px 14px',background:'rgba(0,0,0,0.35)',borderBottom:'1px solid rgba(184,147,58,0.2)',display:'flex',alignItems:'center',gap:'10px',flexShrink:0,cursor:'grab',userSelect:'none'}}>
        <span style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',flexShrink:0}}>🧠 AI Assistant</span>

        {kbNames&&kbNames.length>0&&(
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <span style={{color:'#4a5568',fontSize:'9px',textTransform:'uppercase',letterSpacing:'1px'}}>📚</span>
            <select value={selectedKbName||''} onChange={e=>onKbChange?.(e.target.value)} style={{background:'rgba(184,147,58,0.1)',border:'1px solid rgba(184,147,58,0.35)',borderRadius:'4px',padding:'2px 8px',color:'#b8933a',fontSize:'10px',outline:'none',cursor:'pointer',maxWidth:'200px'}}>
              <option value="">Default KB ({(allKbEntries||kbEntries).filter(e=>!e.kbName||e.kbName==='').length})</option>
              {(kbNames||[]).map(n=><option key={n} value={n}>{n} ({(allKbEntries||[]).filter(e=>e.kbName===n).length})</option>)}
            </select>
          </div>
        )}

        <div style={{flex:1}} />

        <button onClick={()=>setQaOnly(p=>!p)} style={{background:qaOnly?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.05)',color:qaOnly?'#f59e0b':'#6b7280',border:`1px solid ${qaOnly?'rgba(245,158,11,0.4)':'rgba(255,255,255,0.1)'}`,borderRadius:'4px',padding:'3px 10px',cursor:'pointer',fontSize:'10px',fontWeight:'bold'}}>
          {qaOnly?'❓ Q&A Only ✓':'❓ Q&A Only'}
        </button>

        <span style={{color:'#4a5568',fontSize:'9px'}}>⠿ drag · resize top</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',fontSize:'18px',lineHeight:1,padding:'0 2px',flexShrink:0}}>×</button>
      </div>

      {/* Content */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {qaOnly&&(
          <>
            <SectionHeader label="❓ Q&A" color="#f59e0b" active={qaActive} onToggle={onToggleQA} collapsed={false} onCollapse={()=>{}} />
            <QASection transcript={transcript} transcriptRef={transcriptRef} kbEntries={kbEntries} active={qaActive} qaKeywords={portalCfg?.intentTriggerKeywords} manualQ={manualQ} setManualQ={setManualQ} collapsed={false} qaOnly={true} />
          </>
        )}

        {!qaOnly&&(
          <>
            <div style={{display:'flex',flexDirection:'column',overflow:'hidden',flex:qaCollapsed?'0 0 auto':qaH,minHeight:qaCollapsed?0:80}}>
              <SectionHeader label="❓ Q&A" color="#f59e0b" active={qaActive} onToggle={onToggleQA} collapsed={qaCollapsed} onCollapse={()=>setQaCollapsed(p=>!p)} />
              <QASection transcript={transcript} transcriptRef={transcriptRef} kbEntries={kbEntries} active={qaActive} qaKeywords={portalCfg?.intentTriggerKeywords} manualQ={manualQ} setManualQ={setManualQ} collapsed={qaCollapsed} qaOnly={false} />
            </div>

            {!qaCollapsed&&!coachCollapsed&&<DragHandle onDragStart={e=>{resizingDiv.current='qa-coach';divStartY.current=e.clientY;divStartH.current=qaH;e.preventDefault();}} />}

            <div style={{display:'flex',flexDirection:'column',overflow:'hidden',flex:coachCollapsed?'0 0 auto':coachH,minHeight:coachCollapsed?0:60}}>
              <SectionHeader label="🎯 Coach" color="#a78bfa" active={coachActive} onToggle={onToggleCoach} collapsed={coachCollapsed} onCollapse={()=>setCoachCollapsed(p=>!p)} />
              <CoachSection transcript={transcript} kbEntries={kbEntries} coachRules={{focusAreas:portalCfg?.coachFocusAreas,style:portalCfg?.coachStyle,additionalContext:portalCfg?.coachAdditionalContext}} active={coachActive} collapsed={coachCollapsed} />
            </div>

            {!coachCollapsed&&!intentCollapsed&&<DragHandle onDragStart={e=>{resizingDiv.current='coach-intent';divStartY.current=e.clientY;divStartH.current=coachH;e.preventDefault();}} />}

            <div style={{display:'flex',flexDirection:'column',overflow:'hidden',flex:intentCollapsed?'0 0 auto':Math.max(10,100-qaH-coachH),minHeight:intentCollapsed?0:60}}>
              <SectionHeader label="🦆 Intent" color="#60a5fa" active={intentActive} onToggle={onToggleIntent} collapsed={intentCollapsed} onCollapse={()=>setIntentCollapsed(p=>!p)} />
              <IntentSection transcript={transcript} active={intentActive} collapsed={intentCollapsed} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}