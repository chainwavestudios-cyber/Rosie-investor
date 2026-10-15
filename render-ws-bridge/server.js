/**
 * Rosie WS Bridge — Twilio Media Streams audio transport.
 *
 * Phase 1 (this build): TRANSPORT ONLY.
 *   - Accepts Twilio Media Streams WebSocket connections (wss path /ws).
 *   - Forwards stream lifecycle + audio events to the app backend via HTTP
 *     (APP_WEBHOOK_URL), in batches to keep request volume sane.
 *   - Exposes an HTTP /play endpoint so the app can push TTS audio back into
 *     the active Twilio stream.
 *   - Health check at /health, keepalive pings, graceful shutdown.
 *
 * AI / Deepgram logic stays in the Base44 app for now. When you're ready to
 * move processing into the container, the relay hooks below are the seams:
 *   - onAudioBatch()  → swap the HTTP forward for in-process Deepgram + LLM
 *   - sendToTwilio()   → already used for /play; reuse for in-process TTS
 *
 * Env:
 *   PORT               (default 10000)  HTTP + WS listen port
 *   WS_PATH            (default /ws)     WebSocket path Twilio connects to
 *   APP_WEBHOOK_URL    (required to relay) Base44 function URL that receives batches
 *   APP_AUTH_TOKEN     (optional)        Bearer token sent to APP_WEBHOOK_URL
 *   STREAM_AUTH_TOKEN  (optional)        If set, Twilio must connect with ?token=
 *   AUDIO_BATCH_MS     (default 250)     How often to flush inbound audio to the app
 *   PING_INTERVAL_MS   (default 30000)  WebSocket keepalive ping cadence
 *   LOG_LEVEL          (default info)    info | debug | silent
 */
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 10000);
const WS_PATH = process.env.WS_PATH || '/ws';
const APP_WEBHOOK_URL = process.env.APP_WEBHOOK_URL || '';
const APP_AUTH_TOKEN = process.env.APP_AUTH_TOKEN || '';
const STREAM_AUTH_TOKEN = process.env.STREAM_AUTH_TOKEN || '';
const AUDIO_BATCH_MS = Number(process.env.AUDIO_BATCH_MS || 250);
const PING_INTERVAL_MS = Number(process.env.PING_INTERVAL_MS || 30000);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const log = (...a) => {
  if (LOG_LEVEL === 'silent') return;
  if (LOG_LEVEL === 'debug' || a.length) console.log(new Date().toISOString(), '[bridge]', ...a);
};
const debug = (...a) => { if (LOG_LEVEL === 'debug') console.debug(new Date().toISOString(), '[bridge:debug]', ...a); };

// streamSid -> { ws, callSid, tracks, batch, batchTimer, startedAt }
const streams = new Map();

const app = express();
app.use(express.json({ limit: '2mb' }));

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, activeStreams: streams.size, uptime: process.uptime() });
});

// ── App → Twilio: push audio to play on a stream ──────────────────────────
// POST /play  { streamSid, payload }   payload = base64 mulaw audio
// POST /play  { streamSid, clear }     clear the outbound queue
// POST /play  { streamSid, mark, name } add a mark event
app.post('/play', async (req, res) => {
  const { streamSid, payload, clear, mark } = req.body || {};
  const s = streamSid && streams.get(streamSid);
  if (!s) return res.status(404).json({ error: 'stream_not_found' });
  if (clear) sendToTwilio(s.ws, { event: 'clear', streamSid });
  if (mark) sendToTwilio(s.ws, { event: 'mark', streamSid, mark: { name: mark.name || 'mark' } });
  if (payload) sendToTwilio(s.ws, { event: 'media', streamSid, media: { payload } });
  res.json({ ok: true });
});

// ── HTTP server + WebSocket server ────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: WS_PATH, verifyClient: verifyTwilio });

function verifyTwilio(info, cb) {
  if (!STREAM_AUTH_TOKEN) return cb(true);
  try {
    const url = new URL(info.req.url, 'http://x');
    if (url.searchParams.get('token') === STREAM_AUTH_TOKEN) return cb(true);
  } catch {}
  cb(false, 401, 'Unauthorized');
}

wss.on('connection', (ws) => {
  let streamSid = null;
  let batchTimer = null;
  const batch = { media: [] };

  const flush = () => {
    if (!streamSid || batch.media.length === 0) return;
    const payload = { event: 'media_batch', streamSid, callSid: streams.get(streamSid)?.callSid, media: batch.media.splice(0, batch.media.length) };
    forwardToApp(payload).catch((e) => debug('forward error', e?.message));
  };

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    debug('twilio→', msg.event);

    if (msg.event === 'connected') return; // Twilio handshake ack

    if (msg.event === 'start') {
      streamSid = msg.streamSid;
      const rec = { ws, callSid: msg.callSid, tracks: msg.tracks || [], startedAt: Date.now() };
      streams.set(streamSid, rec);
      log('stream start', streamSid, 'call', msg.callSid);
      batchTimer = setInterval(flush, AUDIO_BATCH_MS);
      forwardToApp({ event: 'start', streamSid, callSid: msg.callSid, tracks: msg.tracks, customParameters: msg.customParameters }).catch(() => {});
      return;
    }

    if (msg.event === 'media') {
      if (!streamSid) streamSid = msg.streamSid;
      batch.media.push({ track: msg.track, chunk: msg.chunk, timestamp: msg.timestamp, payload: msg.payload });
      return;
    }

    if (msg.event === 'stop') {
      log('stream stop', streamSid);
      flush();
      if (batchTimer) clearInterval(batchTimer);
      if (streamSid) forwardToApp({ event: 'stop', streamSid, callSid: streams.get(streamSid)?.callSid }).catch(() => {});
      if (streamSid) streams.delete(streamSid);
      streamSid = null;
      return;
    }
  });

  ws.on('close', () => {
    if (batchTimer) clearInterval(batchTimer);
    flush();
    if (streamSid) {
      forwardToApp({ event: 'stop', streamSid, callSid: streams.get(streamSid)?.callSid }).catch(() => {});
      streams.delete(streamSid);
    }
    log('stream closed', streamSid);
  });

  ws.on('error', (e) => log('ws error', e?.message));
});

// ── Helpers ───────────────────────────────────────────────────────────────
function sendToTwilio(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

async function forwardToApp(payload) {
  if (!APP_WEBHOOK_URL) { debug('no APP_WEBHOOK_URL, dropping', payload.event); return; }
  const headers = { 'Content-Type': 'application/json' };
  if (APP_AUTH_TOKEN) headers['Authorization'] = `Bearer ${APP_AUTH_TOKEN}`;
  const res = await fetch(APP_WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify(payload) });
  // The app may return audio to play inline (optional, phase-2 convenience).
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await res.json().catch(() => null);
    if (body?.play && body.streamSid) {
      const s = streams.get(body.streamSid);
      if (s) sendToTwilio(s.ws, { event: 'media', streamSid: body.streamSid, media: { payload: body.play } });
    }
  }
}

// ── Keepalive pings ───────────────────────────────────────────────────────
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, PING_INTERVAL_MS);
wss.on('close', () => clearInterval(pingInterval));

// ── Graceful shutdown ─────────────────────────────────────────────────────
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
  log('listening on :', PORT, 'ws path', WS_PATH, 'webhook', APP_WEBHOOK_URL ? 'set' : 'NOT SET');
});