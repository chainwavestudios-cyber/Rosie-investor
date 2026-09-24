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
import AIAssistantPopup from '@/components/leads/AIAssistantPopup';
import DebtScriptEditor from '@/components/debt/DebtScriptEditor';
import DebtCreditReport from '@/components/debt/DebtCreditReport';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const VOICE_MODELS = [
  'flux-cliff-en', 'flux-miles-en', 'flux-drew-en', 'flux-bruce-en',
  'flux-wes-en', 'flux-marcus-en', 'flux-wade-en', 'flux-donovan-en',
  'flux-jack-en', 'flux-conor-en', 'flux-kit-en', 'flux-cole-en',
  'flux-hannah-en', 'flux-alexis-en', 'flux-sienna-en', 'flux-haley-en',
  'flux-brooke-en', 'flux-paige-en', 'flux-elise-en', 'flux-kelsey-en',
];
const FOCUS_TOPICS = ['General', 'The Program', 'How It Works', 'Credit Impact', 'Fees & Pricing', 'Timeline', 'Qualifying Debt Types', 'Creditor Negotiations', 'Enrollment Process'];

const PRESET_SCENARIOS = [
  { label: '😰 Overwhelmed', data: { customerName: 'Bob', customerAddress: '1428 Oak Ridge Dr', customerCity: 'Green Grove Springs', customerState: 'FL', customerZip: '32603', debtAmount: '35000', creditorCount: '5', creditors: 'Chase, Capital One, Discover, Amex, Citi', monthlyIncome: '3200', behindOnPayments: true, monthsBehind: '3', noticeNumber: 'N-4827', phone: '(352) 555-0142', hardship: 'I lost my job at the beginning of last year when the company downsized. I was out of work for about four months and had to rely on my credit cards to cover rent and groceries. Even after I found a new job, the interest rates had gone up so much that I am barely making minimum payments and the balances keep growing.' } },
  { label: '🤔 Skeptical', data: { customerName: 'Bob', customerAddress: '503 Bayshore Blvd', customerCity: 'Tampa', customerState: 'FL', customerZip: '33606', debtAmount: '15000', creditorCount: '3', creditors: 'Chase, Capital One, Discover', monthlyIncome: '4500', behindOnPayments: false, monthsBehind: '0', noticeNumber: 'N-7193', phone: '(813) 555-0188', hardship: 'I went through a divorce about a year ago and had to split everything up. My ex ran up some of the cards before we separated and I got stuck with the balances. Between legal fees and starting over on my own, I have not been able to get ahead of the interest.' } },
  { label: '📈 High Debt', data: { customerName: 'Bob', customerAddress: '742 Lakeview Pkwy', customerCity: 'Orlando', customerState: 'FL', customerZip: '32803', debtAmount: '75000', creditorCount: '8', creditors: 'Multiple creditors', monthlyIncome: '6000', behindOnPayments: true, monthsBehind: '2', noticeNumber: 'N-9051', phone: '(407) 555-0173', hardship: 'I had a medical emergency two years ago that required surgery and a hospital stay. Even with insurance, I was left with thousands in bills. I put medical expenses and living costs on credit cards while I was recovering and could not work. Now I am drowning in minimum payments.' } },
];
const DEBT_KB_CATEGORIES = ['debt_kb', 'debt_faq', 'debt_agent', 'debt_customer', 'debt_doc', 'debt_web', 'debt_call', 'debt_hotpoints', 'debt_disqualify'];

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
  const [scenario, setScenario] = useState({ customerName: 'Bob', customerAddress: '1428 Oak Ridge Dr', customerCity: 'Green Grove Springs', customerState: 'FL', customerZip: '32603', debtAmount: '35000', creditorCount: '5', creditors: 'Chase, Capital One, Discover, Amex, Citi', monthlyIncome: '3200', behindOnPayments: true, monthsBehind: '3', noticeNumber: 'N-4827', phone: '(352) 555-0142', hardship: 'I lost my job at the beginning of last year when the company downsized. I was out of work for about four months and had to rely on my credit cards to cover rent and groceries. Even after I found a new job, the interest rates had gone up so much that I am barely making minimum payments and the balances keep growing.' });
  const [callRefs, setCallRefs] = useState([]);
  const [selectedCallRefId, setSelectedCallRefId] = useState('');
  const [showAIPopup, setShowAIPopup] = useState(false);
  const [rightView, setRightView] = useState('transcript');
  const [panelPoppedOut, setPanelPoppedOut] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 200, y: 120 });
  const [panelSize, setPanelSize] = useState({ width: 520, height: 600 });
  const [panelDragging, setPanelDragging] = useState(false);
  const [panelResizing, setPanelResizing] = useState(false);
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
  const [qaActive, setQaActive] = useState(false);
  const [coachActive, setCoachActive] = useState(false);
  const [intentActive, setIntentActive] = useState(false);
  const [allKbEntries, setAllKbEntries] = useState([]);
  const [kbNames, setKbNames] = useState([]);
  const [selectedKbName, setSelectedKbName] = useState('Debt Settlement');
    const [mode, setMode] = useState('open'); // 'open' | 'close'
    const [closerName, setCloserName] = useState('Drew');
    const [objections, setObjections] = useState([]);
    const [openScenarios, setOpenScenarios] = useState([]);
    const [closeScenarios, setCloseScenarios] = useState([]);
    const [debtScripts, setDebtScripts] = useState([]);
    const aiTranscriptRef = useRef([]);

  // Load Deepgram API key from PortalSettings (shared with admin BobTab)
  useEffect(() => {
    base44.entities.PortalSettings.filter({ key: 'bob_controls_debt' })
      .then(rows => {
        if (rows?.length > 0 && rows[0].adminUsername) {
          try {
            const saved = JSON.parse(rows[0].adminUsername);
            if (saved.dgApiKey) setDgApiKey(saved.dgApiKey);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const transcriptRef = useRef([]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Normalize BOB transcript for AIAssistantPopup (speaker: 0=prospect/bob, 1=agent/trainee)
  const normalizedTranscript = transcript.map(e => ({ speaker: e.role === 'trainee' ? 1 : 0, text: e.text, time: e.time }));
  useEffect(() => { aiTranscriptRef.current = normalizedTranscript; }, [normalizedTranscript]);

  // Panel drag/resize handlers (when popped out)
  useEffect(() => {
    if (!panelDragging && !panelResizing) return;
    const handleMove = (e) => {
      if (panelDragging) {
        setPanelPos({
          x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - panelOffset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 50, e.clientY - panelOffset.y)),
        });
      }
      if (panelResizing) {
        setPanelSize({
          width: Math.max(350, e.clientX - panelPos.x),
          height: Math.max(300, e.clientY - panelPos.y),
        });
      }
    };
    const handleUp = () => { setPanelDragging(false); setPanelResizing(false); };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [panelDragging, panelResizing, panelOffset, panelPos]);

  // Load all KB entries for the popup
  useEffect(() => {
    base44.entities.KnowledgeBase.list('-created_date', 500).then(all => {
      const entries = all || [];
      setAllKbEntries(entries);
      setKbNames([...new Set(entries.map(e => e.kbName || '').filter(Boolean))]);
    }).catch(() => {});
  }, []);

  // Load reference calls (MP3 call recordings) for scenario selection
  useEffect(() => {
    base44.entities.KnowledgeBase.filter({ category: 'debt_call' }, '-created_date', 50)
      .then(entries => setCallRefs(entries || []))
      .catch(() => {});
  }, []);

  // Load KB entries from all debt categories
  const loadKB = useCallback(async () => {
    try {
      const all = await base44.entities.KnowledgeBase.list('-created_date', 500);
      const debt = (all || []).filter(e => e.kbName === 'Debt Settlement' || DEBT_KB_CATEGORIES.includes(e.category));
      setKbEntries(debt);
      setKbCount(debt.length);
      setObjections((all || []).filter(e => e.category === 'debt_objections'));
      setOpenScenarios((all || []).filter(e => e.category === 'debt_open_scenario'));
      setCloseScenarios((all || []).filter(e => e.category === 'debt_close_scenario'));
      const scripts = await base44.entities.DebtScript.list('-sortOrder', 100);
      setDebtScripts(scripts || []);
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

  const { phase, error, agentSpeaking, micDevices, micDeviceId, setMicDeviceId, ringPhase, transferPhase, startCall, hangup, isRecording, recordingUrl } = useDebtBobVoice({ onTranscript: handleTranscript, onLog: addLog });

  const getActivePersona = useCallback(() => {
    if (sliderValue < 33) return DEBT_DUCK;
    if (sliderValue < 67) return DEBT_OWL;
    return DEBT_COW;
  }, [sliderValue]);

  const buildSystemPrompt = useCallback(() => {
    const persona = getActivePersona();
    const kbText = kbEntries.slice(0, 15).map(e => {
      const ans = (e.answer || '').slice(0, 500);
      return `Q: ${e.question}\nA: ${ans}`;
    }).join('\n\n');
    const sliderLabel = sliderValue < 20 ? 'full Duck mode (hard sell — skeptical, resistant, stress-tests the closer)'
      : sliderValue < 40 ? 'Duck-leaning Owl (mostly resistant but will consider logic)'
      : sliderValue < 60 ? 'Owl/Hybrid (analytical, wants to understand the program)'
      : sliderValue < 80 ? 'Cow-leaning Owl (generally agreeable but checks logic)'
      : 'full Cow mode (easy sell — stressed, drowning in debt, relieved someone called)';

    // Objections — more for Duck, fewer for Cow
    const objCount = sliderValue < 33 ? objections.length : sliderValue < 67 ? Math.ceil(objections.length / 2) : Math.ceil(objections.length / 4);
    const objText = objections.slice(0, objCount).map(e => `🚫 "${e.question}" — Context: ${(e.answer || '').slice(0, 200)}`).join('\n');

    // Scenario roadmap
    const scenarioRoadmap = mode === 'open' ? openScenarios : closeScenarios;
    const roadmapText = scenarioRoadmap.map(e => `${e.question}: ${(e.answer || '').slice(0, 300)}`).join('\n');

    const scenarioText = (scenario.debtAmount || scenario.creditors || scenario.monthlyIncome || scenario.customerCity) ? `
━━━ CUSTOMER DEBT SCENARIO — ROLEPLAY WITH THESE DETAILS ━━━
- Name: ${scenario.customerName || 'Bob'}
- Location: ${[scenario.customerCity, scenario.customerState].filter(Boolean).join(', ') || 'unspecified'}
- Total Debt: $${scenario.debtAmount || 'unspecified'}
- Creditors: ${scenario.creditors || 'unspecified'} (${scenario.creditorCount || '?'} accounts)
- Monthly Income: $${scenario.monthlyIncome || 'unspecified'}
- Behind on Payments: ${scenario.behindOnPayments ? `Yes, ${scenario.monthsBehind || '?'} months behind` : 'No, current'}
- Notice Number: ${scenario.noticeNumber || 'N-4827'}
- Phone: ${scenario.phone || '(352) 555-0142'}
- Address: ${[scenario.customerAddress, scenario.customerCity, scenario.customerState, scenario.customerZip].filter(Boolean).join(', ') || 'unspecified'}
- Hardship Story: ${scenario.hardship || 'I lost my job last year and had to rely on credit cards. Even after finding new work, the interest rates keep me from getting ahead. I am barely making minimum payments and the balances keep growing.'}
- Use these details when discussing your financial situation. Be specific about amounts, creditors, notice number, phone, address, and hardship when asked.` : '';

    const modeText = mode === 'open' ? `
━━━ CALL TYPE: OPENING (INCOMING CALL — OPENER SCRIPT) ━━━
This is an INCOMING CALL — you (the customer) called Debt Advisors of America after receiving a NOTICE in the mail about your debt.
You are INTERESTED and cooperative — you called THEM for help. You are not hostile.
The receptionist has connected you to the debt specialist (trainee). The trainee will follow this script flow — respond to EACH step:

1. GREETING: "Hi, this is [Agent] from Debt Advisors. On a recorded line. Can I please have your notice number?"
   → Provide your notice number from the scenario.

2. INFO PULL: Agent explains 3 reasons for the notice (balance, interest rate increase, paying 12+ months). Asks which apply.
   → Confirm which apply to you honestly based on your debt situation.

3. IDENTITY: Agent asks you to grab pen/paper, gives their name/company/direct line. Asks to confirm your phone number.
   → Confirm your phone number. Say you're writing down their info.

4. DATA GATHERING: Agent asks about total debt, primary account holder, monthly payments, min vs more, balances decreasing, still using cards, payments difficult, savings, HARDSHIP cause.
   → Answer honestly from your scenario. For hardship, give your FULL 3+ sentence hardship story: what happened, when, how it impacted you financially.

5. CREDIT PULL: Agent asks for address, DOB, last 4 of SSN, permission for soft inquiry.
   → Provide the info. You MUST say "Yes" to give permission.

6. ACCOUNT REVIEW: Agent reviews each creditor (balance, limit, min payment). Asks if you pay min or more.
   → Confirm or correct each account honestly based on your creditors list.

7. BUDGET: Agent asks income after taxes and expenses (rent, auto, insurance, gas, groceries, utilities, phone, internet, student loans, misc).
   → Provide realistic estimates based on your monthly income.

8. HOLD: Agent says they'll review and submit for approval, puts you on brief hold.
   → Agree to hold. Say you'll keep pen and paper handy.

KEY: You called them. You want help. Provide your notice number, phone, debt details, hardship story, and budget info when asked. Even as a "Duck", you are cautious about personal info but still cooperative — you called for help.` : `
━━━ CALL TYPE: CLOSING (FOLLOW-UP CALL) ━━━
You already went through the opening process. The opener gathered your info and explained the program basics.
Now the closer (trainee) is calling to finalize and close you on the program.
The transfer agent (Chris from BAC) has introduced the closer to you as "our debt specialist."
You know about the program already — you're more engaged but still have questions about fees, timeline, and whether it really works.
Even as a "Duck", you're skeptical but hearing them out — you're closer to saying yes but need reassurance.`;

    const refCall = callRefs.find(r => r.id === selectedCallRefId);
    const refCallText = refCall ? `
━━━ REFERENCE CALL BEHAVIOR — LEARN FROM THIS REAL CALL ━━━
Q: ${refCall.question}
A: ${refCall.answer}
— Use this as reference for how a real customer in this situation behaves and reacts.` : '';

    return `${persona.systemPrompt}

${modeText}

━━━ CURRENT SESSION SETTINGS ━━━
- Call Mode: ${mode === 'open' ? 'OPENING (first contact)' : 'CLOSING (follow-up)'}
- Persona Blend: ${sliderLabel} (slider ${sliderValue}/100 — 0=full Duck/hard, 50=Owl, 100=full Cow/easy)
- Intensity: ${intensity}/5 (higher = more extreme character behavior)
- Call Focus Topic: "${focusTopic}" — steer objections and interest toward this topic
${scenarioText}${refCallText}

━━━ ${mode === 'open' ? 'OPEN' : 'CLOSE'} CALL ROADMAP — HOW THIS CALL SHOULD FLOW ━━━
${roadmapText || 'No scenario uploaded yet. Upload open/close call recordings to BOB\'s Brain to give BOB a roadmap.'}

━━━ OBJECTIONS TO USE (based on slider — more objections = harder sell) ━━━
${objText || 'No objections cataloged yet. Upload call recordings to BOB\'s Brain → Objections tab to catalog real customer objections.'}
Use these objections NATURALLY during the call. At lower slider values (Duck), use MORE of them. At higher values (Cow), use FEWER.

━━━ DEBT SETTLEMENT KNOWLEDGE BASE — LEARNED FROM REAL CALLS ━━━
${kbText || 'No KB entries yet. Upload calls, documents, and websites to BOB\'s Brain to make BOB smarter and more realistic.'}

━━━ CUSTOMER QUESTIONS — ASK THE AGENT PERIODICALLY ━━━
You are a REAL customer with questions. Periodically ASK the agent questions during the call. Space them out naturally — don't rapid-fire. Ask one, wait for the answer, then continue the conversation.

Number of questions to ask during this call: ${intensity <= 1 ? '1-2' : intensity === 2 ? '2-3' : intensity === 3 ? '3-5' : intensity === 4 ? '5-7' : '7-10'} (based on intensity ${intensity}/5)
${focusTopic === 'General' ? `Ask questions spanning ALL topics randomly: ${FOCUS_TOPICS.filter(t => t !== 'General').join(', ')}` : `Focus your questions on the topic: "${focusTopic}"`}

Questions from the Knowledge Base (customer Q&A):
${kbEntries.filter(e => e.category === 'debt_customer' || e.category === 'debt_faq' || e.category === 'debt_kb').slice(0, 20).map((e, i) => `${i + 1}. ${e.question}`).join('\n') || 'No customer Q&A uploaded yet. Upload to BOB\'s Brain to add real customer questions.'}

Questions from Scripts:
${(debtScripts || []).slice(0, 15).map((s, i) => `${i + 1}. ${s.name}`).join('\n') || 'No scripts uploaded yet.'}

Hotpoint Topics — occasionally bring these up or ask about them during the call:
${kbEntries.filter(e => e.category === 'debt_hotpoints').slice(0, 15).map((hp, i) => `${i + 1}. ${hp.question}`).join('\n') || 'No hotpoints uploaded yet.'}

Disqualification Topics — occasionally bring up something related to these (e.g., mention a bankruptcy, lawsuit, or income issue). This tests whether the agent catches the disqualification:
${kbEntries.filter(e => e.category === 'debt_disqualify').slice(0, 15).map((d, i) => `${i + 1}. ${d.question}`).join('\n') || 'No disqualification Q&A uploaded yet.'}

IMPORTANT: Ask these questions NATURALLY during the call. Weave them into the conversation — don't read them like a list. Space them out every 30-60 seconds. Pick from the list above based on what's being discussed. If the focus is General, pick from ANY topic. If a specific topic is set, pick questions related to that topic.

━━━ CRITICAL RULES ━━━
- You are a REAL PERSON on a phone call. Keep ALL responses 1-3 sentences.
- Never say you are an AI. Never break character.
- Use natural speech: contractions, interruptions, "uh", "look", "listen", "I mean" — real people talk like this.
- React to what the trainee actually says — improvise within your persona, don't just recite lines.
- Use the KNOWLEDGE BASE above to inform your responses — if the closer mentions program details, fees, or timelines that match the KB, react realistically based on what you know.`;
  }, [sliderValue, intensity, focusTopic, kbEntries, getActivePersona, scenario, callRefs, selectedCallRefId, mode, objections, openScenarios, closeScenarios, debtScripts]);

  const handleStartCall = useCallback(async () => {
    const newCount = callCount + 1;
    setCallCount(newCount);
    const label = newCount === 1 ? 'Bob' : `Bob${newCount - 1}`;
    setSessionId(label);
    setTranscript([]);
    const vIdx = (newCount - 1) % VOICE_MODELS.length;
    setVoiceModel(VOICE_MODELS[vIdx]);

    // Use the same key as the admin BobTab — the hardcoded Voice Agent key works there
    const apiKey = dgApiKey || '44294c0c2f0ebbcc81b853151056111226b853e9';
    console.log('[BOB] Using Deepgram key prefix:', apiKey.slice(0, 8) + '...');
    const greetings = ['Hello.', 'Hello?', 'Hello, this is Bob.', 'Yeah?', 'Hello, go ahead.'];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    await startCall({ apiKey, systemPrompt: buildSystemPrompt(), voiceModel: VOICE_MODELS[vIdx], greeting, sessionLabel: label, mode, closerName, scenario });
  }, [callCount, startCall, buildSystemPrompt, dgApiKey, mode, closerName, scenario]);

  const sliderLabel = sliderValue < 20 ? '🦆 Full Duck' : sliderValue < 40 ? '🦆 Duck-Owl' : sliderValue < 60 ? '🦉 Owl (Hybrid)' : sliderValue < 80 ? '🐄 Owl-Cow' : '🐄 Full Cow';
  const sliderColor = sliderValue < 33 ? '#ef4444' : sliderValue < 67 ? '#f59e0b' : '#4ade80';
  const phaseColor = { idle: '#4a5568', ringing: '#f59e0b', transfer: '#60a5fa', connecting: '#f59e0b', active: '#4ade80', error: '#ef4444' }[phase] || '#4a5568';
  const phaseLabel = { idle: 'Idle', ringing: '📳 Ringing…', transfer: '📋 Transfer…', connecting: 'Connecting…', active: '🔴 LIVE', error: 'Error' }[phase] || phase;

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
        <>
        <div style={{ display: 'grid', gridTemplateColumns: panelPoppedOut ? '380px' : '380px 1fr', gap: '16px', alignItems: 'start' }}>
          {/* Left: Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Mode selector — Open vs Close */}
            <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Call Mode</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setMode('open')} disabled={phase !== 'idle'} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: `1px solid ${mode === 'open' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: mode === 'open' ? `${GOLD}18` : 'transparent', color: mode === 'open' ? GOLD : '#6b7280', cursor: phase !== 'idle' ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>📞 Open Training</button>
                <button onClick={() => setMode('close')} disabled={phase !== 'idle'} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: `1px solid ${mode === 'close' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: mode === 'close' ? `${GOLD}18` : 'transparent', color: mode === 'close' ? GOLD : '#6b7280', cursor: phase !== 'idle' ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>🎯 Close Training</button>
              </div>
              <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px' }}>{mode === 'open' ? 'First contact — customer calls in, opener transfers to closer.' : 'Follow-up — customer already knows the program, closer finalizes.'}</div>
            </div>

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

              {/* Closer name — used by transfer agent to introduce you */}
              <div style={{ marginBottom: '12px' }}>
                <label style={ls}>👤 Your Name (Closer)</label>
                <input value={closerName} onChange={e => setCloserName(e.target.value)} disabled={phase !== 'idle'} placeholder="Drew" style={inp} />
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
              {ringPhase && <div style={{ marginTop: '8px', color: '#f59e0b', fontSize: '11px', textAlign: 'center', animation: 'pulse 0.8s infinite' }}>📞 Dialing… (ringing twice, then transfer agent connects)</div>}
              {transferPhase && <div style={{ marginTop: '8px', color: '#60a5fa', fontSize: '11px', textAlign: 'center', animation: 'pulse 1s infinite' }}>📋 Transfer agent speaking… {mode === 'open' ? 'Jocelyn is introducing Bob' : 'Chris is connecting you with Bob'}</div>}
              {agentSpeaking && phase === 'active' && <div style={{ marginTop: '6px', color: GOLD, fontSize: '11px', textAlign: 'center' }}>🤖 Bob is speaking…</div>}
              {error && <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '11px' }}>⚠ {error}</div>}

              {/* AI Assistant button — opens popup */}
              <button onClick={() => setShowAIPopup(true)} style={{ width: '100%', marginTop: '10px', background: showAIPopup ? 'rgba(74,222,128,0.15)' : `${GOLD}18`, color: showAIPopup ? '#4ade80' : GOLD, border: `1px solid ${showAIPopup ? 'rgba(74,222,128,0.3)' : GOLD + '44'}`, borderRadius: '4px', padding: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {showAIPopup ? '🟢 AI Assistant Active' : '🤖 Open AI Assistant'}
              </button>
              <div style={{ color: '#4a5568', fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>Q&A, Coach, Intent — uses Deepgram audio stream</div>
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

            {/* Scenario Config */}
            <div style={{ background: '#0d1b2a', border: '1px solid rgba(251,146,60,0.2)', borderRadius: '6px', padding: '16px' }}>
              <div style={{ color: '#fb923c', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🎭 Customer Scenario</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {PRESET_SCENARIOS.map((p, i) => (
                  <button key={i} onClick={() => setScenario(p.data)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)', color: '#fb923c', cursor: 'pointer', fontSize: '11px' }}>{p.label}</button>
                ))}
                <button onClick={() => setScenario({ customerName: 'Bob', customerAddress: '', customerCity: '', customerState: '', customerZip: '', debtAmount: '', creditorCount: '', creditors: '', monthlyIncome: '', behindOnPayments: false, monthsBehind: '', noticeNumber: '', phone: '', hardship: '' })} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: '11px' }}>Clear</button>
              </div>
              <div style={{ marginBottom: '8px' }}><label style={ls}>Customer Name</label><input value={scenario.customerName} onChange={e => setScenario(p => ({ ...p, customerName: e.target.value }))} placeholder="Bob" style={inp} /></div>
              <div style={{ marginBottom: '8px' }}><label style={ls}>Street Address</label><input value={scenario.customerAddress} onChange={e => setScenario(p => ({ ...p, customerAddress: e.target.value }))} placeholder="1428 Oak Ridge Dr" style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><label style={ls}>City</label><input value={scenario.customerCity} onChange={e => setScenario(p => ({ ...p, customerCity: e.target.value }))} placeholder="Green Grove Springs" style={inp} /></div>
                <div><label style={ls}>State</label><input value={scenario.customerState} onChange={e => setScenario(p => ({ ...p, customerState: e.target.value }))} placeholder="FL" style={inp} /></div>
              </div>
              <div style={{ marginBottom: '8px' }}><label style={ls}>Zip</label><input value={scenario.customerZip} onChange={e => setScenario(p => ({ ...p, customerZip: e.target.value }))} placeholder="32603" style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><label style={ls}>Total Debt $</label><input type="number" value={scenario.debtAmount} onChange={e => setScenario(p => ({ ...p, debtAmount: e.target.value }))} placeholder="25000" style={inp} /></div>
                <div><label style={ls}>Creditors #</label><input type="number" value={scenario.creditorCount} onChange={e => setScenario(p => ({ ...p, creditorCount: e.target.value }))} placeholder="4" style={inp} /></div>
              </div>
              <div style={{ marginBottom: '8px' }}><label style={ls}>Creditor Names</label><input value={scenario.creditors} onChange={e => setScenario(p => ({ ...p, creditors: e.target.value }))} placeholder="Chase, Capital One, Discover" style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><label style={ls}>Monthly Income $</label><input type="number" value={scenario.monthlyIncome} onChange={e => setScenario(p => ({ ...p, monthlyIncome: e.target.value }))} placeholder="3500" style={inp} /></div>
                <div><label style={ls}>Months Behind</label><input type="number" value={scenario.monthsBehind} onChange={e => setScenario(p => ({ ...p, monthsBehind: e.target.value }))} placeholder="2" style={inp} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '10px' }}>
                <input type="checkbox" checked={scenario.behindOnPayments} onChange={e => setScenario(p => ({ ...p, behindOnPayments: e.target.checked }))} style={{ accentColor: '#fb923c' }} />
                <span style={{ color: '#c4cdd8', fontSize: '12px' }}>Behind on payments</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><label style={ls}>Notice #</label><input value={scenario.noticeNumber} onChange={e => setScenario(p => ({ ...p, noticeNumber: e.target.value }))} placeholder="N-4827" style={inp} /></div>
                <div><label style={ls}>Phone</label><input value={scenario.phone} onChange={e => setScenario(p => ({ ...p, phone: e.target.value }))} placeholder="(352) 555-0142" style={inp} /></div>
              </div>
              <div style={{ marginBottom: '8px' }}><label style={ls}>Hardship Story (3+ sentences)</label><textarea value={scenario.hardship} onChange={e => setScenario(p => ({ ...p, hardship: e.target.value }))} placeholder="What happened, when, and how it impacted you financially" style={{ ...inp, resize: 'vertical', minHeight: '60px' }} /></div>
              {callRefs.length > 0 && (
                <div>
                  <label style={ls}>📖 Reference Call (learn from real customer)</label>
                  <select value={selectedCallRefId} onChange={e => setSelectedCallRefId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">— None —</option>
                    {callRefs.map(r => <option key={r.id} value={r.id}>{r.question?.slice(0, 60)}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Right: Transcript */}
          <div style={panelPoppedOut ? { position: 'fixed', left: panelPos.x, top: panelPos.y, width: panelSize.width, height: panelSize.height, zIndex: 9998, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' } : { background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh' }}>
            <div onMouseDown={panelPoppedOut ? (e) => { setPanelDragging(true); setPanelOffset({ x: e.clientX - panelPos.x, y: e.clientY - panelPos.y }); } : undefined} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: panelPoppedOut ? 'move' : 'default', userSelect: panelPoppedOut ? 'none' : 'auto' }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button onClick={() => setRightView('transcript')} style={{ padding: '4px 12px', background: rightView === 'transcript' ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: `2px solid ${rightView === 'transcript' ? GOLD : 'transparent'}`, color: rightView === 'transcript' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: rightView === 'transcript' ? 'bold' : 'normal', letterSpacing: '1px', textTransform: 'uppercase' }}>📋 Transcript</button>
                <button onClick={() => setRightView('scripts')} style={{ padding: '4px 12px', background: rightView === 'scripts' ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: `2px solid ${rightView === 'scripts' ? GOLD : 'transparent'}`, color: rightView === 'scripts' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: rightView === 'scripts' ? 'bold' : 'normal', letterSpacing: '1px', textTransform: 'uppercase' }}>📝 Scripts</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '10px' }}>{rightView === 'transcript' ? <>{transcript.length} lines · <span style={{ color: GOLD }}>{sessionId}</span></> : 'Debt Call Coach Scripts'}</span>
                <button onClick={() => { if (!panelPoppedOut) { setPanelPos({ x: Math.max(200, window.innerWidth - 560), y: 120 }); setPanelSize({ width: 520, height: Math.min(600, window.innerHeight - 160) }); } setPanelPoppedOut(!panelPoppedOut); }} style={{ background: panelPoppedOut ? `${GOLD}18` : 'rgba(255,255,255,0.05)', border: `1px solid ${panelPoppedOut ? GOLD + '44' : 'rgba(255,255,255,0.1)'}`, color: panelPoppedOut ? GOLD : '#8a9ab8', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{panelPoppedOut ? '⬇ Pop In' : '⬆ Pop Out'}</button>
              </div>
            </div>
            {rightView === 'scripts' ? (
              <div style={{ flex: 1, overflow: 'hidden', padding: '14px 16px' }}>
                <DebtScriptEditor />
              </div>
            ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              {transcript.length === 0 ? (
                <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0', fontSize: '13px' }}>
                  {phase === 'active' ? 'Listening… start speaking to BOB.' : phase === 'ringing' ? '📞 Dialing…' : phase === 'transfer' ? '📋 Transfer agent is connecting the call…' : phase === 'connecting' ? 'Connecting to Deepgram…' : 'No transcript yet. Click "Connect to BOB" to start a training call.'}
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
            )}
          {panelPoppedOut && (
            <div onMouseDown={(e) => { e.stopPropagation(); setPanelResizing(true); }} style={{ position: 'absolute', bottom: 0, right: 0, width: '18px', height: '18px', cursor: 'nwse-resize', color: '#4a5568', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '2px', fontSize: '10px', userSelect: 'none' }}>⤡</div>
          )}
          </div>
        </div>

        {/* AI Assistant Popup — draggable, resizable, same as admin panel */}
        {showAIPopup && (
          <AIAssistantPopup
            lead={null}
            transcript={normalizedTranscript}
            transcriptRef={aiTranscriptRef}
            kbEntries={kbEntries}
            portalCfg={{}}
            engagementScore={0}
            qaActive={qaActive}
            coachActive={coachActive}
            intentActive={intentActive}
            onToggleQA={() => setQaActive(p => !p)}
            onToggleCoach={() => setCoachActive(p => !p)}
            onToggleIntent={() => setIntentActive(p => !p)}
            onClose={() => setShowAIPopup(false)}
            onIntentResult={() => {}}
            onQALog={() => {}}
            onCoachTip={() => {}}
            kbName={selectedKbName || ''}
            allKbEntries={allKbEntries}
            kbNames={kbNames}
            selectedKbName={selectedKbName}
            onKbChange={setSelectedKbName}
            activeScript={null}
            scripts={[]}
            callAttemptNumber={callCount}
            previousCallSummary={null}
          />
        )}
        </>
      )}

      {/* BOB's Brain */}
      {subTab === 'brain' && <DebtBobKB onKBUpdated={loadKB} />}

      {/* Training Log */}
      {subTab === 'log' && <TrainingLog logs={logs} recordingUrl={recordingUrl} onClear={() => { if (window.confirm('Clear all logs?')) setLogs([]); }} />}

      <DebtCreditReport scenario={scenario} visible={phase === 'active'} />
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