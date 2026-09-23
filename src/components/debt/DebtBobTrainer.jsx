/**
 * DebtBobTrainer.jsx — B.O.B. (Bot-Operated Buyer) training simulator for debt settlement.
 * Duck-to-Cow slider (cow = easy sell, duck = hard sell), Deepgram Voice Agent,
 * learns from uploaded calls/documents/websites in BOB's Brain KB.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtBobVoice } from '@/hooks/useDebtBobVoice';
import { DEBT_DUCK, DEBT_COW, DEBT_OWL } from '@/components/admin/bob/DebtPersonas';
import DebtBobKB from '@/components/debt/DebtBobKB';
import FloatingScriptBox from '@/components/debt/FloatingScriptBox';
import DebtAIPanel from '@/components/debt/DebtAIPanel';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const VOICE_MODELS = ['aura-zeus-en', 'aura-orion-en', 'aura-arcas-en', 'aura-perseus-en', 'aura-angus-en', 'aura-orpheus-en'];
const FOCUS_TOPICS = ['General', 'The Program', 'How It Works', 'Credit Impact', 'Fees & Pricing', 'Timeline', 'Qualifying Debt Types', 'Creditor Negotiations', 'Enrollment Process'];
const DEBT_KB_CATEGORIES = ['debt_kb', 'debt_faq', 'debt_agent', 'debt_customer', 'debt_doc', 'debt_web', 'debt_call'];

const SUB_TABS = [
  { id: 'training', label: '🎓 Training Room' },
  { id: 'brain', label: '🧠 BOB\'s Brain' },
  { id: 'log', label: '📋 Training Log' },
];

export default function DebtBobTrainer() {
  const [subTab, setSubTab] = useState('training');
  const [sliderValue, setSliderValue] = useState(0);
  const [intensity, setIntensity] = useState(3);
  const [focusTopic, setFocusTopic] = useState('General');
  const [voiceModel, setVoiceModel] = useState(VOICE_MODELS[0]);
  const [kbEntries, setKbEntries] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [logs, setLogs] = useState([]);
  const [callCount, setCallCount] = useState(0);
  const [sessionId, setSessionId] = useState('Bob');
  const [kbCount, setKbCount] = useState(0);
  const [dgApiKey, setDgApiKey] = useState('');

  // Load Deepgram API key from PortalSettings (shared with admin BobTab)
  useEffect(() => {
    base44.entities.PortalSettings.filter({ key: 'bob_controls_debt' })
      .then(rows => {
        if (rows?.length > 0 && rows[0].bobDeepgramApiKey) {
          setDgApiKey(rows[0].bobDeepgramApiKey);
        }
      })
      .catch(() => {});
  }, []);

  const transcriptRef = useRef([]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Load KB entries from all debt categories
  const loadKB = useCallback(async () => {
    try {
      const all = await base44.entities.KnowledgeBase.list('-created_date', 500);
      const debt = (all || []).filter(e => DEBT_KB_CATEGORIES.includes(e.category));
      setKbEntries(debt);
      setKbCount(debt.length);
    } catch {}
  }, []);

  useEffect(() => { loadKB(); }, [loadKB]);

  // Listen for KB updates from the Knowledge Base tab — shared learning
  useEffect(() => {
    const handler = () => loadKB();
    window.addEventListener('debt_kb_updated', handler);
    return () => window.removeEventListener('debt_kb_updated', handler);
  }, [loadKB]);

  const addLog = useCallback((type, content) => {
    setLogs(prev => [...prev, { type, content, time: new Date().toISOString(), sessionId }]);
  }, [sessionId]);

  const handleTranscript = useCallback((entry) => {
    setTranscript(prev => [...prev, entry]);
  }, []);

  const { phase, error, agentSpeaking, micDevices, micDeviceId, setMicDeviceId, ringPhase, startCall, hangup, isRecording, recordingUrl } = useDebtBobVoice({ onTranscript: handleTranscript, onLog: addLog });

  const getActivePersona = useCallback(() => {
    if (sliderValue < 33) return DEBT_DUCK;
    if (sliderValue < 67) return DEBT_OWL;
    return DEBT_COW;
  }, [sliderValue]);

  const buildSystemPrompt = useCallback(() => {
    const persona = getActivePersona();
    const kbText = kbEntries.slice(0, 30).map(e => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n');
    const sliderLabel = sliderValue < 20 ? 'full Duck mode (hard sell — skeptical, resistant, stress-tests the closer)'
      : sliderValue < 40 ? 'Duck-leaning Owl (mostly resistant but will consider logic)'
      : sliderValue < 60 ? 'Owl/Hybrid (analytical, wants to understand the program)'
      : sliderValue < 80 ? 'Cow-leaning Owl (generally agreeable but checks logic)'
      : 'full Cow mode (easy sell — stressed, drowning in debt, relieved someone called)';
    return `${persona.systemPrompt}

━━━ CURRENT SESSION SETTINGS ━━━
- Persona Blend: ${sliderLabel} (slider ${sliderValue}/100 — 0=full Duck/hard, 50=Owl, 100=full Cow/easy)
- Intensity: ${intensity}/5 (higher = more extreme character behavior)
- Call Focus Topic: "${focusTopic}" — steer objections and interest toward this topic

━━━ DEBT SETTLEMENT KNOWLEDGE BASE — LEARNED FROM REAL CALLS ━━━
${kbText || 'No KB entries yet. Upload calls, documents, and websites to BOB\'s Brain to make BOB smarter and more realistic.'}

━━━ CRITICAL RULES ━━━
- You are a REAL PERSON on a phone call. Keep ALL responses 1-3 sentences.
- Never say you are an AI. Never break character.
- Use natural speech: contractions, interruptions, "uh", "look", "listen", "I mean" — real people talk like this.
- React to what the trainee actually says — improvise within your persona, don't just recite lines.
- Use the KNOWLEDGE BASE above to inform your responses — if the closer mentions program details, fees, or timelines that match the KB, react realistically based on what you know.`;
  }, [sliderValue, intensity, focusTopic, kbEntries, getActivePersona]);

  const handleStartCall = useCallback(async () => {
    const newCount = callCount + 1;
    setCallCount(newCount);
    const label = newCount === 1 ? 'Bob' : `Bob${newCount - 1}`;
    setSessionId(label);
    setTranscript([]);
    const vIdx = (newCount - 1) % VOICE_MODELS.length;
    setVoiceModel(VOICE_MODELS[vIdx]);

    // Get a fresh Deepgram API key — prefer live token, then PortalSettings, then fallback
    let apiKey = dgApiKey;
    if (!apiKey) {
      try {
        const tokenRes = await base44.functions.invoke('deepgramToken', {});
        apiKey = tokenRes?.key || tokenRes?.data?.key || '';
      } catch {}
    }
    if (!apiKey) apiKey = '44294c0c2f0ebbcc81b853151056111226b853e9';
    const greetings = ['Hello.', 'Hello?', 'Hello, this is Bob.', 'Yeah?', 'Hello, go ahead.'];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    await startCall({ apiKey, systemPrompt: buildSystemPrompt(), voiceModel: VOICE_MODELS[vIdx], greeting, sessionLabel: label });
  }, [callCount, startCall, buildSystemPrompt, dgApiKey]);

  const sliderLabel = sliderValue < 20 ? '🦆 Full Duck' : sliderValue < 40 ? '🦆 Duck-Owl' : sliderValue < 60 ? '🦉 Owl (Hybrid)' : sliderValue < 80 ? '🐄 Owl-Cow' : '🐄 Full Cow';
  const sliderColor = sliderValue < 33 ? '#ef4444' : sliderValue < 67 ? '#f59e0b' : '#4ade80';
  const phaseColor = { idle: '#4a5568', ringing: '#f59e0b', connecting: '#f59e0b', active: '#4ade80', error: '#ef4444' }[phase] || '#4a5568';
  const phaseLabel = { idle: 'Idle', ringing: '📳 Ringing…', connecting: 'Connecting…', active: '🔴 LIVE', error: 'Error' }[phase] || phase;

  return (
    <div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: '20px', padding: '16px 20px', background: `${GOLD}08`, border: `1px solid ${GOLD}22`, borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <div style={{ fontSize: '24px' }}>🤖</div>
            <div>
              <h2 style={{ color: '#e8e0d0', margin: 0, fontSize: '18px', fontWeight: 'normal' }}>B.O.B. — Bot-Operated Buyer</h2>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>Debt Settlement Training Simulator · Deepgram Voice AI</div>
            </div>
          </div>
          <div style={{ color: '#6b7280', fontSize: '11px' }}>Practice your debt settlement closer pitch. Duck = hard sell, Cow = easy sell. BOB learns from every uploaded call.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {phase === 'active' && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', padding: '6px 14px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} /><span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 'bold' }}>{sessionId} LIVE</span></div>}
          <div style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '8px 14px', textAlign: 'center' }}><div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold' }}>{callCount}</div><div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Calls</div></div>
          <div style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '8px 14px', textAlign: 'center' }}><div style={{ color: '#a78bfa', fontSize: '18px', fontWeight: 'bold' }}>{kbCount}</div><div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Brain Size</div></div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{ padding: '10px 18px', background: subTab === t.id ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: `2px solid ${subTab === t.id ? GOLD : 'transparent'}`, color: subTab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: subTab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{t.label}</button>
        ))}
      </div>

      {/* Training Room */}
      {subTab === 'training' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 400px', gap: '16px', alignItems: 'start' }}>
          {/* Left: Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Call controls */}
            <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '16px' }}>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📞 Call Controls</div>

              {/* Mic selector */}
              {micDevices.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={ls}>🎙 Microphone</label>
                  <select value={micDeviceId} onChange={e => setMicDeviceId(e.target.value)} disabled={phase === 'active'} style={{ ...inp, cursor: 'pointer' }}>
                    {micDevices.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0, 6)}`}</option>)}
                  </select>
                </div>
              )}

              {/* Voice model */}
              <div style={{ marginBottom: '12px' }}>
                <label style={ls}>🗣 Voice Model</label>
                <select value={voiceModel} onChange={e => setVoiceModel(e.target.value)} disabled={phase !== 'idle'} style={{ ...inp, cursor: 'pointer' }}>
                  {VOICE_MODELS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Start/Hangup */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {phase === 'idle' || phase === 'error' ? (
                  <button onClick={handleStartCall} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📞 Connect to BOB</button>
                ) : (
                  <button onClick={hangup} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '10px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⏹ Hang Up</button>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: `${phaseColor}18`, border: `1px solid ${phaseColor}44`, borderRadius: '20px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: phaseColor, animation: phase === 'active' ? 'pulse 1s infinite' : 'none' }} />
                  <span style={{ color: phaseColor, fontSize: '11px', fontWeight: 'bold' }}>{phaseLabel}</span>
                </span>
              </div>

              {isRecording && <div style={{ marginTop: '6px', color: '#ef4444', fontSize: '11px', textAlign: 'center', animation: 'pulse 1.5s infinite' }}>● REC — Recording call audio</div>}
              {ringPhase && <div style={{ marginTop: '8px', color: '#f59e0b', fontSize: '11px', textAlign: 'center', animation: 'pulse 0.8s infinite' }}>📞 Dialing… (ringing twice, then Bob picks up)</div>}
              {agentSpeaking && phase === 'active' && <div style={{ marginTop: '6px', color: GOLD, fontSize: '11px', textAlign: 'center' }}>🤖 Bob is speaking…</div>}
              {error && <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '11px' }}>⚠ {error}</div>}
            </div>

            {/* Duck-Cow Slider */}
            <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ ...ls, marginBottom: 0 }}>Duck ←→ Cow Slider</label>
                <span style={{ color: sliderColor, fontSize: '13px', fontWeight: 'bold' }}>{sliderLabel}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#ef4444', fontSize: '10px' }}>🦆 Duck (Hard Sell)</span>
                <span style={{ color: '#f59e0b', fontSize: '10px' }}>🦉 Owl</span>
                <span style={{ color: '#4ade80', fontSize: '10px' }}>🐄 Cow (Easy Sell)</span>
              </div>
              <input type="range" min={0} max={100} value={sliderValue} onChange={e => setSliderValue(Number(e.target.value))} style={{ width: '100%', accentColor: sliderColor, cursor: 'pointer' }} />
              <div style={{ color: '#6b7280', fontSize: '11px', lineHeight: 1.5, marginTop: '6px' }}>
                {sliderValue < 20 ? DEBT_DUCK.description : sliderValue < 40 ? 'Duck-leaning — mostly resistant but will consider logic.' : sliderValue < 60 ? DEBT_OWL.description : sliderValue < 80 ? 'Cow-leaning — generally agreeable but checks logic.' : DEBT_COW.description}
              </div>

              {/* Intensity */}
              <div style={{ marginTop: '12px' }}>
                <label style={{ ...ls, marginBottom: '6px' }}>Intensity (1 = mild, 5 = full character)</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setIntensity(n)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: `1px solid ${intensity === n ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: intensity === n ? `${GOLD}18` : 'transparent', color: intensity === n ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Focus topic */}
              <div style={{ marginTop: '12px' }}>
                <label style={ls}>Focus / Topic</label>
                <select value={focusTopic} onChange={e => setFocusTopic(e.target.value)} style={{ ...inp, cursor: 'pointer', colorScheme: 'dark' }}>
                  {FOCUS_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Active persona info */}
            <div style={{ background: '#0d1b2a', border: `1px solid ${sliderColor}33`, borderRadius: '6px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '20px' }}>{getActivePersona().emoji}</span>
                <div>
                  <div style={{ color: sliderColor, fontSize: '12px', fontWeight: 'bold' }}>{getActivePersona().name}</div>
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>{getActivePersona().description}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Transcript */}
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📋 Live Transcript</div>
              <div style={{ color: '#6b7280', fontSize: '10px' }}>{transcript.length} lines · <span style={{ color: GOLD }}>{sessionId}</span></div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              {transcript.length === 0 ? (
                <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0', fontSize: '13px' }}>
                  {phase === 'active' ? 'Listening… start speaking to BOB.' : phase === 'ringing' ? '📞 Dialing BOB…' : phase === 'connecting' ? 'Connecting to Deepgram…' : 'No transcript yet. Click "Connect to BOB" to start a training call.'}
                </div>
              ) : transcript.map((msg, i) => {
                const isBob = msg.role === 'bob';
                return (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '10px', justifyContent: isBob ? 'flex-start' : 'flex-end' }}>
                    <div style={{ maxWidth: '85%', background: isBob ? 'rgba(16,185,129,0.1)' : 'rgba(96,165,250,0.1)', border: `1px solid ${isBob ? 'rgba(16,185,129,0.2)' : 'rgba(96,165,250,0.2)'}`, borderRadius: isBob ? '12px 12px 12px 2px' : '12px 12px 2px 12px', padding: '8px 12px' }}>
                      <div style={{ color: isBob ? GOLD : '#60a5fa', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '3px' }}>{isBob ? '🤖 BOB' : '🎙 You'}</div>
                      <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.5 }}>{msg.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Tools — Q&A, Coach, Intent, Pitches, Signals */}
          <DebtAIPanel transcript={transcript} kbEntries={kbEntries} isActive={phase === 'active'} transcriptFormat="bob" />
        </div>
      )}

      {/* BOB's Brain */}
      {subTab === 'brain' && <DebtBobKB onKBUpdated={loadKB} />}

      {/* Training Log */}
      {subTab === 'log' && <TrainingLog logs={logs} recordingUrl={recordingUrl} onClear={() => { if (window.confirm('Clear all logs?')) setLogs([]); }} />}

      <FloatingScriptBox storageKey="bob_script" />
    </div>
  );
}

// ─── Training Log ─────────────────────────────────────────────────────────────
function TrainingLog({ logs, recordingUrl, onClear }) {
  const logEndRef = useRef(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);
  const typeColors = { session_start: '#60a5fa', session_end: '#a78bfa', transcript: '#e8e0d0', coach_tip: '#f59e0b', qa_answer: '#34d399', intent_update: '#f472b6', appointment: '#4ade80', disposition: '#f59e0b' };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>Training Log — {logs.length} Events</div>
        {logs.length > 0 && <button onClick={onClear} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>Clear Log</button>}
      </div>
      {recordingUrl && (
        <div style={{ marginBottom: '16px', background: '#0d1b2a', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '14px' }}>
          <div style={{ color: '#ef4444', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>● Call Recording</div>
          <audio controls src={recordingUrl} style={{ width: '100%', outline: 'none' }} />
          <a href={recordingUrl} target="_blank" rel="noopener noreferrer" download style={{ color: GOLD, fontSize: '11px', marginTop: '6px', display: 'inline-block' }}>⬇ Download Recording</a>
        </div>
      )}
      {logs.length === 0 && !recordingUrl ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0' }}>No sessions yet. Start a training call to see events here.</div> :
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {logs.map((entry, i) => {
            const color = typeColors[entry.type] || '#6b7280';
            return (
              <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '12px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, marginTop: '5px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ color, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{entry.type.replace(/_/g, ' ')}</span>
                    <span style={{ color: '#4a5568', fontSize: '10px' }}>{new Date(entry.time).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{entry.content}</div>
                </div>
              </div>
            );
          })}
        </div>}
      <div ref={logEndRef} />
    </div>
  );
}