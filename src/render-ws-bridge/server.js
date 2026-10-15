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
 *       → { greeting, ttsEngine, ttsVoiceModel, llmModel, leadId, leadFirstName, leadLastName }
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
 *   2. APP_AUTH_TOKEN     — Bridge → Relay: Bearer header on HTTP forward
 *   3. PLAY_AUTH_TOKEN    — Relay → Bridge /play: Bearer header on playback
 *   The stream token is never forwarded to the app or logged.
 *
 * Env:
 *   PORT, WS_PATH, APP_WEBHOOK_URL, APP_AUTH_TOKEN,
 *   STREAM_AUTH_TOKEN (required in production),
 *   PLAY_AUTH_TOKEN (required in production, authenticates /play),
 *   DEEPGRAM_API_KEY (required for streaming STT + TTS fallback),
 *   ELEVENLABS_API_KEY (optional, for TTS),
 *   TTS_ENGINE (elevenlabs|deepgram-aura, default elevenlabs),
 *   ELEVENLABS_VOICE_ID, DEEPGRAM_TTS_VOICE, DEEPGRAM_STT_MODEL,
 *   PING_INTERVAL_MS, LOG_LEVEL, NODE_ENV, HTTP_TIMEOUT_MS
 */
const express = require('express');
const http = require('http');
const { WebSocket, WebSocketServer } = require('ws');

// ── Config ──────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 10000);
const WS_PATH = process.env.WS_PATH || '/ws';
const APP_WEBHOOK_URL = process.env.APP_WEBHOOK_URL || '';
const APP_AUTH_TOKEN = process.env.APP_AUTH_TOKEN || '';
const STREAM_AUTH_TOKEN = process.env.STREAM_AUTH_TOKEN || '';
const PLAY_AUTH_TOKEN = process.env.PLAY_AUTH_TOKEN || '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const TTS_ENGINE = process.env.TTS_ENGINE || 'elevenlabs';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '1SM7GgM6IMuvQlz2BwM3';
const DEEPGRAM_TTS_VOICE = process.env.DEEPGRAM_TTS_VOICE || 'aura-2-thalia-en';
const DEEPGRAM_STT_MODEL = process.env.DEEPGRAM_STT_MODEL || 'nova-2';
const PING_INTERVAL_MS = Number(process.env.PING_INTERVAL_MS || 30000);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';
const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 15000);

// ── Fail-closed: refuse to start without required secrets in production ──
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

// ── Logging ──────────────────────────────────────────────────────────────
const log = (...a) => {
  if (LOG_LEVEL !== 'silent') console.log(new Date().toISOString(), '[bridge]', ...a);
};
const debug = (...a) => {
  if (LOG_LEVEL === 'debug') console.debug(new Date().toISOString(), '[bridge:debug]', ...a);
};

// ── State: streamSid → session ──────────────────────────────────────────
const streams = new Map();

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
  const { streamSid, payload, clear, mark } = req.body || {};
  const s = streamSid && streams.get(streamSid);
  if (!s) return res.status(404).json({ error: 'stream_not_found' });
  if (clear) sendToTwilio(s.ws, { event: 'clear', streamSid });
  if (mark) sendToTwilio(s.ws, { event: 'mark', streamSid, mark: { name: mark.name || 'mark' } });
  if (payload) sendToTwilio(s.ws, { event: 'media', streamSid, media: { payload } });
  res.json({ ok: true });
});

// ── HTTP + WebSocket server ───────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: WS_PATH });

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

// ── Stream lifecycle ────────────────────────────────────────────────────
async function handleStreamStart(ws, streamSid, start) {
  const leadId = start.customParameters?.leadId || '';
  const session = {
    ws,
    callSid: start.callSid,
    leadId,
    dgWs: null,
    generation: 0,        // increments on each AI response (barge-in tracking)
    state: 'listening',   // listening | thinking | speaking
    conversation: [],
    recordingBuffer: [],
    eventQueue: Promise.resolve(),
    startedAt: Date.now(),
    stopping: false,
    config: {},
  };
  streams.set(streamSid, session);
  log('stream start', streamSid, 'call', start.callSid, 'lead', leadId);

  // Open Deepgram streaming STT (doesn't need config — runs in parallel)
  openDeepgram(session, streamSid);

  // Call relay init (gets config + greeting)
  try {
    const initResp = await callRelay({ event: 'init', streamSid, callSid: start.callSid, leadId });
    session.leadId = initResp.leadId || leadId;
    session.config = {
      ttsEngine: initResp.ttsEngine || TTS_ENGINE,

      // Only use this field when it is an actual Deepgram voice/model ID.
      ttsVoiceModel: initResp.ttsVoiceModel || '',

      // These provider-specific fields are optional.
      elevenLabsVoiceId:
        initResp.elevenLabsVoiceId || ELEVENLABS_VOICE_ID,

      deepgramTtsVoice:
        initResp.deepgramTtsVoice || DEEPGRAM_TTS_VOICE,

      llmModel: initResp.llmModel || 'claude-sonnet-5',
    };

    // Generate and play greeting
    if (initResp.greeting) {
      session.conversation.push({ role: 'assistant', content: initResp.greeting });
      session.state = 'speaking';
      session.generation++;
      const gen = session.generation;
      const tts = await generateTTS(initResp.greeting, session.config);
      if (tts && session.generation === gen) {
        session.recordingBuffer.push(tts);
        playAudio(streamSid, tts, gen);
      } else {
        session.state = 'listening';
      }
    }
  } catch (e) {
    log('init failed', e?.message);
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
  }
}

function handleMark(streamSid, mark) {
  const session = streams.get(streamSid);
  if (!session) return;
  // Mark received = playback completed → resume listening
  if (session.state === 'speaking') {
    session.state = 'listening';
    debug('playback completed, gen', session.generation);
  }
}

async function handleStreamStop(streamSid) {
  const session = streams.get(streamSid);
  if (!session || session.stopping) return; // idempotent
  session.stopping = true;
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
      await callRelay({
        event: 'stop',
        streamSid,
        callSid: session.callSid,
        conversation: session.conversation,
        recordingBase64,
        leadId: session.leadId,
      });
    } catch (e) {
      log('stop relay failed', e?.message);
    }
  });

  log('stream stop', streamSid, 'dur', Math.round((Date.now() - session.startedAt) / 1000) + 's');
}

// ── Deepgram streaming STT ──────────────────────────────────────────────
function openDeepgram(session, streamSid) {
  if (!DEEPGRAM_API_KEY) {
    log('no DEEPGRAM_API_KEY, skipping STT');
    return;
  }

  const params = new URLSearchParams({
    encoding: 'mulaw',
    sample_rate: '8000',
    channels: '1',
    model: DEEPGRAM_STT_MODEL,
    smart_format: 'true',
    punctuate: 'true',
    interim_results: 'true',
    endpointing: '300',
    vad_events: 'true',
  });

  const dgWs = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
  });

  dgWs.on('open', () => log('deepgram connected', streamSid));

  dgWs.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'Results') {
      const transcript = msg.channel?.alternatives?.[0]?.transcript || '';

      // Barge-in: caller speaks during AI playback → interrupt
      if (msg.vad?.speech_start && session.state === 'speaking') {
        log('barge-in detected, gen', session.generation);
        session.generation++; // invalidate current playback
        sendToTwilio(session.ws, { event: 'clear', streamSid });
        session.state = 'listening';
        return;
      }

      // On speech_final, process the complete utterance
      if (msg.speech_final && transcript.trim() && session.state === 'listening') {
        log('speech_final:', transcript);
        handleUtterance(streamSid, transcript);
      }
    }
  });

  dgWs.on('error', (e) => log('deepgram error', e?.message));
  dgWs.on('close', () => { session.dgWs = null; log('deepgram disconnected', streamSid); });

  session.dgWs = dgWs;
}

// ── Utterance → LLM (via relay) → TTS → playback ───────────────────────
async function handleUtterance(streamSid, transcript) {
  const session = streams.get(streamSid);
  if (!session) return;

  session.state = 'thinking';
  session.conversation.push({ role: 'user', content: transcript });

  try {
    const resp = await callRelay({
      event: 'turn',
      streamSid,
      callSid: session.callSid,
      transcript,
      conversation: session.conversation.slice(-20), // window: last 20 messages
      leadId: session.leadId,
    });

    const { action, text, disposition } = resp;
    session.conversation.push({ role: 'assistant', content: text || '' });

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

    // action === 'speak': generate TTS and play
    if (text) {
      session.state = 'speaking';
      session.generation++;
      const gen = session.generation;
      const tts = await generateTTS(text, session.config);
      if (tts && session.generation === gen) {
        session.recordingBuffer.push(tts);
        playAudio(streamSid, tts, gen);
      } else {
        session.state = 'listening';
      }
    } else {
      session.state = 'listening';
    }
  } catch (e) {
    log('utterance handling failed', e?.message);
    session.state = 'listening';
  }
}

// ── TTS generation (ElevenLabs preferred, Deepgram Aura fallback) ──────
async function generateTTS(text, config = {}) {
  const engine = config.ttsEngine || TTS_ENGINE;

  // Keep each provider's voice ID separate.
  const elevenLabsVoiceId =
    config.elevenLabsVoiceId || ELEVENLABS_VOICE_ID;

  const deepgramVoice =
    config.deepgramTtsVoice ||
    (engine === 'deepgram-aura' ? config.ttsVoiceModel : '') ||
    DEEPGRAM_TTS_VOICE;

  // Try ElevenLabs first when selected and configured.
  if (engine === 'elevenlabs' && ELEVENLABS_API_KEY) {
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(elevenLabsVoiceId)}?output_format=ulaw_8000`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/*',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (res.ok) {
        const audio = Buffer.from(await res.arrayBuffer());

        if (audio.length > 0) {
          log('elevenlabs TTS success; bytes', audio.length);
          return audio.toString('base64');
        }

        log('elevenlabs TTS returned empty audio');
      } else {
        const details = await res.text();
        log(
          'elevenlabs TTS error',
          res.status,
          details.slice(0, 1000)
        );
      }
    } catch (e) {
      log('elevenlabs TTS failed', e?.message);
    }
  }

  // Deepgram Aura fallback, or primary provider if selected.
  if (DEEPGRAM_API_KEY) {
    try {
      const res = await fetch(
        `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(deepgramVoice)}&encoding=mulaw&sample_rate=8000&container=none`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'audio/*',
          },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (res.ok) {
        const audio = Buffer.from(await res.arrayBuffer());

        if (audio.length > 0) {
          log('deepgram TTS success; bytes', audio.length);
          return audio.toString('base64');
        }

        log('deepgram TTS returned empty audio');
      } else {
        const details = await res.text();
        log(
          'deepgram TTS error',
          res.status,
          details.slice(0, 1000)
        );
      }
    } catch (e) {
      log('deepgram TTS failed', e?.message);
    }
  } else {
    log('Deepgram fallback unavailable: missing DEEPGRAM_API_KEY');
  }

  log('TTS failed: no provider returned audio');
  return null;
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
  if (!APP_WEBHOOK_URL) throw new Error('APP_WEBHOOK_URL not configured');
  const headers = { 'Content-Type': 'application/json' };
  if (APP_AUTH_TOKEN) headers['Authorization'] = `Bearer ${APP_AUTH_TOKEN}`;
  const res = await fetch(APP_WEBHOOK_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Relay returned HTTP ${res.status} for ${payload.event}`);
  return res.json();
}

// ── Keepalive pings ─────────────────────────────────────────────────────
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, PING_INTERVAL_MS);
wss.on('close', () => clearInterval(pingInterval));

// ── Graceful shutdown ───────────────────────────────────────────────────
function shutdown(sig) {
  log('shutdown', sig);
  clearInterval(pingInterval);
  wss.clients.forEach((ws) => { try { ws.close(1001, 'server_shutdown'); } catch {} });
  streams.clear();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, () => {
  log('listening on :', PORT, 'ws path', WS_PATH);
});