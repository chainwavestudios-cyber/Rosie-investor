/**
 * bargein.test.cjs — Caller turn-taking on the voice bridge.
 *
 * Callers make small sounds while the agent talks. She must not be cut off by a
 * backchannel ("uh-huh") or a blip in the middle of a sentence, and when the
 * caller does say something that matters she must yield AND that sentence must
 * reach the model instead of being dropped.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');

const pipelineFor = (sttEngine, sttModel) => ({
  version: 'selector-runtime-v1', valid: true, llmModel: 'gemini-3-flash', llmRequestModel: 'gemini_3_flash',
  sttEngine, sttModel, ttsEngine: 'elevenlabs', ttsVoiceModel: 'customVoice12345', ttsSynthesisModel: 'eleven_turbo_v2_5',
});
const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function harness(file, settings) {
  const routes = {}, requests = [], sockets = [], logs = [];
  let server;
  const app = { use() {}, get(path, fn) { routes[path] = fn; }, post(path, fn) { routes[path] = fn; } };
  const express = () => app; express.json = () => () => {};
  class MockSocket extends EventEmitter {
    static OPEN = 1;
    constructor(url, options) { super(); this.url = url; this.options = options; this.readyState = 1; this.bufferedAmount = 0; sockets.push(this); }
    send() {} close() {} ping() {}
  }
  class MockServer extends EventEmitter { constructor() { super(); this.clients = new Set(); server = this; } }
  const context = {
    require(name) {
      if (name === 'express') return express;
      if (name === 'http') return { createServer: () => ({ listen() {}, close() {} }) };
      if (name === 'ws') return { WebSocket: MockSocket, WebSocketServer: MockServer };
      throw new Error(name);
    },
    process: {
      env: {
        DEEPGRAM_API_KEY: 'inert-deepgram', ELEVENLABS_API_KEY: 'inert-eleven', STREAM_AUTH_TOKEN: 'inert-stream',
        PLAY_AUTH_TOKEN: 'inert-play', APP_WEBHOOK_URL: 'https://relay.invalid', APP_AUTH_TOKEN: 'inert-relay',
        DEEPGRAM_STT_MODEL: 'nova-2', TTS_ENGINE: 'elevenlabs',
      },
      on() {}, uptime: () => 1,
    },
    console: { log: (...args) => logs.push(args.join(' ')), debug() {}, warn() {} },
    Buffer, URL, URLSearchParams, Date, AbortSignal,
    setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (t) => clearTimeout(t), setInterval: () => 0, clearInterval() {},
    async fetch(url, options) {
      const body = options && options.body ? JSON.parse(options.body) : null;
      requests.push({ url, body });
      if (url === 'https://relay.invalid') {
        return { ok: true, json: async () => (body.event === 'init'
          ? { pipeline: settings, greeting: 'Hello there, this is the greeting.' }
          : { action: 'speak', text: 'Sure, let me explain that.', llmRuntime: { model: 'gemini_3_flash', state: 'accepted', ms: 17 } }) };
      }
      return { ok: true, status: 200, text: async () => '', arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
    },
  };
  vm.runInNewContext(readFileSync(file, 'utf8'), context);
  const ws = new EventEmitter(); ws.readyState = 1; ws.sent = [];
  ws.send = (msg) => ws.sent.push(JSON.parse(msg)); ws.close = () => {};
  server.emit('connection', ws);
  const res = () => { let data, status = 200; return { status(c) { status = c; return this; }, set() { return this; }, json(v) { data = v; return this; }, get data() { return data; }, get code() { return status; } }; };
  const send = (msg) => ws.emit('message', Buffer.from(JSON.stringify(msg)));
  const emitStt = (msg) => sockets[0].emit('message', Buffer.from(JSON.stringify(msg)));
  const clears = () => ws.sent.filter((m) => m.event === 'clear').length;
  const call = async (path, body) => { const r = res(); await routes[path]({ headers: { authorization: 'Bearer inert-play' }, body }, r); return r; };
  return {
    start: async () => { send({ event: 'start', start: { streamSid: 'MZ-test', callSid: 'CA-test', customParameters: { streamToken: 'inert-stream' } } }); await settle(40); },
    emitStt, clears, requests, logs,
    state: async () => (await call('/runtime')).data.calls[0].state,
    spoke: (needle) => requests.some((r) => JSON.stringify(r.body || {}).includes(needle)),
  };
}

for (const relative of ['../../render-ws-bridge/server.js', './server.js']) {
  const file = join(__dirname, relative);
  const flux = () => harness(file, pipelineFor('flux', 'flux-general-en'));

  test(`${relative}: a backchannel does not cut the agent off`, async () => {
    const h = flux(); await h.start();
    const before = h.clears();
    h.emitStt({ type: 'TurnInfo', event: 'StartOfTurn', transcript: '' });
    await settle(30);
    h.emitStt({ type: 'TurnInfo', event: 'EndOfTurn', transcript: 'uh-huh' });
    await settle(60);
    assert.equal(h.clears(), before, 'no interruption for a backchannel');
    assert.equal(await h.state(), 'speaking', 'she keeps talking');
    assert.ok(!h.spoke('uh-huh'), 'a backchannel is not sent to the model as a turn');
  });

  test(`${relative}: a blip that stops leaves her sentence intact`, async () => {
    const h = flux(); await h.start();
    const before = h.clears();
    h.emitStt({ type: 'TurnInfo', event: 'StartOfTurn', transcript: '' });
    await settle(30);
    h.emitStt({ type: 'TurnInfo', event: 'EndOfTurn', transcript: '' });
    await settle(900); // long past the grace window: the pending interrupt must be gone
    assert.equal(h.clears(), before, 'a blip is not an interruption');
    assert.equal(await h.state(), 'speaking', 'she keeps talking');
  });

  test(`${relative}: speech that keeps going interrupts her`, async () => {
    const h = flux(); await h.start();
    const before = h.clears();
    h.emitStt({ type: 'TurnInfo', event: 'StartOfTurn', transcript: '' });
    await settle(900); // caller still talking past the grace window
    assert.equal(h.clears(), before + 1, 'she stops talking for a sustained interruption');
    assert.equal(await h.state(), 'listening', 'she is listening to the caller');
  });

  test(`${relative}: a finished sentence interrupts her and is answered`, async () => {
    const h = flux(); await h.start();
    const before = h.clears();
    h.emitStt({ type: 'TurnInfo', event: 'StartOfTurn', transcript: '' });
    await settle(20);
    h.emitStt({ type: 'TurnInfo', event: 'EndOfTurn', transcript: 'Wait, I have a question about the fees' });
    await settle(80);
    assert.ok(h.clears() > before, 'she stops talking');
    assert.ok(h.spoke('fees'), 'the interrupting sentence reached the model');
  });

  test(`${relative}: backchannel on the Nova engine does not cut her off`, async () => {
    const h = harness(file, pipelineFor('deepgram-nova-3', 'nova-3')); await h.start();
    const before = h.clears();
    h.emitStt({ type: 'Results', channel: { alternatives: [{ transcript: 'right' }] }, vad: { speech_start: true }, speech_final: false });
    await settle(30);
    h.emitStt({ type: 'Results', channel: { alternatives: [{ transcript: 'right' }] }, vad: { speech_end: true }, speech_final: true });
    await settle(60);
    assert.equal(h.clears(), before, 'no interruption for a backchannel');
    assert.equal(await h.state(), 'speaking', 'she keeps talking');
  });
}