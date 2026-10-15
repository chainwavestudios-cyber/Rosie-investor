const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const pipeline = { version: 'selector-runtime-v1', valid: true, llmModel: 'gemini-3-flash', llmRequestModel: 'gemini_3_flash', sttEngine: 'deepgram-nova-3', sttModel: 'nova-3', ttsEngine: 'elevenlabs', ttsVoiceModel: 'customVoice12345', ttsSynthesisModel: 'eleven_flash_v2_5' };
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness(file, { settings = pipeline, rejectEleven = false, failureStatus = 403, responseBody = 'rejected', elevenKey = 'inert-eleven', emptyEleven = false, throwEleven = false } = {}) {
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
    require(name) { if (name === 'express') return express; if (name === 'http') return { createServer: () => ({ listen() {}, close() {} }) }; if (name === 'ws') return { WebSocket: MockSocket, WebSocketServer: MockServer }; throw new Error(name); },
    process: { env: { DEEPGRAM_API_KEY: 'inert-deepgram', ELEVENLABS_API_KEY: elevenKey, STREAM_AUTH_TOKEN: 'inert-stream', PLAY_AUTH_TOKEN: 'inert-play', APP_WEBHOOK_URL: 'https://relay.invalid', APP_AUTH_TOKEN: 'inert-relay', DEEPGRAM_STT_MODEL: 'nova-2', TTS_ENGINE: 'deepgram-aura' }, on() {}, uptime: () => 1 },
    console: { log: (...args) => logs.push(args.join(' ')), debug() {} }, Buffer, URL, URLSearchParams, Date, AbortSignal,
    setTimeout() { return { unref() {} }; }, clearTimeout() {}, setInterval() {}, clearInterval() {},
    async fetch(url, options) {
      const body = JSON.parse(options.body); requests.push({ url, body });
      if (url === 'https://relay.invalid') return { ok: true, json: async () => body.event === 'init' ? { pipeline: settings, greeting: 'Hello' } : { action: 'speak', text: 'Response', llmRuntime: { model: settings.llmRequestModel, state: 'accepted', ms: 17 } } };
      const isEleven = url.includes('elevenlabs');
      if (isEleven && throwEleven) throw new Error('ElevenLabs request timed out');
      const ok = !(rejectEleven && isEleven);
      return { ok, status: ok ? 200 : failureStatus, text: async () => responseBody, arrayBuffer: async () => isEleven && emptyEleven ? new ArrayBuffer(0) : Uint8Array.from([1, 2, 3]).buffer };
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
  return { start, sockets, requests, request, send, logs };
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
    assert.match(call.tts.error, /HTTP 403: rejected/);
    assert.equal(call.tts.failure.status, 403);
    assert.equal(call.tts.failure.body, 'rejected');
  });
  test(`${relative}: dedicated voices override stale generic settings and survive fallback`, async () => {
    const settings = { ...pipeline, elevenLabsVoiceId: 'separateVoice67890', deepgramTtsVoice: 'aura-2-arcas-en' };
    const h = harness(file, { settings, rejectEleven: true }); await h.start();
    assert.match(h.requests.find(item => item.url.includes('elevenlabs')).url, /separateVoice67890/);
    const report = (await h.request('/runtime')).data;
    assert.equal(report.diagnosticsVersion, 'tts-diagnostics-v2');
    assert.equal(report.calls[0].selected.elevenLabsVoiceId, settings.elevenLabsVoiceId);
    assert.equal(report.calls[0].tts.voice, settings.deepgramTtsVoice);
    assert.equal(report.calls[0].tts.failure.voice, settings.elevenLabsVoiceId);
    assert.equal(report.calls[0].tts.failure.model, 'eleven_flash_v2_5');
  });
  for (const status of [400, 401, 402, 403]) {
    test(`${relative}: HTTP ${status} and original response survive successful fallback without exposing keys`, async () => {
      const body = JSON.stringify({ detail: { status: 'provider_rejection', message: 'Request rejected inert-eleven' } });
      const h = harness(file, { rejectEleven: true, failureStatus: status, responseBody: body }); await h.start();
      const call = (await h.request('/runtime')).data.calls[0];
      assert.equal(call.tts.engine, 'deepgram-aura');
      assert.equal(call.tts.state, 'accepted');
      assert.equal(call.tts.failure.status, status);
      assert.equal(call.tts.failure.keyPresent, true);
      assert.match(call.tts.failure.body, /provider_rejection/);
      assert.match(call.tts.error, new RegExp(`HTTP ${status}:`));
      assert.ok(!JSON.stringify(call).includes('inert-eleven'));
      assert.ok(!h.logs.join(' ').includes('inert-eleven'));
    });
  }
  for (const [kind, options] of [['missing_key', { elevenKey: '' }], ['empty_audio', { emptyEleven: true }], ['request_error', { throwEleven: true }]]) {
    test(`${relative}: ${kind} is distinguished from an HTTP rejection`, async () => {
      const h = harness(file, options); await h.start();
      const call = (await h.request('/runtime')).data.calls[0];
      assert.equal(call.tts.engine, 'deepgram-aura');
      assert.equal(call.tts.failure.kind, kind);
      assert.equal(call.tts.failure.status, kind === 'empty_audio' ? 200 : null);
      assert.ok(call.tts.error);
      if (kind === 'missing_key') {
        assert.equal(call.tts.failure.keyPresent, false);
        assert.equal(h.requests.some(item => item.url.includes('elevenlabs')), false);
      }
    });
  }
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