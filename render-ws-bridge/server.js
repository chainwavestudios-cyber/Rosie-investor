/* global require, process, Buffer */
/**
 * Rosie WS Bridge — Twilio Media Streams + Streaming AI Orchestrator
 *
 * Architecture (Option 2 from technical review):
 *   Bridge owns: live Twilio WebSocket, Deepgram streaming STT, TTS generation,
 *     playback queue with generation IDs, barge-in, mark tracking.
 *   Base44 (mediaStreamRelay) owns: config/lead loading, LLM inference,
 *     transfer execution, transcript persistence, disposition management.
 *
 * Inter-service protocol (versioned):
 *   Bridge → Relay events (POST to APP_WEBHOOK_URL):
 *     { event: "init", streamSid, callSid, leadId }
 *       → { greeting, ttsEngine, ttsVoiceModel, cartesiaVoiceId, llmModel, leadId, leadFirstName, leadLastName }
 *     { event: "turn", streamSid, callSid, transcript, conversation, leadId }
 *       → { action: "speak"|"transfer"|"end_call", text, disposition }
 *     { event: "transfer", streamSid, callSid, conversation, leadId }
 *       → { ok, transferNumber }
 *     { event: "end_call", streamSid, callSid, disposition, leadId }
 *       → { ok }
 *     { event: "stop", streamSid, callSid, conversation, recordingBase64, leadId }
 *       → { ok }
 *
 * Auth boundaries (3 separate trust boundaries — never mix):
 *   1. STREAM_AUTH_TOKEN  — Twilio → Bridge: validated in start.customParameters
 *   2. APP_AUTH_TOKEN     — Bridge → Relay: Bearer [server-side token] on HTTP forward
 *   3. PLAY_AUTH_TOKEN    — Relay → Bridge /play: Bearer [server-side token] on playback
 *   The stream token is never forwarded to the app or logged.
 *
 * Env:
 *   PORT, WS_PATH, APP_WEBHOOK_URL, APP_AUTH_TOKEN,
 *   STREAM_AUTH_TOKEN (required in production),
 *   PLAY_AUTH_TOKEN (required in production, authenticates /play),
 *   DEEPGRAM_API_KEY (required for streaming STT + TTS fallback),
 *   ELEVENLABS_API_KEY (optional, for TTS),
 *   TTS_ENGINE (elevenlabs|deepgram-aura|flux|cartesia, default elevenlabs),
 *   ELEVENLABS_VOICE_ID, DEEPGRAM_TTS_VOICE, DEEPGRAM_STT_MODEL,
 *   PING_INTERVAL_MS, LOG_LEVEL, NODE_ENV, HTTP_TIMEOUT_MS
 */
const express = require('express');
const http = require('http');
const { WebSocket, WebSocketServer } = require('ws');
const nodeCrypto = require('crypto');
const {startPlainBobAgent} = require('./managed-voice-agent.cjs');
const {installInsureIqBobTransport} = require('./insureiq-bob-adapter.cjs');

// ── Config ──────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 10000);
const WS_PATH = process.env.WS_PATH || '/ws';
const BOB_BRIDGE_SESSION_SECRET = process.env.BOB_BRIDGE_SESSION_SECRET || '';
const BOB_ALLOWED_ORIGINS = new Set((process.env.BOB_ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean));
// Original Fronter/Twilio callback stays unchanged. BOB has a separate
// backend, credential and explicit opt-in while sharing this audio process.
const APP_WEBHOOK_URL = process.env.APP_WEBHOOK_URL || '';
const APP_AUTH_TOKEN = process.env.APP_AUTH_TOKEN || '';
const BOB_BRIDGE_ENABLED = process.env.BOB_BRIDGE_ENABLED === 'true';
const BOB_APP_WEBHOOK_URL = process.env.BOB_APP_WEBHOOK_URL || '';
const BOB_APP_AUTH_TOKEN = process.env.BOB_APP_AUTH_TOKEN || '';
const BOB_PLAY_AUTH_TOKEN = process.env.BOB_PLAY_AUTH_TOKEN || '';
const STREAM_AUTH_TOKEN = process.env.STREAM_AUTH_TOKEN || '';
const PLAY_AUTH_TOKEN = process.env.PLAY_AUTH_TOKEN || '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const TTS_ENGINE = process.env.TTS_ENGINE || 'elevenlabs';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '1SM7GgM6IMuvQlz2BwM3';
const DEEPGRAM_TTS_VOICE = process.env.DEEPGRAM_TTS_VOICE || 'aura-2-thalia-en';
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || '';
const CARTESIA_VOICE_ID = process.env.CARTESIA_VOICE_ID || '7b3c5c22-9561-425b-8e7a-63dbf1262e35';
const CARTESIA_MODEL = process.env.CARTESIA_MODEL || 'sonic-3.6';
// Cartesia asks each request to carry the date the integration was tested.
const CARTESIA_VERSION = process.env.CARTESIA_VERSION || '2026-03-01';
const PING_INTERVAL_MS = Number(process.env.PING_INTERVAL_MS || 30000);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';
const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 15000);
// Voice pacing. A conversational phone agent reads slower than ElevenLabs' 1.0
// default, which callers hear as rushed. 0.9 is unhurried but still natural.
const ELEVENLABS_SPEED = Number(process.env.ELEVENLABS_SPEED || 0.9);

// ── Fail-closed: refuse to start without required secrets in production ──
if (NODE_ENV === 'production') {
  const missing = [];
  if (!STREAM_AUTH_TOKEN) missing.push('STREAM_AUTH_TOKEN');
  if (!PLAY_AUTH_TOKEN) missing.push('PLAY_AUTH_TOKEN');
  if (!APP_WEBHOOK_URL) missing.push('APP_WEBHOOK_URL');
  if (!DEEPGRAM_API_KEY) missing.push('DEEPGRAM_API_KEY');
  // BOB is optional and cannot prevent legacy Fronter calls from starting.
  // Its route fails closed when disabled or unconfigured (see bobBridgeReady).
  if (missing.length) {
    console.error('[bridge] FATAL: missing required secrets:', missing.join(', '));
    process.exit(1);
  }
}

// ── Logging ──────────────────────────────────────────────────────────────
const log = (...a) => {
  if (LOG_LEVEL !== 'silent') console.log(new Date().toISOString(), '[bridge]', ...a);
};
const debug = (...a) => {
  if (LOG_LEVEL === 'debug') console.debug(new Date().toISOString(), '[bridge:debug]', ...a);
};

// ── State: streamSid → session ──────────────────────────────────────────
const streams = new Map();
const PIPELINE_VERSION = 'selector-runtime-v1';
const TTS_DIAGNOSTICS_VERSION = 'tts-diagnostics-v2';
let lastCall = null;
const runtimeSnapshot = session => ({
  browser: !!session.browser, callSid: session.callSid, state: session.state,
  startedAt: new Date(session.startedAt).toISOString(), observedAt: new Date().toISOString(),
  selected: session.config, stt: session.stt, tts: session.tts, llm: session.llm, error: session.error,
  turn: session.turn || null, turnSamples: session.turnSamples || [],
});

// ── Speaking watchdog ───────────────────────────────────────────────────
// When the AI speaks, state = 'speaking' and only returns to 'listening' once
// Twilio sends the 'mark' event (playback complete). If the TTS provider errors,
// times out, or closes without delivering that mark, state would stay stuck in
// 'speaking' forever — and since caller speech is only processed when listening,
// the AI would go deaf after the greeting. This timer forces state back to
// 'listening' if no mark arrives within the safety window.
const SPEAKING_WATCHDOG_MS = 12000;
function armSpeakingWatchdog(session, streamSid) {
  clearSpeakingWatchdog(session);
  session.speakingTimer = setTimeout(() => {
    if (session.state === 'speaking') {
      log('speaking watchdog: mark never arrived, forcing listen', streamSid);
      session.state = 'listening';
    }
  }, SPEAKING_WATCHDOG_MS);
}
function clearSpeakingWatchdog(session) {
  if (session.speakingTimer) { clearTimeout(session.speakingTimer); session.speakingTimer = null; }
}

// ── Barge-in grace window ───────────────────────────────────────────────
// Callers make small sounds while the agent talks — a cough, "mm-hmm", a chair
// creak. Cutting the agent off on the first blip is what makes the call feel
// jumpy. Caller speech only interrupts once it is still going after this window;
// a blip cancels the pending interrupt and the agent finishes her sentence.
const BARGE_IN_GRACE_MS = Number(process.env.BARGE_IN_GRACE_MS || 600);
// Short acknowledgements are agreement sounds, not a change of turn.
const BACKCHANNEL_RE = /^(yeah|yep|yup|yes|no|nope|ok|okay|k|sure|right|correct|exactly|uh[- ]?huh|mm[- ]?hmm|mhm|hm+|mm+|ah+|oh+|ha+|aha|wow|really|gotcha|got it|i see|alright|interesting|understood|thanks)[.!,?\s]*$/i;
function isBackchannel(transcript, session) {
  // A short reply to the agent's own question ("yes", "speaking", "ok") is an
  // answer, not agreement noise — she must stop and listen to it, otherwise the
  // caller answers the greeting and then hears nothing back.
  if (agentAskedQuestion(session)) return false;
  return BACKCHANNEL_RE.test(String(transcript || '').trim());
}
function agentAskedQuestion(session) {
  const conversation = session?.conversation || [];
  for (let i = conversation.length - 1; i >= 0; i--) {
    if (conversation[i].role === 'assistant') return /\?\s*$/.test(String(conversation[i].content || '').trim());
  }
  return false;
}
function cancelPendingBarge(session) {
  if (session.bargeTimer) { clearTimeout(session.bargeTimer); session.bargeTimer = null; }
}
function scheduleBargeIn(session, streamSid) {
  if (session.bargeTimer) return;
  session.bargeTimer = setTimeout(() => {
    session.bargeTimer = null;
    // She finished first, or the caller already stopped: she keeps talking.
    if (session.state !== 'speaking' || !session.callerSpeaking) return;
    log('barge-in confirmed after grace window, gen', session.generation);
    session.generation++;
    sendToTwilio(session.ws, { event: 'clear', streamSid });
    clearSpeakingWatchdog(session);
    session.state = 'listening';
  }, BARGE_IN_GRACE_MS);
}

// ── Express ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check (basic liveness)
app.get('/health', (req, res) => {
  res.json({ ok: true, activeStreams: streams.size, uptime: process.uptime() });
});

// Readiness check (verifies required config is present)
app.get('/ready', (req, res) => {
  const checks = {
    appWebhookUrl: !!APP_WEBHOOK_URL,
    streamAuth: !!STREAM_AUTH_TOKEN,
    playAuth: !!PLAY_AUTH_TOKEN,
    deepgram: !!DEEPGRAM_API_KEY,
  };
  const ready = Object.values(checks).every(Boolean);
  res.status(ready ? 200 : 503).json({ ready, checks });
});

// Runtime evidence is private: the app proxies it after checking admin access.
app.get('/runtime', (req, res) => {
  if (!PLAY_AUTH_TOKEN || req.headers.authorization !== `Bearer ${PLAY_AUTH_TOKEN}`) return res.status(401).json({ error: 'unauthorized' });
  res.set('Cache-Control', 'no-store');
  return res.json({ version: PIPELINE_VERSION, diagnosticsVersion: TTS_DIAGNOSTICS_VERSION, checkedAt: new Date().toISOString(),
    credentials: { deepgram: !!DEEPGRAM_API_KEY, elevenlabs: !!ELEVENLABS_API_KEY, cartesia: !!CARTESIA_API_KEY },
    calls: Array.from(streams.values()).filter(s=>!s.browser).map(runtimeSnapshot),
    lastCall: lastCall?.browser?null:lastCall,
  });
});

// ── /play: app → Twilio audio (AUTHENTICATED) ───────────────────────────
// POST /play { streamSid, payload }  — play base64 mulaw audio
// POST /play { streamSid, clear }     — clear playback queue
// POST /play { streamSid, mark, name } — add a mark event
app.post('/play', async (req, res) => {
  // Authenticate every playback request — never rely on unguessable streamSid
  if (PLAY_AUTH_TOKEN) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${PLAY_AUTH_TOKEN}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
  const { streamSid, text, clear, mark, ttsOverride } = req.body || {};
  let { payload } = req.body || {};
  const s = streamSid && streams.get(streamSid);
  if (!s) return res.status(404).json({ error: 'stream_not_found' });
  // Fronter's privileged /play token is never an authorization for BOB audio.
  if (s.browser) return res.status(403).json({error:'product_scope_mismatch'});
  if (text) {
    // Per-utterance voice override is deliberately restricted to the corporate
    // founder transfer. Never modify session.config or other calls' voices.
    const founderVoice = '7c6219d2-e8d2-462c-89d8-7ecba7c75d65';
    const useFounderVoice = s.leadId === 'rosie_corporate' &&
      ttsOverride?.engine === 'cartesia' && ttsOverride?.voiceId === founderVoice;
    if (ttsOverride && !useFounderVoice) return res.status(403).json({error:'tts_override_not_allowed'});
    const ttsConfig = useFounderVoice
      ? {...s.config, ttsEngine:'cartesia', cartesiaVoiceId:founderVoice}
      : s.config;
    payload = await generateTTS(String(text), ttsConfig, s);
    if (!payload) return res.status(502).json({ error: 'tts_failed' });
    s.recordingBuffer.push(payload);
  }
  if (clear) sendToTwilio(s.ws, { event: 'clear', streamSid });
  if (mark) sendToTwilio(s.ws, { event: 'mark', streamSid, mark: { name: mark.name || 'mark' } });
  if (payload) sendToTwilio(s.ws, { event: 'media', streamSid, media: { payload } });
  // G.711 mu-law 8 kHz: 8000 raw bytes per second. Caller can wait for
  // playback to finish before instructing Twilio to bridge the destination.
  const durationMs = payload ? Math.ceil(Buffer.from(payload,'base64').length / 8) : 0;
  res.json({ ok: true, durationMs });
});

// ── HTTP + WebSocket server ───────────────────────────────────────────────
const server = http.createServer(app);
// Explicitly dispatch upgrades: two WebSocketServer({server,path}) handlers
// compete for every upgrade and the first one rejects the other's route.
const wss = new WebSocketServer({ noServer:true, path:WS_PATH });

wss.on('connection', (ws) => {
  let streamSid = null;
  let authenticated = false;
  const authTimer = setTimeout(() => {
    if (!authenticated) ws.close(1008, 'Stream authentication required');
  }, 5000);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    debug('twilio→', msg.event);

    if (msg.event === 'connected') return;

    if (msg.event === 'start') {
      if (authenticated) return;
      const start = msg.start;
      // Fail-closed: STREAM_AUTH_TOKEN required (enforced at startup in prod)
      if (!start?.streamSid || !start.callSid ||
          (STREAM_AUTH_TOKEN && start.customParameters?.streamToken !== STREAM_AUTH_TOKEN)) {
        clearTimeout(authTimer);
        ws.close(1008, 'Unauthorized stream');
        return;
      }
      authenticated = true;
      clearTimeout(authTimer);
      streamSid = start.streamSid;
      handleStreamStart(ws, streamSid, start);
      return;
    }

    if (!authenticated || !streamSid || msg.streamSid !== streamSid) return;

    if (msg.event === 'media') {
      const media = msg.media;
      if (media?.track === 'inbound' && media.payload) {
        handleInboundAudio(streamSid, media.payload);
      }
      return;
    }

    // Mark event: Twilio acknowledges that queued audio has finished playing
    if (msg.event === 'mark') {
      handleMark(streamSid, msg.mark);
      return;
    }

    if (msg.event === 'stop') {
      handleStreamStop(streamSid);
      return;
    }
  });

  ws.on('close', (code, reason) => {
    clearTimeout(authTimer);
    if (streamSid) handleStreamStop(streamSid);
    log('stream closed', streamSid, 'code', code, reason.toString());
  });

  ws.on('error', (e) => log('ws error', e?.message));
});


// ── BOB browser transport adapter (isolated from Twilio /ws) ─────────────
// Session ticket is short lived and signed by the BOB backend. The same
// Twilio μ-law framing is used internally so STT, turn timing, TTS playback,
// generations, barge-in, and mark acknowledgements reuse the proven engine.
function bobBridgeReadiness(){
 const cfg={enabled:BOB_BRIDGE_ENABLED,callback:!!BOB_APP_WEBHOOK_URL,
  callbackCredential:BOB_APP_AUTH_TOKEN.length>=24,runtimeCredential:BOB_PLAY_AUTH_TOKEN.length>=24,
  sessionSecret:BOB_BRIDGE_SESSION_SECRET.length>=32,origins:BOB_ALLOWED_ORIGINS.size>0,
  deepgram:!!DEEPGRAM_API_KEY};
 const scopedCallback=(()=>{try{const u=new URL(BOB_APP_WEBHOOK_URL);return u.protocol==='https:' && /\/functions\/bobMediaRelay$/.test(u.pathname)}catch{return false}})();
 return {enabled:cfg.enabled,ready:cfg.enabled && Object.values(cfg).every(Boolean)&&scopedCallback,
  checks:{...cfg,scopedCallback}};
}
// The existing /runtime stays Fronter-only. BOB's health and diagnostics use
// a distinct token and never expose Fronter calls or tenant detail.
app.get('/bob/runtime',(req,res)=>{
 if(!BOB_PLAY_AUTH_TOKEN||req.headers.authorization!==`Bearer ${BOB_PLAY_AUTH_TOKEN}`)
  return res.status(401).json({error:'unauthorized'});
 const state=bobBridgeReadiness();
 res.set('Cache-Control','no-store');
 return res.status(state.ready?200:503).json({version:PIPELINE_VERSION,ready:state.ready,
  credentials:{deepgram:!!DEEPGRAM_API_KEY,cartesia:!!CARTESIA_API_KEY,elevenlabs:!!ELEVENLABS_API_KEY},
  calls:Array.from(streams.values()).filter(s=>s.browser).map(runtimeSnapshot),
  lastCall:lastCall?.browser?lastCall:null});
});
const bobWss = new WebSocketServer({noServer:true,path:'/bob/ws'});
const plainBobSessions=new Map();
const insureIqBob=installInsureIqBobTransport({app,WebSocket,WebSocketServer,deepgramKey:DEEPGRAM_API_KEY,startPlainBobAgent});
// ONE HTTP upgrade listener owns both mutually exclusive paths. Fronter's
// legacy /ws handshake and BOB's /bob/ws handshake never compete.
if(WS_PATH==='/bob/ws')throw new Error('Legacy Twilio path may not overlap BOB route');
server.on('upgrade',(req,socket,head)=>{
 let pathname='';
 try{pathname=new URL(req.url||'/', 'http://localhost').pathname}catch{socket.destroy();return}
 const handler=pathname===WS_PATH?wss:pathname==='/bob/ws'?bobWss:pathname===insureIqBob.path?insureIqBob.wss:null;
 if(!handler){socket.destroy();return}
 handler.handleUpgrade(req,socket,head,ws=>handler.emit('connection',ws,req));
});
const bobTicketReplay=new Map();
function verifyBobTicket(token){
 if(!BOB_BRIDGE_SESSION_SECRET || BOB_BRIDGE_SESSION_SECRET.length<32)throw Error('BOB ticket secret is unconfigured');
 const parts=String(token||'').split('.');
 if(parts.length!==2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[0-9a-f]{64}$/.test(parts[1]))throw Error('Malformed BOB ticket');
 const signed=nodeCrypto.createHmac('sha256',BOB_BRIDGE_SESSION_SECRET).update(parts[0]).digest('hex');
 if(!nodeCrypto.timingSafeEqual(Buffer.from(signed,'hex'),Buffer.from(parts[1],'hex')))throw Error('Invalid BOB signature');
 const decoded=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
 const now=Math.floor(Date.now()/1000);
 if(!decoded || decoded.app_key!=='bob' || !/^[a-zA-Z0-9._-]{1,100}$/.test(decoded.org_id||'') ||
    !/^[a-zA-Z0-9._-]{1,100}$/.test(decoded.session_id||'') ||
    !Number.isFinite(decoded.issued_at) || !Number.isFinite(decoded.expires_at) ||
    decoded.issued_at>now+30 || decoded.expires_at<now ||
    decoded.expires_at>decoded.issued_at+300 || decoded.expires_at>now+300)throw Error('BOB ticket expired or invalid');
 // One-time ticket check on this staging instance only; shared replay DB
 // is required when running multiple bridge replicas.
 for(const [id,expiration] of bobTicketReplay){if(expiration<now)bobTicketReplay.delete(id)}
 if(bobTicketReplay.has(parts[1]))throw Error('BOB ticket replay');
 if(bobTicketReplay.size>4000)throw Error('BOB ticket replay cache saturated');
 bobTicketReplay.set(parts[1],decoded.expires_at);
 return decoded;
}
bobWss.on('connection',(ws,req)=>{
 if(!bobBridgeReadiness().ready){ws.close(1013,'BOB bridge disabled or unconfigured');return}
 const origin=req.headers.origin||'';
 if(!BOB_ALLOWED_ORIGINS.has(origin)){ws.close(1008,'BOB origin rejected');return}
 let streamSid=null,authenticated=false;
 const authTimer=setTimeout(()=>{if(!authenticated)ws.close(1008,'BOB ticket required')},5000);
 ws.isAlive=true;
 ws.on('pong',()=>{ws.isAlive=true});
 let sessionTimer=null;
 ws.on('message',async(raw)=>{
  let m;try{m=JSON.parse(raw.toString())}catch{return}
  if(!authenticated){
   if(m.event!=='start')return;
   try{
    const ticket=verifyBobTicket(m.ticket);
    if(m.sessionId!==ticket.session_id || m.organizationId!==ticket.org_id)
      throw Error('BOB session/organization mismatch');
    if(ticket.mode_id && !['plain','jacked_up'].includes(ticket.mode_id))
      throw Error('BOB session mode not authorized');
    authenticated=true;clearTimeout(authTimer);
    streamSid=ticket.session_id;
    const trainingPrompt=String(m.trainingPrompt||'').slice(0,12000);
    if(ticket.mode_id==='plain'){
      // Base44 verifies the signed grant and returns only the pinned settings.
      // No Google Gemini key is needed: Deepgram manages Google internally.
      const init=await callRelay({_bobTransport:true,event:'init',streamSid,callSid:streamSid,leadId:streamSid,trainingPrompt});
      if(init?.serviceTier!=='plain'||init.voiceAgentSettings?.agent?.think?.provider?.type!=='google')
       throw Error('Plain BOB signed session does not match the managed Deepgram provider');
      if(ws.readyState!==WebSocket.OPEN)return;
      const agent=startPlainBobAgent({browser:ws,sessionId:streamSid,settings:init.voiceAgentSettings,
       apiKey:DEEPGRAM_API_KEY,WebSocket,
       emit:payload=>{if(ws.readyState===WebSocket.OPEN)sendToTwilio(ws,payload)},
       reportUsage:callRelay,reportStop:callRelay,
       onExit:id=>plainBobSessions.delete(id)});
      plainBobSessions.set(streamSid,agent);
    }else{
      // Existing Jacked Up BOB/Fronter engine: independent Deepgram STT,
      // Anthropic dialogue and Cartesia speech. No voice-agent bundle.
      handleStreamStart(ws,streamSid,{
       streamSid,callSid:streamSid,
       customParameters:{leadId:streamSid,organizationId:ticket.org_id,browser:true,trainingPrompt}
      });
    }
    const maxSeconds=Number(ticket.max_session_seconds);
    sessionTimer=setTimeout(()=>{try{ws.close(1000,'Authorized BOB time limit')}catch{}},
      Number.isFinite(maxSeconds)?Math.max(60,Math.min(1800,maxSeconds))*1000:1800000);
    ws.send(JSON.stringify({event:'accepted',sessionId:streamSid,codec:'mulaw',sampleRate:8000}));
   }catch(e){log('[BOB] browser auth rejected:',e?.message);ws.close(1008,'BOB authentication failed')}
   return;
  }
  if(m.sessionId!==streamSid)return;
  const managed=plainBobSessions.get(streamSid);
  if(m.event==='audio' && typeof m.payload==='string' && m.payload.length<=32768 &&
     /^[A-Za-z0-9+/=]+$/.test(m.payload)){
     if(managed)managed.audio(m.payload);else handleInboundAudio(streamSid,m.payload);
  }
  if(m.event==='mark'&&!managed)handleMark(streamSid,{name:String(m.name||'browser_playback_complete').slice(0,80)});
  if(m.event==='stop'){if(managed)managed.finish();else handleStreamStop(streamSid)}
 });
 ws.on('close',()=>{clearTimeout(authTimer);if(sessionTimer)clearTimeout(sessionTimer);
   if(streamSid){const managed=plainBobSessions.get(streamSid);if(managed)managed.finish();else handleStreamStop(streamSid)}});
 ws.on('error',e=>log('[BOB] browser socket error',String(e?.message||'')));
});
// ── End BOB browser transport ────────────────────────────────────────────

// Per-operation provider consumption observations. Provider billing remains
// 'unavailable' until external invoice/receipt reconciliation. Never infer price.
function meterTTS(session,streamSid,text){
 if(!session.browser||!text||!session.tts)return;
 const usage=session.tts,seq=++session.ttsMeterSequence;
 const provider=usage.engine||session.config.ttsEngine||'unknown';
 const chars=[...String(text)].length;
 callRelay({event:'usage',streamSid,callSid:session.callSid,leadId:session.leadId,
  usage:{service:'bob_tts',provider,model:usage.model||'unavailable',
   synthesisCharacters:chars,providerUnits:chars,providerRequestId:usage.providerRequestId||'',
   generationState:usage.state||'unverified',
   providerUnitType:'submitted_characters_unreconciled',
   requestId:'tts:'+streamSid+':'+seq}})
 .catch(e=>log('[BOB] TTS meter outbox unavailable',String(e?.message||'').slice(0,130)));
}
// ── Stream lifecycle ────────────────────────────────────────────────────
async function handleStreamStart(ws, streamSid, start) {
  const leadId = start.customParameters?.leadId || '';
  const session = {
    browser:!!start.customParameters?.browser,
    trainingPrompt:String(start.customParameters?.trainingPrompt||'').slice(0,16000),
    sttBytesSent:0,ttsMeterSequence:0,
    ws,
    callSid: start.callSid,
    leadId,
    dgWs: null,
    generation: 0,        // increments on each AI response (barge-in tracking)
    callerSpeaking: false, // true from caller speech start until it ends
    bargeTimer: null,      // pending barge-in confirmation (grace window)
    state: 'initializing', // pipeline is loaded before opening STT
    conversation: [],
    recordingBuffer: [],
    eventQueue: Promise.resolve(),
    startedAt: Date.now(),
    stopping: false,
    config: {},
  };
  streams.set(streamSid, session);
  log('stream start', streamSid, 'call', start.callSid, 'lead', leadId);

  // Load the selected pipeline FIRST; environment defaults must not override selectors.
  try {
    const initResp = await callRelay({ event: 'init', streamSid, callSid: start.callSid, leadId,
      ...(session.browser?{trainingPrompt:session.trainingPrompt}:{}) });
    if (session.stopping) return;
    if (!initResp.pipeline?.valid || initResp.pipeline.version !== PIPELINE_VERSION) throw new Error('Relay pipeline is missing or outdated; update the relay.');
    session.leadId = initResp.leadId || leadId;
    session.config = { ...initResp.pipeline, configUpdatedAt: initResp.configUpdatedAt };
    session.state = 'listening';
    openDeepgram(session, streamSid);

    // Generate and play greeting — stream via Deepgram for lowest latency
    if (initResp.greeting) {
      session.conversation.push({ role: 'assistant', content: initResp.greeting });
      if(session.browser)sendToTwilio(session.ws,{event:'bob_transcript',role:'bob',text:initResp.greeting});
      session.state = 'speaking';
      session.generation++;
      const gen = session.generation;
      armSpeakingWatchdog(session, streamSid);
      const ttsEngine = session.config.ttsEngine || TTS_ENGINE;
      let ok = false;
      if (ttsEngine === 'flux' && DEEPGRAM_API_KEY) {
        ok = await streamFluxTTS(initResp.greeting, streamSid, session, gen);
      } else if (ttsEngine === 'deepgram-aura' && DEEPGRAM_API_KEY) {
        ok = await streamDeepgramTTS(initResp.greeting, streamSid, session, gen);
      } else if (ttsEngine === 'cartesia' && CARTESIA_API_KEY) {
        ok = await streamCartesiaTTS(initResp.greeting, streamSid, session, gen);
      }
      if (!ok) {
        const tts = await generateTTS(initResp.greeting, session.config, session);
        if (tts && session.generation === gen) { session.recordingBuffer.push(tts); playAudio(streamSid, tts, gen); }
        else { session.state = 'listening'; clearSpeakingWatchdog(session); }
      } else if (session.generation !== gen) {
        session.state = 'listening';
        clearSpeakingWatchdog(session);
      }
      if(ok || session.tts?.state==='accepted')meterTTS(session,streamSid,initResp.greeting);
    }
  } catch (e) {
    session.state = 'error';
    session.error = e?.message;
    log('init failed', e?.message);
    if(session.browser)sendToTwilio(session.ws,{event:'bob_error',message:String(e?.message||'Training initialization failed').slice(0,180)});
  }
}

function handleInboundAudio(streamSid, audioPayload) {
  const session = streams.get(streamSid);
  if (!session) return;

  // Add to recording buffer
  session.recordingBuffer.push(audioPayload);

  // Forward to Deepgram if connected (backpressure check)
  if (session.dgWs && session.dgWs.readyState === WebSocket.OPEN) {
    if (session.dgWs.bufferedAmount > 500000) {
      debug('deepgram backpressure, dropping audio');
      return;
    }
    const raw = Buffer.from(audioPayload, 'base64');
    session.dgWs.send(raw);
    session.sttBytesSent+=raw.length;
  }
}

function handleMark(streamSid, mark) {
  const session = streams.get(streamSid);
  if (!session) return;
  // Mark received = playback completed → resume listening
  if (session.state === 'speaking') {
    session.state = 'listening';
    clearSpeakingWatchdog(session);
    debug('playback completed, gen', session.generation);
  }
}

async function handleStreamStop(streamSid) {
  const session = streams.get(streamSid);
  if (!session || session.stopping) return; // idempotent
  session.stopping = true;
  clearSpeakingWatchdog(session);
  streams.delete(streamSid);

  // Close Deepgram connection (flush final results)
  if (session.dgWs) {
    try {
      session.dgWs.send(JSON.stringify({ type: 'CloseStream' }));
      await new Promise(r => setTimeout(r, 500));
      session.dgWs.close();
    } catch {}
    session.dgWs = null;
  }

  // Serialized: wait for all pending events, then send stop
  await enqueue(session, async () => {
    let recordingBase64 = '';
    if (session.recordingBuffer.length > 0) {
      recordingBase64 = session.recordingBuffer.join('');
    }
    try {
      if(session.browser && session.sttBytesSent>0){
        await callRelay({event:'usage',streamSid,callSid:session.callSid,leadId:session.leadId,
         _bobTransport:session.browser,
         usage:{service:'bob_stt',provider:'deepgram',model:session.stt?.model||session.config?.sttModel||'unknown',
          audioSeconds:session.sttBytesSent/8000,providerUnits:session.sttBytesSent/8000,
          providerRequestId:session.sttRequestId||'',
          providerUnitType:'audio_seconds_forwarded_unreconciled',requestId:'stt:'+streamSid}});
      }
      await callRelay({
        event: 'stop',
        _bobTransport:session.browser,
        streamSid,
        callSid: session.callSid,
        conversation: session.browser?[]:session.conversation,
        ...(session.browser?{durationSeconds:Math.max(0,Math.round((Date.now()-session.startedAt)/1000))}:{}),
        recordingBase64:session.browser?'':recordingBase64,
        leadId: session.leadId,
      });
    } catch (e) {
      log('stop relay failed', e?.message);
    }
  });

  lastCall = { ...runtimeSnapshot(session), state: 'completed' };
  log('stream stop', streamSid, 'dur', Math.round((Date.now() - session.startedAt) / 1000) + 's');
}

// ── Deepgram streaming STT ──────────────────────────────────────────────
function openDeepgram(session, streamSid) {
  const sttModel = session.config.sttModel || 'nova-2';
  const isFlux = sttModel.startsWith('flux');
  session.stt = { model: sttModel, state: 'connecting', at: new Date().toISOString() };
  if (!DEEPGRAM_API_KEY) {
    session.stt.state = 'error'; session.stt.error = 'Deepgram key missing';
    log('no DEEPGRAM_API_KEY, skipping STT');
    return;
  }

  // Flux uses /v2/listen with model-integrated turn detection (TurnInfo/EndOfTurn events).
  // Nova uses /v1/listen with VAD + endpointing (speech_final events).
  let params, endpoint;
  if (isFlux) {
    // v2/listen does not accept 'channels' — it auto-detects from the audio stream
    params = new URLSearchParams({ encoding: 'mulaw', sample_rate: '8000', model: sttModel });
    endpoint = 'v2/listen';
  } else {
    params = new URLSearchParams({
      encoding: 'mulaw', sample_rate: '8000', channels: '1', model: sttModel,
      smart_format: 'true', punctuate: 'true', interim_results: 'true',
      endpointing: '200', vad_events: 'true',
    });
    endpoint = 'v1/listen';
  }

  const dgWs = new WebSocket(`wss://api.deepgram.com/${endpoint}?${params}`, {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
  });

  dgWs.on('upgrade',(response)=>{
    const id=String(response?.headers?.['dg-request-id']||'');
    if(/^[a-z0-9-]{8,80}$/i.test(id))session.sttRequestId=id;
  });
  dgWs.on('open', () => { session.stt.state = 'connected'; session.stt.at = new Date().toISOString(); log('deepgram connected', streamSid, sttModel); });

  dgWs.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if(msg?.metadata?.request_id && /^[a-z0-9-]{8,80}$/i.test(String(msg.metadata.request_id)))session.sttRequestId=String(msg.metadata.request_id);
    if(msg?.request_id && !session.sttRequestId && /^[a-z0-9-]{8,80}$/i.test(String(msg.request_id)))session.sttRequestId=String(msg.request_id);
    if (msg.type === 'Results') {
      session.stt.state = 'accepted'; session.stt.at = new Date().toISOString();
      const modelInfo = Object.values(msg.metadata?.model_info || {})[0];
      if (modelInfo?.name) session.stt.providerModel = modelInfo.name;
      // Nova: use VAD + speech_final for turn detection
      if (!isFlux) {
        const transcript = msg.channel?.alternatives?.[0]?.transcript || '';
        if (msg.vad?.speech_start) {
          session.callerSpeaking = true;
          if (session.state === 'speaking') scheduleBargeIn(session, streamSid);
        }
        if (msg.vad?.speech_end) {
          session.callerSpeaking = false;
          cancelPendingBarge(session);
        }
        if (msg.speech_final) {
          session.callerSpeaking = false;
          cancelPendingBarge(session);
          // A finished, meaningful sentence cuts her off; a backchannel is
          // agreement, so she keeps her train of thought and keeps talking.
          if (transcript.trim() && session.state === 'speaking' && !isBackchannel(transcript, session)) {
            log('barge-in (complete utterance), gen', session.generation);
            session.generation++;
            sendToTwilio(session.ws, { event: 'clear', streamSid });
            clearSpeakingWatchdog(session);
            session.state = 'listening';
          }
          if (transcript.trim() && session.state === 'listening') {
            log('speech_final:', transcript);
            handleUtterance(streamSid, transcript);
          }
        }
      }
    }

    // Flux: use TurnInfo events for model-integrated turn detection
    if (isFlux && msg.type === 'TurnInfo') {
      if (msg.event === 'StartOfTurn') {
        session.callerSpeaking = true;
        if (session.state === 'speaking') scheduleBargeIn(session, streamSid);
      }
      if (msg.event === 'EndOfTurn') {
        session.callerSpeaking = false;
        cancelPendingBarge(session);
        const said = (msg.transcript || '').trim();
        // A finished, meaningful sentence cuts her off; a backchannel is
        // agreement, so she keeps her train of thought and keeps talking.
        if (said && session.state === 'speaking' && !isBackchannel(said, session)) {
          log('flux barge-in (complete utterance), gen', session.generation);
          session.generation++;
          sendToTwilio(session.ws, { event: 'clear', streamSid });
          clearSpeakingWatchdog(session);
          session.state = 'listening';
        }
        if (said && session.state === 'listening') {
          log('flux EndOfTurn:', said);
          handleUtterance(streamSid, said);
        }
      }
    }
  });

  dgWs.on('error', (e) => { session.stt.state = 'error'; session.stt.error = 'Deepgram connection failed'; log('deepgram error', e?.message); });
  dgWs.on('close', () => { session.dgWs = null; if (session.stt.state !== 'error') session.stt.state = 'disconnected'; log('deepgram disconnected', streamSid); });

  session.dgWs = dgWs;
}

// ── Utterance → LLM (via relay) → TTS → playback ───────────────────────
async function handleUtterance(streamSid, transcript) {
  const session = streams.get(streamSid);
  if (!session) return;

  // The caller's turn just ended — start this turn's response clock. The
  // end-of-turn engine (Flux or Nova) and the TTS engine that will answer are
  // recorded with it so Flux turns can be measured against the latency target.
  session.turn = {
    engine: String(session.stt?.model || '').startsWith('flux') ? 'flux' : 'nova',
    tts: session.config?.ttsEngine || null,
    startAt: Date.now(),
    at: new Date().toISOString(),
  };

  session.state = 'thinking';
  session.conversation.push({ role: 'user', content: transcript });
  if(session.browser)sendToTwilio(session.ws,{event:'bob_transcript',role:'user',text:String(transcript).slice(0,2500)});

  try {
    const resp = await callRelay({
      event: 'turn',
      streamSid,
      callSid: session.callSid,
      transcript,
      conversation: session.conversation.slice(-20), // window: last 20 messages
      leadId: session.leadId,
      pipeline: session.config,
      ...(session.browser?{trainingPrompt:session.trainingPrompt}:{}),
    });

    session.llm = resp.llmRuntime || { state: 'unverified' };
    const { action, text, disposition } = resp;
    session.conversation.push({ role: 'assistant', content: text || '' });
    if(session.browser&&text)sendToTwilio(session.ws,{event:'bob_transcript',role:'bob',text:String(text).slice(0,2500)});

    if (action === 'transfer') {
      // Execute transfer via relay (sends email, updates lead, redirects call)
      await callRelay({
        event: 'transfer',
        streamSid,
        callSid: session.callSid,
        conversation: session.conversation,
        leadId: session.leadId,
      });
      return;
    }

    if (action === 'end_call') {
      // Update disposition via relay (does NOT auto-mark as "removed")
      await callRelay({
        event: 'end_call',
        streamSid,
        callSid: session.callSid,
        disposition: disposition || 'no_response',
        leadId: session.leadId,
      });
      return;
    }

    // action === 'speak': stream TTS via Deepgram for lowest latency, fall back to batch
    if (text) {
      session.state = 'speaking';
      session.generation++;
      const gen = session.generation;
      armSpeakingWatchdog(session, streamSid);
      const ttsEngine = session.config.ttsEngine || TTS_ENGINE;
      let ok = false;
      if (ttsEngine === 'flux' && DEEPGRAM_API_KEY) {
        ok = await streamFluxTTS(text, streamSid, session, gen);
      } else if (ttsEngine === 'deepgram-aura' && DEEPGRAM_API_KEY) {
        ok = await streamDeepgramTTS(text, streamSid, session, gen);
      } else if (ttsEngine === 'cartesia' && CARTESIA_API_KEY) {
        ok = await streamCartesiaTTS(text, streamSid, session, gen);
      }
      if (!ok) {
        const tts = await generateTTS(text, session.config, session);
        if (tts && session.generation === gen) { session.recordingBuffer.push(tts); playAudio(streamSid, tts, gen); }
        else { session.state = 'listening'; clearSpeakingWatchdog(session); }
      } else if (session.generation !== gen) {
        session.state = 'listening';
        clearSpeakingWatchdog(session);
      }
      if(ok || session.tts?.state==='accepted')meterTTS(session,streamSid,text);
    } else {
      session.state = 'listening';
    }
  } catch (e) {
    log('utterance handling failed', e?.message);
    session.state = 'listening';
  }
}

// ── Streaming TTS via Deepgram Flux /v2/speak (turn-based, cross-turn voice consistency) ──
async function streamFluxTTS(text, streamSid, session, generation) {
  const voice = session.config.fluxVoiceId || session.config.deepgramTtsVoice || session.config.ttsVoiceModel || 'flux-alexis-en';
  const startedAt = Date.now();
  session.tts = { engine: 'flux', model: voice, voice, state: 'streaming', ms: 0, at: new Date().toISOString() };

  return new Promise((resolve) => {
    let played = false;
    let markSent = false;
    let chunkCount = 0;
    let resolved = false;
    const params = new URLSearchParams({ model: voice, encoding: 'mulaw', sample_rate: '8000' });
    const ws = new WebSocket(`wss://api.deepgram.com/v2/speak?${params}`, {
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
    });

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      session.tts.ms = Date.now() - startedAt;
      session.tts.state = result;
      resolve(result === 'accepted');
    };

    // Always send the mark when audio was played, even if SpeechMetadata never
    // arrives (timeout/error) — otherwise the speaking state sticks and the AI
    // goes deaf to the caller's response.
    const ensureMark = () => {
      if (markSent || !played || generation !== session.generation) return;
      markSent = true;
      sendToTwilio(session.ws, { event: 'mark', streamSid, mark: { name: `gen-${generation}` } });
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'Speak', text }));
      ws.send(JSON.stringify({ type: 'Flush' }));
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        if (generation !== session.generation) { try { ws.send(JSON.stringify({ type: 'Interrupt' })); } catch {} ws.close(); finish('interrupted'); return; }
        const chunk = data.toString('base64');
        if (chunk.length > 0) {
          chunkCount++;
          if (!played) { sendToTwilio(session.ws, { event: 'clear', streamSid }); noteAudioOut(session); played = true; }
          sendToTwilio(session.ws, { event: 'media', streamSid, media: { payload: chunk } });
          session.recordingBuffer.push(chunk);
        }
      } else {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'SpeechMetadata') {
            ensureMark();
            ws.close();
            finish(chunkCount > 0 ? 'accepted' : 'empty');
          }
        } catch {}
      }
    });

    ws.on('close', () => { ensureMark(); finish(chunkCount > 0 ? 'accepted' : 'empty'); });
    ws.on('error', (e) => { log('[streamFluxTTS] error:', e?.message); ensureMark(); finish('error'); });
    setTimeout(() => { if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(); }, 8000);
  });
}

// ── Streaming TTS via Deepgram WebSocket (plays audio chunks as they arrive) ──
// Cuts perceived latency from "full TTS generation" to "first audio chunk" (~200ms).
async function streamDeepgramTTS(text, streamSid, session, generation) {
  const voice = session.config.deepgramTtsVoice || session.config.ttsVoiceModel || DEEPGRAM_TTS_VOICE;
  const startedAt = Date.now();
  session.tts = { engine: 'deepgram-aura', model: voice, voice, state: 'streaming', ms: 0, at: new Date().toISOString() };

  return new Promise((resolve) => {
    let played = false;
    let chunkCount = 0;
    const params = new URLSearchParams({
      model: voice,
      encoding: 'mulaw',
      sample_rate: '8000',
      container: 'none',
    });
    const ws = new WebSocket(`wss://api.deepgram.com/v1/speak?${params}`, {
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
    });

    const cleanup = (result) => {
      session.tts.ms = Date.now() - startedAt;
      session.tts.state = result;
      resolve(result === 'accepted');
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({ text }));
      ws.send(JSON.stringify({ type: 'CloseStream' }));
    });

    ws.on('upgrade',response=>{const id=String(response?.headers?.['dg-request-id']||'');if(/^[a-z0-9-]{8,80}$/i.test(id))session.tts.providerRequestId=id;});
    ws.on('message', (data, isBinary) => {
      if(!isBinary){
        try{const metadata=JSON.parse(data.toString());
          if(metadata.request_id&&/^[a-z0-9-]{8,80}$/i.test(String(metadata.request_id)))session.tts.providerRequestId=String(metadata.request_id);
        }catch{}
        return;
      }
      // Barge-in check: drop stale audio if generation was invalidated
      if (generation !== session.generation) { ws.close(); cleanup('interrupted'); return; }
      const chunk = data.toString('base64');
      if (chunk.length > 0) {
        chunkCount++;
        if (!played) { sendToTwilio(session.ws, { event: 'clear', streamSid }); noteAudioOut(session); played = true; }
        sendToTwilio(session.ws, { event: 'media', streamSid, media: { payload: chunk } });
        session.recordingBuffer.push(chunk);
      }
    });

    ws.on('close', () => {
      if (played && generation === session.generation) {
        sendToTwilio(session.ws, { event: 'mark', streamSid, mark: { name: `gen-${generation}` } });
      }
      cleanup(chunkCount > 0 ? 'accepted' : 'empty');
    });

    ws.on('error', (e) => {
      log('[streamTTS] Deepgram stream error:', e?.message);
      // If audio was already played, send the mark so the speaking state
      // doesn't stick — otherwise the AI would never hear the caller again.
      if (played && generation === session.generation) {
        sendToTwilio(session.ws, { event: 'mark', streamSid, mark: { name: `gen-${generation}` } });
      }
      cleanup('error');
    });

    // Timeout: if no audio in 8s, abort and fall back to non-streaming
    setTimeout(() => { if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) { ws.close(); } }, 8000);
  });
}

// ── Streaming TTS via Cartesia Sonic (µ-law chunks streamed as generated) ──
// Cartesia's /tts/bytes endpoint streams the audio as it is synthesized, so the
// first chunk reaches Twilio in ~90ms of model time instead of after a full
// render. Same barge-in rules as the Deepgram streamers: a bumped generation
// abandons the stream and never re-speaks stale text.
async function streamCartesiaTTS(text, streamSid, session, generation) {
  const voice = session.config.cartesiaVoiceId || CARTESIA_VOICE_ID;
  const startedAt = Date.now();
  session.tts = { engine: 'cartesia', model: CARTESIA_MODEL, voice, state: 'streaming', ms: 0, at: new Date().toISOString() };

  let played = false;
  let chunkCount = 0;
  let markSent = false;
  const clean = value => {
    let message = String(value || '');
    if (CARTESIA_API_KEY) message = message.split(CARTESIA_API_KEY).join('[redacted]');
    return message.slice(0, 500);
  };
  const ensureMark = () => {
    if (markSent || !played || generation !== session.generation) return;
    markSent = true;
    sendToTwilio(session.ws, { event: 'mark', streamSid, mark: { name: `gen-${generation}` } });
  };
  const finish = (state, error = null) => {
    session.tts = { ...session.tts, state, error, ms: Date.now() - startedAt };
  };

  try {
    const res = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CARTESIA_API_KEY}`,
        'Cartesia-Version': CARTESIA_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: CARTESIA_MODEL,
        transcript: text,
        voice: { mode: 'id', id: voice },
        output_format: { container: 'raw', encoding: 'pcm_mulaw', sample_rate: 8000 },
        language: 'en',
      }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });

    const providerId=String(res.headers?.get?.('x-request-id')||res.headers?.get?.('cartesia-request-id')||'');
    if(/^[a-z0-9_-]{8,120}$/i.test(providerId))session.tts.providerRequestId=providerId;
    if (!res.ok) {
      const details = clean(await res.text());
      log('[streamCartesiaTTS] HTTP', res.status, details);
      finish('error', `HTTP ${res.status}: ${details}`);
      return false;
    }

    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (generation !== session.generation) { await reader.cancel().catch(() => {}); break; }
      const payload = Buffer.from(value).toString('base64');
      if (!payload.length) continue;
      chunkCount++;
      if (!played) { sendToTwilio(session.ws, { event: 'clear', streamSid }); noteAudioOut(session); played = true; }
      sendToTwilio(session.ws, { event: 'media', streamSid, media: { payload } });
      session.recordingBuffer.push(payload);
    }
    ensureMark();
    finish(chunkCount > 0 ? 'accepted' : 'empty');
    return chunkCount > 0;
  } catch (e) {
    ensureMark();
    const message = clean(e?.message || e);
    log('[streamCartesiaTTS] failed', message);
    finish('error', message);
    // Audio already played counts as success — a barge-in must not trigger a re-speak.
    return chunkCount > 0;
  }
}

// ── TTS generation (Cartesia / ElevenLabs preferred, Deepgram Aura fallback) ──
async function generateTTS(text, config = {}, session = null) {
  const engine = config.ttsEngine || TTS_ENGINE;
  const elevenLabsVoiceId = config.elevenLabsVoiceId || (engine === 'elevenlabs' ? config.ttsVoiceModel : '') || ELEVENLABS_VOICE_ID;
  const deepgramVoice = config.deepgramTtsVoice || (engine === 'deepgram-aura' ? config.ttsVoiceModel : '') || DEEPGRAM_TTS_VOICE;
  const cartesiaVoice = config.cartesiaVoiceId || CARTESIA_VOICE_ID;
  // /v1/speak rejects Flux model strings, so a Flux selection must batch through
  // an Aura voice — otherwise a failed Flux stream leaves the agent silent.
  const batchVoice = engine === 'flux' ? DEEPGRAM_TTS_VOICE : deepgramVoice;
  const synthesisModel = config.ttsSynthesisModel || 'eleven_flash_v2_5';
  const startedAt = Date.now();
  let fallback = null;
  let elevenLabsFailure = null;
  const safeError = value => {
    let message = String(value || '');
    for (const key of [ELEVENLABS_API_KEY, DEEPGRAM_API_KEY, CARTESIA_API_KEY]) {
      if (key) message = message.split(key).join('[redacted]');
    }
    return message.slice(0, 1000);
  };
  const failEleven = (kind, message, status = null, body = null) => {
    elevenLabsFailure = { provider: 'elevenlabs', keyPresent: !!ELEVENLABS_API_KEY, model: synthesisModel, voice: elevenLabsVoiceId, kind, status, body: body == null ? null : safeError(body), message: safeError(message) };
    log('[TTS] ElevenLabs failure:', JSON.stringify(elevenLabsFailure));
  };
  const record = (provider, model, voice, state, error = null) => {
    if (session) session.tts = { engine: provider, model, voice, state, fallback, error: error || elevenLabsFailure?.message || null, failure: elevenLabsFailure, ms: Date.now() - startedAt, at: new Date().toISOString() };
  };
  record(engine, engine === 'elevenlabs' ? synthesisModel : engine === 'cartesia' ? CARTESIA_MODEL : deepgramVoice, engine === 'elevenlabs' ? elevenLabsVoiceId : engine === 'cartesia' ? cartesiaVoice : deepgramVoice, 'requested');
  log('[TTS] Provider selected:', engine);
  log('[TTS] ElevenLabs key present:', !!ELEVENLABS_API_KEY);
  log('[TTS] ElevenLabs voice ID:', elevenLabsVoiceId);
  log('[TTS] ElevenLabs model:', synthesisModel);

  if (engine === 'cartesia' && CARTESIA_API_KEY) {
    try {
      const res = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CARTESIA_API_KEY}`, 'Cartesia-Version': CARTESIA_VERSION, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: CARTESIA_MODEL,
          transcript: text,
          voice: { mode: 'id', id: cartesiaVoice },
          output_format: { container: 'raw', encoding: 'pcm_mulaw', sample_rate: 8000 },
          language: 'en',
        }),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (res.ok) {
        const audio = Buffer.from(await res.arrayBuffer());
        if (audio.length > 0) {
          log('[TTS] Cartesia accepted:', res.status, 'bytes:', audio.length);
          record('cartesia', CARTESIA_MODEL, cartesiaVoice, 'accepted');
          return audio.toString('base64');
        }
        log('[TTS] Cartesia returned empty audio');
      } else {
        log('[TTS] Cartesia error', res.status, safeError(await res.text()));
      }
    } catch (e) {
      log('[TTS] Cartesia failed', safeError(e?.message));
    }
    fallback = 'Cartesia failed; using the other providers.';
  } else if (engine === 'cartesia') {
    log('[TTS] Cartesia selected but CARTESIA_API_KEY is not set on the bridge');
    fallback = 'Cartesia key missing on bridge; using the other providers.';
  }

  if (engine === 'elevenlabs' && ELEVENLABS_API_KEY) {
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(elevenLabsVoiceId)}?output_format=ulaw_8000`,
        {
          method: 'POST',
          headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/*' },
          body: JSON.stringify({ text, model_id: synthesisModel, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed: ELEVENLABS_SPEED } }),
          signal: AbortSignal.timeout(15000),
        }
      );
      if (res.ok) {
        const audio = Buffer.from(await res.arrayBuffer());
        if (audio.length > 0) {
          log('[TTS] ElevenLabs accepted:', res.status, 'bytes:', audio.length);
          record('elevenlabs', synthesisModel, elevenLabsVoiceId, 'accepted');
          return audio.toString('base64');
        }
        failEleven('empty_audio', 'ElevenLabs returned empty audio', res.status);
      } else {
        const details = safeError(await res.text());
        failEleven('http_error', `HTTP ${res.status}: ${details}`, res.status, details);
      }
    } catch (e) {
      failEleven('request_error', e?.message || 'ElevenLabs request failed');
    }
  } else if (engine === 'elevenlabs') {
    failEleven('missing_key', 'ELEVENLABS_API_KEY not set on bridge');
  }

  if (engine === 'elevenlabs') fallback = `ElevenLabs failed (${elevenLabsFailure?.message}); using Deepgram Aura.`;
  if (DEEPGRAM_API_KEY) {
    try {
      const res = await fetch(
        `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(batchVoice)}&encoding=mulaw&sample_rate=8000&container=none`,
        {
          method: 'POST',
          headers: { 'Authorization': `Token ${DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'audio/*' },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(15000),
        }
      );
      if (res.ok) {
        const audio = Buffer.from(await res.arrayBuffer());
        if (audio.length > 0) {
          log('deepgram TTS success; bytes', audio.length);
          record('deepgram-aura', batchVoice, batchVoice, 'accepted');
          return audio.toString('base64');
        }
        log('deepgram TTS returned empty audio');
      } else {
        log('deepgram TTS error', res.status, safeError(await res.text()));
      }
    } catch (e) {
      log('deepgram TTS failed', safeError(e?.message));
    }
  } else {
    log('Deepgram fallback unavailable: missing DEEPGRAM_API_KEY');
  }
  record(engine, engine === 'elevenlabs' ? synthesisModel : engine === 'cartesia' ? CARTESIA_MODEL : deepgramVoice, engine === 'elevenlabs' ? elevenLabsVoiceId : engine === 'cartesia' ? cartesiaVoice : deepgramVoice, 'error', `No provider returned audio.${elevenLabsFailure ? ` ${elevenLabsFailure.message}` : ''}`);
  log('TTS failed: no provider returned audio');
  return null;
}

// ── Turn response latency (caller stopped → agent's first audio out) ────
// Closes the clock opened in handleUtterance on the first audio of the reply,
// so the dashboard can score each turn against the low-latency target.
function noteAudioOut(session) {
  if (!session?.turn || session.turn.ms != null) return;
  const ms = Date.now() - session.turn.startAt;
  session.turn = { ...session.turn, ms };
  session.turnSamples = [
    ...(session.turnSamples || []),
    { ms, stt: session.turn.engine, tts: session.turn.tts, at: new Date().toISOString() },
  ].slice(-20);
}

// ── Playback with generation-aware interruption prevention ─────────────
function playAudio(streamSid, audioBase64, generation) {
  const session = streams.get(streamSid);
  if (!session) return;
  // Drop stale audio if generation was invalidated by barge-in
  if (generation !== session.generation) {
    debug('stale audio dropped, gen', generation, 'current', session.generation);
    return;
  }
  noteAudioOut(session);
  // Clear any queued audio first (safety — prevents overlap)
  sendToTwilio(session.ws, { event: 'clear', streamSid });
  // Send audio
  sendToTwilio(session.ws, { event: 'media', streamSid, media: { payload: audioBase64 } });
  // Send mark to track playback completion
  sendToTwilio(session.ws, { event: 'mark', streamSid, mark: { name: `gen-${generation}` } });
}

// ── Helpers ────────────────────────────────────────────────────────────
function sendToTwilio(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// Per-stream serialized event queue: guarantees ordered delivery
function enqueue(session, fn) {
  session.eventQueue = session.eventQueue.then(fn, fn).catch((e) => {
    log('event queue error', e?.message);
  });
  return session.eventQueue;
}

// Call mediaStreamRelay with timeout
async function callRelay(payload) {
  // Never forward a BOB training transcript to the debt/investor relay.
  // The final stop event may run after stream deletion; its private marker
  // survives that transition but is stripped before transmission.
  const isBob=payload._bobTransport===true||streams.get(payload.streamSid)?.browser===true;
  const { _bobTransport, ...safePayload }=payload;
  if(isBob && !bobBridgeReadiness().ready)throw new Error('BOB callback disabled or unconfigured');
  const endpoint=isBob?BOB_APP_WEBHOOK_URL:APP_WEBHOOK_URL;
  const bearer=isBob?BOB_APP_AUTH_TOKEN:APP_AUTH_TOKEN;
  if(!endpoint)throw new Error(isBob?'BOB callback not configured':'APP_WEBHOOK_URL not configured');
  const headers = { 'Content-Type': 'application/json' };
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(safePayload),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Relay returned HTTP ${res.status} for ${payload.event}`);
  return res.json();
}

// ── Keepalive pings ─────────────────────────────────────────────────────
const pingInterval = setInterval(() => {
  for(const group of [wss,bobWss,insureIqBob.wss])group.clients.forEach(ws=>{
    if(ws.isAlive===false)return ws.terminate();
    ws.isAlive=false;ws.ping();
  });
}, PING_INTERVAL_MS);
wss.on('close', () => clearInterval(pingInterval));

// ── Graceful shutdown ───────────────────────────────────────────────────
function shutdown(sig) {
  log('shutdown', sig);
  clearInterval(pingInterval);
  for(const agent of plainBobSessions.values())agent.finish();
  for(const group of [wss,bobWss,insureIqBob.wss])group.clients.forEach(ws=>{try{ws.close(1001,'server_shutdown')}catch{}});
  streams.clear();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, () => {
  log('listening on :', PORT, 'ws paths', WS_PATH, '/bob/ws', insureIqBob.path);
});