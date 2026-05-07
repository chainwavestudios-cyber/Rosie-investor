/**
 * BobTab.jsx — B.O.B. (Bot-Operated Buyer) Training System
 * 
 * Admin tab that provides a full investor call training simulation:
 * - Mock Lead Contact Card (pre-populated with "Bob" persona data)
 * - BOB AI Chatbot (powered by Deepgram Voice Agent with investor simulator persona)
 * - Training Transcript Log (every session recorded)
 * - BOB Knowledge Base (separate from main KB)
 * - Portal Controls for BOB (persona settings)
 * - AI Tools (ScriptAssistant-style Q&A, Coach, Intent Engine) 
 *   listen to BOB and help the trainee in real time
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { getPortalSettings, loadPortalSettings } from '@/lib/portalSettings';

const GOLD  = '#b8933a';
const DARK  = '#0a0f1e';
const ls    = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inp   = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };
const DG_WS_URL = 'wss://agent.deepgram.com/v1/agent/converse';

// ─── Mock Bob Data ──────────────────────────────────────────────────────────
const BOB_PERSONA = {
  name: 'Robert "Bob" Callahan',
  email: 'bob.callahan@example.com',
  phone: '(555) 847-2291',
  company: 'Callahan Capital Group',
  address: '4820 Westlake Dr, Austin, TX 78746',
  status: 'prospect',
  investmentType: 'Individual',
  notes: 'HNW individual. Former roofing contractor turned real estate investor. Has capital to deploy (~$50k). Skeptical of tech but open to proof. Responds well to data and ROI clarity.',
  engagementScore: 42,
  disposition: 'callback',
  callbackAt: new Date(Date.now() + 86400000 * 2).toISOString(),
};

// ─── BOB AI System Prompt ────────────────────────────────────────────────────
function buildBobSystemPrompt(persona, kbEntries) {
  const kbQA = (kbEntries || [])
    .filter(e => e.category !== 'raw_document')
    .map(e => `Q: ${e.question}\nA: ${e.answer}`)
    .join('\n\n');

  return `You are "Bob Callahan," a high-net-worth investor prospect being pitched on Rosie AI — an AI-powered automation and lead generation platform focused on solar and roofing leads.

PERSONA: ${persona}

BEHAVIORAL INSTRUCTIONS (pick the mode set in your config):
- You simulate a realistic investor persona for sales training purposes.
- You ask hard questions about ROI, risk, structure, and proof.
- You are NOT a helpful assistant — you are a PROSPECT being pitched.
- Respond naturally, concisely, as a real person on a call would.
- Do NOT break character or reveal you are an AI.
- React to the salesperson's statements naturally.
- If they explain the waterfall structure or NWS integration well, soften slightly.
- If they stumble or repeat themselves, push harder.

KNOWLEDGE (what Bob knows about Rosie AI):
${kbQA || 'General knowledge about AI investment platforms and private placements.'}

IMPORTANT: Keep responses short (1-3 sentences max), like a real phone call. Be conversational, not essay-like.`;
}

// ─── Utility ────────────────────────────────────────────────────────────────
function Dot({ status, size = 7 }) {
  const colors = { idle:'#4a5568', connecting:'#f59e0b', connected:'#4ade80', error:'#ef4444' };
  const color = colors[status] || '#4a5568';
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0, background:color,
      boxShadow: status==='connected' ? `0 0 6px ${color}` : 'none' }} />
  );
}

function Tog({ label, value, onToggle, desc, color = GOLD }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ color:'#c4cdd8', fontSize:'13px' }}>{label}</div>
        {desc && <div style={{ color:'#4a5568', fontSize:'11px', marginTop:'2px' }}>{desc}</div>}
      </div>
      <button onClick={onToggle} style={{ width:'44px', height:'24px', borderRadius:'12px', border:'none', cursor:'pointer',
        background: value ? `linear-gradient(135deg,${color},${color}cc)` : 'rgba(255,255,255,0.1)', position:'relative', flexShrink:0 }}>
        <div style={{ position:'absolute', top:'2px', left:value?'22px':'2px', width:'20px', height:'20px', background:'#fff', borderRadius:'50%', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }} />
      </button>
    </div>
  );
}

// ─── Mock Field Display ──────────────────────────────────────────────────────
function MockField({ label, value, mono = false }) {
  return (
    <div style={{ marginBottom:'14px' }}>
      <label style={ls}>{label}</label>
      <div style={{ ...inp, cursor:'default', opacity:0.8, fontFamily: mono ? 'monospace' : 'Georgia, serif', fontSize: mono ? '12px' : '14px' }}>{value || '—'}</div>
    </div>
  );
}

// ─── Training Log Entry ──────────────────────────────────────────────────────
function LogEntry({ entry }) {
  const typeColors = {
    session_start: '#60a5fa', session_end: '#a78bfa', portal_access: '#4ade80',
    transcript: '#e8e0d0', coach_tip: '#f59e0b', qa_answer: '#34d399', intent_update: '#f472b6',
  };
  const color = typeColors[entry.type] || '#6b7280';
  return (
    <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'flex', gap:'12px', alignItems:'flex-start' }}>
      <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:color, marginTop:'5px', flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'3px' }}>
          <span style={{ color, fontSize:'10px', fontWeight:'bold', textTransform:'uppercase', letterSpacing:'1px' }}>{entry.type.replace(/_/g,' ')}</span>
          <span style={{ color:'#4a5568', fontSize:'10px' }}>{new Date(entry.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})}</span>
        </div>
        <div style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{entry.content}</div>
      </div>
    </div>
  );
}

// ─── BOB AI Voice Agent ──────────────────────────────────────────────────────
function BobVoiceAgent({ persona, kbEntries, onTranscriptEntry, onSessionEvent, dgApiKey }) {
  const [phase, setPhase]           = useState('idle');
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [error, setError]           = useState('');
  const sessionIdRef = useRef(`bob-${Date.now()}`);
  const wsRef        = useRef(null);
  const audioCtxRef  = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef    = useRef(null);
  const nextStartTimeRef = useRef(0);
  const isListeningRef   = useRef(false);

  const greeting = `Yeah, look, I've got about ten minutes before my next call. I've been hearing about what you guys are doing. Go ahead, pitch me — but skip the fluff, I want the numbers.`;

  const buildSettings = useCallback(() => {
    const systemPrompt = buildBobSystemPrompt(persona, kbEntries);
    return {
      type: 'Settings',
      audio: {
        input:  { encoding:'linear16', sample_rate:24000 },
        output: { encoding:'linear16', sample_rate:24000, container:'none' },
      },
      agent: {
        listen: { provider:{ type:'deepgram', version:'v1', model:'nova-2', language:'en-US' } },
        think:  [{ provider:{ type:'open_ai', version:'v1', model:'gpt-4o-mini' }, prompt:systemPrompt }],
        speak:  { provider:{ type:'deepgram', version:'v1', model:'aura-zeus-en' } },
        greeting,
      },
    };
  }, [persona, kbEntries]);

  const playChunk = useCallback((arrayBuffer) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const int16   = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    sourceRef.current = src;
    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
    src.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
    src.onended = () => {
      if (ctx.currentTime >= nextStartTimeRef.current - 0.01) setAgentSpeaking(false);
    };
  }, []);

  const connect = useCallback(async () => {
    setError(''); setPhase('connecting');
    isListeningRef.current = false;
    sessionIdRef.current = `bob-${Date.now()}`;

    const apiKey = dgApiKey || '44294c0c2f0ebbcc81b853151056111226b853e9';

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      micStreamRef.current = stream;
    } catch {
      setError('Mic access denied.'); setPhase('error'); return;
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate:24000 });
    audioCtxRef.current = ctx;
    nextStartTimeRef.current = 0;

    const ws = new WebSocket(DG_WS_URL, ['token', apiKey]);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    onSessionEvent({ type:'session_start', content:`BOB Training Session started — Session ID: ${sessionIdRef.current}`, time:new Date().toISOString() });

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        setAgentSpeaking(true);
        playChunk(e.data);
        return;
      }
      try {
        const msg = JSON.parse(e.data);
        switch(msg.type) {
          case 'Welcome':
            ws.send(JSON.stringify(buildSettings()));
            break;
          case 'SettingsApplied': {
            setPhase('active');
            const source    = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            processor.onaudioprocess = (ev) => {
              if (ws.readyState !== WebSocket.OPEN || !isListeningRef.current) return;
              const input = ev.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) {
                const s = Math.max(-1, Math.min(1, input[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              ws.send(int16.buffer);
            };
            source.connect(processor);
            const silence = ctx.createGain(); silence.gain.value = 0;
            processor.connect(silence); silence.connect(ctx.destination);
            break;
          }
          case 'AgentAudioDone':
            isListeningRef.current = true;
            break;
          case 'ConversationText': {
            const entry = { role: msg.role === 'user' ? 'trainee' : 'bob', text: msg.content, time: new Date().toISOString() };
            setTranscript(prev => [...prev, entry]);
            onTranscriptEntry(entry);
            onSessionEvent({
              type: 'transcript',
              content: `[${msg.role === 'user' ? '🎙 TRAINEE' : '🤖 BOB'}] ${msg.content}`,
              time: new Date().toISOString(),
            });
            break;
          }
          case 'UserStartedSpeaking':
            if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
            nextStartTimeRef.current = 0;
            setAgentSpeaking(false);
            break;
        }
      } catch {}
    };

    ws.onclose = (e) => {
      setPhase('idle');
      if (e.code !== 1000) setError(`Disconnected (${e.code})`);
      cleanup(false);
      onSessionEvent({ type:'session_end', content:`BOB session ended — code ${e.code}`, time:new Date().toISOString() });
    };
  }, [buildSettings, playChunk, onSessionEvent, onTranscriptEntry, dgApiKey]);

  const cleanup = useCallback((updatePhase = true) => {
    if (processorRef.current) processorRef.current.disconnect();
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }
    audioCtxRef.current = null; micStreamRef.current = null; wsRef.current = null;
    if (updatePhase) setPhase('idle');
  }, []);

  const disconnect = () => { cleanup(true); isListeningRef.current = false; };

  const phaseColor = { idle:'#4a5568', connecting:'#f59e0b', active:'#4ade80', error:'#ef4444' }[phase] || '#4a5568';
  const phaseLabel = { idle:'Idle', connecting:'Connecting…', active:'🔴 LIVE', error:'Error' }[phase] || phase;

  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'linear-gradient(135deg,rgba(184,147,58,0.3),rgba(184,147,58,0.1))', border:`2px solid ${GOLD}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>🤖</div>
          <div>
            <div style={{ color:'#e8e0d0', fontSize:'14px', fontWeight:'bold' }}>BOB — Training Prospect</div>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'2px' }}>
              <Dot status={phase === 'active' ? 'connected' : phase === 'connecting' ? 'connecting' : phase === 'error' ? 'error' : 'idle'} />
              <span style={{ color:phaseColor, fontSize:'11px' }}>{phaseLabel}</span>
              {agentSpeaking && phase === 'active' && (
                <span style={{ color:GOLD, fontSize:'10px', animation:'pulse 1s infinite' }}>● Speaking…</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {phase === 'idle' || phase === 'error' ? (
            <button onClick={connect} style={{ background:'linear-gradient(135deg,#4ade80,#22c55e)', color:'#0a0f1e', border:'none', borderRadius:'2px', padding:'8px 16px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase' }}>
              📞 Connect to BOB
            </button>
          ) : phase === 'connecting' ? (
            <button disabled style={{ background:'rgba(245,158,11,0.2)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'2px', padding:'8px 16px', cursor:'wait', fontSize:'11px' }}>
              Connecting…
            </button>
          ) : (
            <button onClick={disconnect} style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'2px', padding:'8px 16px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
              ⏹ End Call
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ padding:'8px 18px', background:'rgba(239,68,68,0.08)', color:'#ef4444', fontSize:'12px' }}>⚠ {error}</div>}

      {/* Live transcript */}
      <div style={{ height:'280px', overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:'8px' }}>
        {transcript.length === 0 ? (
          <div style={{ color:'#4a5568', fontSize:'13px', textAlign:'center', padding:'60px 0' }}>
            {phase === 'idle' ? 'Click "Connect to BOB" to start a training call.' : 'Waiting for conversation…'}
          </div>
        ) : transcript.map((msg, i) => {
          const isBob = msg.role === 'bob';
          return (
            <div key={i} style={{ display:'flex', gap:'8px', justifyContent:isBob?'flex-start':'flex-end' }}>
              {isBob && <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'rgba(184,147,58,0.15)', border:`1px solid ${GOLD}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', flexShrink:0 }}>🤖</div>}
              <div style={{ maxWidth:'72%', background:isBob?'rgba(184,147,58,0.08)':'rgba(96,165,250,0.1)', border:`1px solid ${isBob?'rgba(184,147,58,0.2)':'rgba(96,165,250,0.2)'}`, borderRadius:isBob?'12px 12px 12px 2px':'12px 12px 2px 12px', padding:'8px 12px' }}>
                <div style={{ color:'#c4cdd8', fontSize:'12px', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{msg.text}</div>
                <div style={{ color:'#4a5568', fontSize:'9px', marginTop:'3px', textAlign:isBob?'left':'right' }}>
                  {isBob ? 'BOB' : 'You'} · {new Date(msg.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
                </div>
              </div>
              {!isBob && <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'rgba(96,165,250,0.15)', border:'1px solid rgba(96,165,250,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', flexShrink:0 }}>🎙</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Helper Panel (listens to BOB, helps trainee) ─────────────────────────
function BobAIHelper({ transcript, kbEntries, onCoachTip, onSessionEvent }) {
  const [qaActive,     setQaActive]     = useState(false);
  const [coachActive,  setCoachActive]  = useState(false);
  const [intentActive, setIntentActive] = useState(false);
  const [qaItems,      setQaItems]      = useState([]);
  const [coachTips,    setCoachTips]    = useState([]);
  const [intentScore,  setIntentScore]  = useState(null);
  const [intentLabel,  setIntentLabel]  = useState('');
  const lastProcessed  = useRef(0);
  const transcriptRef  = useRef([]);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Process new transcript entries
  useEffect(() => {
    if (!transcript.length) return;
    const newEntries = transcript.slice(lastProcessed.current);
    if (!newEntries.length) return;
    lastProcessed.current = transcript.length;

    newEntries.forEach(entry => {
      if (entry.role !== 'bob') return; // Only analyze what BOB says

      // Q&A: detect questions in BOB's speech
      if (qaActive) {
        const questionPattern = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain|show me|prove|numbers)\b.{3,80}[?!]/gi;
        const matches = [...(entry.text.matchAll(questionPattern) || [])].map(m => m[0].trim());
        matches.forEach(q => {
          const id = Date.now() + Math.random();
          setQaItems(prev => [...prev, { id, question:q, answer:'', loading:true }]);
          base44.functions.invoke('liveAssistantAI', {
            question: q,
            transcript: transcriptRef.current.slice(-8),
            kbEntries,
          }).then(res => {
            const answer = res?.data?.answer || 'Check your knowledge base for this topic.';
            setQaItems(prev => prev.map(x => x.id === id ? {...x, answer, loading:false} : x));
            onSessionEvent({ type:'qa_answer', content:`Q: ${q}\nA: ${answer}`, time:new Date().toISOString() });
          }).catch(() => {
            setQaItems(prev => prev.map(x => x.id === id ? {...x, answer:'Unable to answer.', loading:false} : x));
          });
        });
      }

      // Coach: generate tips based on BOB's objections
      if (coachActive) {
        const objectionWords = ['prove', 'doubt', 'skeptical', 'risky', 'guarantee', 'fail', 'burned', 'bubble', 'realistic', 'convinced', 'numbers', 'catch'];
        const hasObjection = objectionWords.some(w => entry.text.toLowerCase().includes(w));
        if (hasObjection) {
          const id = Date.now() + Math.random();
          base44.functions.invoke('liveAssistantAI', {
            transcript: transcriptRef.current.slice(-6),
            kbEntries,
            mode: 'coach',
          }).then(res => {
            const tip = res?.data?.tip || res?.data?.response || '';
            if (tip) {
              setCoachTips(prev => [{ id, tip, time:new Date() }, ...prev].slice(0,5));
              onCoachTip(tip);
              onSessionEvent({ type:'coach_tip', content:`💡 Coach Tip: ${tip}`, time:new Date().toISOString() });
            }
          }).catch(() => {});
        }
      }

      // Intent Engine
      if (intentActive) {
        const buySignals   = ['minimum', 'portal', 'wire', 'send me', 'sign', 'how do I', 'next steps', 'interested'];
        const negSignals   = ['no', 'not interested', 'pass', 'too risky', 'my lawyer', 'accountant', 'call you back'];
        const hasBuy  = buySignals.some(w => entry.text.toLowerCase().includes(w));
        const hasNeg  = negSignals.some(w => entry.text.toLowerCase().includes(w));
        if (hasBuy) { setIntentScore(prev => Math.min(100, (prev||50) + 15)); setIntentLabel('🐄 Warming Up'); }
        if (hasNeg) { setIntentScore(prev => Math.max(0, (prev||50) - 12)); setIntentLabel('🦆 Resistant'); }
        if (!hasBuy && !hasNeg) { setIntentScore(prev => prev || 50); setIntentLabel('🦉 Neutral'); }
      }
    });
  }, [transcript, qaActive, coachActive, intentActive, kbEntries]);

  const intentColor = intentScore === null ? '#6b7280' : intentScore >= 70 ? '#4ade80' : intentScore >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
      {/* Toggle controls */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'14px 16px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>🧠 AI Tools — Live Help</div>
        <Tog label="Q&A Engine" value={qaActive} onToggle={() => setQaActive(!qaActive)} desc="Detects BOB's questions and surfaces answers from KB" color="#34d399" />
        <Tog label="Coach Mode" value={coachActive} onToggle={() => setCoachActive(!coachActive)} desc="Generates coaching tips when BOB objects" color="#f59e0b" />
        <Tog label="Intent Engine" value={intentActive} onToggle={() => setIntentActive(!intentActive)} desc="Tracks BOB's buying intent in real time" color="#f472b6" />
      </div>

      {/* Intent Score */}
      {intentActive && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'14px 16px' }}>
          <div style={{ color:'#8a9ab8', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>Intent Score</div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ flex:1, height:'8px', background:'rgba(255,255,255,0.06)', borderRadius:'4px', overflow:'hidden' }}>
              <div style={{ width:`${intentScore ?? 50}%`, height:'100%', background:intentColor, borderRadius:'4px', transition:'width 0.5s ease' }} />
            </div>
            <span style={{ color:intentColor, fontSize:'18px', fontWeight:'bold', minWidth:'40px', textAlign:'right' }}>{intentScore ?? '?'}</span>
            <span style={{ color:intentColor, fontSize:'11px' }}>{intentLabel || '—'}</span>
          </div>
        </div>
      )}

      {/* Coach Tips */}
      {coachActive && coachTips.length > 0 && (
        <div style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'4px', padding:'14px 16px' }}>
          <div style={{ color:'#f59e0b', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>💡 Live Coach Tips</div>
          {coachTips.map(tip => (
            <div key={tip.id} style={{ marginBottom:'10px', padding:'10px', background:'rgba(0,0,0,0.2)', borderRadius:'4px', borderLeft:'3px solid #f59e0b' }}>
              <div style={{ color:'#e8e0d0', fontSize:'12px', lineHeight:1.5 }}>{tip.tip}</div>
              <div style={{ color:'#6b7280', fontSize:'10px', marginTop:'4px' }}>{new Date(tip.time).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Q&A Answers */}
      {qaActive && qaItems.length > 0 && (
        <div style={{ background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:'4px', padding:'14px 16px', maxHeight:'240px', overflowY:'auto' }}>
          <div style={{ color:'#34d399', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>❓ Q&A Responses</div>
          {qaItems.slice().reverse().map(item => (
            <div key={item.id} style={{ marginBottom:'10px', padding:'10px', background:'rgba(0,0,0,0.2)', borderRadius:'4px' }}>
              <div style={{ color:'#6b7280', fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>BOB asked:</div>
              <div style={{ color:'#c4cdd8', fontSize:'12px', fontStyle:'italic', marginBottom:'6px' }}>"{item.question}"</div>
              {item.loading ? (
                <div style={{ color:'#4a5568', fontSize:'11px' }}>Searching KB…</div>
              ) : (
                <div style={{ color:'#34d399', fontSize:'12px', lineHeight:1.5 }}>→ {item.answer}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BOB Knowledge Base ───────────────────────────────────────────────────────
function BobKnowledgeBase() {
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState('');
  const [a, setA]               = useState('');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [search, setSearch]     = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.KnowledgeBase.list('-created_date', 500);
      setEntries((all || []).filter(e => e.category === 'bob_training' || (e.tags || '').includes('bob')));
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!q.trim() || !a.trim()) return;
    setSaving(true); setMsg('');
    try {
      await base44.entities.KnowledgeBase.create({ question:q.trim(), answer:a.trim(), category:'bob_training', tags:'bob', source:'manual' });
      setQ(''); setA(''); setMsg('✓ Added to BOB KB'); await load();
    } catch (e) { setMsg('Error: ' + e.message); }
    setSaving(false); setTimeout(() => setMsg(''), 3000);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this BOB KB entry?')) return;
    setDeleting(id);
    try { await base44.entities.KnowledgeBase.delete(id); await load(); } catch {}
    setDeleting(null);
  };

  const filtered = entries.filter(e => !search || (e.question + e.answer).toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ color:'#8a9ab8', fontSize:'12px', marginBottom:'16px' }}>
        BOB-specific knowledge used to train responses. Entries tagged <code style={{ color:GOLD }}>bob</code> are injected into BOB's system prompt.
      </div>

      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'16px', marginBottom:'20px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Add BOB KB Entry</div>
        <div style={{ marginBottom:'10px' }}>
          <label style={ls}>Scenario / Question (what BOB might say or ask)</label>
          <textarea value={q} onChange={e=>setQ(e.target.value)} rows={2} placeholder="e.g. BOB asks: What's the minimum investment?" style={{ ...inp, resize:'vertical', fontSize:'13px' }} />
        </div>
        <div style={{ marginBottom:'12px' }}>
          <label style={ls}>Ideal Trainee Response / Talking Point</label>
          <textarea value={a} onChange={e=>setA(e.target.value)} rows={3} placeholder="The minimum is $15,000. We have a tiered waterfall structure where investors are paid back first before profit splits..." style={{ ...inp, resize:'vertical', fontSize:'13px' }} />
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <button onClick={add} disabled={saving || !q.trim() || !a.trim()} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'8px 18px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase', opacity:(!q.trim()||!a.trim())?0.4:1 }}>
            {saving ? 'Saving…' : '+ Add Entry'}
          </button>
          {msg && <span style={{ color:msg.startsWith('Error')?'#ef4444':'#4ade80', fontSize:'12px' }}>{msg}</span>}
        </div>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search BOB KB…" style={{ ...inp, marginBottom:'14px' }} />

      {loading ? <div style={{ color:'#4a5568', textAlign:'center', padding:'30px' }}>Loading…</div> : filtered.length === 0 ? (
        <div style={{ color:'#4a5568', textAlign:'center', padding:'40px', fontSize:'13px' }}>
          {entries.length === 0 ? 'No BOB KB entries yet. Add some training scenarios above.' : 'No results.'}
        </div>
      ) : filtered.map(entry => (
        <div key={entry.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'14px 16px', marginBottom:'10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
            <div style={{ color:'#c4cdd8', fontSize:'13px', fontWeight:'bold', flex:1, paddingRight:'12px' }}>{entry.question}</div>
            <button onClick={() => del(entry.id)} disabled={deleting===entry.id} style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'2px', padding:'4px 8px', cursor:'pointer', fontSize:'10px', flexShrink:0 }}>
              {deleting===entry.id ? '…' : 'Delete'}
            </button>
          </div>
          <div style={{ color:'#6b7280', fontSize:'12px', lineHeight:1.5 }}>{entry.answer}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Training Transcript Log ──────────────────────────────────────────────────
function TrainingLog({ logs, onClear }) {
  const logEndRef = useRef(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [logs]);

  const sessions = logs.reduce((acc, log) => {
    const sid = log.sessionId || 'main';
    if (!acc[sid]) acc[sid] = [];
    acc[sid].push(log);
    return acc;
  }, {});

  const sessionIds = Object.keys(sessions).reverse();

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div>
          <div style={{ color:'#e8e0d0', fontSize:'16px', fontWeight:'normal', fontFamily:'Georgia,serif' }}>Training Log</div>
          <div style={{ color:'#6b7280', fontSize:'12px', marginTop:'2px' }}>{logs.length} events recorded across {sessionIds.length} session{sessionIds.length!==1?'s':''}</div>
        </div>
        {logs.length > 0 && (
          <button onClick={onClear} style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'2px', padding:'6px 12px', cursor:'pointer', fontSize:'11px' }}>
            Clear Log
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#4a5568', fontSize:'13px' }}>
          <div style={{ fontSize:'32px', marginBottom:'10px' }}>📋</div>
          No training sessions yet. Connect to BOB to start.
        </div>
      ) : sessionIds.map(sid => (
        <div key={sid} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', marginBottom:'16px', overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', background:'rgba(0,0,0,0.2)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:GOLD, fontSize:'11px', letterSpacing:'1px', textTransform:'uppercase' }}>Session {sid}</span>
            <span style={{ color:'#4a5568', fontSize:'11px' }}>{sessions[sid].length} events</span>
          </div>
          <div style={{ maxHeight:'400px', overflowY:'auto' }}>
            {sessions[sid].map((log, i) => <LogEntry key={i} entry={log} />)}
          </div>
        </div>
      ))}
      <div ref={logEndRef} />
    </div>
  );
}

// ─── BOB Portal Controls (persona settings) ──────────────────────────────────
function BobPortalControls({ persona, onPersonaChange, dgApiKey, onDgKeyChange }) {
  const [mode, setMode]     = useState(persona.mode || 'duck');
  const [intensity, setIntensity] = useState(persona.intensity || 3);
  const [customGreet, setCustomGreet] = useState(persona.customGreeting || '');
  const [focus, setFocus]   = useState(persona.focus || 'Solar Lead Gen');
  const [saved, setSaved]   = useState(false);

  const save = () => {
    onPersonaChange({ mode, intensity, customGreeting:customGreet, focus });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const modeDescriptions = {
    duck: '🦆 Duck (Hard) — Skeptical, resistant, stress-tests the trainee. Uses objection phrases and silences.',
    cow:  '🐄 Cow (Easy) — Warm, agreeable, tests if trainee can close without talking past the sale.',
    owl:  '🦉 Owl (Medium) — Logical, balanced. Wants to understand the "why" and technical moat.',
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'20px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>BOB Persona Mode</div>

        <div style={{ marginBottom:'14px' }}>
          <label style={ls}>Mode</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {[['duck','🦆 Duck (Hard)'],['cow','🐄 Cow (Easy)'],['owl','🦉 Owl (Medium)']].map(([v,l]) => (
              <button key={v} onClick={() => setMode(v)} style={{ flex:1, padding:'10px 8px', borderRadius:'2px', border:`1px solid ${mode===v?GOLD+'66':'rgba(255,255,255,0.1)'}`, background:mode===v?`${GOLD}18`:'transparent', color:mode===v?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', fontWeight:mode===v?'bold':'normal', textAlign:'center' }}>
                {l}
              </button>
            ))}
          </div>
          {mode && <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'8px', lineHeight:1.5 }}>{modeDescriptions[mode]}</div>}
        </div>

        <div style={{ marginBottom:'14px' }}>
          <label style={ls}>Intensity (1 = mild, 5 = full character)</label>
          <div style={{ display:'flex', gap:'6px' }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setIntensity(n)} style={{ flex:1, padding:'8px', borderRadius:'2px', border:`1px solid ${intensity===n?GOLD+'66':'rgba(255,255,255,0.1)'}`, background:intensity===n?`${GOLD}18`:'transparent', color:intensity===n?GOLD:'#6b7280', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:'14px' }}>
          <label style={ls}>Focus / Topic</label>
          <select value={focus} onChange={e=>setFocus(e.target.value)} style={{ ...inp }}>
            <option value="Solar Lead Gen">Solar Lead Gen</option>
            <option value="Roofing Leads">Roofing Leads</option>
            <option value="SwiftDial CRM">SwiftDial CRM</option>
            <option value="Investment Structure">Investment Structure (Waterfall / Reg D)</option>
            <option value="NWS DAT Integration">NWS Storm Tracking / DAT</option>
            <option value="General Pitch">General Pitch</option>
          </select>
        </div>

        <div style={{ marginBottom:'14px' }}>
          <label style={ls}>Custom Opening (leave blank for default)</label>
          <textarea value={customGreet} onChange={e=>setCustomGreet(e.target.value)} rows={3}
            placeholder={`Default: "Yeah, I've got about ten minutes. Go ahead, pitch me — skip the fluff, I want the numbers."`}
            style={{ ...inp, resize:'vertical', fontSize:'12px' }} />
        </div>

        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <button onClick={save} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'10px 20px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase' }}>
            Save Persona
          </button>
          {saved && <span style={{ color:'#4ade80', fontSize:'12px' }}>✓ Saved</span>}
        </div>
      </div>

      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'20px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>Deepgram API Key (BOB)</div>
        <div style={{ color:'#6b7280', fontSize:'12px', marginBottom:'10px' }}>
          Use a separate Deepgram key (deepgram2) for BOB training calls to keep usage separate from production.
        </div>
        <div style={{ marginBottom:'0' }}>
          <label style={ls}>Deepgram API Key (overrides default)</label>
          <input value={dgApiKey} onChange={e=>onDgKeyChange(e.target.value)} placeholder="Leave blank to use default key" style={{ ...inp, fontFamily:'monospace', fontSize:'12px' }} type="password" />
        </div>
      </div>
    </div>
  );
}

// ─── Mock Lead Contact Card ───────────────────────────────────────────────────
function MockLeadCard({ onPortalAccessSent, onCallConnected, isCallActive, kbEntries, transcript, onSessionEvent, coachTip, persona, dgApiKey, onTranscriptEntry }) {
  const [cardTab, setCardTab] = useState('overview');
  const [portalSent, setPortalSent] = useState(false);
  const [emailSent, setEmailSent]   = useState(false);
  const [siteSent, setSiteSent]     = useState(false);

  const CARD_TABS = [
    ['overview', '👤 Overview'],
    ['history', '📞 History'],
    ['script', '📝 Script / AI'],
    ['rosie', '🤖 BOB Chat'],
    ['portal', '🔑 Portal'],
  ];

  const handlePortalAccess = () => {
    setPortalSent(true);
    onPortalAccessSent();
    setTimeout(() => setPortalSent(false), 4000);
  };

  const mockNotes = [
    { type:'call', content:'First contact. Bob was interested but wanted more data on the waterfall.', time:'2 days ago', by:'admin' },
    { type:'email', content:'Sent intro email with Rosie AI overview deck.', time:'3 days ago', by:'admin' },
    { type:'note', content:'HNW. Former roofing contractor. Has ~$50k to deploy. Skeptical of tech.', time:'1 week ago', by:'admin' },
  ];

  const noteTypeIcons = { note:'📝', call:'📞', sms:'💬', voicemail:'📳', email:'✉️' };

  return (
    <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', display:'flex', flexDirection:'column', height:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>
      {/* Card Header */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.2)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'12px' }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:`linear-gradient(135deg,${GOLD}44,${GOLD}22)`, border:`2px solid ${GOLD}66`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>R</div>
          <div style={{ flex:1 }}>
            <div style={{ color:'#e8e0d0', fontSize:'16px', fontFamily:'Georgia,serif' }}>{BOB_PERSONA.name}</div>
            <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'2px' }}>{BOB_PERSONA.company} · {BOB_PERSONA.email}</div>
          </div>
          <span style={{ padding:'3px 10px', borderRadius:'2px', background:'rgba(167,139,250,0.12)', color:'#a78bfa', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>
            🔷 Prospect
          </span>
          <span style={{ padding:'3px 10px', borderRadius:'2px', background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontSize:'10px', letterSpacing:'1px' }}>
            🎓 TRAINING
          </span>
        </div>

        {/* Action buttons row */}
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={() => { setSiteSent(true); setTimeout(()=>setSiteSent(false),3000); }}
            style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'5px 8px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
            {siteSent ? '✓ Sent!' : '💼 Site'}
          </button>
          <button onClick={handlePortalAccess}
            style={{ background:'rgba(167,139,250,0.12)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.3)', borderRadius:'2px', padding:'5px 8px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', transition:'all 0.2s', ...(portalSent?{background:'rgba(74,222,128,0.15)',color:'#4ade80',border:'1px solid rgba(74,222,128,0.3)'}:{}) }}>
            {portalSent ? '✓ Portal Sent!' : '🔐 Portal'}
          </button>
          <button onClick={() => { setEmailSent(true); setTimeout(()=>setEmailSent(false),3000); }}
            style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'5px 8px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
            {emailSent ? '✓ Sent!' : '✉️ Email'}
          </button>
          <button onClick={() => { setCardTab('rosie'); onCallConnected(); }}
            style={{ background:isCallActive?'rgba(74,222,128,0.15)':'rgba(74,222,128,0.12)', color:'#4ade80', border:`1px solid rgba(74,222,128,${isCallActive?'0.5':'0.3'})`, borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', boxShadow:isCallActive?'0 0 8px rgba(74,222,128,0.3)':'none' }}>
            {isCallActive ? '🔴 Call Active' : '📞 Connect BOB'}
          </button>
          <div style={{ width:'1px', height:'20px', background:'rgba(255,255,255,0.08)', margin:'0 2px' }} />
          <span style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'2px', padding:'4px 8px', fontSize:'10px' }}>
            📅 Callback {new Date(BOB_PERSONA.callbackAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
          </span>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0, overflowX:'auto' }}>
        {CARD_TABS.map(([id, label]) => (
          <button key={id} onClick={() => setCardTab(id)} style={{ padding:'10px 14px', background:cardTab===id?'rgba(184,147,58,0.08)':'transparent', border:'none', borderBottom:`2px solid ${cardTab===id?GOLD:'transparent'}`, color:cardTab===id?GOLD:'#6b7280', cursor:'pointer', fontSize:'11px', fontWeight:cardTab===id?'bold':'normal', whiteSpace:'nowrap', flexShrink:0 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>

        {/* Overview */}
        {cardTab === 'overview' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
              <MockField label="Full Name" value={BOB_PERSONA.name} />
              <MockField label="Company" value={BOB_PERSONA.company} />
              <MockField label="Email" value={BOB_PERSONA.email} />
              <MockField label="Phone" value={BOB_PERSONA.phone} />
              <MockField label="Address" value={BOB_PERSONA.address} />
              <MockField label="Investment Type" value={BOB_PERSONA.investmentType} />
            </div>
            <div style={{ marginBottom:'14px' }}>
              <label style={ls}>Notes</label>
              <div style={{ ...inp, cursor:'default', opacity:0.8, fontSize:'13px', lineHeight:1.6, minHeight:'70px' }}>{BOB_PERSONA.notes}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'14px', textAlign:'center' }}>
                <div style={{ color:GOLD, fontSize:'28px', fontWeight:'bold' }}>42</div>
                <div style={{ color:'#6b7280', fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px', marginTop:'4px' }}>Engagement Score</div>
              </div>
              <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'4px', padding:'14px', textAlign:'center' }}>
                <div style={{ color:'#f59e0b', fontSize:'18px', fontWeight:'bold' }}>🦆 Duck</div>
                <div style={{ color:'#6b7280', fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px', marginTop:'4px' }}>Current Persona</div>
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {cardTab === 'history' && (
          <div>
            {mockNotes.map((note, i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'12px 14px', marginBottom:'10px' }}>
                <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'6px' }}>
                  <span style={{ fontSize:'14px' }}>{noteTypeIcons[note.type] || '📝'}</span>
                  <span style={{ color:GOLD, fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{note.type}</span>
                  <span style={{ color:'#4a5568', fontSize:'10px', marginLeft:'auto' }}>{note.time} · {note.by}</span>
                </div>
                <div style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:1.5 }}>{note.content}</div>
              </div>
            ))}
          </div>
        )}

        {/* Script / AI Helper */}
        {cardTab === 'script' && (
          <div>
            <div style={{ marginBottom:'16px', padding:'12px 14px', background:'rgba(184,147,58,0.08)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'4px', fontSize:'12px', color:'#c4cdd8', lineHeight:1.6 }}>
              <strong style={{ color:GOLD }}>📝 Training Script — Rosie AI Investor Pitch</strong><br/><br/>
              <strong>Opening:</strong> "Hey Bob, thanks for taking my call. I know you're busy — I'll be straight with you. We're Rosie AI, and what we've built is an automated lead generation engine specifically for solar and roofing contractors. We use NWS storm data to pinpoint homes that just got hit — and reach them before the competition does…"<br/><br/>
              <strong>On Returns:</strong> "Our structure is a tiered waterfall — investors are paid back first before any profit splits. 8% preferred return, then capital returned, then upside."<br/><br/>
              <strong>On Risk:</strong> "The minimum is $15,000. The structure protects you — you sit above management in the waterfall…"<br/><br/>
              <strong>Close Signal:</strong> If BOB asks about minimums, portal, or wire instructions — ask for the commitment immediately.
            </div>
            <BobAIHelper
              transcript={transcript}
              kbEntries={kbEntries}
              onCoachTip={() => {}}
              onSessionEvent={onSessionEvent}
            />
          </div>
        )}

        {/* BOB Chat / Voice */}
        {cardTab === 'rosie' && (
          <BobVoiceAgent
            persona={`Mode: ${persona.mode || 'duck'}, Intensity: ${persona.intensity || 3}/5, Focus: ${persona.focus || 'General Pitch'}. ${persona.customGreeting || ''}`}
            kbEntries={kbEntries}
            onTranscriptEntry={onTranscriptEntry}
            onSessionEvent={onSessionEvent}
            dgApiKey={dgApiKey}
          />
        )}

        {/* Portal Access */}
        {cardTab === 'portal' && (
          <div>
            <div style={{ marginBottom:'16px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Portal Access Controls</div>
              <div style={{ color:'#6b7280', fontSize:'12px', marginBottom:'16px', lineHeight:1.6 }}>
                When BOB asks about the investor portal during training, click Send Portal Access below. This action will be logged in the Training Log.
              </div>
              <MockField label="Portal Username" value="bob.callahan" />
              <MockField label="Portal Login URL" value="https://investors.rosieai.tech/portal-login" />
              <button onClick={handlePortalAccess} style={{ width:'100%', background:'linear-gradient(135deg,#a78bfa,#8b5cf6)', color:'#fff', border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase', transition:'all 0.2s', ...(portalSent?{background:'linear-gradient(135deg,#4ade80,#22c55e)',color:DARK}:{}) }}>
                {portalSent ? '✓ Portal Access Sent! (Logged)' : '🔐 Send Portal Access to BOB'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main BOB Tab ─────────────────────────────────────────────────────────────
export default function BobTab() {
  const [section, setSection]     = useState('training');
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [kbEntries, setKbEntries]   = useState([]);
  const [sessionId, setSessionId]   = useState(() => `session-${Date.now()}`);
  const [isCallActive, setIsCallActive] = useState(false);
  const [lastCoachTip, setLastCoachTip] = useState('');
  const [persona, setPersona]       = useState({ mode:'duck', intensity:3, focus:'General Pitch', customGreeting:'' });
  const [dgApiKey, setDgApiKey]     = useState('');

  useEffect(() => {
    base44.entities.KnowledgeBase.list('-created_date', 500)
      .then(all => setKbEntries(all || []))
      .catch(() => {});
  }, []);

  const addLog = useCallback((entry) => {
    setTrainingLogs(prev => [...prev, { ...entry, sessionId }]);
  }, [sessionId]);

  const handlePortalAccessSent = () => {
    addLog({ type:'portal_access', content:'🔐 PORTAL ACCESS SENT to BOB — Trainee clicked "Send Portal Access" during call.', time:new Date().toISOString() });
  };

  const handleCallConnected = () => {
    setIsCallActive(true);
    setSessionId(`session-${Date.now()}`);
    setTranscript([]);
    addLog({ type:'session_start', content:'📞 Trainee connected to BOB training call.', time:new Date().toISOString() });
  };

  const handleTranscriptEntry = (entry) => {
    setTranscript(prev => [...prev, entry]);
  };

  const SECTIONS = [
    { id:'training', label:'🎓 Training Room' },
    { id:'log',      label:'📋 Training Log' },
    { id:'kb',       label:'🧠 BOB Knowledge Base' },
    { id:'controls', label:'⚙️ BOB Controls' },
  ];

  return (
    <div style={{ fontFamily:'Georgia, serif' }}>
      {/* BOB Tab Header */}
      <div style={{ marginBottom:'24px', padding:'20px 24px', background:'rgba(184,147,58,0.05)', border:'1px solid rgba(184,147,58,0.15)', borderRadius:'4px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'6px' }}>
            <div style={{ fontSize:'28px' }}>🤖</div>
            <div>
              <h2 style={{ color:'#e8e0d0', margin:0, fontSize:'20px', fontWeight:'normal' }}>B.O.B. — Bot-Operated Buyer</h2>
              <div style={{ color:GOLD, fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', marginTop:'2px' }}>Sales Training Simulator</div>
            </div>
          </div>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:0, lineHeight:1.5, maxWidth:'600px' }}>
            Practice your Rosie AI investor pitch against a simulated prospect. BOB uses Deepgram Voice AI to roleplay Duck, Cow, or Owl personas. All sessions are transcribed and logged.
          </p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
          {isCallActive && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'20px', padding:'6px 12px' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#ef4444' }} />
              <span style={{ color:'#ef4444', fontSize:'11px', fontWeight:'bold' }}>TRAINING LIVE</span>
            </div>
          )}
          <div style={{ background:'rgba(184,147,58,0.12)', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', padding:'6px 12px', textAlign:'center' }}>
            <div style={{ color:GOLD, fontSize:'16px', fontWeight:'bold' }}>{trainingLogs.length}</div>
            <div style={{ color:'#6b7280', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px' }}>Events Logged</div>
          </div>
        </div>
      </div>

      {/* Section Nav */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:'0' }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{ padding:'10px 16px', background:section===s.id?'rgba(184,147,58,0.08)':'transparent', border:'none', borderBottom:`2px solid ${section===s.id?GOLD:'transparent'}`, color:section===s.id?GOLD:'#6b7280', cursor:'pointer', fontSize:'12px', fontWeight:section===s.id?'bold':'normal', whiteSpace:'nowrap' }}>
            {s.label}
            {s.id==='log' && trainingLogs.length>0 && <span style={{ marginLeft:'6px', background:'rgba(184,147,58,0.2)', color:GOLD, borderRadius:'10px', padding:'1px 6px', fontSize:'10px' }}>{trainingLogs.length}</span>}
          </button>
        ))}
      </div>

      {/* Training Room */}
      {section === 'training' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'16px', minHeight:'700px' }}>
          <MockLeadCard
            onPortalAccessSent={handlePortalAccessSent}
            onCallConnected={handleCallConnected}
            isCallActive={isCallActive}
            kbEntries={kbEntries}
            transcript={transcript}
            onSessionEvent={addLog}
            coachTip={lastCoachTip}
            persona={persona}
            dgApiKey={dgApiKey}
            onTranscriptEntry={handleTranscriptEntry}
          />

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ padding:'12px 14px', background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.15)', borderRadius:'4px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' }}>🎓 Trainee Sidebar</div>
              <div style={{ color:'#6b7280', fontSize:'11px' }}>Tools below listen to BOB in real time and help you respond effectively.</div>
            </div>
            <BobAIHelper
              transcript={transcript}
              kbEntries={kbEntries}
              onCoachTip={(tip) => { setLastCoachTip(tip); }}
              onSessionEvent={addLog}
            />
          </div>
        </div>
      )}

      {section === 'log' && (
        <TrainingLog
          logs={trainingLogs}
          onClear={() => {
            if (window.confirm('Clear all training logs? This cannot be undone.')) setTrainingLogs([]);
          }}
        />
      )}

      {section === 'kb' && <BobKnowledgeBase />}

      {section === 'controls' && (
        <BobPortalControls
          persona={persona}
          onPersonaChange={setPersona}
          dgApiKey={dgApiKey}
          onDgKeyChange={setDgApiKey}
        />
      )}
    </div>
  );
}