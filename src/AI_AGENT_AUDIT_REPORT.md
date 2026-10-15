# AI Voice Agent — Full Audit Report

This report documents every file, data flow, and piece of logic that powers the **AI Voice Agent** (the automated outbound dialing + live conversation system). It is written for a code audit: every component, backend function, entity, shared helper, and external service involved is listed, summarized, and — where it matters — quoted in full.

---

## 1. Overview — What the AI Voice Agent Does

The AI Voice Agent is an automated phone agent ("Alex") that:

1. **Dials leads** from a CSV or manual entry.
2. **Speaks a scripted greeting** when the prospect answers.
3. **Holds a live conversation** following a strict 4-step debt-relief script (intro → qualification → debt breakdown → transfer).
4. **Transcribes the prospect's speech** in real time (Deepgram streaming STT).
5. **Generates responses** via an LLM (Claude/GPT/Gemini via platform InvokeLLM).
6. **Speaks responses aloud** via TTS (ElevenLabs preferred, Deepgram Aura fallback).
7. **Transfers qualified prospects** to a senior advisor, sends a credentials email, and saves a transcript.
8. **Ends calls** for unqualified/not-interested prospects with a disposition.

The system uses a **3-tier architecture** to separate real-time audio from business logic:

| Tier | Where | Responsibility |
|---|---|---|
| **Transport** | Render WS Bridge (`render-ws-bridge/server.js`) | Twilio Media Stream WebSocket, Deepgram STT, TTS generation, playback queue, barge-in |
| **Business Logic** | `mediaStreamRelay` (Base44 function) | Config/lead loading, LLM inference, transfer execution, transcript persistence, disposition |
| **Call Control** | `dialerVoiceHandler` + `aiAgentDial` (Base44 functions) | TwiML generation, outbound dialing, call-hours enforcement, status callbacks |

---

## 2. File Inventory

Every file involved in the AI Voice Agent:

| File | Role |
|---|---|
| `render-ws-bridge/server.js` | **External WebSocket bridge** — Twilio Media Stream, Deepgram STT, TTS, playback |
| `render-ws-bridge/Dockerfile` | Container build for the bridge |
| `render-ws-bridge/render.yaml` | Render deployment blueprint |
| `render-ws-bridge/package.json` | Bridge npm dependencies |
| `base44/functions/mediaStreamRelay/entry.ts` | **Business logic relay** — init, turn, transfer, end_call, stop handlers |
| `base44/functions/dialerVoiceHandler/entry.ts` | **TwiML generator** — AI agent connect, transfer, end call, direct dial, inbound |
| `base44/functions/aiAgentDial/entry.ts` | **Outbound dialer** — creates leads, places Twilio calls, status callbacks |
| `base44/functions/bridgeKeepalive/entry.ts` | Pings the bridge /health endpoint to prevent Render free-tier spin-down |
| `base44/shared/aiAgentHelpers.ts` | Shared helpers — debt extraction, contact extraction, email, transfer prep, system prompt |
| `base44/shared/aiVoiceMap.ts` | Maps TTS voice IDs to Twilio Polly voices (fallback only) |
| `base44/shared/twilioVoiceParams.ts` | Reads both form POST and JSON request params |
| `base44/shared/twilioHelpers.ts` | Twilio API fetch helper, E.164 conversion, XML escape |
| `base44/shared/phoneTimeZone.ts` | Call-hours cutoff (8am–8pm local time) |
| `base44/shared/callCutoffOverride.ts` | Validates override tokens for test calls |
| `base44/shared/llmHelper.ts` | `callLLM()` helper used by aiAgentHelpers |
| `base44/entities/AIAgentConfig.jsonc` | **Config entity** — singleton config for the agent |
| `base44/entities/FronterLead.jsonc` | Lead entity (created/updated by the agent) |
| `base44/entities/FronterCallTranscript.jsonc` | Transcript entity (saved on call stop) |
| `src/components/fronter/AIAgentDialer.jsx` | **Dialer UI** — CSV upload, manual dial, queue management |
| `src/components/fronter/FronterMonitorAIAgent.jsx` | **Monitor card** — live status, config display, activate/deactivate |
| `src/components/fronter/aiagent/AIAgentLiveConfig.jsx` | Live config display (model, voice, transfer targets) |
| `src/components/fronter/aiagent/AIAgentVoiceSection.jsx` | Voice/STT/TTS/LLM config controls |
| `src/components/fronter/aiagent/AIAgentTelephonySection.jsx` | Telephony config (line, transfer numbers, timeout) |
| `src/components/fronter/aiagent/AIAgentKnowledgeSection.jsx` | KB selection (primary/secondary) |
| `src/components/fronter/aiagent/AIAgentPromptSection.jsx` | System prompt, script flow, rebuttals, Q&A tuning editors |
| `base44/workflows/Bridge Keepalive.jsonc` | Scheduled workflow calling bridgeKeepalive every 10 min |

---

## 3. Architecture — End-to-End Data Flow

```
  ┌──────────────────────────────────────────────────────────────────┐
  │  ADMIN UI (AIAgentDialer.jsx)                                     │
  │                                                                   │
  │  CSV upload / manual dial → base44.functions.invoke('aiAgentDial') │
  └───────────────────────────┬──────────────────────────────────────┘
                              │  SDK call
  ┌───────────────────────────▼──────────────────────────────────────┐
  │  aiAgentDial (backend function)                                   │
  │                                                                   │
  │  1. Validate phone (E.164)                                        │
  │  2. checkCallCutoff (8am-8pm local time)                          │
  │  3. Load AIAgentConfig → get twilioLineKey                        │
  │  4. Create/update FronterLead prospect card                       │
  │  5. Twilio API: POST /Calls.json                                  │
  │     Url = dialerVoiceHandler?Mode=aiAgent&LeadId=...              │
  │     StatusCallback = aiAgentDial?callStatus=1                     │
  └───────────────────────────┬──────────────────────────────────────┘
                              │  Twilio places the call
  ┌───────────────────────────▼──────────────────────────────────────┐
  │  dialerVoiceHandler (backend function) — Mode=aiAgent             │
  │                                                                   │
  │  1. Load AIAgentConfig + FronterLead                               │
  │  2. Substitute {{first_name}} etc. in greeting                    │
  │  3. Read WS_BRIDGE_URL + STREAM_AUTH_TOKEN from secrets           │
  │  4. Return TwiML:                                                 │
  │     <Connect><Stream url="wss://bridge/ws">                       │
  │       <Parameter name="leadId" />                                  │
  │       <Parameter name="streamToken" />                             │
  │     </Stream></Connect>                                            │
  │     <Redirect>retry URL (max 2 retries)</Redirect>                 │
  └───────────────────────────┬──────────────────────────────────────┘
                              │  Twilio opens WebSocket to bridge
  ┌───────────────────────────▼──────────────────────────────────────┐
  │  Render WS Bridge (server.js)                                      │
  │                                                                   │
  │  1. WebSocket connection from Twilio                              │
  │  2. Validate STREAM_AUTH_TOKEN in start.customParameters          │
  │  3. Open Deepgram streaming STT (nova-2, mulaw 8kHz)              │
  │  4. POST { event: "init" } → mediaStreamRelay                    │
  │     ← { greeting, ttsEngine, ttsVoiceModel, llmModel }            │
  │  5. Generate TTS for greeting (ElevenLabs/Deepgram)               │
  │  6. Play audio to Twilio (media + mark events)                    │
  │                                                                   │
  │  LOOP:                                                            │
  │  7. Receive inbound audio → forward to Deepgram                   │
  │  8. Deepgram speech_final → POST { event: "turn", transcript }   │
  │     ← { action: "speak"|"transfer"|"end_call", text }             │
  │  9. If "speak": generate TTS → play (with barge-in tracking)      │
  │ 10. If "transfer": POST { event: "transfer" } → relay             │
  │ 11. If "end_call": POST { event: "end_call" } → relay             │
  │                                                                   │
  │  ON STOP/CLOSE:                                                    │
  │ 12. POST { event: "stop", conversation, recordingBase64 }        │
  └───────────────────────────┬──────────────────────────────────────┘
                              │  HTTP POST (APP_AUTH_TOKEN)
  ┌───────────────────────────▼──────────────────────────────────────┐
  │  mediaStreamRelay (backend function)                              │
  │                                                                   │
  │  init:    Load AIAgentConfig + FronterLead → return greeting       │
  │  turn:    Load config + lead → InvokeLLM → { action, text }       │
  │           Deterministic $10k debt check overrides transfer        │
  │  transfer: prepareTransfer() → extract debt/contact,             │
  │             send credentials email, generate summary,             │
  │             update lead, play TTS, redirect Twilio call           │
  │  end_call: Update lead disposition, play goodbye TTS,             │
  │             redirect Twilio to hangup TwiML                       │
  │  stop:    Upload recording (stored privately),                    │
  │             save transcript to FronterCallTranscript (idempotent)  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 4. The Render WS Bridge (`render-ws-bridge/server.js`)

**File:** `render-ws-bridge/server.js`

This is an external Node.js service deployed on Render. It owns **all real-time audio**: the Twilio Media Stream WebSocket, Deepgram streaming STT, TTS generation, and the playback queue.

### 4.1 Configuration (lines 28-53)

```js
const PORT = Number(process.env.PORT || 10000);
const WS_PATH = process.env.WS_PATH || '/ws';
const APP_WEBHOOK_URL = process.env.APP_WEBHOOK_URL || '';
const APP_AUTH_TOKEN = process.env.APP_AUTH_TOKEN || '';
const STREAM_AUTH_TOKEN = process.env.STREAM_AUTH_TOKEN || '';
const PLAY_AUTH_TOKEN = process.env.PLAY_AUTH_TOKEN || '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const TTS_ENGINE = process.env.TTS_ENGINE || 'elevenlabs';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const DEEPGRAM_TTS_VOICE = process.env.DEEPGRAM_TTS_VOICE || 'aura-2-thalia-en';
const DEEPGRAM_STT_MODEL = process.env.DEEPGRAM_STT_MODEL || 'nova-2';
```

### 4.2 Fail-Closed Production Check (lines 55-66)

In production, the bridge refuses to start without required secrets:

```js
if (NODE_ENV === 'production') {
  const missing = [];
  if (!STREAM_AUTH_TOKEN) missing.push('STREAM_AUTH_TOKEN');
  if (!PLAY_AUTH_TOKEN) missing.push('PLAY_AUTH_TOKEN');
  if (!APP_WEBHOOK_URL) missing.push('APP_WEBHOOK_URL');
  if (!DEEPGRAM_API_KEY) missing.push('DEEPGRAM_API_KEY');
  if (missing.length) {
    console.error('[bridge] FATAL: missing required secrets:', missing.join(', '));
    process.exit(1);
  }
}
```

### 4.3 Three Auth Boundaries (lines 39-44, 96-112, 134-143)

The bridge enforces **three separate trust boundaries** that are never mixed:

1. **STREAM_AUTH_TOKEN** — Twilio → Bridge: validated in `start.customParameters`. If missing/mismatched, the WebSocket is closed with code 1008.
2. **APP_AUTH_TOKEN** — Bridge → Relay: Bearer header on every HTTP POST to `mediaStreamRelay`.
3. **PLAY_AUTH_TOKEN** — Relay → Bridge `/play`: Bearer header on every playback request.

The stream token is never forwarded to the app backend or logged.

### 4.4 WebSocket Connection Handler (lines 130-180)

On connection:
- A 5-second auth timer closes the socket if no valid `start` event arrives.
- `ws.isAlive` + ping/pong keepalive (30s interval).
- On `start`: validates `streamSid`, `callSid`, and `streamToken`; calls `handleStreamStart()`.
- On `media` (inbound track): forwards audio to Deepgram via `handleInboundAudio()`.
- On `mark`: marks playback complete, resumes listening state.
- On `stop`: calls `handleStreamStop()` (idempotent).

### 4.5 Stream Session State (lines 182-210)

Each stream session holds:

```js
const session = {
  ws,                    // Twilio WebSocket
  callSid,
  leadId,
  dgWs: null,            // Deepgram WebSocket
  generation: 0,         // increments on each AI response (barge-in tracking)
  state: 'listening',    // listening | thinking | speaking
  conversation: [],       // [{ role: 'user'|'assistant', content }]
  recordingBuffer: [],    // base64 mulaw audio chunks
  eventQueue: Promise.resolve(),  // serialized event delivery
  startedAt: Date.now(),
  stopping: false,
  config: {},
};
```

### 4.6 Init → Greeting (lines 182-210)

On stream start, the bridge:
1. Opens Deepgram STT in parallel.
2. POSTs `{ event: "init", streamSid, callSid, leadId }` to `mediaStreamRelay`.
3. Receives `{ greeting, ttsEngine, ttsVoiceModel, llmModel }`.
4. Generates TTS for the greeting and plays it.

```js
async function handleStreamStart(ws, streamSid, start) {
  // ... create session ...
  openDeepgram(session, streamSid);
  try {
    const initResp = await callRelay({ event: 'init', streamSid, callSid: start.callSid, leadId });
    session.config = {
      ttsEngine: initResp.ttsEngine || TTS_ENGINE,
      ttsVoiceModel: initResp.ttsVoiceModel || '',
      llmModel: initResp.llmModel || 'claude-sonnet-5',
    };
    if (initResp.greeting) {
      session.conversation.push({ role: 'assistant', content: initResp.greeting });
      session.state = 'speaking';
      session.generation++;
      const gen = session.generation;
      const tts = await generateTTS(initResp.greeting, session.config);
      if (tts && session.generation === gen) {
        session.recordingBuffer.push(tts);
        playAudio(streamSid, tts, gen);
      }
    }
  } catch (e) { log('init failed', e?.message); }
}
```

### 4.7 Deepgram Streaming STT (lines 227-270)

Opens a WebSocket to Deepgram with: `model=nova-2`, `encoding=mulaw`, `sample_rate=8000`, `channels=1`, `interim_results=true`, `endpointing=300`, `vad_events=true`.

On `Results`:
- **Barge-in:** if `vad.speech_start` fires while `state === 'speaking'`, increments `generation` (invalidating current playback), sends `clear` to Twilio, and returns to `listening`.
- **Speech final:** if `speech_final` and `state === 'listening'`, calls `handleUtterance()`.

### 4.8 Utterance → LLM → TTS → Playback (lines 272-320)

```js
async function handleUtterance(streamSid, transcript) {
  const session = streams.get(streamSid);
  session.state = 'thinking';
  session.conversation.push({ role: 'user', content: transcript });

  const resp = await callRelay({
    event: 'turn',
    streamSid,
    callSid: session.callSid,
    transcript,
    conversation: session.conversation.slice(-20),  // window: last 20 messages
    leadId: session.leadId,
  });

  const { action, text, disposition } = resp;
  session.conversation.push({ role: 'assistant', content: text || '' });

  if (action === 'transfer') {
    await callRelay({ event: 'transfer', streamSid, callSid, conversation, leadId });
    return;
  }
  if (action === 'end_call') {
    await callRelay({ event: 'end_call', streamSid, callSid, disposition, leadId });
    return;
  }
  // action === 'speak'
  if (text) {
    session.state = 'speaking';
    session.generation++;
    const gen = session.generation;
    const tts = await generateTTS(text, session.config);
    if (tts && session.generation === gen) {
      session.recordingBuffer.push(tts);
      playAudio(streamSid, tts, gen);
    }
  }
}
```

### 4.9 TTS Generation (lines 322-380)

**ElevenLabs (preferred)** — produces μ-law 8kHz directly:
```js
const res = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=ulaw_8000`,
  { method: 'POST', headers: { 'xi-api-key': ELEVENLABS_API_KEY, ... },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    signal: AbortSignal.timeout(10000) });
```

**Deepgram Aura (fallback)** — μ-law 8kHz:
```js
const res = await fetch(
  `https://api.deepgram.com/v1/speak?model=${voice}&encoding=mulaw&sample_rate=8000&container=none`,
  { method: 'POST', headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, ... }, body: text, ... });
```

### 4.10 Playback with Barge-In Prevention (lines 382-395)

```js
function playAudio(streamSid, audioBase64, generation) {
  const session = streams.get(streamSid);
  if (!session) return;
  if (generation !== session.generation) return;  // drop stale audio (barge-in)
  sendToTwilio(session.ws, { event: 'clear', streamSid });      // clear queue
  sendToTwilio(session.ws, { event: 'media', streamSid, media: { payload: audioBase64 } });
  sendToTwilio(session.ws, { event: 'mark', streamSid, mark: { name: `gen-${generation}` } });
}
```

### 4.11 Stop → Recording + Transcript (lines 100-128, 397-420)

On stream stop (idempotent via `session.stopping`):
1. Close Deepgram (flush final results).
2. Join `recordingBuffer` into a single base64 string.
3. POST `{ event: "stop", conversation, recordingBase64, leadId }` to relay.

---

## 5. Business Logic: `mediaStreamRelay`

**File:** `base44/functions/mediaStreamRelay/entry.ts`

This is the Base44 backend function that owns all business logic. It receives events from the bridge via HTTP POST.

### 5.1 Auth (lines 136-143)

Fail-closed: rejects if `WS_BRIDGE_AUTH_TOKEN` is set and the Bearer header doesn't match:

```js
const authToken = secrets.get('WS_BRIDGE_AUTH_TOKEN') || '';
if (authToken) {
  const auth = req.headers.get('Authorization') || '';
  if (auth !== `Bearer ${authToken}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
}
```

### 5.2 Event Routing (lines 155-162)

```js
if (event === 'init') return await handleInit(base44, body);
if (event === 'turn') return await handleTurn(base44, body);
if (event === 'transfer') return await handleTransfer(req, base44, body);
if (event === 'end_call') return await handleEndCall(base44, body);
if (event === 'stop') return await handleStop(base44, body);
```

### 5.3 INIT — Load Config + Lead, Return Greeting (lines 170-205)

```js
async function handleInit(base44, body) {
  const { leadId } = body;
  let lead = null;
  let config = {};
  if (leadId) { try { lead = await base44.entities.FronterLead.get(leadId); } catch {} }
  try {
    const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
    config = configs?.[0] || {};
  } catch {}

  let greeting = '';
  if (config.greeting) {
    greeting = config.greeting;
    if (lead) {
      greeting = greeting
        .replace(/\{\{first_name\}\}/g, lead.firstName || '')
        .replace(/\{\{last_name\}\}/g, lead.lastName || '')
        .replace(/\{\{email\}\}/g, lead.email || '');
    }
  }
  return Response.json({
    greeting,
    ttsEngine: config.ttsEngine || 'elevenlabs',
    ttsVoiceModel: config.ttsVoiceModel || '',
    llmModel: config.llmModel || 'claude-sonnet-5',
    leadId: lead?.id || leadId,
    leadFirstName: lead?.firstName || '',
    leadLastName: lead?.lastName || '',
  });
}
```

### 5.4 TURN — LLM Response with Structured Action (lines 208-297)

This is the core conversation handler:

```js
async function handleTurn(base44, body) {
  const { transcript, conversation, leadId } = body;
  if (!transcript || typeof transcript !== 'string') {
    return Response.json({ error: 'missing transcript' }, { status: 400 });
  }

  // Load config + lead
  let config = {};
  try {
    const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
    config = configs?.[0] || {};
  } catch {}
  let lead = null;
  if (leadId) { try { lead = await base44.entities.FronterLead.get(leadId); } catch {} }

  // Build system prompt with variable substitution
  const systemPrompt = config.systemPrompt || FRONTER_SCRIPT_SYSTEM_PROMPT;
  const filledPrompt = systemPrompt
    .replace(/\{\{first_name\}\}/g, lead?.firstName || '')
    .replace(/\{\{last_name\}\}/g, lead?.lastName || '')
    .replace(/\{\{email\}\}/g, lead?.email || '')
    .replace(/\{\{city\}\}/g, lead?.city || '')
    .replace(/\{\{state\}\}/g, lead?.state || '');

  // Build conversation text
  const conversationText = (conversation || [])
    .map((m) => `${m.role === 'user' ? 'Prospect' : 'Agent'}: ${m.content}`)
    .join('\n');

  const llmModel = MODEL_MAP[config.llmModel] || 'claude-sonnet-5';

  let action = 'speak';
  let text = '';
  let disposition = '';

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${filledPrompt}

Conversation so far:
${conversationText}

Respond as the Agent to the prospect's latest message. Keep your response to 1-3 sentences since it will be spoken aloud on a phone call. Do not use formatting, emojis, or special characters.

Determine the action:
- "speak": Continue the conversation naturally
- "transfer": The prospect is qualified and ready for transfer to a senior advisor
- "end_call": The prospect is not qualified (debt under $10,000) or explicitly not interested

Return JSON with:
- action: one of "speak", "transfer", "end_call"
- text: what to speak aloud (1-3 sentences, no formatting)
- disposition: if end_call, one of "not_interested", "opt_out", "no_response", "technical_failure"`,
      response_json_schema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: VALID_ACTIONS },
          text: { type: 'string' },
          disposition: { type: 'string', enum: VALID_DISPOSITIONS },
        },
        required: ['action', 'text'],
      },
      model: llmModel,
    });

    // Validate LLM response against schema
    action = VALID_ACTIONS.includes(result?.action) ? result.action : 'speak';
    text = typeof result?.text === 'string' ? result.text : '';
    if (text.length > 500) text = text.slice(0, 497) + '...';
    disposition = VALID_DISPOSITIONS.includes(result?.disposition) ? result.disposition : 'no_response';
  } catch (e) {
    action = 'speak';
    text = "I'm sorry, could you repeat that?";
  }

  // Deterministic qualification: reject transfer if debt is known and below $10k
  if (action === 'transfer' && lead?.debtAmount != null && lead.debtAmount > 0 && lead.debtAmount < 10000) {
    action = 'speak';
    text = "I appreciate your time, but our programs are designed for debt amounts of $10,000 or more...";
    disposition = 'not_interested';
  }

  return Response.json({ action, text, disposition });
}
```

**Key design points:**
- The LLM returns **structured JSON** (validated against `response_json_schema`), not free text with markers. This replaced the old TRANSFER/ENDCALL text-marker approach.
- The response is **schema-validated**: `action` must be in `VALID_ACTIONS`, `disposition` must be in `VALID_DISPOSITIONS`.
- Text is capped at 500 chars.
- A **deterministic $10k debt check** overrides the LLM's transfer decision if the lead's known debt is below $10,000.
- On LLM error, the agent says "I'm sorry, could you repeat that?" and stays in `speak` mode.

### 5.5 TRANSFER — Execute Transfer Prep + Redirect (lines 300-343)

```js
async function handleTransfer(req, base44, body) {
  const { callSid, conversation, leadId } = body;
  let lead = null; let config = {};
  // ... load lead + config ...

  // 1. Execute transfer prep (extract data, send email, generate summary, update lead)
  try {
    await prepareTransfer(req, base44, lead, config, conversation || []);
  } catch (e) { console.error('Transfer prep failed:', e?.message); }

  // 2. Play transfer announcement via bridge TTS
  const transferMsg = "Let me connect you with one of our senior debt advisors. Please hold for just a moment.";
  const ttsAudio = await generateTTS(transferMsg, config);
  if (ttsAudio) {
    await playToBridge(body.streamSid, { clear: true });
    await playToBridge(body.streamSid, { payload: ttsAudio });
    await new Promise(r => setTimeout(r, estimatePlaybackMs(transferMsg)));
  }

  // 3. Redirect Twilio call to transfer TwiML
  if (callSid) {
    const transferUrl = `${BASE_URL}/functions/dialerVoiceHandler?Mode=aiAgentTransfer&LeadId=${leadId}&SkipSay=true`;
    await twilioFetch(`/Calls/${callSid}.json`, {
      method: 'POST',
      body: new URLSearchParams({ Url: transferUrl }),
    });
  }
  return Response.json({ ok: true, transferNumber: config.transferPhoneNumber || '+16193530919' });
}
```

### 5.6 END_CALL — Disposition + Goodbye + Hangup (lines 346-400)

```js
async function handleEndCall(base44, body) {
  const { callSid, disposition, leadId, streamSid } = body;
  // ... load config ...
  const validDisposition = VALID_DISPOSITIONS.includes(disposition) ? disposition : 'no_response';

  // Update lead — only set status='removed' for explicit opt-out/not-interested
  if (leadId) {
    const lead = await base44.entities.FronterLead.get(leadId);
    const update = {
      callCount: (lead?.callCount || 0) + 1,
      lastCallResult: validDisposition,
      lastCalledAt: new Date().toISOString(),
    };
    if (validDisposition === 'opt_out' || validDisposition === 'not_interested') {
      update.status = 'removed';
    }
    await base44.entities.FronterLead.update(leadId, update);
  }

  // Play goodbye via bridge TTS
  const endMsg = "Thank you for your time. Have a great day. Goodbye.";
  const ttsAudio = await generateTTS(endMsg, config);
  if (ttsAudio) {
    await playToBridge(streamSid, { clear: true });
    await playToBridge(streamSid, { payload: ttsAudio });
    await new Promise(r => setTimeout(r, estimatePlaybackMs(endMsg)));
  }

  // Redirect Twilio to hangup TwiML
  if (callSid) {
    const endCallUrl = `${BASE_URL}/functions/dialerVoiceHandler?Mode=aiAgentEndCall&SkipSay=true`;
    await twilioFetch(`/Calls/${callSid}.json`, { method: 'POST', body: new URLSearchParams({ Url: endCallUrl }) });
  }
  return Response.json({ ok: true });
}
```

**Key design:** Ending a call does NOT automatically mark the lead as "removed" — only explicit `opt_out` or `not_interested` dispositions do. This was a deliberate decision to separate call termination from disposition.

### 5.7 STOP — Recording Upload + Transcript Save (lines 402-480)

```js
async function handleStop(base44, body) {
  const { callSid, conversation, recordingBase64, leadId } = body;
  let recordingUri = '';

  // Upload recording (stored privately)
  if (recordingBase64 && recordingBase64.length > 0) {
    // Convert base64 mulaw → WAV (add RIFF/WAVE/fmt/data headers)
    // ... build WAV header (mulaw, 8kHz, mono, 8-bit) ...
    const file = new File([wav], `recording-${callSid || 'unknown'}.wav`, { type: 'audio/wav' });
    const result = await base44.integrations.Core.UploadPrivateFile({ file });
    recordingUri = result?.file_uri || '';
  }

  // Save transcript (idempotent: check for existing by callSid)
  if (conversation && conversation.length > 0 && leadId && callSid) {
    const existing = await base44.entities.FronterCallTranscript.filter({ callSid });
    const items = existing?.items || (Array.isArray(existing) ? existing : []);
    if (items.length === 0) {
      let lead = null;
      try { lead = await base44.entities.FronterLead.get(leadId); } catch {}
      const leadName = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim();
      const transcriptData = conversation.map((m) => ({
        speaker: m.role === 'assistant' ? 0 : 1,
        text: m.content,
        time: new Date().toISOString(),
      }));
      await base44.entities.FronterCallTranscript.create({
        leadId, leadName,
        fronterUsername: 'ai_agent',
        transcriptJson: JSON.stringify(transcriptData),
        transcriptLineCount: transcriptData.length,
        callSid,
        callDate: new Date().toISOString(),
        callResult: 'media_stream',
        recordingUrl: recordingUri || undefined,
      });
    }
  }
  return Response.json({ ok: true });
}
```

**Key design:**
- Recordings are uploaded via `UploadPrivateFile` (stored privately — requires a signed URL to access).
- Transcript saves are **idempotent**: checked by `callSid` before creating, so duplicate `stop` events (from WebSocket close + explicit stop) don't create duplicate records.
- Speaker mapping: `assistant` → 0 (agent), `user` → 1 (prospect/customer).

---

## 6. Call Control: `dialerVoiceHandler`

**File:** `base44/functions/dialerVoiceHandler/entry.ts`

This function generates TwiML for all call-control modes. For the AI agent, the relevant modes are:

### 6.1 Mode=aiAgent — Connect to Media Stream (lines 48-158)

When the AI agent dials a lead and the prospect answers, Twilio hits this URL. The handler:

1. Loads `AIAgentConfig` and the `FronterLead`.
2. Substitutes `{{first_name}}`, `{{last_name}}`, `{{email}}`, etc. in the greeting.
3. Reads `WS_BRIDGE_URL` and `STREAM_AUTH_TOKEN` from secrets.
4. Returns TwiML that connects the call to the bridge WebSocket:

```xml
<Response>
  <Connect>
    <Stream url="wss://bridge-url/ws" name="rosie-ai-agent">
      <Parameter name="leadId" value="..." />
      <Parameter name="streamToken" value="..." />
    </Stream>
  </Connect>
  <Say voice="Polly.Joanna-Neural">Please hold for just a moment.</Say>
  <Redirect method="POST">.../dialerVoiceHandler?Mode=aiAgent&LeadId=...&retry=1</Redirect>
</Response>
```

**Retry logic:** If the WebSocket fails (bridge cold-start, network blip), Twilio falls through to the `<Redirect>`, which re-enters this handler with an incremented `retry` counter. Max 2 retries before hangup. Retries do NOT redial the lead — they only retry the stream connection.

**Greeting ownership:** When the bridge URL exists, the greeting is NOT spoken by this handler — the bridge generates it via ElevenLabs/Deepgram TTS and plays it through the Media Stream. The greeting loaded here is only used in the no-bridge fallback path.

**Call-hours cutoff:** NOT enforced here. The cutoff is enforced by `aiAgentDial` BEFORE placing the call. Hanging up here (after the prospect answered) would be worse than not calling.

### 6.2 Mode=aiAgentTransfer — Transfer to Advisor (lines 160-200)

Redirected to from `mediaStreamRelay` when the LLM says "transfer":

```xml
<Response>
  <Dial callerId="..." timeout="30" action=".../aiAgentRespond?transferFallback=1&leadId=..." method="POST">
    <Number>+16193530919</Number>
  </Dial>
</Response>
```

- Validates the transfer number is valid E.164 (`/^\+[1-9]\d{7,14}$/`).
- `SkipSay=true` skips the spoken transfer message (already played by the bridge).
- `action` URL points to `aiAgentRespond` with `transferFallback=1` — if the advisor doesn't answer, the fallback handler tries the secondary number.

### 6.3 Mode=aiAgentEndCall — Hangup (lines 202-225)

```xml
<Response>
  <Say voice="Polly.Joanna-Neural">Thank you for your time. Have a great day. Goodbye.</Say>
  <Hangup/>
</Response>
```

`SkipSay=true` skips the Say (already played by the bridge).

---

## 7. Outbound Dialing: `aiAgentDial`

**File:** `base44/functions/aiAgentDial/entry.ts`

### 7.1 startDial (lines 33-129)

```js
if (action === 'startDial') {
  const { phone, firstName, lastName, city, state, debtAmount, leadId, adminUsername, overrideCutoff } = body;
  if (!phone) return Response.json({ error: 'phone required' }, { status: 400 });
  if (!/^\+[1-9]\d{7,14}$/.test(toE164(String(phone)))) {
    return Response.json({ error: 'Enter a valid phone number...' }, { status: 400 });
  }

  // 8pm local-time cutoff
  const cutoff = checkCallCutoff(phone);
  if (cutoff.blocked && !overrideCutoff) {
    return Response.json({ error: 'CALL_TIME_BLOCKED', message: reason, ... }, { status: 403 });
  }

  // Get AI agent config for the line
  const configs = await base44.asServiceRole.entities.AIAgentConfig.filter({ configName: 'default' });
  const lineKey = configs?.[0]?.twilioLineKey || '';
  const fromNumber = lineNumber(lineKey);

  // Create or update FronterLead prospect card
  let leadRecord = null;
  if (leadId) { try { leadRecord = await base44.asServiceRole.entities.FronterLead.get(leadId); } catch {} }
  if (!leadRecord) {
    leadRecord = await base44.asServiceRole.entities.FronterLead.create({
      leadNumber: `#F${String(num).padStart(4, '0')}`,
      firstName, lastName, phone, city, state, debtAmount,
      status: 'prospect',
      assignedTo: 'ai_agent',
      ...
    });
  }

  // Place the Twilio call
  const voiceUrl = `${BASE_URL}/functions/dialerVoiceHandler?Mode=aiAgent&LeadId=${leadRecord?.id}`;
  const statusCallbackUrl = `${BASE_URL}/functions/aiAgentDial?callStatus=1&leadId=${leadRecord?.id}`;
  const call = await twilioFetch(`/Calls.json`, {
    method: 'POST',
    body: new URLSearchParams({
      To: toE164(phone), From: fromNumber,
      Url: voiceUrl,
      StatusCallback: statusCallbackUrl,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST',
      Timeout: '30',
    }),
  });

  // Update lead with call info
  await base44.asServiceRole.entities.FronterLead.update(leadRecord.id, {
    lastCalledAt: new Date().toISOString(),
    callCount: (leadRecord.callCount || 0) + 1,
  });

  return Response.json({ ok: true, callSid: call.sid, leadId: leadRecord?.id, leadNumber: leadRecord?.leadNumber });
}
```

### 7.2 callStatus — Twilio Status Callback (lines 131-155)

```js
if (url.searchParams.get('callStatus') === '1') {
  const leadId = url.searchParams.get('leadId') || '';
  const callStatus = body.CallStatus || '';
  const callDuration = body.CallDuration || '0';
  if (leadId) {
    const updates = {};
    if (callStatus === 'completed') {
      updates.lastCallResult = 'connected';
      updates.lastCallDurationSeconds = parseInt(callDuration) || 0;
    } else if (callStatus === 'no-answer' || callStatus === 'failed' || callStatus === 'busy') {
      updates.lastCallResult = 'no_answer';
    }
    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.FronterLead.update(leadId, updates);
    }
  }
  return Response.json({ ok: true });
}
```

---

## 8. Shared Helpers: `aiAgentHelpers.ts`

**File:** `base44/shared/aiAgentHelpers.ts`

### 8.1 `prepareTransfer()` — lines 247-312

The transfer preparation pipeline, shared by both the old Gather flow (`aiAgentRespond`) and the new Media Stream flow (`mediaStreamRelay`):

```js
export async function prepareTransfer(req, base44, leadData, config, conversation) {
  const leadId = leadData.id;
  const now = new Date().toISOString();
  const primaryNumber = config.transferPhoneNumber || '+16193530919';

  // 1. Extract debt data + contact data (parallel)
  const [debtData, contactData] = await Promise.all([
    extractDebtData(req, conversation),
    extractContactData(req, conversation, leadData),
  ]);

  const leadUpdates = {
    status: 'transferred',
    lastCallResult: 'transferred',
    transferredAt: now,
    transferredTo: `Chris Bongiorno (${primaryNumber})`,
    lastCalledAt: now,
  };
  // Merge contact updates
  if (contactData.updates && Object.keys(contactData.updates).length > 0) {
    Object.assign(leadUpdates, contactData.updates);
  }
  // Merge debt data
  if (debtData.confirmed) {
    if (debtData.debtAmount != null) leadUpdates.debtAmount = debtData.debtAmount;
    if (debtData.debtTypesJson) leadUpdates.debtTypesJson = debtData.debtTypesJson;
    if (debtData.debtAmountsJson) leadUpdates.debtAmountsJson = debtData.debtAmountsJson;
  }

  // 2. Send credentials email (if enabled)
  let emailSent = false;
  if (config.preTransferEmailEnabled !== false) {
    const emailResult = await sendCredentialsEmail(base44, emailLeadData, 'ai_agent');
    emailSent = emailResult.sent;
    if (emailSent) {
      leadUpdates.credsSentAt = now;
      leadUpdates.credsSentTemplate = emailResult.templateLabel || 'credentials';
      if (leadData.status === 'prospect') leadUpdates.status = 'lead';
    }
  }

  // 3. Generate AI input summary
  const summary = await generateCallSummary(req, conversation);
  if (summary) {
    let notesLog = [];
    try { notesLog = JSON.parse(leadData.notesLogJson || '[]'); } catch {}
    notesLog.push({ text: `🤖 AI Input Summary: ${summary}`, timestamp: now, author: 'AI', type: 'ai_input' });
    if (debtData.confirmed && debtData.summary) {
      notesLog.push({ text: `💰 Debt Confirm: ${debtData.summary}`, timestamp: now, author: 'AI', type: 'debt_confirm' });
    }
    leadUpdates.notesLogJson = JSON.stringify(notesLog);
  }

  // 4. Update lead
  await base44.entities.FronterLead.update(leadId, leadUpdates);
  return { leadUpdates, emailSent, summary, debtData, contactData };
}
```

### 8.2 `extractDebtData()` — lines 14-70

Uses `callLLM` (Claude Sonnet) to extract total debt amount, debt types, and per-type amounts from the conversation. Returns `{ confirmed, debtAmount, debtTypes, debtTypesJson, debtAmountsJson, summary }`.

### 8.3 `extractContactData()` — lines 77-143

Uses `callLLM` (Claude Sonnet) to extract contact fields (name, phone, email, address, etc.) from the conversation. Handles spelled-out emails ("j as in john, o as in ocean..."). Returns `{ updates, overwrites, missingFields }`.

### 8.4 `sendCredentialsEmail()` — lines 185-240

Sends a credentials email via the **Gmail connector**:
1. Loads the first `FronterEmailTemplate`.
2. Fills `{{firstName}}` and `{{email}}` variables.
3. Gets the Gmail access token via `base44.connectors.getConnection('gmail')`.
4. Builds an RFC 2822 MIME message and base64url-encodes it.
5. POSTs to `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`.

### 8.5 `FRONTER_SCRIPT_SYSTEM_PROMPT` — lines 319-363

The full 4-step debt-relief script as a system prompt. This is the **default** system prompt used when `AIAgentConfig.systemPrompt` is empty. It includes:
- Step 1: Introduction & Verification
- Step 2: Pitch & Qualification (with $10k threshold)
- Step 3: Debt Breakdown & Confirmation
- Step 4: Program Value & Handoff
- Special cases (appointment, not interested, scam question)
- Rules (1-3 sentences, no formatting, never make up info)

---

## 9. Configuration: `AIAgentConfig` Entity

**File:** `base44/entities/AIAgentConfig.jsonc`

A singleton config entity (`configName: 'default'`). Key fields:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `isActive` | boolean | false | Whether the agent is live on the selected line |
| `twilioLineKey` | string | — | Which Twilio line the agent answers |
| `transferPhoneNumber` | string | +16193530919 | Primary transfer target (Chris Bongiorno) |
| `transferPhoneNumber2` | string | +12162586934 | Secondary transfer target |
| `queueTimeoutSeconds` | number | 90 | Wait timeout before fallback |
| `sttEngine` | enum | deepgram-nova-2 | Speech-to-text engine |
| `ttsEngine` | enum | deepgram-aura | Text-to-speech engine |
| `ttsVoiceModel` | string | aura-2-thalia-en | Voice ID |
| `llmModel` | enum | claude-sonnet-5 | LLM for conversation |
| `kbPrimary` | enum | fronter | Primary knowledge base |
| `kbSecondary` | enum | debtcallcoach | Secondary knowledge base |
| `greeting` | textarea | "Hi, may I speak with {{first_name}} please?" | Spoken when prospect answers |
| `systemPrompt` | textarea | — | Full agent instructions (never read aloud) |
| `scriptFlow` | textarea | — | Call execution phases |
| `dynamicRebuttals` | textarea | — | Objection handling |
| `qaTuning` | textarea | — | Q&A fine-tuning notes |
| `callbackBookingEnabled` | boolean | true | Auto-book callback on transfer failure |
| `preTransferEmailEnabled` | boolean | true | Send credentials email before transfer |

**RLS:** `null` on all operations — any authenticated user can read/write/delete the config.

---

## 10. UI Components

### 10.1 `AIAgentDialer.jsx` — Lead Dialer UI

**File:** `src/components/fronter/AIAgentDialer.jsx`

Provides:
- **Manual dial** — enter a phone number + name, click "Dial Now". Pre-checks 8pm cutoff (with override toggle).
- **CSV upload** — format: `First Name, Last Name, Phone, City, State, Debt Amount`. Parses and queues leads.
- **Sequential dialing** — dials each lead one by one, 5-second wait between calls to avoid rate limits.
- **Queue stats** — total, pending, dialing, dialed, failed, blocked (8pm).

All dialing goes through `base44.functions.invoke('aiAgentDial', { action: 'startDial', ... })`.

### 10.2 `FronterMonitorAIAgent.jsx` — Monitor Card

**File:** `src/components/fronter/FronterMonitorAIAgent.jsx`

A live status card showing:
- Active/inactive banner with activate/deactivate toggle.
- Telephony config (line, transfer target, queue timeout).
- Voice pipeline (STT, TTS, voice, LLM).
- Knowledge bases (primary, secondary).
- Automation toggles (callback booking, pre-transfer email).
- Auto-refreshes every 5 seconds.

### 10.3 Config Editor Components

| Component | Purpose |
|---|---|
| `AIAgentVoiceSection.jsx` | STT engine, TTS engine, voice model, LLM model selectors |
| `AIAgentTelephonySection.jsx` | Twilio line, transfer numbers, queue timeout, callback/email toggles |
| `AIAgentKnowledgeSection.jsx` | Primary/secondary KB selectors |
| `AIAgentPromptSection.jsx` | Greeting input + 4 tabbed editors (System Prompt, Script Flow, Rebuttals, Q&A Tuning) with reset-to-default |
| `AIAgentLiveConfig.jsx` | Read-only display of active config (model names, voice labels, transfer targets) |

---

## 11. Voice Mapping: `aiVoiceMap.ts`

**File:** `base44/shared/aiVoiceMap.ts`

Maps TTS voice IDs to Twilio Polly voices. This is used **only** in the fallback path (when the bridge is not configured and Twilio `<Say>` must speak). When the bridge is active, TTS is generated by ElevenLabs/Deepgram and the Polly voice is irrelevant.

```js
const POLLY_VOICE_MAP = {
  'aura-2-thalia-en': 'Polly.Joanna-Neural',
  'aura-2-asteria-en': 'Polly.Salli-Neural',
  'aura-2-arcas-en': 'Polly.Matthew-Neural',
  '21m00Tcm4TlvDq8ikWAM': 'Polly.Kendra-Neural',  // ElevenLabs Rachel
  'EXAVITqu4j5949LvpkN8': 'Polly.Matthew-Neural', // ElevenLabs Adam
  // ...
};
```

---

## 12. Bridge Keepalive

### 12.1 `bridgeKeepalive` Function

**File:** `base44/functions/bridgeKeepalive/entry.ts`

Pings the bridge `/health` endpoint every 10 minutes to prevent Render free-tier spin-down:

```js
export default async function(req) {
  const bridgeUrl = (secrets.get('WS_BRIDGE_URL') || '').replace(/\/$/, '');
  if (!bridgeUrl) return Response.json({ ok: false, error: 'WS_BRIDGE_URL not set' });
  try {
    const res = await fetch(`${bridgeUrl}/health`, { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    return Response.json({ ok: res.ok, bridge: data });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) });
  }
}
```

### 12.2 Bridge Health Endpoints

The bridge exposes two health endpoints:

- **`GET /health`** — basic liveness: `{ ok: true, activeStreams, uptime }`
- **`GET /ready`** — readiness: verifies all required config is present (appWebhookUrl, streamAuth, playAuth, deepgram). Returns 503 if not ready.

---

## 13. Secrets Inventory

The AI Voice Agent uses these secrets:

| Secret | Used By | Purpose |
|---|---|---|
| `WS_BRIDGE_URL` | dialerVoiceHandler, mediaStreamRelay, bridgeKeepalive | Bridge HTTP/WebSocket URL |
| `WS_BRIDGE_AUTH_TOKEN` | mediaStreamRelay | Bridge → Relay auth (Bearer) |
| `STREAM_AUTH_TOKEN` | dialerVoiceHandler → bridge | Twilio → Bridge auth (custom param) |
| `PLAY_AUTH_TOKEN` | mediaStreamRelay → bridge /play | Relay → Bridge playback auth |
| `DEEPGRAM_API_KEY` | bridge, mediaStreamRelay | Deepgram STT + TTS fallback |
| `ELEVENLABS_API_KEY` | bridge, mediaStreamRelay | ElevenLabs TTS (preferred) |
| `ANTHROPIC_API_KEY` | aiAgentHelpers (via llmHelper) | Direct Anthropic calls for extraction |
| `TWILIO_ACCOUNT_SID` | twilioHelpers | Twilio API auth |
| `TWILIO_AUTH_TOKEN` | twilioHelpers | Twilio API auth |
| `TWILIO_FROM_NUMBER` (1-6) | aiAgentDial, dialerVoiceHandler | Outbound caller IDs |

---

## 14. Inter-Service Protocol

The bridge and relay communicate via a versioned HTTP protocol. All events are POSTed to `mediaStreamRelay` with `Authorization: Bearer ${APP_AUTH_TOKEN}`.

### Bridge → Relay Events

| Event | Payload | Response |
|---|---|---|
| `init` | `{ streamSid, callSid, leadId }` | `{ greeting, ttsEngine, ttsVoiceModel, llmModel, leadId, leadFirstName, leadLastName }` |
| `turn` | `{ streamSid, callSid, transcript, conversation, leadId }` | `{ action: "speak"\|"transfer"\|"end_call", text, disposition }` |
| `transfer` | `{ streamSid, callSid, conversation, leadId }` | `{ ok, transferNumber }` |
| `end_call` | `{ streamSid, callSid, disposition, leadId }` | `{ ok }` |
| `stop` | `{ streamSid, callSid, conversation, recordingBase64, leadId }` | `{ ok }` |

### Relay → Bridge Events

| Event | Endpoint | Payload | Auth |
|---|---|---|---|
| `play` | `POST /play` | `{ streamSid, payload }` or `{ streamSid, clear }` or `{ streamSid, mark, name }` | `Bearer ${PLAY_AUTH_TOKEN}` |

---

## 15. Conversation State Machine

The AI agent follows a state machine driven by the LLM's `action` field:

```
  PROSPECT ANSWERS
       │
       ▼
  ┌─ INIT ──────────────────────────────┐
  │  Bridge → Relay: init                │
  │  Relay → Bridge: greeting            │
  │  Bridge: TTS greeting → play          │
  └──────────────┬──────────────────────┘
                 │
                 ▼
  ┌─ CONVERSATION LOOP ─────────────────┐
  │  Prospect speaks → Deepgram STT     │
  │  Bridge → Relay: turn (transcript)  │
  │  Relay: InvokeLLM → { action, text }│
  │                                      │
  │  ┌─ action="speak" ──┐              │
  │  │ Bridge: TTS → play │              │
  │  │ → back to loop     │              │
  │  └────────────────────┘              │
  │  ┌─ action="transfer" ─┐            │
  │  │ Relay: prepareTransfer()         │
  │  │ Bridge: TTS "connecting..."       │
  │  │ Relay: redirect Twilio           │
  │  │ → dialerVoiceHandler?Mode=transfer│
  │  │ → <Dial> advisor number           │
  │  └────────────────────┘              │
  │  ┌─ action="end_call" ─┐            │
  │  │ Relay: update lead disposition   │
  │  │ Bridge: TTS "goodbye"             │
  │  │ Relay: redirect Twilio           │
  │  │ → dialerVoiceHandler?Mode=endCall│
  │  │ → <Hangup>                        │
  │  └────────────────────┘              │
  └──────────────────────────────────────┘
                 │
                 ▼
  ┌─ STOP ──────────────────────────────┐
  │  Bridge → Relay: stop               │
  │  Relay: upload recording (private)  │
  │  Relay: save transcript (idempotent)│
  └──────────────────────────────────────┘
```

---

## 16. Deterministic Safety Checks

The system has several deterministic checks that override the LLM:

| Check | Where | Logic |
|---|---|---|
| **$10k debt threshold** | `mediaStreamRelay.handleTurn` | If `action === 'transfer'` and `lead.debtAmount < 10000`, overrides to `speak` with a disqualifying message |
| **Call-hours cutoff** | `aiAgentDial.startDial` | `checkCallCutoff(phone)` blocks calls before 8am or after 8pm in the recipient's timezone. `overrideCutoff` bypasses for test calls. |
| **E.164 validation** | `aiAgentDial`, `dialerVoiceHandler` | Validates phone numbers against `/^\+[1-9]\d{7,14}$/` before dialing or transferring |
| **Schema validation** | `mediaStreamRelay.handleTurn` | LLM response `action` must be in `VALID_ACTIONS`, `disposition` in `VALID_DISPOSITIONS`. Invalid values default to `speak` / `no_response`. |
| **Text length cap** | `mediaStreamRelay.handleTurn` | LLM text capped at 500 chars (slice + "...") |
| **Transfer number validation** | `dialerVoiceHandler` (aiAgentTransfer) | Transfer number must match E.164 regex before dialing |
| **Idempotent transcript save** | `mediaStreamRelay.handleStop` | Checks for existing `FronterCallTranscript` by `callSid` before creating |
| **WebSocket retry cap** | `dialerVoiceHandler` (aiAgent) | Max 2 stream connection retries before hangup |

---

## 17. Security / Auth Boundaries

### 17.1 Three Auth Boundaries (never mixed)

| Boundary | Token | Direction | Validated Where |
|---|---|---|---|
| Twilio → Bridge | `STREAM_AUTH_TOKEN` | Twilio WebSocket `start.customParameters` | Bridge `wss.on('connection')` |
| Bridge → Relay | `WS_BRIDGE_AUTH_TOKEN` | HTTP Bearer header | `mediaStreamRelay` entry |
| Relay → Bridge | `PLAY_AUTH_TOKEN` | HTTP Bearer header on `/play` | Bridge `app.post('/play')` |

The stream token is never forwarded to the app backend or logged.

### 17.2 Fail-Closed Production

In production (`NODE_ENV=production`), the bridge refuses to start without `STREAM_AUTH_TOKEN`, `PLAY_AUTH_TOKEN`, `APP_WEBHOOK_URL`, and `DEEPGRAM_API_KEY`.

### 17.3 Error Handling

- `mediaStreamRelay` never returns raw internal exception messages to callers — always `{ error: 'internal error' }` on 500.
- `dialerVoiceHandler` always returns valid TwiML, even on fatal error (returns a "unable to take your call" message + hangup).

---

## 18. Known Issues / Audit Observations

1. **`AIAgentConfig` has no RLS:** Any authenticated user can read/write/delete the agent config. A non-admin could activate/deactivate the agent or change transfer numbers.

2. **`FronterLead` has no RLS:** Any authenticated user can read/modify any lead created by the AI agent.

3. **`FronterCallTranscript` has no RLS:** Any authenticated user can read any AI agent call transcript (including recordings).

4. **`aiAgentDial` has no auth check:** The function does not verify the caller's identity or role. Any authenticated app user (or anyone who can hit the endpoint) could trigger outbound calls. The `overrideCutoff` flag is passed from the frontend with no server-side validation of who can use it.

5. **`mediaStreamRelay` trusts `leadId` from the bridge:** The `leadId` is passed through the bridge from Twilio's `customParameters`, which originate from `dialerVoiceHandler`'s TwiML. A crafted TwiML could inject an arbitrary `leadId`.

6. **`dialerVoiceHandler` has no Twilio signature verification:** Unlike `voicemailWebhook` and `aiAgentRespond`, this handler does not verify the Twilio signature. Anyone who knows the URL could POST crafted parameters. The `STREAM_AUTH_TOKEN` in the TwiML is a secret, but the URL itself is public.

7. **`aiAgentHelpers.sendCredentialsEmail` uses `asServiceRole` Gmail token:** The email is sent as the connected Gmail account, not as the calling user. There is no per-user email sending.

8. **`extractDebtData` and `extractContactData` use `claude-sonnet-5` directly:** These call `callLLM` from `llmHelper.ts`, which uses the direct Anthropic API. If `ANTHROPIC_API_KEY` is exhausted, these silently return empty data (no fallback to InvokeLLM, unlike `liveAssistantAI`).

9. **Bridge cold-start gap:** Despite the keepalive workflow, Render free-tier services can still spin down. The retry logic in `dialerVoiceHandler` (max 2 retries) mitigates this, but 2 retries may not be enough for a 30-60s cold start.

10. **`conversation.slice(-20)` window:** The bridge sends only the last 20 conversation messages to the relay. Long conversations may lose early context, causing the agent to forget what was said at the beginning of the call.

11. **No conversation persistence across reconnects:** If the WebSocket drops and reconnects (retry), the conversation state is lost — the bridge creates a new session. The prospect would hear the greeting again.

12. **Recording is raw mulaw → WAV:** The recording is raw μ-law 8kHz audio captured from the Twilio Media Stream. Quality is phone-grade (8kHz). The WAV header is built manually in `handleStop`.

13. **`transferredTo` is hardcoded as "Chris Bongiorno":** In `prepareTransfer`, the `transferredTo` field is set to `Chris Bongiorno (${primaryNumber})` regardless of the actual transfer target. If the transfer number is changed in config, the name won't match.

14. **`kbPrimary` / `kbSecondary` config fields are not used by `mediaStreamRelay`:** The config has KB selection fields, but the Media Stream flow's `handleTurn` does not load or use any KB entries. The system prompt is the only context the LLM gets. (The old `aiAgentRespond` Gather flow may use them, but the new Media Stream flow does not.)

15. **`callbackBookingEnabled` is not implemented in the Media Stream flow:** The config has a callback booking toggle, but `handleTransfer` does not check it. If the transfer fails (advisor doesn't answer), no callback is automatically booked.

---

## 19. Deployment

### 19.1 Bridge (Render)

- **Dockerfile:** `FROM node:20-alpine`, `npm install --omit=dev`, `CMD ["node", "server.js"]`
- **render.yaml:** Prebuilt container image, health check at `/health`, auto-deploy
- **Required env vars:** `APP_WEBHOOK_URL`, `APP_AUTH_TOKEN`, `STREAM_AUTH_TOKEN`, `PLAY_AUTH_TOKEN`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `TTS_ENGINE`, `NODE_ENV=production`

### 19.2 Base44 Functions

- `mediaStreamRelay`, `dialerVoiceHandler`, `aiAgentDial`, `bridgeKeepalive` are deployed as Base44 backend functions.
- Secrets are managed via the Base44 Secrets dashboard.
- The `APP_WEBHOOK_URL` in the bridge must point to `https://rosieai-investorpage.base44.app/functions/mediaStreamRelay`.

### 19.3 Keepalive Workflow

- `base44/workflows/Bridge Keepalive.jsonc` runs `bridgeKeepalive` every 10 minutes to prevent Render spin-down.

---

## 20. Summary

The AI Voice Agent is a 3-tier system:

1. **Transport (Render Bridge):** Owns real-time audio — Twilio Media Stream WebSocket, Deepgram streaming STT, ElevenLabs/Deepgram TTS, playback queue with barge-in (generation-based interruption prevention), and recording buffer.
2. **Business Logic (mediaStreamRelay):** Owns conversation state — loads config/lead, calls InvokeLLM for each turn with schema-validated JSON responses, executes transfers (debt extraction + email + summary + lead update), manages dispositions, and persists transcripts + recordings.
3. **Call Control (dialerVoiceHandler + aiAgentDial):** Owns Twilio integration — generates TwiML to connect calls to the bridge, places outbound calls with call-hours enforcement, handles status callbacks, and provides transfer/end-call TwiML.

The system uses **three separate auth boundaries** (stream, app, play) that are never mixed, **fail-closed** production checks, **schema-validated** LLM responses, **deterministic safety checks** ($10k threshold, E.164 validation, text caps), and **idempotent** transcript persistence.

The main audit concerns are: no RLS on any entity, no auth on `aiAgentDial`, no Twilio signature verification on `dialerVoiceHandler`, unused KB config fields in the Media Stream flow, unimplemented callback booking, hardcoded transfer name, and the bridge cold-start gap.

<next_prompt>Fix the auth and RLS gaps in the AI agent</next_prompt>