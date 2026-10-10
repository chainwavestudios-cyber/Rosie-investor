/**
 * FronterBobTrainer.jsx — BOB training simulator for the fronter page.
 * BOB simulates a fresh customer receiving a cold call from the fronter.
 * Uses FronterKnowledgeBase for the brain, same duck/cow slider + character tuning.
 * Auto-pops out Q&A and scripts when the call connects.
 * Audio recordings saved to BobSession with 24h expiry.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtBobVoice } from '@/hooks/useDebtBobVoice';
import { BOB_CHARACTERS, getCharacter, DEFAULT_CHARACTER_ID, BOB_THINK_MODELS, DEFAULT_THINK_MODEL } from '@/components/debt/bob/BobCharacters';
import FronterQAPopup from '@/components/fronter/FronterQAPopup';
import { substituteScriptVars } from '@/lib/scriptSubstitute';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const PINK = '#f472b6';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const VOICE_MODELS = [
  'flux-cliff-en', 'flux-miles-en', 'flux-drew-en', 'flux-bruce-en',
  'flux-wes-en', 'flux-marcus-en', 'flux-wade-en', 'flux-donovan-en',
  'flux-jack-en', 'flux-conor-en', 'flux-kit-en', 'flux-cole-en',
  'flux-hannah-en', 'flux-alexis-en', 'flux-sienna-en', 'flux-haley-en',
  'flux-brooke-en', 'flux-paige-en', 'flux-elise-en', 'flux-kelsey-en',
];

const FRONTER_DUCK = {
  name: 'Duck (Hard)',
  emoji: '🦆',
  description: 'Skeptical, annoyed by cold calls, guards info. Stress-tests the fronter.',
  systemPrompt: `You are BOB — a real person receiving an UNSOLICITED COLD CALL from a debt settlement fronter. You did NOT ask for this call. You have significant credit card debt ($15K–$40K) and you're struggling, but you've been burned by debt relief scams before and you're skeptical of telemarketers.

━━━ CALL FLOW — OUTBOUND COLD CALL ━━━
STEP 1 — Your phone rings. You answer cautiously: "Hello?" / "Yeah?" / "Hello, who is this?"
STEP 2 — The fronter introduces themselves. You react with friction:
  "I don't talk to telemarketers." / "How did you get my number?" / "Look, I'm busy. What is this about?"
STEP 3 — The fronter explains why they're calling (debt relief program). You push back:
  "I've heard all this before. Last company took $500 and did nothing." / "Are you a scam?" / "I'm not giving you my financials over the phone."
STEP 4 — If the fronter is patient and builds trust, you slowly open up:
  "Okay… so what exactly do you do?" / "I'm not promising anything, but go ahead."
STEP 5 — When asked about your debts, you're hesitant:
  "Why do you need to know that?" / "I'm not giving you my financials." → (if trust built) "I've got maybe three or four cards. Probably around $20,000 total."

━━━ QUALIFYING — GUARD YOUR INFO ━━━
- "Are you employed?" → "Yeah, I work." (don't elaborate)
- "What's your monthly income?" → "Enough to get by. Why?" (answer only if they explain)
- "Are you behind on payments?" → "A couple. Maybe 30 days late on one." (honest but reluctant)
- "What's your credit score?" → "I don't know exactly. It used to be good."

Do NOT reveal you are an AI. You are a real person named Bob.`,
};

const FRONTER_OWL = {
  name: 'Owl (Hybrid)',
  emoji: '🦉',
  description: 'Cautious but curious. Asks questions, wants to understand before committing.',
  systemPrompt: `You are BOB — a real person receiving an UNSOLICITED COLD CALL from a debt settlement fronter. You have $20K–$35K in credit card debt. You're careful — you research before making decisions. You're not hostile but you won't commit to anything you don't understand.

━━━ CALL FLOW — OUTBOUND COLD CALL ━━━
STEP 1 — You answer: "Hello." / "Yeah." / "Bob speaking."
STEP 2 — The fronter introduces themselves. You respond neutrally:
  "Okay, what can you do for me?" / "I've got a few minutes. What's the program?"
STEP 3 — You listen carefully, ask precise questions:
  "How does that actually work?" / "What's the impact on my credit?" / "What are the fees?" / "How long does the program take?"
STEP 4 — When asked about your debts, you answer precisely:
  "I have three credit cards. Total balance is approximately $28,000. Interest rates range from 18% to 27%." / "My minimum payments total about $750 a month."
STEP 5 — If the fronter explains clearly and admits limitations honestly, you warm up. If they over-pitch, you get cautious.

━━━ QUALIFYING — ANSWER DIRECTLY ━━━
- "Are you employed?" → "Yes, full-time. I'm a project manager."
- "Are you behind on payments?" → "Not yet, but I'm one missed paycheck away from falling behind."
- "Have you tried other solutions?" → "I looked into a balance transfer card but I don't qualify with my current utilization."

Do NOT reveal you are an AI. You are a real person named Bob.`,
};

const FRONTER_COW = {
  name: 'Cow (Easy)',
  emoji: '🐄',
  description: 'Stressed, drowning in debt, relieved someone called. Tests if fronter can qualify without overselling.',
  systemPrompt: `You are BOB — a real person receiving an UNSOLICITED COLD CALL from a debt settlement fronter. You have $25K–$50K in credit card debt, you're barely making minimum payments, and you're stressed. When the fronter calls, you're relieved — finally someone who can help.

━━━ CALL FLOW — OUTBOUND COLD CALL ━━━
STEP 1 — You answer: "Hello?" / "Hi, yes?"
STEP 2 — The fronter introduces themselves. You respond warmly:
  "Oh thank God, yeah — I could really use some help with my debt." / "I've been hoping someone would call. I really need to figure something out."
STEP 3 — You listen eagerly, respond positively:
  "That sounds great." / "Really?" / "Wow, that would help so much." / "Tell me more."
STEP 4 — When asked about your debts, you share openly:
  "I've got four credit cards. Chase is about $8,000, Capital One is $12,000, Discover is maybe $6,000, and I've got a medical bill for $3,500." / "The interest rates are crazy — one's at 29%!" / "I'm paying like $900 a month in minimums and the balances barely go down."
STEP 5 — If the fronter qualifies you and wants to transfer you to a specialist, you agree readily.

━━━ QUALIFYING — ENGAGE WARMLY ━━━
- "Are you employed?" → "Yes, I work in logistics. Been there 6 years."
- "Are you behind on payments?" → "I'm 30 days late on the Capital One. I'm scared they're going to send it to collections."
- "What's your credit score?" → "It was 720 a year ago. Now it's probably in the 500s."

Do NOT reveal you are an AI. You are a real person named Bob.`,
};

const PRESET_SCENARIOS = [
  { label: '😰 Overwhelmed', data: { customerName: 'Bob', debtAmount: '35000', creditorCount: '5', creditors: 'Chase, Capital One, Discover, Amex, Citi', monthlyIncome: '3200', monthsBehind: '3', hardship: 'I lost my job last year and had to rely on credit cards. Even after finding new work, the interest rates keep me from getting ahead.' } },
  { label: '🤔 Skeptical', data: { customerName: 'Bob', debtAmount: '15000', creditorCount: '3', creditors: 'Chase, Capital One, Discover', monthlyIncome: '4500', monthsBehind: '0', hardship: 'I went through a divorce and got stuck with the balances. Between legal fees and starting over, I have not been able to get ahead of the interest.' } },
  { label: '📈 High Debt', data: { customerName: 'Bob', debtAmount: '75000', creditorCount: '8', creditors: 'Multiple creditors', monthlyIncome: '6000', monthsBehind: '2', hardship: 'I had a medical emergency two years ago. Even with insurance, I was left with thousands in bills. I put everything on credit cards while recovering.' } },
];

const PREVIEW_MAX_SIZE = 8000;
async function buildSessionTranscript(lines) {
  const full = JSON.stringify(lines || []);
  const file = new File([full], `fronter-bob-transcript-${Date.now()}.json`, { type: 'application/json' });
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  const preview = [];
  let size = 2;
  for (let i = lines.length - 1; i >= 0; i--) {
    const len = JSON.stringify(lines[i]).length + 1;
    if (size + len > PREVIEW_MAX_SIZE) break;
    preview.unshift(lines[i]);
    size += len;
  }
  return { transcriptJson: JSON.stringify(preview), transcriptFileUrl: file_url, transcriptLineCount: lines.length };
}

export default function FronterBobTrainer({ username, fronterFirstName }) {
  const [sliderValue, setSliderValue] = useState(0);
  const [intensity, setIntensity] = useState(3);
  const [characterId, setCharacterId] = useState(DEFAULT_CHARACTER_ID);
  const [voiceModel, setVoiceModel] = useState(VOICE_MODELS[0]);
  const [thinkModel, setThinkModel] = useState(DEFAULT_THINK_MODEL);
  const [kbEntries, setKbEntries] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [callCount, setCallCount] = useState(0);
  const [sessionId, setSessionId] = useState('Bob');
  const [scenario, setScenario] = useState(PRESET_SCENARIOS[0].data);
  const [showQA, setShowQA] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [dgApiKey, setDgApiKey] = useState('');
  const transcriptRef = useRef([]);
  const callStartRef = useRef(null);
  const sessionRecIdRef = useRef(null);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Load KB + scripts
  useEffect(() => {
    Promise.all([
      base44.entities.FronterKnowledgeBase.list('-created_date', 500),
      base44.entities.FronterScript.list('sortOrder', 50),
    ]).then(([kb, scrs]) => {
      setKbEntries(kb || []);
      setScripts(scrs || []);
    }).catch(() => {});
  }, []);

  // Load Deepgram API key
  useEffect(() => {
    base44.entities.PortalSettings.filter({ key: 'bob_controls_debt' })
      .then(rows => {
        if (rows?.length > 0 && rows[0].adminUsername) {
          try { const saved = JSON.parse(rows[0].adminUsername); if (saved.dgApiKey) setDgApiKey(saved.dgApiKey); } catch {}
        }
      }).catch(() => {});
  }, []);

  const addLog = useCallback((type, content) => {
    // Simple logging
  }, []);

  const handleTranscript = useCallback((entry) => {
    setTranscript(prev => [...prev, entry]);
  }, []);

  const { phase, error, agentSpeaking, micDevices, micDeviceId, setMicDeviceId, outputDevices, outputDeviceId, setOutputDeviceId, ringPhase, transferPhase, startCall, hangup, isRecording, recordingUrl, getRecordingSnapshot, paused, pauseCall, resumeCall } = useDebtBobVoice({ onTranscript: handleTranscript, onLog: addLog });

  // Auto-popout Q&A and scripts when call connects
  useEffect(() => {
    if (phase === 'active') {
      setShowQA(true);
      setShowScripts(true);
    }
  }, [phase]);

  // Session persistence
  const metaRef = useRef({});
  metaRef.current = { sessionLabel: sessionId, voiceModel, sliderValue, intensity, sourceType: 'fronter' };

  const ensureSession = useCallback(async () => {
    if (!sessionRecIdRef.current) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const rec = await base44.entities.BobSession.create({ ...metaRef.current, transcriptLineCount: 0, durationSeconds: 0, createdAt: new Date().toISOString(), expiresAt, sourceType: 'fronter', traineeUsername: username });
      sessionRecIdRef.current = rec.id;
    }
    return sessionRecIdRef.current;
  }, [username]);

  const saveTranscript = useCallback(async () => {
    const lines = transcriptRef.current || [];
    if (lines.length === 0) return;
    try {
      const id = await ensureSession();
      const t = await buildSessionTranscript(lines);
      const dur = callStartRef.current ? Math.round((Date.now() - callStartRef.current) / 1000) : 0;
      await base44.entities.BobSession.update(id, { ...t, durationSeconds: dur });
    } catch (e) { console.warn('Transcript save failed:', e); }
  }, [ensureSession]);

  // Create session on call start, save transcript on call end
  useEffect(() => {
    if (phase === 'active' && !callStartRef.current) {
      callStartRef.current = Date.now();
      ensureSession().catch(() => {});
    }
    if ((phase === 'idle' || phase === 'error') && callStartRef.current) {
      saveTranscript().catch(() => {});
      // Save recording URL
      if (recordingUrl) {
        ensureSession().then(id => base44.entities.BobSession.update(id, { recordingUrl }).catch(() => {})).catch(() => {});
      }
      callStartRef.current = null;
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave every 30 seconds
  useEffect(() => {
    if (phase !== 'active') return;
    const iv = setInterval(async () => {
      await saveTranscript().catch(() => {});
      const blob = getRecordingSnapshot();
      if (blob) {
        try {
          const file = new File([blob], `fronter-bob-partial-${Date.now()}.webm`, { type: 'audio/webm' });
          const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
          const id = await ensureSession();
          await base44.entities.BobSession.update(id, { recordingUrl: file_url }).catch(() => {});
        } catch {}
      }
    }, 30000);
    return () => clearInterval(iv);
  }, [phase, saveTranscript, getRecordingSnapshot, ensureSession]);

  const getActivePersona = useCallback(() => {
    if (sliderValue < 33) return FRONTER_DUCK;
    if (sliderValue < 67) return FRONTER_OWL;
    return FRONTER_COW;
  }, [sliderValue]);

  const buildSystemPrompt = useCallback(() => {
    const persona = getActivePersona();
    const character = getCharacter(characterId);
    const kbText = kbEntries.slice(0, 40).map(e => `Q: ${e.question}\nA: ${(e.answer || '').slice(0, 400)}`).join('\n\n');
    const sliderLabel = sliderValue < 20 ? 'full Duck mode (hard — skeptical, annoyed, guards info)'
      : sliderValue < 40 ? 'Duck-leaning Owl (mostly resistant but will consider logic)'
      : sliderValue < 60 ? 'Owl/Hybrid (analytical, wants to understand)'
      : sliderValue < 80 ? 'Cow-leaning Owl (generally agreeable but checks logic)'
      : 'full Cow mode (easy — stressed, drowning in debt, relieved someone called)';

    const minObjections = sliderValue < 33 ? 3 + intensity : sliderValue < 67 ? 2 + Math.ceil(intensity / 2) : Math.max(1, Math.ceil(intensity / 3));
    const minQuestions = 2 + intensity;

    const scenarioText = (scenario.debtAmount || scenario.creditors) ? `
━━━ YOUR DEBT SITUATION — USE THESE DETAILS ━━━
- Name: ${scenario.customerName || 'Bob'}
- Total Debt: $${scenario.debtAmount || 'unspecified'}
- Creditors: ${scenario.creditors || 'unspecified'} (${scenario.creditorCount || '?'} accounts)
- Monthly Income: $${scenario.monthlyIncome || 'unspecified'}
- Months Behind: ${scenario.monthsBehind || '0'}
- Hardship: ${scenario.hardship || 'I lost my job and had to rely on credit cards. Even after finding new work, the interest rates keep me from getting ahead.'}
- Use these details when discussing your financial situation. Be specific when asked.` : '';

    return `${persona.systemPrompt}

${character.personalityPrompt}

━━━ ⚠ CRITICAL — REACT, DON'T VOLUNTEEER ━━━
You are receiving a COLD CALL. You did NOT ask for this. WAIT for the fronter to speak first.
- Do NOT offer your debt details until the fronter asks.
- Do NOT raise objections until the fronter makes a claim worth objecting to.
- At the very start, just say your greeting ("Hello?" or "Yeah?") and WAIT.

━━━ ⚠ DO NOT JUST SAY "ok", "uh-huh", "yeah", "right", "sure" ━━━
NEVER respond with a bare acknowledgment. EVERY response must contain real content — a question, an objection, a concern, or information about your financial situation.
BAD: "Ok." / "Uh-huh." / "Yeah, that sounds good."
GOOD: "Wait, how much is this going to cost me?" / "I don't know, I've been burned before." / "So you're saying you can get Chase to lower my interest?"

━━━ CURRENT SESSION SETTINGS ━━━
- Persona Blend: ${sliderLabel} (slider ${sliderValue}/100)
- Intensity: ${intensity}/5
${scenarioText}

━━━ OBJECTIONS & QUESTIONS — REACTIVE, NOT PREEMPTIVE ━━━
- MINIMUM ${minObjections} objections during the call — but ONLY raise an objection AFTER the fronter makes a claim. Don't object to nothing.
- MINIMUM ${minQuestions} questions during the call — but ONLY ask questions that relate to what the fronter just said.
- Space them out — one objection or question every 30-60 seconds, triggered by the conversation.
- At the very start: just greet them and WAIT. Do NOT object or ask anything until the fronter has spoken first.

━━━ FRONTER KNOWLEDGE BASE — LEARNED FROM REAL CALLS ━━━
${kbText || 'No KB entries yet. The fronter should upload calls and documents to the KB to make BOB smarter.'}

━━━ CRITICAL RULES ━━━
- You are a REAL PERSON on a phone call. Keep ALL responses 1-3 sentences.
- Never say you are an AI. Never break character.
- Use natural speech: contractions, interruptions, "uh", "look", "listen", "I mean."
- React to what the fronter actually says — improvise within your persona.
- Use the KNOWLEDGE BASE above to inform your responses.`;
  }, [sliderValue, intensity, kbEntries, getActivePersona, scenario, characterId]);

  const handleStartCall = useCallback(async () => {
    const newCount = callCount + 1;
    setCallCount(newCount);
    const character = getCharacter(characterId);
    setSessionId(character.name);
    setTranscript([]);
    sessionRecIdRef.current = null; callStartRef.current = null;
    setVoiceModel(character.voiceModel);

    const apiKey = dgApiKey || '44294c0c2f0ebbcc81b853151056111226b853e9';
    const greetings = ['Hello?', 'Yeah?', 'Hello, who is this?', 'Hello, go ahead.'];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    // No transfer agent for fronter calls — direct cold call
    await startCall({ apiKey, systemPrompt: buildSystemPrompt(), voiceModel: character.voiceModel, greeting, sessionLabel: character.name, thinkModel });
  }, [callCount, startCall, buildSystemPrompt, dgApiKey, characterId, thinkModel]);

  const handleSaveNow = useCallback(async () => {
    if (!transcriptRef.current || transcriptRef.current.length === 0) return;
    setSavingSession(true);
    try {
      await saveTranscript();
      if (recordingUrl) {
        const id = await ensureSession();
        await base44.entities.BobSession.update(id, { recordingUrl }).catch(() => {});
      }
      setSessionSaved(true);
      setTimeout(() => setSessionSaved(false), 2000);
    } catch (e) { alert('Failed to save: ' + (e?.message || String(e))); }
    setSavingSession(false);
  }, [saveTranscript, recordingUrl, ensureSession]);

  const sliderLabel = sliderValue < 20 ? '🦆 Full Duck' : sliderValue < 40 ? '🦆 Duck-Owl' : sliderValue < 60 ? '🦉 Owl' : sliderValue < 80 ? '🐄 Owl-Cow' : '🐄 Full Cow';
  const sliderColor = sliderValue < 33 ? '#ef4444' : sliderValue < 67 ? '#f59e0b' : '#4ade80';
  const phaseColor = { idle: '#4a5568', ringing: '#f59e0b', connecting: '#f59e0b', active: '#4ade80', error: '#ef4444' }[phase] || '#4a5568';
  const phaseLabel = { idle: 'Idle', ringing: '📳 Dialing…', connecting: 'Connecting…', active: '🔴 LIVE', error: 'Error' }[phase] || phase;

  return (
    <div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '14px', alignItems: 'start' }}>
        {/* Left: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Header */}
          <div style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}22`, borderRadius: '6px', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '22px' }}>🤖</div>
              <div>
                <div style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold' }}>B.O.B. Training</div>
                <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Fronter Cold Call Simulator</div>
              </div>
            </div>
            <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '6px' }}>BOB simulates a fresh customer with $10K+ in credit card debt. Practice your open script and qualifying flow.</div>
          </div>

          {/* Call controls */}
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '14px' }}>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>📞 Call Controls</div>

            {micDevices.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <label style={ls}>🎙 Microphone</label>
                <select value={micDeviceId} onChange={e => setMicDeviceId(e.target.value)} disabled={phase === 'active'} style={{ ...inp, cursor: 'pointer' }}>
                  {micDevices.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0, 6)}`}</option>)}
                </select>
              </div>
            )}

            {outputDevices.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <label style={ls}>🔊 Audio Output</label>
                <select value={outputDeviceId} onChange={e => setOutputDeviceId(e.target.value)} disabled={phase === 'active'} style={{ ...inp, cursor: 'pointer' }}>
                  {outputDevices.map(o => <option key={o.deviceId} value={o.deviceId}>{o.label || `Speaker ${o.deviceId.slice(0, 6)}`}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: '8px' }}>
              <label style={ls}>🎭 Character</label>
              <select value={characterId} onChange={e => { setCharacterId(e.target.value); const c = getCharacter(e.target.value); setVoiceModel(c.voiceModel); }} disabled={phase !== 'idle'} style={{ ...inp, cursor: 'pointer' }}>
                {BOB_CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
              <div style={{ color: '#6b7280', fontSize: '9px', marginTop: '3px' }}>{getCharacter(characterId).description}</div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={ls}>🗣 Voice Model</label>
              <select value={voiceModel} onChange={e => setVoiceModel(e.target.value)} disabled={phase !== 'idle'} style={{ ...inp, cursor: 'pointer' }}>
                {VOICE_MODELS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={ls}>🧠 BOB Brain (LLM Model)</label>
              <select value={thinkModel} onChange={e => setThinkModel(e.target.value)} disabled={phase !== 'idle'} style={{ ...inp, cursor: 'pointer' }}>
                {BOB_THINK_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {phase === 'idle' || phase === 'error' ? (
                <button onClick={handleStartCall} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '9px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📞 Connect to BOB</button>
              ) : (
                <>
                  <button onClick={hangup} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '9px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>⏹ Hang Up</button>
                  <button onClick={paused ? resumeCall : pauseCall} style={{ background: paused ? 'linear-gradient(135deg,#10b981,#22c55e)' : 'rgba(251,191,36,0.15)', color: paused ? DARK : '#fbbf24', border: `1px solid ${paused ? 'rgba(16,185,129,0.4)' : 'rgba(251,191,36,0.3)'}`, borderRadius: '4px', padding: '9px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
                </>
              )}
              <button onClick={handleSaveNow} disabled={savingSession || transcript.length === 0} style={{ background: sessionSaved ? 'rgba(74,222,128,0.15)' : `${GOLD}18`, color: sessionSaved ? '#4ade80' : GOLD, border: `1px solid ${sessionSaved ? 'rgba(74,222,128,0.3)' : GOLD + '44'}`, borderRadius: '4px', padding: '9px 16px', cursor: (savingSession || transcript.length === 0) ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (savingSession || transcript.length === 0) ? 0.5 : 1 }}>
                {savingSession ? '⏳' : sessionSaved ? '✓' : '💾 Save'}
              </button>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: `${phaseColor}18`, border: `1px solid ${phaseColor}44`, borderRadius: '20px' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: phaseColor, animation: phase === 'active' && !paused ? 'pulse 1s infinite' : 'none' }} />
                <span style={{ color: phaseColor, fontSize: '10px', fontWeight: 'bold' }}>{paused ? '⏸ Paused' : phaseLabel}</span>
              </span>
            </div>

            {phase === 'active' && isRecording && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center', padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px' }}>
                <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>● REC</span>
                <span style={{ color: '#8a9ab8', fontSize: '10px' }}>Recording (24h retention)</span>
              </div>
            )}
            {recordingUrl && phase !== 'active' && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '4px' }}>
                <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold' }}>🎵 Recording ready</span>
                <a href={recordingUrl} target="_blank" rel="noopener noreferrer" download style={{ color: GOLD, fontSize: '10px', textDecoration: 'underline' }}>⬇ Download</a>
              </div>
            )}
            {ringPhase && <div style={{ marginTop: '6px', color: '#f59e0b', fontSize: '10px', textAlign: 'center', animation: 'pulse 0.8s infinite' }}>📞 Dialing BOB…</div>}
            {agentSpeaking && phase === 'active' && <div style={{ marginTop: '4px', color: GOLD, fontSize: '10px', textAlign: 'center' }}>🤖 Bob is speaking…</div>}
            {error && <div style={{ marginTop: '6px', color: '#ef4444', fontSize: '10px' }}>⚠ {error}</div>}
          </div>

          {/* Duck-Cow Slider */}
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...ls, marginBottom: 0 }}>Duck ←→ Cow Slider</label>
              <span style={{ color: sliderColor, fontSize: '12px', fontWeight: 'bold' }}>{sliderLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: '#ef4444', fontSize: '9px' }}>🦆 Hard</span>
              <span style={{ color: '#f59e0b', fontSize: '9px' }}>🦉 Hybrid</span>
              <span style={{ color: '#4ade80', fontSize: '9px' }}>🐄 Easy</span>
            </div>
            <input type="range" min={0} max={100} value={sliderValue} onChange={e => setSliderValue(Number(e.target.value))} style={{ width: '100%', accentColor: sliderColor, cursor: 'pointer' }} />
            <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>{getActivePersona().description}</div>

            <div style={{ marginTop: '10px' }}>
              <label style={{ ...ls, marginBottom: '5px' }}>Intensity (1=mild, 5=extreme)</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setIntensity(n)} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: `1px solid ${intensity === n ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: intensity === n ? `${GOLD}18` : 'transparent', color: intensity === n ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{n}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Scenario */}
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(251,146,60,0.2)', borderRadius: '6px', padding: '14px' }}>
            <div style={{ color: '#fb923c', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>🎭 Customer Scenario</div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {PRESET_SCENARIOS.map((p, i) => (
                <button key={i} onClick={() => setScenario(p.data)} style={{ padding: '5px 8px', borderRadius: '3px', border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)', color: '#fb923c', cursor: 'pointer', fontSize: '10px' }}>{p.label}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <div><label style={ls}>Total Debt $</label><input type="number" value={scenario.debtAmount} onChange={e => setScenario(p => ({ ...p, debtAmount: e.target.value }))} style={inp} /></div>
              <div><label style={ls}>Income $</label><input type="number" value={scenario.monthlyIncome} onChange={e => setScenario(p => ({ ...p, monthlyIncome: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ marginBottom: '6px' }}><label style={ls}>Creditors</label><input value={scenario.creditors} onChange={e => setScenario(p => ({ ...p, creditors: e.target.value }))} style={inp} /></div>
            <div><label style={ls}>Hardship Story</label><textarea value={scenario.hardship} onChange={e => setScenario(p => ({ ...p, hardship: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '8px 12px', textAlign: 'center', flex: 1 }}>
              <div style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold' }}>{callCount}</div>
              <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>Calls</div>
            </div>
            <div style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '8px 12px', textAlign: 'center', flex: 1 }}>
              <div style={{ color: PURPLE, fontSize: '16px', fontWeight: 'bold' }}>{kbEntries.length}</div>
              <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>KB Size</div>
            </div>
          </div>
        </div>

        {/* Right: Transcript */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📋 Transcript</div>
            <span style={{ color: '#6b7280', fontSize: '10px' }}>{transcript.length} lines · <span style={{ color: GOLD }}>{sessionId}</span></span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
            {transcript.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0', fontSize: '13px' }}>
                {phase === 'active' ? 'Listening… start speaking to BOB.' : phase === 'ringing' ? '📞 Dialing…' : phase === 'connecting' ? 'Connecting to Deepgram…' : 'No transcript yet. Click "Connect to BOB" to start a training call.'}
              </div>
            ) : transcript.map((msg, i) => {
              const isBob = msg.role === 'bob';
              return (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', justifyContent: isBob ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '85%', background: isBob ? 'rgba(16,185,129,0.1)' : 'rgba(96,165,250,0.1)', border: `1px solid ${isBob ? 'rgba(16,185,129,0.2)' : 'rgba(96,165,250,0.2)'}`, borderRadius: isBob ? '12px 12px 12px 2px' : '12px 12px 2px 12px', padding: '8px 12px' }}>
                    <div style={{ color: isBob ? GOLD : BLUE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>{isBob ? '🤖 BOB' : '🎙 You'}</div>
                    <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{msg.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Auto-popout: Q&A */}
      {showQA && (
        <FronterQAPopup username={username} onClose={() => setShowQA(false)} />
      )}

      {/* Auto-popout: Scripts */}
      {showScripts && (
        <FloatingScripts scripts={scripts} fronterFirstName={fronterFirstName} onClose={() => setShowScripts(false)} />
      )}
    </div>
  );
}

// ─── Floating Scripts Panel (auto-pops out on BOB connect) ──────────────────
function FloatingScripts({ scripts, fronterFirstName, onClose }) {
  const [activeScript, setActiveScript] = useState(null);
  const [pos, setPos] = useState({ x: 500, y: 60 });
  const [size, setSize] = useState({ w: 380, h: 480 });
  const dragRef = useRef(null);

  useEffect(() => {
    if (scripts.length > 0 && !activeScript) setActiveScript(scripts[0]);
  }, [scripts]);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      <div onMouseDown={onDragStart} style={{ padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
        <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 Scripts</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>×</button>
      </div>
      {scripts.length > 1 && (
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', flexShrink: 0 }}>
          {scripts.map(s => (
            <button key={s.id} onClick={() => setActiveScript(s)} style={{ padding: '6px 10px', background: 'none', border: 'none', borderBottom: `2px solid ${activeScript?.id === s.id ? GOLD : 'transparent'}`, color: activeScript?.id === s.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap', fontWeight: activeScript?.id === s.id ? 'bold' : 'normal' }}>{s.name}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {!activeScript ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No scripts yet.</div>
        ) : (
          <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>{substituteScriptVars(activeScript.content, { fronterFirstName })}</div>
        )}
      </div>
      <div onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onMove = (ev) => setSize({ w: Math.max(280, startW + ev.clientX - startX), h: Math.max(250, startH + ev.clientY - startY) });
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}