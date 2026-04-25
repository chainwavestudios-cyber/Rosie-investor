import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const TRIGGER_PATTERNS = [
  /minimum investment/i, /how much/i, /what.s the minimum/i,
  /what.s the return/i, /roi/i, /returns/i, /yield/i,
  /is it safe/i, /risk/i, /guaranteed/i, /secure/i,
  /how long/i, /lock.?up/i, /liquidity/i, /when can i/i,
  /accredited/i, /qualify/i, /who can invest/i,
  /what do you do/i, /tell me about/i, /explain/i,
  /fees/i, /cost/i, /charge/i, /commission/i,
  /regulation/i, /sec/i, /registered/i, /legal/i,
  /portal/i, /access/i, /how do i/i,
];

const QUESTION_PATTERN = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain)\b.{5,80}\?/gi;

export default function LiveAssistant({ isCallActive = false, lead = null, currentLead = null }) {
  const [visible, setVisible]           = useState(true);
  const [minimized, setMinimized]       = useState(false);
  const [position, setPosition]         = useState({ x: window.innerWidth - 420, y: 80 });
  const [width, setWidth]               = useState(400);
  const [expanded, setExpanded]         = useState(false); // wide mode
  const [summarizing, setSummarizing]   = useState(false);
  const [summary, setSummary]           = useState('');
  const [savingNotes, setSavingNotes]   = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');
  const [transcript, setTranscript]     = useState([]);
  const [aiAnswer, setAiAnswer]         = useState('');
  const [aiLoading, setAiLoading]       = useState(false);
  const [listening, setListening]       = useState(false);
  const [micDevices, setMicDevices]     = useState([]);
  const [selectedMic, setSelectedMic]   = useState('');
  const [kbEntries, setKbEntries]       = useState([]);
  const [manualQ, setManualQ]           = useState('');
  const [activeTab, setActiveTab]       = useState('assistant');
  const [error, setError]               = useState('');
  const [detectedQs, setDetectedQs]     = useState([]);
  const [coachMode, setCoachMode]       = useState(false);
  const [coachTip, setCoachTip]         = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [research, setResearch]         = useState(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [sentiment, setSentiment]       = useState(null); // 'positive' | 'neutral' | 'negative'
  const [activeQuestion, setActiveQuestion] = useState(null);

  const wsRef          = useRef(null);
  const streamRef      = useRef(null);
  const processorRef   = useRef(null);
  const contextRef     = useRef(null);
  const dragRef        = useRef({ dragging:false, startX:0, startY:0, origX:0, origY:0 });
  const transcriptRef  = useRef([]);
  const lastTriggerRef = useRef(0);
  const lastCoachRef   = useRef(0);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const mics = devs.filter(d => d.kind === 'audioinput');
      setMicDevices(mics);
      const internal = mics.find(m => /built.in|internal|macbook/i.test(m.label)) || mics[1] || mics[0];
      if (internal) setSelectedMic(internal.deviceId);
    });
    loadKB();
  }, []);

  useEffect(() => {
    if (isCallActive && !listening) startListening();
    if (!isCallActive && listening) stopListening();
  }, [isCallActive]);

  const activeLead = currentLead || lead;

  // Auto-research when call connects with a lead
  useEffect(() => {
    if (isCallActive && activeLead && !research && !researchLoading) {
      runResearch();
    }
  }, [isCallActive, activeLead]);

  const loadKB = async () => {
    try {
      const entries = await base44.entities.KnowledgeBase.list('-created_date', 200);
      setKbEntries(entries);
    } catch {}
  };

  const startListening = async () => {
    if (listening) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined },
      });
      streamRef.current = stream;

      let dgKey = '';
      try {
        const tokenRes = await base44.functions.invoke('deepgramToken', {});
        dgKey = tokenRes?.data?.key || '';
        if (!dgKey) throw new Error('No key');
      } catch(e) {
        setError('Could not get Deepgram token: ' + e.message);
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&endpointing=300`,
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
          if (!alt?.transcript) return;
          const text = alt.transcript.trim();
          if (!text) return;
          if (data.is_final) {
            const entry = { text, time: new Date(), final: true };
            const newT = [...transcriptRef.current, entry];
            transcriptRef.current = newT;
            setTranscript([...newT]);
            detectQuestions(text);
            checkTrigger(text, newT);
            if (coachMode) checkCoach(newT);
            analyzeSentiment(text);
          }
        } catch {}
      };

      ws.onerror = () => setError('Deepgram connection error');
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

  // Detect questions in transcript and show as clickable boxes
  const detectQuestions = (text) => {
    const matches = [...(text.matchAll(QUESTION_PATTERN) || [])];
    if (matches.length > 0) {
      const newQs = matches.map(m => m[0].trim());
      setDetectedQs(prev => {
        const all = [...prev, ...newQs].filter((q, i, arr) => arr.indexOf(q) === i).slice(-6);
        return all;
      });
    }
  };

  const checkTrigger = useCallback(async (text, allT) => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 3000) return;
    if (!TRIGGER_PATTERNS.some(p => p.test(text))) return;
    lastTriggerRef.current = now;
    await askAI(text, allT);
  }, [kbEntries]);

  // Coach mode - analyze pitch and give real-time suggestions
  const checkCoach = async (allT) => {
    const now = Date.now();
    if (now - lastCoachRef.current < 15000) return; // coach every 15s max
    lastCoachRef.current = now;
    setCoachLoading(true);
    try {
      const recent = allT.slice(-15).map(t => t.text).join(' ');
      const res = await base44.functions.invoke('liveAssistantAI', {
        question: `Analyze this sales conversation and give ONE brief coaching tip (max 2 sentences). Focus on tone, pacing, next best thing to say, or objection handling. Be direct and actionable.\n\nConversation: "${recent}"`,
        transcript: allT,
        kbEntries,
        mode: 'coach',
      });
      if (res?.data?.answer) setCoachTip(res.data.answer);
    } catch {}
    setCoachLoading(false);
  };

  // Sentiment analysis from transcript
  const analyzeSentiment = (text) => {
    const positive = /great|interesting|sounds good|tell me more|exciting|love|definitely|yes|absolutely|of course|how do i/i.test(text);
    const negative = /no|not interested|too much|can't|don't|expensive|risky|worried|concerned|don't think/i.test(text);
    if (positive) setSentiment('positive');
    else if (negative) setSentiment('negative');
    else setSentiment('neutral');
  };

  const askAI = async (question, allT) => {
    setAiLoading(true);
    setAiAnswer('');
    setActiveTab('assistant');
    setActiveQuestion(question);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        question,
        transcript: (allT || transcriptRef.current).slice(-10),
        kbEntries,
      });
      setAiAnswer(res?.data?.answer || 'No answer found.');
    } catch(e) { setAiAnswer('Error: ' + e.message); }
    setAiLoading(false);
  };

  const runResearch = async () => {
    setResearchLoading(true);
    setResearch(null);
    try {
      const l = currentLead || lead;
      const name = l ? `${l.firstName} ${l.lastName}` : 'Unknown';
      const location = l?.state || l?.address || '';
      const res = await base44.functions.invoke('liveAssistantResearch', {
        name,
        email: l?.email || '',
        phone: l?.phone || '',
        location,
        notes: l?.notes || '',
      });
      setResearch(res?.data || null);
    } catch(e) { setResearch({ error: e.message }); }
    setResearchLoading(false);
  };

  const sentimentColor = { positive:'#4ade80', neutral:'#f59e0b', negative:'#ef4444' };
  const sentimentLabel = { positive:'😊 Positive', neutral:'😐 Neutral', negative:'😟 Negative' };

  const summarizeCall = async () => {
    setSummarizing(true);
    setSummary('');
    try {
      const fullTranscript = transcriptRef.current.map(t => t.text).join(' ');
      const res = await base44.functions.invoke('liveAssistantAI', {
        question: `Summarize this sales call in 3-5 bullet points. Include: main topics discussed, investor's questions/concerns, their level of interest, and recommended next steps.

Transcript: "${fullTranscript}"`,
        transcript: transcriptRef.current,
        kbEntries,
        mode: 'summary',
      });
      setSummary(res?.data?.answer || 'No summary generated.');
    } catch(e) { setSummary('Error: ' + e.message); }
    setSummarizing(false);
  };

  const saveToNotes = async () => {
    const l = currentLead || lead;
    if (!l?.id) { setSaveMsg('No lead selected'); setTimeout(() => setSaveMsg(''), 2000); return; }
    setSavingNotes(true);
    try {
      const noteContent = summary
        ? `📋 Call Summary:\n${summary}\n\n📝 Full Transcript:\n${transcriptRef.current.map(t => t.text).join(' ')}`
        : `📝 Call Transcript:\n${transcriptRef.current.map(t => t.text).join(' ')}`;
      await base44.entities.LeadHistory.create({
        leadId: l.id,
        type: 'note',
        content: noteContent.slice(0, 2000),
      });
      setSaveMsg('Saved to notes ✓');
    } catch(e) { setSaveMsg('Error: ' + e.message); }
    setSavingNotes(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  // Drag
  const onMouseDown = (e) => {
    if (e.target.closest('button,input,textarea,select')) return;
    dragRef.current = { dragging:true, startX:e.clientX, startY:e.clientY, origX:position.x, origY:position.y };
    e.preventDefault();
  };
  useEffect(() => {
    const newW = expanded ? Math.min(820, window.innerWidth - 40) : 400;
    setWidth(newW);
    // Reposition if going off screen
    setPosition(p => ({ x: Math.min(p.x, window.innerWidth - newW - 10), y: p.y }));
  }, [expanded]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.dragging) return;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - width, dragRef.current.origX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.origY + e.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => { dragRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [width]);

  if (!visible) return (
    <button onClick={() => setVisible(true)} style={{ position:'fixed', bottom:'20px', right:'20px', zIndex:99998, background:GOLD, color:DARK, border:'none', borderRadius:'50%', width:'48px', height:'48px', fontSize:'20px', cursor:'pointer', boxShadow:'0 4px 20px rgba(184,147,58,0.5)' }}>🧠</button>
  );

  return (
    <div style={{ position:'fixed', left:`${position.x}px`, top:`${position.y}px`, zIndex:99998, width:`${width}px`, fontFamily:'Georgia, serif', userSelect:'none' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.4)', borderRadius:'10px', boxShadow:'0 8px 40px rgba(0,0,0,0.7)', overflow:'hidden' }}>

        {/* Header */}
        <div onMouseDown={onMouseDown} style={{ padding:'10px 14px', background:'rgba(184,147,58,0.1)', borderBottom:'1px solid rgba(184,147,58,0.2)', cursor:'grab', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: listening ? '#4ade80' : '#4a5568', boxShadow: listening ? '0 0 8px #4ade80' : 'none', animation: listening ? 'pulse 1.5s infinite' : 'none' }} />
            <span style={{ color:GOLD, fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>🧠 Live Assistant</span>
            {isCallActive && <span style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', fontSize:'9px', padding:'1px 6px', borderRadius:'3px', border:'1px solid rgba(74,222,128,0.3)' }}>LIVE</span>}
            {sentiment && <span style={{ background:`${sentimentColor[sentiment]}18`, color:sentimentColor[sentiment], fontSize:'9px', padding:'1px 6px', borderRadius:'3px', border:`1px solid ${sentimentColor[sentiment]}44` }}>{sentimentLabel[sentiment]}</span>}
          </div>
          <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
            {/* Research button */}
            <button onClick={() => { setShowResearch(r => !r); if (!research && !researchLoading) runResearch(); }}
              title="Research lead"
              style={{ background: showResearch ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${showResearch ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)'}`, color: showResearch ? '#60a5fa' : '#6b7280', borderRadius:'4px', padding:'3px 7px', cursor:'pointer', fontSize:'11px' }}>🔍</button>
            {/* Coach toggle */}
            <button onClick={() => setCoachMode(c => !c)}
              title="Coach mode"
              style={{ background: coachMode ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${coachMode ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.1)'}`, color: coachMode ? '#a78bfa' : '#6b7280', borderRadius:'4px', padding:'3px 7px', cursor:'pointer', fontSize:'11px' }}>🎯</button>
            <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'}
              style={{ background: expanded ? 'rgba(184,147,58,0.15)' : 'none', border: expanded ? `1px solid rgba(184,147,58,0.3)` : 'none', color: expanded ? GOLD : '#6b7280', cursor:'pointer', fontSize:'12px', padding:'2px 6px', borderRadius:'3px' }}>
              {expanded ? '⊡' : '⊞'}
            </button>
            <button onClick={() => setMinimized(m => !m)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'14px', padding:'0 3px' }}>{minimized ? '▲' : '▼'}</button>
            <button onClick={() => setVisible(false)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'16px', padding:'0 3px' }}>×</button>
          </div>
        </div>

        {!minimized && (
          <>
            {/* Mic + controls */}
            <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:'6px', alignItems:'center' }}>
              <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
                style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 8px', color:'#e8e0d0', fontSize:'10px', outline:'none', cursor:'pointer' }}>
                {micDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,6)}`}</option>)}
              </select>
              <button onClick={listening ? stopListening : startListening}
                style={{ background: listening ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)', color: listening ? '#ef4444' : '#4ade80', border:`1px solid ${listening ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`, borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px', whiteSpace:'nowrap' }}>
                {listening ? '⏹ Stop' : '🎙 Start'}
              </button>
            </div>

            {error && <div style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', fontSize:'10px', padding:'6px 12px' }}>{error}</div>}

            {/* Research panel */}
            {showResearch && (
              <div style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(96,165,250,0.05)', animation:'fadeIn 0.2s ease' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <span style={{ color:'#60a5fa', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase' }}>🔍 Lead Research</span>
                  <button onClick={runResearch} disabled={researchLoading}
                    style={{ background:'rgba(96,165,250,0.1)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'3px', padding:'2px 8px', cursor:'pointer', fontSize:'9px' }}>
                    {researchLoading ? '⏳' : '↻ Refresh'}
                  </button>
                </div>
                {researchLoading && <div style={{ color:'#4a5568', fontSize:'11px', textAlign:'center', padding:'10px' }}>Researching…</div>}
                {research?.error && <div style={{ color:'#ef4444', fontSize:'10px' }}>{research.error}</div>}
                {research && !research.error && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'200px', overflowY:'auto' }}>
                    {research.summary && <div style={{ color:'#e8e0d0', fontSize:'11px', lineHeight:1.5, background:'rgba(0,0,0,0.15)', borderRadius:'4px', padding:'7px 9px' }}>{research.summary}</div>}
                    {research.businessOwner && <div style={{ color:'#f59e0b', fontSize:'10px' }}>💼 {research.businessOwner}</div>}
                    {research.nearbyBusinesses?.length > 0 && (
                      <div>
                        <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'3px' }}>Nearby</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'3px' }}>
                          {research.nearbyBusinesses.map((b, i) => (
                            <span key={i} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'3px', padding:'1px 6px', fontSize:'9px', color:'#8a9ab8' }}>{b}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {research.universities?.length > 0 && (
                      <div style={{ color:'#a78bfa', fontSize:'10px' }}>🎓 {research.universities.join(', ')}</div>
                    )}
                    {research.talkingPoints?.length > 0 && (
                      <div>
                        <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'3px' }}>💬 Talking Points</div>
                        {research.talkingPoints.map((tp, i) => (
                          <div key={i} style={{ color:'#4ade80', fontSize:'10px', padding:'2px 0' }}>• {tp}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Coach tip */}
            {coachMode && (coachTip || coachLoading) && (
              <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(167,139,250,0.06)', animation:'fadeIn 0.2s ease' }}>
                <div style={{ color:'#a78bfa', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'4px' }}>🎯 Coach</div>
                {coachLoading ? <div style={{ color:'#4a5568', fontSize:'11px' }}>Analyzing…</div> : <div style={{ color:'#e8e0d0', fontSize:'11px', lineHeight:1.5 }}>{coachTip}</div>}
              </div>
            )}

            {/* Main content area — side-by-side when expanded */}
            <div style={{ display: expanded ? 'flex' : 'block' }}>

              {/* Questions panel — side panel when expanded, inline when collapsed */}
              {detectedQs.length > 0 && (
                <div style={{
                  ...(expanded ? {
                    width:'220px', flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.06)',
                    background:'rgba(245,158,11,0.03)', display:'flex', flexDirection:'column',
                  } : {
                    borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(245,158,11,0.03)'
                  }),
                  padding:'10px',
                }}>
                  <div style={{ color:'#f59e0b', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'6px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>❓ Questions ({detectedQs.length})</span>
                    <button onClick={() => setDetectedQs([])} style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'10px' }}>Clear</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px', overflowY:'auto', maxHeight: expanded ? '400px' : '120px' }}>
                    {detectedQs.map((q, i) => (
                      <button key={i} onClick={() => askAI(q, transcriptRef.current)}
                        style={{
                          background: activeQuestion === q ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.03)',
                          border:`1px solid ${activeQuestion === q ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}`,
                          borderLeft: activeQuestion === q ? '3px solid #f59e0b' : '3px solid transparent',
                          borderRadius:'4px', padding:'6px 8px', cursor:'pointer',
                          color: activeQuestion === q ? '#f59e0b' : '#8a9ab8',
                          fontSize:'10px', textAlign:'left', lineHeight:1.4, transition:'all 0.15s',
                        }}
                        onMouseEnter={e => { if(activeQuestion !== q) { e.currentTarget.style.borderColor='rgba(245,158,11,0.3)'; e.currentTarget.style.color='#e8e0d0'; } }}
                        onMouseLeave={e => { if(activeQuestion !== q) { e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.color='#8a9ab8'; } }}>
                        {q.length > (expanded ? 80 : 60) ? q.slice(0, expanded ? 80 : 60) + '…' : q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Right side — tabs + content */}
              <div style={{ flex:1, minWidth:0 }}>
                {/* Tabs */}
                <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {[['assistant','🧠 AI'],['transcript','📝 Transcript'],['kb','📚 KB']].map(([id,label]) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                      style={{ flex:1, background:'none', border:'none', borderBottom: activeTab===id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeTab===id ? GOLD : '#6b7280', padding:'7px 4px', cursor:'pointer', fontSize:'10px', letterSpacing:'0.5px' }}>
                      {label}
                    </button>
                  ))}
                </div>

            {/* Assistant tab */}
            {activeTab === 'assistant' && (
              <div style={{ padding:'12px' }}>
                <div style={{ minHeight:'80px', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'10px 12px', marginBottom:'10px' }}>
                  {aiLoading && <div style={{ display:'flex', alignItems:'center', gap:'8px', color:'#6b7280', fontSize:'12px' }}><div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, animation:'pulse 0.8s infinite' }} />Thinking…</div>}
                  {!aiLoading && !aiAnswer && <div style={{ color:'#4a5568', fontSize:'11px', textAlign:'center', paddingTop:'16px' }}>{listening ? '🎙 Listening for triggers or questions…' : 'Start listening or ask manually'}</div>}
                  {!aiLoading && aiAnswer && (
                    <div style={{ animation:'fadeIn 0.2s ease' }}>
                      {activeQuestion && <div style={{ color:'#f59e0b', fontSize:'9px', marginBottom:'5px', fontStyle:'italic' }}>Re: "{activeQuestion.slice(0, 50)}…"</div>}
                      <div style={{ color:'#e8e0d0', fontSize:'12px', lineHeight:1.6 }}>{aiAnswer}</div>
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <input value={manualQ} onChange={e => setManualQ(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter' && manualQ.trim()) { askAI(manualQ, transcriptRef.current); setManualQ(''); } }}
                    placeholder="Ask anything…"
                    style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'6px 10px', color:'#e8e0d0', fontSize:'11px', outline:'none', fontFamily:'Georgia, serif' }} />
                  <button onClick={() => { if(manualQ.trim()) { askAI(manualQ, transcriptRef.current); setManualQ(''); } }} disabled={!manualQ.trim() || aiLoading}
                    style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>Ask</button>
                </div>
                <div style={{ marginTop:'6px', color:'#4a5568', fontSize:'9px' }}>Auto-triggers: returns · minimum · risk · fees · accredited · liquidity…</div>
              </div>
            )}

            {/* Transcript tab */}
            {activeTab === 'transcript' && (
              <div style={{ padding:'8px 12px', maxHeight:'240px', overflowY:'auto' }}>
                {transcript.length === 0 && <div style={{ color:'#4a5568', fontSize:'11px', textAlign:'center', padding:'20px' }}>{listening ? 'Waiting for speech…' : 'Start listening'}</div>}
                {[...transcript].reverse().map((t, i) => (
                  <div key={i} style={{ marginBottom:'6px', fontSize:'11px', animation:'fadeIn 0.2s ease' }}>
                    <span style={{ color:'#4a5568', fontSize:'9px', marginRight:'6px' }}>{t.time.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})}</span>
                    <span style={{ color:'#c4cdd8' }}>{t.text}</span>
                  </div>
                ))}
                {transcript.length > 0 && (
                  <div style={{ marginTop:'8px', display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center' }}>
                    <button onClick={() => { setTranscript([]); transcriptRef.current = []; setDetectedQs([]); setSentiment(null); setSummary(''); }}
                      style={{ background:'transparent', color:'#4a5568', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'3px', padding:'3px 8px', cursor:'pointer', fontSize:'9px' }}>
                      Clear
                    </button>
                    <button onClick={summarizeCall} disabled={summarizing}
                      style={{ background:'rgba(184,147,58,0.12)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'3px', padding:'3px 10px', cursor:'pointer', fontSize:'9px', fontWeight:'bold' }}>
                      {summarizing ? '⏳ Summarizing…' : '📋 Summarize Call'}
                    </button>
                    <button onClick={saveToNotes} disabled={savingNotes || transcript.length === 0}
                      style={{ background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.25)', borderRadius:'3px', padding:'3px 10px', cursor:'pointer', fontSize:'9px', fontWeight:'bold' }}>
                      {savingNotes ? '⏳ Saving…' : '💾 Save to Notes'}
                    </button>
                    {saveMsg && <span style={{ color: saveMsg.includes('✓') ? '#4ade80' : '#ef4444', fontSize:'9px' }}>{saveMsg}</span>}
                  </div>
                )}

                {/* Summary box */}
                {summary && (
                  <div style={{ marginTop:'8px', background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'4px', padding:'8px 10px' }}>
                    <div style={{ color:GOLD, fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'5px' }}>📋 Call Summary</div>
                    <div style={{ color:'#c4cdd8', fontSize:'11px', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{summary}</div>
                    <button onClick={saveToNotes} disabled={savingNotes}
                      style={{ marginTop:'6px', background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.25)', borderRadius:'3px', padding:'3px 10px', cursor:'pointer', fontSize:'9px' }}>
                      {savingNotes ? '⏳' : '💾 Save Summary to Notes'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* KB tab */}
            {activeTab === 'kb' && <KBEditor kbEntries={kbEntries} onUpdate={loadKB} />}
              </div>{/* end right side */}
            </div>{/* end main content area */}
          </>
        )}
      </div>
    </div>
  );
}

// ── KB Editor with URL + File support ────────────────────────────────────────
function KBEditor({ kbEntries, onUpdate }) {
  const [q, setQ]           = useState('');
  const [a, setA]           = useState('');
  const [url, setUrl]       = useState('');
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [mode, setMode]     = useState('manual'); // 'manual' | 'url' | 'file'
  const fileRef             = useRef(null);
  const GOLD = '#b8933a';
  const DARK = '#0a0f1e';
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'6px 9px', color:'#e8e0d0', fontSize:'11px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'none' };

  const save = async () => {
    if (!q.trim() || !a.trim()) return;
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
      for (const e of entries) {
        await base44.entities.KnowledgeBase.create({ question: e.question, answer: e.answer, category: 'url', source: url.trim() });
      }
      setUrl('');
      onUpdate();
    } catch(e) { console.error(e); }
    setScraping(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScraping(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const result = await base44.functions.invoke('kbExtractFile', {
        fileName: file.name,
        fileType: file.type,
        base64,
      });
      const entries = result?.data?.entries || [];
      for (const e of entries) {
        await base44.entities.KnowledgeBase.create({ question: e.question, answer: e.answer, category: 'document', source: file.name });
      }
      onUpdate();
    } catch(e) { console.error(e); }
    setScraping(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const del = async (id) => {
    try { await base44.entities.KnowledgeBase.delete(id); onUpdate(); } catch {}
  };

  const grouped = kbEntries.reduce((acc, e) => {
    const cat = e.category || 'manual';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(e);
    return acc;
  }, {});

  const catColors = { manual:'#60a5fa', url:'#4ade80', document:'#f59e0b' };
  const catIcons  = { manual:'✍️', url:'🌐', document:'📄' };

  return (
    <div style={{ padding:'10px 12px', maxHeight:'360px', overflowY:'auto' }}>
      {/* Mode tabs */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'10px' }}>
        {[['manual','✍️ Manual'],['url','🌐 URL'],['file','📄 File']].map(([id,label]) => (
          <button key={id} onClick={() => setMode(id)}
            style={{ flex:1, background: mode===id ? 'rgba(184,147,58,0.15)' : 'rgba(255,255,255,0.03)', border:`1px solid ${mode===id ? GOLD : 'rgba(255,255,255,0.08)'}`, color: mode===id ? GOLD : '#6b7280', borderRadius:'4px', padding:'4px', cursor:'pointer', fontSize:'9px', letterSpacing:'0.5px' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Manual Q&A */}
      {mode === 'manual' && (
        <div style={{ marginBottom:'10px', background:'rgba(0,0,0,0.15)', borderRadius:'4px', padding:'8px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Question / trigger…" style={{ ...inp, marginBottom:'5px' }} />
          <textarea value={a} onChange={e => setA(e.target.value)} placeholder="Answer…" rows={2} style={inp} />
          <button onClick={save} disabled={saving || !q.trim() || !a.trim()}
            style={{ marginTop:'5px', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'3px', padding:'5px 14px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
            {saving ? 'Saving…' : '+ Add'}
          </button>
        </div>
      )}

      {/* URL scraper */}
      {mode === 'url' && (
        <div style={{ marginBottom:'10px', background:'rgba(0,0,0,0.15)', borderRadius:'4px', padding:'8px' }}>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-faq-page.com" style={{ ...inp, marginBottom:'5px' }} />
          <div style={{ color:'#4a5568', fontSize:'9px', marginBottom:'6px' }}>AI will scrape the page and extract Q&A pairs automatically</div>
          <button onClick={scrapeUrl} disabled={scraping || !url.trim()}
            style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'3px', padding:'5px 14px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
            {scraping ? '⏳ Scraping…' : '🌐 Scrape & Import'}
          </button>
        </div>
      )}

      {/* File upload */}
      {mode === 'file' && (
        <div style={{ marginBottom:'10px', background:'rgba(0,0,0,0.15)', borderRadius:'4px', padding:'8px' }}>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleFile} style={{ display:'none' }} />
          <button onClick={() => fileRef.current?.click()} disabled={scraping}
            style={{ width:'100%', background:'rgba(245,158,11,0.1)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.25)', borderRadius:'4px', padding:'10px', cursor:'pointer', fontSize:'10px' }}>
            {scraping ? '⏳ Extracting…' : '📄 Upload PDF or Doc'}
          </button>
          <div style={{ color:'#4a5568', fontSize:'9px', marginTop:'4px', textAlign:'center' }}>AI extracts knowledge from your document</div>
        </div>
      )}

      {/* Entries grouped by category */}
      {Object.entries(grouped).map(([cat, entries]) => (
        <div key={cat} style={{ marginBottom:'8px' }}>
          <div style={{ color: catColors[cat] || '#8a9ab8', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'4px' }}>
            {catIcons[cat] || '📌'} {cat} ({entries.length})
          </div>
          {entries.map(e => (
            <div key={e.id} style={{ marginBottom:'4px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'6px 9px', borderLeft:`3px solid ${catColors[cat] || '#8a9ab8'}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:GOLD, fontSize:'10px', fontWeight:'bold', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Q: {e.question}</div>
                  <div style={{ color:'#8a9ab8', fontSize:'10px', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>A: {e.answer}</div>
                  {e.source && <div style={{ color:'#4a5568', fontSize:'8px', marginTop:'1px' }}>{e.source}</div>}
                </div>
                <button onClick={() => del(e.id)} style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'13px', marginLeft:'6px', flexShrink:0 }}>×</button>
              </div>
            </div>
          ))}
        </div>
      ))}
      {kbEntries.length === 0 && <div style={{ color:'#4a5568', fontSize:'11px', textAlign:'center', padding:'10px' }}>No KB entries yet</div>}
    </div>
  );
}