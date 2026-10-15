const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const pipeline = { version: 'selector-runtime-v1', valid: true, llmModel: 'gemini-3-flash', llmRequestModel: 'gemini_3_flash', sttEngine: 'deepgram-nova-3', sttModel: 'nova-3', ttsEngine: 'elevenlabs', ttsVoiceModel: 'customVoice12345', ttsSynthesisModel: 'eleven_flash_v2_5' };
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness(file, { settings = pipeline, rejectEleven = false } = {}) {
  const routes = {}, requests = [], sockets = [];
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
    require(name) { if (name === 'express') return express; if (name === 'http') return { createServer: () => ({ listen() {}, close() {} }) }; if (name === 'ws') return { WebSocket: MockSocket, WebSocketServer: MockServer }; throw new Error(name); },
    process: { env: { DEEPGRAM_API_KEY: 'inert-deepgram', ELEVENLABS_API_KEY: 'inert-eleven', STREAM_AUTH_TOKEN: 'inert-stream', PLAY_AUTH_TOKEN: 'inert-play', APP_WEBHOOK_URL: 'https://relay.invalid', APP_AUTH_TOKEN: 'inert-relay', DEEPGRAM_STT_MODEL: 'nova-2', TTS_ENGINE: 'deepgram-aura' }, on() {}, uptime: () => 1 },
    console: { log() {}, debug() {} }, Buffer, URL, URLSearchParams, Date, AbortSignal,
    setTimeout() { return { unref() {} }; }, clearTimeout() {}, setInterval() {}, clearInterval() {},
    async fetch(url, options) {
      const body = JSON.parse(options.body); requests.push({ url, body });
      if (url === 'https://relay.invalid') return { ok: true, json: async () => body.event === 'init' ? { pipeline: settings, greeting: 'Hello' } : { action: 'speak', text: 'Response', llmRuntime: { model: settings.llmRequestModel, state: 'accepted', ms: 17 } } };
      return { ok: !(rejectEleven && url.includes('elevenlabs')), status: 403, text: async () => 'rejected', arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
    },
  };
  vm.runInNewContext(readFileSync(file, 'utf8'), context);
  const ws = new EventEmitter(); ws.readyState = 1; ws.sent = []; ws.send = msg => ws.sent.push(JSON.parse(msg)); ws.close = () => {};
  server.emit('connection', ws);
  const send = msg => ws.emit('message', Buffer.from(JSON.stringify(msg)));
  async function start() { send({ event: 'start', start: { streamSid: 'MZ-test', callSid: 'CA-test', customParameters: { streamToken: 'inert-stream' } } }); await settle(); }
  async function request(path, body, token = 'inert-play') {
    let status = 200, data;
    const res = { status(code) { status = code; return this; }, set() { return this; }, json(value) { data = value; return this; } };
    await routes[path]({ headers: { authorization: `Bearer ${token}` }, body }, res);
    return { status, data };
  }
  return { start, sockets, requests, request, send };
}
for (const relative of ['../../render-ws-bridge/server.js', './server.js']) {
  const file = join(__dirname, relative);
  test(`${relative}: selected Nova-3 overrides environment Nova-2; selected Eleven model and voice reach provider`, async () => {
    const h = harness(file); await h.start();
    assert.equal(new URL(h.sockets[0].url).searchParams.get('model'), 'nova-3');
    const tts = h.requests.find(item => item.url.includes('elevenlabs'));
    assert.equal(tts.body.model_id, 'eleven_flash_v2_5');
    assert.match(tts.url, /customVoice12345/);
    const report = (await h.request('/runtime')).data;
    assert.equal(report.calls[0].tts.state, 'accepted');
    assert.equal(report.calls[0].tts.engine, 'elevenlabs');
    assert.equal(report.calls[0].tts.voice, pipeline.ttsVoiceModel);
    assert.equal((await h.request('/runtime', null, 'wrong')).status, 401);
  });
  test(`${relative}: STT response and LLM request evidence are reported; call snapshot is pinned`, async () => {
    const h = harness(file); await h.start();
    h.sockets[0].emit('open');
    h.send({ event: 'mark', streamSid: 'MZ-test', mark: { name: 'gen-1' } });
    h.sockets[0].emit('message', JSON.stringify({ type: 'Results', speech_final: true, channel: { alternatives: [{ transcript: 'I have a question' }] }, metadata: { model_info: { mock: { name: 'nova-3-general' } } } }));
    await settle();
    const turn = h.requests.find(item => item.body.event === 'turn');
    assert.equal(turn.body.pipeline.llmRequestModel, 'gemini_3_flash');
    assert.equal(turn.body.pipeline.sttModel, 'nova-3');
    const call = (await h.request('/runtime')).data.calls[0];
    assert.equal(call.llm.state, 'accepted');
    assert.equal(call.stt.state, 'accepted');
    assert.equal(call.stt.providerModel, 'nova-3-general');
  });
  test(`${relative}: Eleven failure shows actual Deepgram fallback instead of the selected voice`, async () => {
    const h = harness(file, { rejectEleven: true }); await h.start();
    const call = (await h.request('/runtime')).data.calls[0];
    assert.equal(call.tts.engine, 'deepgram-aura');
    assert.equal(call.tts.voice, 'aura-2-thalia-en');
    assert.match(call.tts.fallback, /ElevenLabs failed/);
  });
  test(`${relative}: selected Deepgram voice is used for greetings and transfer announcements`, async () => {
    const settings = { ...pipeline, ttsEngine: 'deepgram-aura', ttsVoiceModel: 'aura-2-arcas-en', ttsSynthesisModel: 'aura-2-arcas-en', sttModel: 'nova-2' };
    const h = harness(file, { settings }); await h.start();
    assert.equal(new URL(h.sockets[0].url).searchParams.get('model'), 'nova-2');
    assert.equal(h.requests.some(item => item.url.includes('elevenlabs')), false);
    await h.request('/play', { streamSid: 'MZ-test', text: 'Transferring now' });
    const voices = h.requests.filter(item => item.url.includes('/v1/speak'));
    assert.equal(voices.length, 2);
    assert.ok(voices.every(item => new URL(item.url).searchParams.get('model') === 'aura-2-arcas-en'));
  });
  test(`${relative}: missing relay pipeline is a visible failure, not a hardcoded substitute`, async () => {
    const h = harness(file, { settings: null }); await h.start();
    const call = (await h.request('/runtime')).data.calls[0];
    assert.equal(call.state, 'error'); assert.match(call.error, /missing or outdated/);
    assert.equal(h.sockets.length, 0);
  });
}