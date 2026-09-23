/**
 * DebtAIPanel.jsx — Reusable AI tools panel for debt settlement coaching.
 * Three tabs: AI (Q&A/Coach/Intent) | Pitches | Signals.
 * Works with both live call transcripts (speaker: 0|1) and BOB transcripts (role: 'bob'|'trainee').
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { DebtPitchPanel } from '@/components/debt/DebtPitchTab';
import DebtIntentSignals, { DEBT_INTENT_RULES } from '@/components/debt/DebtIntentSignals';

const GOLD = '#10b981';

export default function DebtAIPanel({ transcript = [], kbEntries = [], isActive = false, transcriptFormat = 'live' }) {
  const [rightTab, setRightTab] = useState('ai');
  const [qaActive, setQaActive] = useState(true);
  const [coachActive, setCoachActive] = useState(true);
  const [intentActive, setIntentActive] = useState(true);
  const [qaItems, setQaItems] = useState([]);
  const [coachTips, setCoachTips] = useState([]);
  const [intentScore, setIntentScore] = useState(null);

  const lastCoachTime = useRef(0);
  const lastIntentTime = useRef(0);
  const processedCount = useRef(0);

  // Normalize transcript for AI functions (which expect speaker: 0=agent, 1=customer)
  const normalizeTranscript = useCallback((entries) => {
    if (transcriptFormat === 'bob') {
      return entries.map(e => ({ speaker: e.role === 'trainee' ? 0 : 1, text: e.text, time: e.time }));
    }
    return entries;
  }, [transcriptFormat]);

  const handleQa = useCallback((question) => {
    const id = Date.now() + Math.random();
    setQaItems(prev => [...prev, { id, question, answer: '', loading: true }]);
    const normalized = normalizeTranscript(transcript.slice(-8));
    base44.functions.invoke('liveAssistantAI', { question, transcript: normalized, kbEntries, kbName: 'Debt Settlement' })
      .then(res => { const answer = res?.answer || res?.data?.answer || 'Check knowledge base.'; setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer, loading: false } : x)); })
      .catch(() => setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer: 'Unable to answer.', loading: false } : x)));
  }, [transcript, kbEntries, normalizeTranscript]);

  const handleCoach = useCallback(() => {
    const normalized = normalizeTranscript(transcript.slice(-6));
    base44.functions.invoke('liveAssistantAI', { transcript: normalized, kbEntries, mode: 'coach' })
      .then(res => { const tip = res?.tip || res?.response || res?.answer || ''; if (tip) setCoachTips(prev => [{ tip, time: new Date() }, ...prev].slice(0, 8)); })
      .catch(() => {});
  }, [transcript, kbEntries, normalizeTranscript]);

  const handleIntent = useCallback(() => {
    const normalized = normalizeTranscript(transcript.slice(-12));
    base44.functions.invoke('liveAssistantAI', { transcript: normalized, kbEntries, mode: 'intent', intentRules: DEBT_INTENT_RULES })
      .then(res => { const score = res?.intent?.intentScore ?? res?.intentScore ?? res?.data?.intentScore; if (score !== undefined) setIntentScore(score); })
      .catch(() => {});
  }, [transcript, kbEntries, normalizeTranscript]);

  // Watch for new transcript entries and trigger AI tools
  useEffect(() => {
    if (!isActive || transcript.length === 0) return;
    if (transcript.length <= processedCount.current) return;

    const newEntries = transcript.slice(processedCount.current);
    processedCount.current = transcript.length;

    newEntries.forEach(entry => {
      const text = entry.text || '';
      const isAgent = transcriptFormat === 'bob' ? entry.role === 'trainee' : entry.speaker === 0;
      const now = Date.now();

      // Q&A: detect questions from the trainee/agent
      if (qaActive && isAgent) {
        const qPat = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain|show me|prove|how much|what's the)\b.{3,80}[?!]/gi;
        const matches = [...(text.matchAll(qPat) || [])].map(m => m[0].trim());
        matches.forEach(q => handleQa(q));
      }

      // Coach: trigger on objection keywords or every 20s
      const objWords = ['prove', 'doubt', 'skeptical', 'risky', 'guarantee', 'fail', 'burned', 'scam', 'catch', 'cost', 'fee', 'how much', 'too much', "can't afford", 'credit score', 'trust'];
      if (coachActive && (objWords.some(w => text.toLowerCase().includes(w)) || now - lastCoachTime.current > 20000)) {
        lastCoachTime.current = now;
        handleCoach();
      }

      // Intent: every 30s
      if (intentActive && now - lastIntentTime.current > 30000) {
        lastIntentTime.current = now;
        handleIntent();
      }
    });
  }, [transcript, isActive, qaActive, coachActive, intentActive, handleQa, handleCoach, handleIntent, transcriptFormat]);

  // Reset processed counter when transcript is cleared
  useEffect(() => {
    if (transcript.length === 0) { processedCount.current = 0; setQaItems([]); setCoachTips([]); setIntentScore(null); }
  }, [transcript.length]);

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh' }}>
      {/* Tabs */}
      <div style={{ padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '2px' }}>
        {[{ id: 'ai', label: '🤖 AI' }, { id: 'pitches', label: '🎤 Pitches' }, { id: 'signals', label: '🎯 Signals' }].map(t => (
          <button key={t.id} onClick={() => setRightTab(t.id)} style={{ padding: '10px 12px', background: 'none', border: 'none', borderBottom: `2px solid ${rightTab === t.id ? GOLD : 'transparent'}`, color: rightTab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: rightTab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{t.label}</button>
        ))}
      </div>

      {rightTab === 'ai' && (
        <>
          {/* Toggle bar */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '6px' }}>
            {[{ key: 'qa', label: 'Q&A', active: qaActive, toggle: () => setQaActive(p => !p), color: '#34d399' }, { key: 'coach', label: 'Coach', active: coachActive, toggle: () => setCoachActive(p => !p), color: '#f59e0b' }, { key: 'intent', label: 'Intent', active: intentActive, toggle: () => setIntentActive(p => !p), color: '#f472b6' }].map(f => (
              <button key={f.key} onClick={f.toggle} style={{ flex: 1, padding: '7px', borderRadius: '4px', border: `1px solid ${f.active ? f.color + '66' : 'rgba(255,255,255,0.1)'}`, background: f.active ? `${f.color}18` : 'transparent', color: f.active ? f.color : '#6b7280', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{f.active ? '● ' : '○ '}{f.label}</button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {intentScore !== null && (
              <div style={{ background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '4px', padding: '10px' }}>
                <div style={{ color: '#f472b6', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>📊 Intent Score</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${intentScore}%`, height: '100%', background: 'linear-gradient(90deg,#ef4444,#f59e0b,#4ade80)', borderRadius: '3px', transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ color: '#f472b6', fontSize: '14px', fontWeight: 'bold' }}>{intentScore}</span>
                </div>
              </div>
            )}
            {coachTips.length > 0 && (
              <div>
                <div style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>💡 Coach Tips</div>
                {coachTips.slice(0, 5).map((t, i) => <div key={i} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '4px', padding: '8px 10px', marginBottom: '5px', fontSize: '11px', color: '#c4cdd8', lineHeight: 1.5 }}>{t.tip}</div>)}
              </div>
            )}
            {qaItems.length > 0 && (
              <div>
                <div style={{ color: '#34d399', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>🔍 Q&A</div>
                {qaItems.slice(-5).map(item => <div key={item.id} style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '4px', padding: '8px 10px', marginBottom: '5px' }}><div style={{ color: '#34d399', fontSize: '10px' }}>Q: {item.question}</div><div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.4 }}>{item.loading ? '⏳…' : `A: ${item.answer}`}</div></div>)}
              </div>
            )}
            {qaItems.length === 0 && coachTips.length === 0 && intentScore === null && <div style={{ color: '#4a5568', fontSize: '12px', textAlign: 'center', padding: '30px 0' }}>{isActive ? 'AI tools listening…' : 'Start a call to activate.'}</div>}
          </div>
        </>
      )}
      {rightTab === 'pitches' && <div style={{ flex: 1, overflowY: 'auto' }}><DebtPitchPanel /></div>}
      {rightTab === 'signals' && <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}><DebtIntentSignals /></div>}
    </div>
  );
}