import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
// API key fetched from backend to avoid exposing it in frontend

// ── Trigger keywords that auto-surface KB answers ─────────────────────────
const TRIGGER_PATTERNS = [
  /minimum investment/i, /how much/i, /what.s the minimum/i,
  /what.s the return/i, /roi/i, /returns/i, /yield/i,
  /is it safe/i, /risk/i, /guaranteed/i, /secure/i,
  /how long/i, /lock.?up/i, /liquidity/i, /when can i/i,
  /accredited/i, /qualify/i, /who can invest/i,
  /what do you do/i, /tell me about/i, /explain/i,
  /fees/i, /cost/i, /charge/i, /commission/i,
  /regulation/i, /sec/i, /registered/i, /legal/i,
  /rosie/i, /the company/i, /your company/i,
  /portal/i, /access/i, /how do i/i,
];

export default function LiveAssistant({ isCallActive = false }) {
  const [visible, setVisible]         = useState(true);
  const [minimized, setMinimized]     = useState(false);
  const [position, setPosition]       = useState({ x: window.innerWidth - 380, y: 80 });
  const [transcript, setTranscript]   = useState([]);
  const [aiAnswer, setAiAnswer]       = useState('');
  const [aiLoading, setAiLoading]     = useState(false);
  const [listening, setListening]     = useState(false);
  const [micDevices, setMicDevices]   = useState([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [kbEntries, setKbEntries]     = useState([]);
  const [manualQ, setManualQ]         = useState('');
  const [activeTab, setActiveTab]     = useState('assistant'); // 'assistant' | 'transcript' | 'kb'
  const [error, setError]             = useState('');

  const wsRef         = useRef(null);
  const streamRef     = useRef(null);
  const processorRef  = useRef(null);
  const contextRef    = useRef(null);
  const dragRef       = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const transcriptRef = useRef([]);
  const lastTriggerRef = useRef(0);

  // Load mic devices and KB on mount
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const mics = devs.filter(d => d.kind === 'audioinput');
      setMicDevices(mics);
      // Default to internal mic (usually index 1, or label contains 'built-in')
      const internal = mics.find(m => /built.in|internal|macbook/i.test(m.label)) || mics[1] || mics[0];
      if (internal) setSelectedMic(internal.deviceId);
    });
    loadKB();
  }, []);

  // Auto-start when call becomes active
  useEffect(() => {
    if (isCallActive && !listening) startListening();
    if (!isCallActive && listening) stopListening();
  }, [isCallActive]);

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
      // Fetch API key from backend
      const tokenRes = await base44.functions.invoke('deepgramToken', {});
      const apiKey = tokenRes?.data?.key || tokenRes?.data?.api_key || '';
      if (!apiKey) { setError('Could not get Deepgram API key. Check backend function.'); return; }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined },
      });
      streamRef.current = stream;

      // Open Deepgram WebSocket
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&endpointing=300`,
        ['token', apiKey]
      );

      ws.onopen = () => {
        setListening(true);
        // Set up audio processor to send PCM to Deepgram
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        contextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
          }
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
          const isFinal = data.is_final;
          if (isFinal) {
            const entry = { text, time: new Date(), final: true };
            const newTranscript = [...transcriptRef.current, entry];
            transcriptRef.current = newTranscript;
            setTranscript([...newTranscript]);
            checkForTrigger(text, newTranscript);
          }
        } catch {}
      };

      ws.onerror = () => setError('Deepgram connection error');
      ws.onclose = () => { setListening(false); };
      wsRef.current = ws;

    } catch (e) {
      setError(`Mic error: ${e.message}`);
    }
  };

  const stopListening = () => {
    try { wsRef.current?.close(); } catch {}
    try { processorRef.current?.disconnect(); } catch {}
    try { contextRef.current?.close(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    setListening(false);
  };

  const checkForTrigger = useCallback(async (text, allTranscript) => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 3000) return; // debounce 3s
    const triggered = TRIGGER_PATTERNS.some(p => p.test(text));
    if (!triggered) return;
    lastTriggerRef.current = now;
    await askAI(text, allTranscript);
  }, [kbEntries]);

  const askAI = async (question, allTranscript) => {
    setAiLoading(true);
    setAiAnswer('');
    setActiveTab('assistant');
    try {
      // Build KB context
      const kbContext = kbEntries.length > 0
        ? kbEntries.map(e => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')
        : 'No knowledge base entries yet.';

      // Last 10 transcript lines for context
      const recentTranscript = (allTranscript || transcriptRef.current)
        .slice(-10).map(t => t.text).join(' ');

      const res = await base44.functions.invoke('liveAssistantAI', {
        question,
        transcript: allTranscript || transcriptRef.current,
        kbEntries,
      });
      const answer = res?.data?.answer || res?.data?.error || 'No answer found.';
      setAiAnswer(answer);
    } catch (e) {
      setAiAnswer('Error getting answer: ' + e.message);
    }
    setAiLoading(false);
  };

  const handleManualAsk = () => {
    if (!manualQ.trim()) return;
    askAI(manualQ, transcriptRef.current);
    setManualQ('');
  };

  // Drag logic
  const onMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) return;
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y };
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.dragging) return;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 360, dragRef.current.origX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.origY + e.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => { dragRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  if (!visible) return (
    <button onClick={() => setVisible(true)} style={{ position:'fixed', bottom:'20px', right:'20px', zIndex:99998, background:GOLD, color:DARK, border:'none', borderRadius:'50%', width:'48px', height:'48px', fontSize:'20px', cursor:'pointer', boxShadow:'0 4px 20px rgba(184,147,58,0.5)' }}>🧠</button>
  );

  return (
    <div style={{ position:'fixed', left:`${position.x}px`, top:`${position.y}px`, zIndex:99998, width:'360px', fontFamily:'Georgia, serif', userSelect:'none' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.4)', borderRadius:'8px', boxShadow:'0 8px 40px rgba(0,0,0,0.7)', overflow:'hidden' }}>

        {/* Header — drag handle */}
        <div onMouseDown={onMouseDown} style={{ padding:'10px 14px', background:'rgba(184,147,58,0.1)', borderBottom:'1px solid rgba(184,147,58,0.2)', cursor:'grab', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: listening ? '#4ade80' : '#4a5568', boxShadow: listening ? '0 0 8px #4ade80' : 'none', animation: listening ? 'pulse 1.5s infinite' : 'none' }} />
            <span style={{ color:GOLD, fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>🧠 Live Assistant</span>
            {isCallActive && <span style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', fontSize:'9px', padding:'1px 6px', borderRadius:'3px', border:'1px solid rgba(74,222,128,0.3)' }}>LIVE</span>}
          </div>
          <div style={{ display:'flex', gap:'4px' }}>
            <button onClick={() => setMinimized(m => !m)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'14px', padding:'0 4px' }}>{minimized ? '▲' : '▼'}</button>
            <button onClick={() => setVisible(false)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'16px', padding:'0 4px' }}>×</button>
          </div>
        </div>

        {!minimized && (
          <>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

            {/* Mic selector + start/stop */}
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

            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              {[['assistant','🧠 Assistant'],['transcript','📝 Transcript'],['kb','📚 KB']].map(([id,label]) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  style={{ flex:1, background:'none', border:'none', borderBottom: activeTab===id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeTab===id ? GOLD : '#6b7280', padding:'7px 4px', cursor:'pointer', fontSize:'10px', letterSpacing:'0.5px' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Assistant tab */}
            {activeTab === 'assistant' && (
              <div style={{ padding:'12px' }}>
                {/* AI Answer */}
                <div style={{ minHeight:'80px', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'10px 12px', marginBottom:'10px' }}>
                  {aiLoading && (
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', color:'#6b7280', fontSize:'12px' }}>
                      <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, animation:'pulse 0.8s infinite' }} />
                      Thinking…
                    </div>
                  )}
                  {!aiLoading && !aiAnswer && (
                    <div style={{ color:'#4a5568', fontSize:'11px', textAlign:'center', paddingTop:'16px' }}>
                      {listening ? '🎙 Listening… ask something or trigger keywords will auto-detect' : 'Start listening to activate AI suggestions'}
                    </div>
                  )}
                  {!aiLoading && aiAnswer && (
                    <div style={{ color:'#e8e0d0', fontSize:'12px', lineHeight:1.6 }}>{aiAnswer}</div>
                  )}
                </div>

                {/* Manual question */}
                <div style={{ display:'flex', gap:'6px' }}>
                  <input value={manualQ} onChange={e => setManualQ(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleManualAsk(); }}
                    placeholder="Ask anything…"
                    style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'6px 10px', color:'#e8e0d0', fontSize:'11px', outline:'none', fontFamily:'Georgia, serif' }} />
                  <button onClick={handleManualAsk} disabled={!manualQ.trim() || aiLoading}
                    style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                    Ask
                  </button>
                </div>

                {/* Trigger keywords hint */}
                <div style={{ marginTop:'8px', color:'#4a5568', fontSize:'9px', lineHeight:1.5 }}>
                  Auto-triggers: returns, minimum, risk, fees, accredited, how long, liquidity…
                </div>
              </div>
            )}

            {/* Transcript tab */}
            {activeTab === 'transcript' && (
              <div style={{ padding:'8px 12px', maxHeight:'220px', overflowY:'auto' }}>
                {transcript.length === 0 && (
                  <div style={{ color:'#4a5568', fontSize:'11px', textAlign:'center', padding:'20px' }}>
                    {listening ? 'Waiting for speech…' : 'Start listening to see transcript'}
                  </div>
                )}
                {[...transcript].reverse().map((t, i) => (
                  <div key={i} style={{ marginBottom:'6px', fontSize:'11px' }}>
                    <span style={{ color:'#4a5568', fontSize:'9px', marginRight:'6px' }}>
                      {t.time.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', second:'2-digit' })}
                    </span>
                    <span style={{ color:'#c4cdd8' }}>{t.text}</span>
                  </div>
                ))}
                {transcript.length > 0 && (
                  <button onClick={() => { setTranscript([]); transcriptRef.current = []; }}
                    style={{ marginTop:'8px', background:'transparent', color:'#4a5568', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'3px', padding:'3px 8px', cursor:'pointer', fontSize:'9px' }}>
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* KB tab */}
            {activeTab === 'kb' && (
              <KBEditor kbEntries={kbEntries} onUpdate={loadKB} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KBEditor({ kbEntries, onUpdate }) {
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [saving, setSaving] = useState(false);
  const GOLD = '#b8933a';
  const DARK = '#0a0f1e';
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'6px 9px', color:'#e8e0d0', fontSize:'11px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'none' };

  const save = async () => {
    if (!q.trim() || !a.trim()) return;
    setSaving(true);
    try {
      await base44.entities.KnowledgeBase.create({ question: q.trim(), answer: a.trim() });
      setQ(''); setA('');
      onUpdate();
    } catch {}
    setSaving(false);
  };

  const del = async (id) => {
    try { await base44.entities.KnowledgeBase.delete(id); onUpdate(); } catch {}
  };

  return (
    <div style={{ padding:'10px 12px', maxHeight:'280px', overflowY:'auto' }}>
      {/* Add entry */}
      <div style={{ marginBottom:'10px', background:'rgba(0,0,0,0.15)', borderRadius:'4px', padding:'8px' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Question / trigger phrase…" style={{ ...inp, marginBottom:'5px' }} />
        <textarea value={a} onChange={e => setA(e.target.value)} placeholder="Answer…" rows={2} style={inp} />
        <button onClick={save} disabled={saving || !q.trim() || !a.trim()}
          style={{ marginTop:'5px', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'3px', padding:'5px 14px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
          {saving ? 'Saving…' : '+ Add to KB'}
        </button>
      </div>

      {/* Entries */}
      {kbEntries.length === 0 && <div style={{ color:'#4a5568', fontSize:'11px', textAlign:'center', padding:'10px' }}>No KB entries yet</div>}
      {kbEntries.map(e => (
        <div key={e.id} style={{ marginBottom:'6px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'7px 9px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:GOLD, fontSize:'10px', fontWeight:'bold', marginBottom:'2px' }}>Q: {e.question}</div>
              <div style={{ color:'#8a9ab8', fontSize:'10px', lineHeight:1.4 }}>A: {e.answer}</div>
            </div>
            <button onClick={() => del(e.id)} style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'13px', marginLeft:'6px', flexShrink:0 }}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}