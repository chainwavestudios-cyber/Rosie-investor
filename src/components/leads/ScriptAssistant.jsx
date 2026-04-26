import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const applyTokens = (text, lead, user) => {
  if (!text) return '';
  const first = lead?.firstName || user?.name?.split(' ')[0] || '';
  const last  = lead?.lastName  || user?.name?.split(' ').slice(1).join(' ') || '';
  return text
    .replace(/\{\{\s*first\s*name\s*\}\}/gi, first)
    .replace(/\{\{\s*last\s*name\s*\}\}/gi, last)
    .replace(/\{\{\s*firstname\s*\}\}/gi, first)
    .replace(/\{\{\s*lastname\s*\}\}/gi, last);
};

const QUESTION_PATTERN = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain)\b.{5,80}\?/gi;

const TRIGGER_PATTERNS = [
  /minimum investment/i, /how much/i, /what.s the minimum/i,
  /return/i, /roi/i, /yield/i, /is it safe/i, /risk/i,
  /guaranteed/i, /how long/i, /lock.?up/i, /liquidity/i,
  /accredited/i, /fees/i, /cost/i, /regulation/i, /sec/i,
];

export default function ScriptAssistant({ lead, user }) {
  // Layout
  const [layout, setLayout]       = useState('side'); // 'side' | 'top' | 'fullscript' | 'fullai'
  const [scriptWidth, setScriptWidth] = useState(55); // percent
  const isDraggingDivider         = useRef(false);
  const containerRef              = useRef(null);

  // Script
  const [scripts, setScripts]     = useState([]);
  const [activeId, setActiveId]   = useState(null);
  const [loadingScripts, setLoadingScripts] = useState(true);

  // AI / STT
  const [listening, setListening]   = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [detectedQs, setDetectedQs] = useState([]);
  const [activeQ, setActiveQ]       = useState(null);
  const [aiAnswer, setAiAnswer]     = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const [manualQ, setManualQ]       = useState('');
  const [kbEntries, setKbEntries]   = useState([]);
  const [micDevices, setMicDevices] = useState([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [coachMode, setCoachMode]   = useState(false);
  const [coachTip, setCoachTip]     = useState('');
  const [sentiment, setSentiment]   = useState(null);
  const [summary, setSummary]       = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');
  const [aiTab, setAiTab]           = useState('ai'); // 'ai' | 'transcript' | 'kb'
  const [error, setError]           = useState('');

  const wsRef         = useRef(null);
  const streamRef     = useRef(null);
  const processorRef  = useRef(null);
  const contextRef    = useRef(null);
  const transcriptRef = useRef([]);
  const lastTrigger   = useRef(0);
  const lastCoach     = useRef(0);

  useEffect(() => {
    // Load scripts
    base44.entities.GlobalScript.list('sortOrder', 200)
      .then(r => { setScripts(r || []); if (r?.length) setActiveId(r[0].id); })
      .catch(() => {}).finally(() => setLoadingScripts(false));
    // Load KB
    base44.entities.KnowledgeBase.list('-created_date', 200)
      .then(r => setKbEntries(r || [])).catch(() => {});
    // Mics
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const mics = devs.filter(d => d.kind === 'audioinput');
      setMicDevices(mics);
      const bh = mics.find(m => /blackhole/i.test(m.label));
      const internal = mics.find(m => /built.in|internal|macbook/i.test(m.label));
      setSelectedMic((bh || internal || mics[0])?.deviceId || '');
    });
    return () => stopListening();
  }, []);

  const active = scripts.find(s => s.id === activeId) || scripts[0];
  const rendered = active ? applyTokens(active.content, lead, user) : '';

  // STT
  const startListening = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined } });
      streamRef.current = stream;
      const tokenRes = await base44.functions.invoke('deepgramToken', {});
      const dgKey = tokenRes?.data?.key || '';
      if (!dgKey) throw new Error('No Deepgram token');

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&endpointing=300`,
        ['token', dgKey]
      );
      ws.onopen = () => {
        setListening(true);
        const ctx = new AudioContext({ sampleRate: 16000 });
        contextRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = proc;
        proc.onaudioprocess = e => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
          ws.send(pcm.buffer);
        };
        src.connect(proc); proc.connect(ctx.destination);
      };
      ws.onmessage = e => {
        try {
          const data = JSON.parse(e.data);
          const text = data?.channel?.alternatives?.[0]?.transcript?.trim();
          if (!text || !data.is_final) return;
          const entry = { text, time: new Date() };
          const newT = [...transcriptRef.current, entry];
          transcriptRef.current = newT;
          setTranscript([...newT]);
          detectQuestions(text);
          checkTrigger(text, newT);
          analyzeSentiment(text);
          if (coachMode) checkCoach(newT);
        } catch {}
      };
      ws.onerror = () => setError('Deepgram error — check mic selection');
      ws.onclose = () => setListening(false);
      wsRef.current = ws;
    } catch(e) { setError(`Mic error: ${e.message}`); }
  };

  const stopListening = () => {
    try { wsRef.current?.close(); } catch {}
    try { processorRef.current?.disconnect(); } catch {}
    try { contextRef.current?.close(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    setListening(false);
  };

  const detectQuestions = (text) => {
    const matches = [...(text.matchAll(QUESTION_PATTERN) || [])].map(m => m[0].trim());
    if (matches.length > 0) {
      setDetectedQs(prev => [...prev, ...matches].filter((q,i,a) => a.indexOf(q) === i).slice(-8));
    }
  };

  const checkTrigger = useCallback(async (text, allT) => {
    const now = Date.now();
    if (now - lastTrigger.current < 3000) return;
    if (!TRIGGER_PATTERNS.some(p => p.test(text))) return;
    lastTrigger.current = now;
    await askAI(text, allT);
  }, [kbEntries]);

  const checkCoach = async (allT) => {
    const now = Date.now();
    if (now - lastCoach.current < 15000) return;
    lastCoach.current = now;
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        question: `Analyze this sales conversation and give ONE brief coaching tip (max 2 sentences). Be direct and actionable.\n\nConversation: "${allT.slice(-12).map(t=>t.text).join(' ')}"`,
        transcript: allT, kbEntries, mode: 'coach',
      });
      if (res?.data?.answer) setCoachTip(res.data.answer);
    } catch {}
  };

  const analyzeSentiment = (text) => {
    if (/great|interesting|sounds good|tell me more|exciting|definitely|yes|absolutely|how do i/i.test(text)) setSentiment('positive');
    else if (/not interested|too much|can.t|don.t|expensive|risky|worried|concerned/i.test(text)) setSentiment('negative');
    else setSentiment('neutral');
  };

  const askAI = async (question, allT) => {
    setAiLoading(true); setAiAnswer(''); setActiveQ(question); setAiTab('ai');
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        question, transcript: (allT || transcriptRef.current).slice(-10), kbEntries,
      });
      setAiAnswer(res?.data?.answer || 'No answer found.');
    } catch(e) { setAiAnswer('Error: ' + e.message); }
    setAiLoading(false);
  };

  const summarizeCall = async () => {
    setSummarizing(true); setSummary('');
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        question: `Summarize this sales call in 3-5 bullet points covering: main topics, investor questions/concerns, interest level, recommended next steps.\n\nTranscript: "${transcriptRef.current.map(t=>t.text).join(' ')}"`,
        transcript: transcriptRef.current, kbEntries, mode: 'summary',
      });
      setSummary(res?.data?.answer || '');
    } catch(e) { setSummary('Error: ' + e.message); }
    setSummarizing(false);
  };

  const saveToNotes = async () => {
    const l = lead || user;
    if (!l?.id) { setSaveMsg('No contact selected'); setTimeout(() => setSaveMsg(''), 2000); return; }
    setSavingNotes(true);
    try {
      const content = summary
        ? `📋 Call Summary:\n${summary}\n\n📝 Transcript:\n${transcriptRef.current.map(t=>t.text).join(' ')}`
        : `📝 Call Transcript:\n${transcriptRef.current.map(t=>t.text).join(' ')}`;
      const entity = lead ? base44.entities.LeadHistory : base44.entities.ContactNote;
      await entity.create(lead
        ? { leadId: l.id, type: 'note', content: content.slice(0, 2000) }
        : { investorId: l.id, type: 'note', content: content.slice(0, 2000) }
      );
      setSaveMsg('✓ Saved to notes');
    } catch(e) { setSaveMsg('Error: ' + e.message); }
    setSavingNotes(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  // Divider drag
  const onDividerMouseDown = (e) => {
    isDraggingDivider.current = true;
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingDivider.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (layout === 'side') {
        const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        setScriptWidth(Math.max(25, Math.min(75, pct)));
      } else {
        const pct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
        setScriptWidth(Math.max(20, Math.min(80, pct)));
      }
    };
    const onUp = () => { isDraggingDivider.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [layout]);

  const sentimentColor = { positive:'#4ade80', neutral:'#f59e0b', negative:'#ef4444' };
  const sentimentEmoji = { positive:'😊', neutral:'😐', negative:'😟' };
  const inp = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'6px 10px', color:'#e8e0d0', fontSize:'11px', outline:'none', fontFamily:'Georgia, serif' };

  // ── Script Panel ──────────────────────────────────────────────────────
  const ScriptPanel = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Script tabs */}
      <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.07)', overflowX:'auto', flexShrink:0, scrollbarWidth:'none' }}>
        {scripts.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)}
            style={{ background: activeId===s.id ? 'rgba(184,147,58,0.1)' : 'none', border:'none', borderBottom: activeId===s.id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeId===s.id ? GOLD : '#6b7280', padding:'7px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap', flexShrink:0 }}>
            {s.name}
          </button>
        ))}
      </div>

      {loadingScripts && <div style={{ color:'#6b7280', fontSize:'12px', textAlign:'center', padding:'24px' }}>Loading…</div>}
      {!loadingScripts && scripts.length === 0 && (
        <div style={{ color:'#4a5568', fontSize:'12px', textAlign:'center', padding:'24px' }}>No scripts yet. Create them in the Scripts sidebar tab.</div>
      )}

      {active && (
        <div style={{ flex:1, overflowY:'auto', padding:'14px', background:'rgba(0,0,0,0.15)',
          color: active.color || '#e8e0d0', fontSize:`${active.fontSize || 14}px`,
          lineHeight:1.8, fontFamily:'Georgia, serif', whiteSpace:'pre-wrap' }}>
          {rendered}
        </div>
      )}

      {(lead || user) && (
        <div style={{ padding:'6px 10px', borderTop:'1px solid rgba(255,255,255,0.05)', color:'#4a5568', fontSize:'9px', flexShrink:0 }}>
          Showing for: <span style={{ color:GOLD }}>{lead?.firstName || user?.name?.split(' ')[0]} {lead?.lastName || user?.name?.split(' ').slice(1).join(' ')}</span>
        </div>
      )}
    </div>
  );

  // ── AI Panel ──────────────────────────────────────────────────────────
  const AIPanel = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* AI Header */}
      <div style={{ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:'8px', flexShrink:0, flexWrap:'wrap' }}>
        <div style={{ width:'7px', height:'7px', borderRadius:'50%', background: listening ? '#4ade80' : '#4a5568', boxShadow: listening ? '0 0 6px #4ade80' : 'none', animation: listening ? 'pulse 1.5s infinite' : 'none', flexShrink:0 }} />
        <span style={{ color:GOLD, fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase' }}>🧠 AI Assistant</span>
        {sentiment && <span style={{ color:sentimentColor[sentiment], fontSize:'10px' }}>{sentimentEmoji[sentiment]}</span>}
        <div style={{ marginLeft:'auto', display:'flex', gap:'4px', alignItems:'center' }}>
          {/* Coach toggle */}
          <button onClick={() => setCoachMode(c => !c)} title="Coach mode"
            style={{ background: coachMode ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${coachMode ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.1)'}`, color: coachMode ? '#a78bfa' : '#6b7280', borderRadius:'4px', padding:'3px 7px', cursor:'pointer', fontSize:'10px' }}>🎯</button>
          {/* Mic select */}
          <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
            style={{ ...inp, padding:'3px 6px', fontSize:'9px', cursor:'pointer', maxWidth:'120px' }}>
            {micDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label?.slice(0,20) || `Mic…`}</option>)}
          </select>
          {/* Start/stop */}
          <button onClick={listening ? stopListening : startListening}
            style={{ background: listening ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)', color: listening ? '#ef4444' : '#4ade80', border:`1px solid ${listening ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`, borderRadius:'4px', padding:'3px 8px', cursor:'pointer', fontSize:'10px', whiteSpace:'nowrap' }}>
            {listening ? '⏹' : '🎙'}
          </button>
        </div>
      </div>

      {error && <div style={{ background:'rgba(239,68,68,0.08)', color:'#ef4444', fontSize:'10px', padding:'5px 10px', flexShrink:0 }}>{error}</div>}

      {/* Coach tip */}
      {coachMode && coachTip && (
        <div style={{ padding:'6px 10px', background:'rgba(167,139,250,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
          <div style={{ color:'#a78bfa', fontSize:'8px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>🎯 Coach</div>
          <div style={{ color:'#e8e0d0', fontSize:'10px', lineHeight:1.5 }}>{coachTip}</div>
        </div>
      )}

      {/* Detected questions */}
      {detectedQs.length > 0 && (
        <div style={{ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(245,158,11,0.03)', flexShrink:0 }}>
          <div style={{ color:'#f59e0b', fontSize:'8px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px', display:'flex', justifyContent:'space-between' }}>
            <span>❓ Detected Questions</span>
            <button onClick={() => setDetectedQs([])} style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'9px' }}>Clear</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'3px', maxHeight:'120px', overflowY:'auto' }}>
            {detectedQs.map((q, i) => (
              <button key={i} onClick={() => askAI(q, transcriptRef.current)}
                style={{ background: activeQ===q ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.02)', border:`1px solid ${activeQ===q ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.07)'}`, borderLeft:`3px solid ${activeQ===q ? '#f59e0b' : 'transparent'}`, borderRadius:'3px', padding:'4px 8px', cursor:'pointer', color: activeQ===q ? '#f59e0b' : '#8a9ab8', fontSize:'10px', textAlign:'left', lineHeight:1.4 }}>
                {q.length > 65 ? q.slice(0,65)+'…' : q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        {[['ai','🧠 Answer'],['transcript','📝 Transcript'],['kb','📚 KB']].map(([id,label]) => (
          <button key={id} onClick={() => setAiTab(id)}
            style={{ flex:1, background:'none', border:'none', borderBottom: aiTab===id ? `2px solid ${GOLD}` : '2px solid transparent', color: aiTab===id ? GOLD : '#6b7280', padding:'6px 4px', cursor:'pointer', fontSize:'9px', letterSpacing:'0.5px' }}>
            {label}
          </button>
        ))}
      </div>

      {/* AI Answer */}
      {aiTab === 'ai' && (
        <div style={{ flex:1, overflowY:'auto', padding:'10px', display:'flex', flexDirection:'column', gap:'8px' }}>
          <div style={{ minHeight:'80px', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'10px', flex:1 }}>
            {aiLoading && <div style={{ color:'#6b7280', fontSize:'11px', display:'flex', gap:'6px', alignItems:'center' }}><div style={{ width:'5px', height:'5px', borderRadius:'50%', background:GOLD, animation:'pulse 0.8s infinite' }} />Thinking…</div>}
            {!aiLoading && !aiAnswer && <div style={{ color:'#4a5568', fontSize:'11px', textAlign:'center', paddingTop:'12px' }}>{listening ? 'Listening for questions…' : 'Start listening or ask below'}</div>}
            {!aiLoading && aiAnswer && (
              <div>
                {activeQ && <div style={{ color:'#f59e0b', fontSize:'9px', marginBottom:'5px', fontStyle:'italic' }}>Re: "{activeQ.slice(0,50)}{activeQ.length>50?'…':''}"</div>}
                <div style={{ color:'#e8e0d0', fontSize:'12px', lineHeight:1.6 }}>{aiAnswer}</div>
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:'5px' }}>
            <input value={manualQ} onChange={e => setManualQ(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&manualQ.trim()) { askAI(manualQ,transcriptRef.current); setManualQ(''); } }}
              placeholder="Ask anything…"
              style={{ ...inp, flex:1 }} />
            <button onClick={() => { if(manualQ.trim()) { askAI(manualQ,transcriptRef.current); setManualQ(''); } }} disabled={!manualQ.trim()||aiLoading}
              style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'6px 10px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>Ask</button>
          </div>
          <div style={{ color:'#4a5568', fontSize:'8px' }}>Auto: returns · minimum · risk · fees · liquidity…</div>
        </div>
      )}

      {/* Transcript */}
      {aiTab === 'transcript' && (
        <div style={{ flex:1, overflowY:'auto', padding:'10px', display:'flex', flexDirection:'column' }}>
          <div style={{ flex:1, overflowY:'auto', marginBottom:'8px' }}>
            {transcript.length === 0 && <div style={{ color:'#4a5568', fontSize:'11px', textAlign:'center', padding:'16px' }}>{listening?'Waiting…':'Start listening'}</div>}
            {[...transcript].reverse().map((t,i) => (
              <div key={i} style={{ marginBottom:'5px', fontSize:'11px' }}>
                <span style={{ color:'#4a5568', fontSize:'9px', marginRight:'5px' }}>{t.time.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})}</span>
                <span style={{ color:'#c4cdd8' }}>{t.text}</span>
              </div>
            ))}
          </div>
          {transcript.length > 0 && (
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
              <button onClick={() => { setTranscript([]); transcriptRef.current=[]; setDetectedQs([]); setSentiment(null); setSummary(''); }}
                style={{ ...inp, cursor:'pointer', fontSize:'9px', padding:'3px 8px' }}>Clear</button>
              <button onClick={summarizeCall} disabled={summarizing}
                style={{ background:'rgba(184,147,58,0.12)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'4px', padding:'3px 9px', cursor:'pointer', fontSize:'9px', fontWeight:'bold' }}>
                {summarizing ? '⏳' : '📋 Summarize'}
              </button>
              <button onClick={saveToNotes} disabled={savingNotes}
                style={{ background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.25)', borderRadius:'4px', padding:'3px 9px', cursor:'pointer', fontSize:'9px', fontWeight:'bold' }}>
                {savingNotes ? '⏳' : '💾 Save Notes'}
              </button>
              {saveMsg && <span style={{ color: saveMsg.includes('✓') ? '#4ade80' : '#ef4444', fontSize:'9px' }}>{saveMsg}</span>}
            </div>
          )}
          {summary && (
            <div style={{ marginTop:'6px', background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'4px', padding:'8px', flexShrink:0 }}>
              <div style={{ color:GOLD, fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>📋 Summary</div>
              <div style={{ color:'#c4cdd8', fontSize:'10px', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{summary}</div>
            </div>
          )}
        </div>
      )}

      {/* KB */}
      {aiTab === 'kb' && (
        <div style={{ flex:1, overflowY:'auto', padding:'10px' }}>
          <MiniKBEditor kbEntries={kbEntries} onUpdate={() => base44.entities.KnowledgeBase.list('-created_date',200).then(r=>setKbEntries(r||[])).catch(()=>{})} />
        </div>
      )}
    </div>
  );

  // ── Layout controls ───────────────────────────────────────────────────
  const LayoutBtn = ({ id, label, icon }) => (
    <button onClick={() => setLayout(id)} title={label}
      style={{ background: layout===id ? 'rgba(184,147,58,0.2)' : 'rgba(255,255,255,0.04)', border:`1px solid ${layout===id ? 'rgba(184,147,58,0.4)' : 'rgba(255,255,255,0.08)'}`, color: layout===id ? GOLD : '#6b7280', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', fontSize:'12px' }}>
      {icon}
    </button>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0, flex:1 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Layout toolbar */}
      <div style={{ display:'flex', gap:'4px', alignItems:'center', marginBottom:'8px', flexShrink:0 }}>
        <span style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginRight:'4px' }}>Layout</span>
        <LayoutBtn id="side"       label="Side by side"     icon="⬜⬜" />
        <LayoutBtn id="top"        label="Script top, AI bottom" icon="🔲" />
        <LayoutBtn id="fullscript" label="Script only"      icon="📝" />
        <LayoutBtn id="fullai"     label="AI only"          icon="🧠" />
      </div>

      {/* Main area */}
      <div ref={containerRef} style={{ flex:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection: layout==='top' ? 'column' : 'row', position:'relative' }}>

        {/* Script panel */}
        {layout !== 'fullai' && (
          <div style={{
            ...(layout === 'side' ? { width:`${scriptWidth}%` } : layout === 'top' ? { height:`${scriptWidth}%` } : { flex:1 }),
            overflow:'hidden', flexShrink:0,
          }}>
            <ScriptPanel />
          </div>
        )}

        {/* Draggable divider */}
        {(layout === 'side' || layout === 'top') && (
          <div onMouseDown={onDividerMouseDown}
            style={{ [layout==='side'?'width':'height']:'6px', flexShrink:0, background:'rgba(255,255,255,0.05)', cursor: layout==='side' ? 'col-resize' : 'row-resize', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(184,147,58,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
            <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'2px', [layout==='side'?'width':'height']:'3px', [layout==='side'?'height':'width']:'30px' }} />
          </div>
        )}

        {/* AI panel */}
        {layout !== 'fullscript' && (
          <div style={{ flex:1, overflow:'hidden', minWidth:0, minHeight:0 }}>
            <AIPanel />
          </div>
        )}
      </div>
    </div>
  );
}

// Full KB editor — manual, URL scrape, file upload, drag & drop
function MiniKBEditor({ kbEntries, onUpdate }) {
  const [mode, setMode]       = useState('manual'); // manual | url | file
  const [q, setQ]             = useState('');
  const [a, setA]             = useState('');
  const [url, setUrl]         = useState('');
  const [saving, setSaving]   = useState(false);
  const [scraping, setScraping] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef               = useRef(null);
  const GOLD = '#b8933a';
  const DARK = '#0a0f1e';
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'5px 8px', color:'#e8e0d0', fontSize:'10px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'none' };

  const save = async () => {
    if (!q.trim()||!a.trim()) return;
    setSaving(true);
    try { await base44.entities.KnowledgeBase.create({ question:q.trim(), answer:a.trim(), category:'manual' }); setQ(''); setA(''); onUpdate(); } catch {}
    setSaving(false);
  };

  const scrapeUrl = async () => {
    if (!url.trim()) return;
    setScraping(true);
    try {
      const res = await base44.functions.invoke('kbScrapeUrl', { url: url.trim() });
      const entries = res?.data?.entries || [];
      for (const e of entries) await base44.entities.KnowledgeBase.create({ question:e.question, answer:e.answer, category:'url', source:url.trim() }).catch(()=>{});
      setUrl(''); onUpdate();
    } catch(e) { console.error(e); }
    setScraping(false);
  };

  const processFile = async (file) => {
    if (!file) return;
    setScraping(true);
    try {
      const base64 = await new Promise((res,rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      const result = await base44.functions.invoke('kbExtractFile', { fileName:file.name, fileType:file.type, base64 });
      const entries = result?.data?.entries || [];
      for (const e of entries) await base44.entities.KnowledgeBase.create({ question:e.question, answer:e.answer, category:'document', source:file.name }).catch(()=>{});
      onUpdate();
    } catch(e) { console.error(e); }
    setScraping(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const del = async (id) => { try { await base44.entities.KnowledgeBase.delete(id); onUpdate(); } catch {} };

  const catColor = { manual:'#60a5fa', url:'#4ade80', document:'#f59e0b' };
  const catIcon  = { manual:'✍️', url:'🌐', document:'📄' };

  return (
    <div>
      {/* Mode tabs */}
      <div style={{ display:'flex', gap:'3px', marginBottom:'8px' }}>
        {[['manual','✍️ Manual'],['url','🌐 URL'],['file','📄 File']].map(([id,label]) => (
          <button key={id} onClick={() => setMode(id)}
            style={{ flex:1, background: mode===id ? 'rgba(184,147,58,0.15)' : 'rgba(255,255,255,0.03)', border:`1px solid ${mode===id ? GOLD : 'rgba(255,255,255,0.08)'}`, color: mode===id ? GOLD : '#6b7280', borderRadius:'4px', padding:'4px', cursor:'pointer', fontSize:'9px' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Manual */}
      {mode === 'manual' && (
        <div style={{ marginBottom:'8px', background:'rgba(0,0,0,0.15)', borderRadius:'4px', padding:'8px' }}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Question / trigger…" style={{ ...inp, marginBottom:'4px' }} />
          <textarea value={a} onChange={e=>setA(e.target.value)} placeholder="Answer…" rows={2} style={inp} />
          <button onClick={save} disabled={saving||!q.trim()||!a.trim()}
            style={{ marginTop:'4px', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'3px', padding:'4px 12px', cursor:'pointer', fontSize:'9px', fontWeight:'bold' }}>
            {saving?'Saving…':'+ Add'}
          </button>
        </div>
      )}

      {/* URL */}
      {mode === 'url' && (
        <div style={{ marginBottom:'8px', background:'rgba(0,0,0,0.15)', borderRadius:'4px', padding:'8px' }}>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://your-faq-page.com" style={{ ...inp, marginBottom:'5px' }} />
          <div style={{ color:'#4a5568', fontSize:'9px', marginBottom:'5px' }}>AI scrapes the page and extracts Q&A pairs</div>
          <button onClick={scrapeUrl} disabled={scraping||!url.trim()}
            style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.25)', borderRadius:'3px', padding:'4px 12px', cursor:'pointer', fontSize:'9px', fontWeight:'bold' }}>
            {scraping?'⏳ Scraping…':'🌐 Scrape & Import'}
          </button>
        </div>
      )}

      {/* File drag & drop */}
      {mode === 'file' && (
        <div style={{ marginBottom:'8px' }}>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" onChange={e=>processFile(e.target.files?.[0])} style={{ display:'none' }} />
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            style={{ background: dragOver ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.15)', border:`2px dashed ${dragOver ? '#f59e0b' : 'rgba(255,255,255,0.15)'}`, borderRadius:'6px', padding:'16px', textAlign:'center', cursor:'pointer', transition:'all 0.15s' }}>
            {scraping ? (
              <div style={{ color:'#f59e0b', fontSize:'11px' }}>⏳ Extracting knowledge…</div>
            ) : (
              <>
                <div style={{ fontSize:'24px', marginBottom:'6px' }}>📄</div>
                <div style={{ color:'#8a9ab8', fontSize:'10px' }}>Drag & drop a PDF or doc here</div>
                <div style={{ color:'#4a5568', fontSize:'9px', marginTop:'3px' }}>or click to browse</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Entries */}
      <div style={{ display:'flex', flexDirection:'column', gap:'3px', maxHeight:'200px', overflowY:'auto' }}>
        {kbEntries.map(e => (
          <div key={e.id} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid rgba(255,255,255,0.05)`, borderLeft:`3px solid ${catColor[e.category||'manual']||'#60a5fa'}`, borderRadius:'3px', padding:'5px 8px', display:'flex', gap:'6px', alignItems:'flex-start' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color: catColor[e.category||'manual']||GOLD, fontSize:'9px', fontWeight:'bold', marginBottom:'1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {catIcon[e.category||'manual']} {e.question}
              </div>
              <div style={{ color:'#6b7280', fontSize:'9px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.answer}</div>
            </div>
            <button onClick={() => del(e.id)} style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'12px', flexShrink:0 }}>×</button>
          </div>
        ))}
        {kbEntries.length === 0 && <div style={{ color:'#4a5568', fontSize:'10px', textAlign:'center', padding:'10px' }}>No KB entries yet</div>}
      </div>
    </div>
  );
}