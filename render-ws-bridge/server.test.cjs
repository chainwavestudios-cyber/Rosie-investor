const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');

// Exercise the actual bridge with inert transport/timers, never a live call.
function harness({ holdStart = false, relayStatus = 200 } = {}) {
  const forwarded = [], timers = [], logs = [];
  let server, completeStart;
  const app = { use() {}, get() {}, post() {} };
  const express = () => app;
  express.json = () => () => {};
  class MockServer extends EventEmitter {
    constructor(options) { super(); this.options = options; this.clients = new Set(); server = this; }
  }
  const context = {
    require(name) {
      if (name === 'express') return express;
      if (name === 'http') return { createServer: () => ({ listen() {}, close() {} }) };
      if (name === 'ws') return { WebSocketServer: MockServer };
      throw new Error(`Unexpected dependency ${name}`);
    },
    process: { env: { STREAM_AUTH_TOKEN: 'development-test-stream-token', APP_WEBHOOK_URL: 'https://test.invalid/relay', APP_AUTH_TOKEN: 'development-test-relay-token' }, on() {}, uptime: () => 1 },
    console: { log: (...args) => logs.push(args), debug() {} },
    URL, Date,
    setTimeout(fn) { const t = { fn, active: true }; timers.push(t); return t; },
    clearTimeout(t) { t.active = false; },
    setInterval(fn) { const t = { fn, active: true }; timers.push(t); return t; },
    clearInterval(t) { t.active = false; },
    async fetch(url, options) {
      const payload = JSON.parse(options.body);
      forwarded.push(payload);
      if (holdStart && payload.event === 'start') await new Promise(resolve => { completeStart = resolve; });
      return { ok: relayStatus === 200, status: relayStatus, headers: { get: () => 'application/json' }, json: async () => ({ ok: true }) };
    },
  };
  vm.runInNewContext(readFileSync(join(__dirname, 'server.js'), 'utf8'), context);
  const ws = new EventEmitter();
  ws.OPEN = 1; ws.readyState = 1; ws.sent = [];
  ws.send = value => ws.sent.push(JSON.parse(value));
  ws.close = (code, reason) => { ws.closed = { code, reason }; ws.readyState = 3; ws.emit('close', code, Buffer.from(reason)); };
  server.emit('connection', ws);
  const send = msg => ws.emit('message', Buffer.from(JSON.stringify(msg)));
  return { server, ws, send, timers, forwarded, logs, completeStart: () => completeStart?.() };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function start(token = 'development-test-stream-token') {
  return { event: 'start', streamSid: 'MZ-test', start: {
    streamSid: 'MZ-test', callSid: 'CA-test', tracks: ['inbound'],
    customParameters: { leadId: 'test-lead', streamToken: token },
    mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
  } };
}
function media() {
  return { event: 'media', streamSid: 'MZ-test', media: { track: 'inbound', chunk: '1', timestamp: '0', payload: '/w==' } };
}

test('upgrade needs no unsupported URL query authentication', () => {
  const h = harness();
  assert.equal(h.server.options.path, '/ws');
  assert.equal(h.server.options.verifyClient, undefined);
});
test('valid nested Twilio start authenticates and forwards context, not credentials', async () => {
  const h = harness();
  h.send({ event: 'connected', protocol: 'Call', version: '1.0.0' });
  h.send(start());
  await settle();
  assert.equal(h.ws.closed, undefined);
  assert.equal(h.forwarded.length, 1);
  assert.equal(h.forwarded[0].callSid, 'CA-test');
  assert.equal(h.forwarded[0].customParameters.leadId, 'test-lead');
  assert.equal(h.forwarded[0].customParameters.streamToken, undefined);
  assert.equal(h.timers[1].active, false);
});
test('wrong, missing, and old flattened credentials are rejected before relaying', () => {
  for (const msg of [start('wrong'), start(''), { event: 'start', streamSid: 'MZ-test', callSid: 'CA-test', customParameters: { streamToken: 'development-test-stream-token' } }]) {
    const h = harness(); h.send(msg);
    assert.equal(h.ws.closed.code, 1008);
    assert.equal(h.forwarded.length, 0);
  }
});
test('unauthenticated media cannot enter the relay', async () => {
  const h = harness(); h.send(media()); await settle();
  assert.equal(h.forwarded.length, 0);
  assert.equal(h.timers.length, 2); // Auth timeout and server-wide keepalive only.
});
test('nested inbound audio is forwarded after session initialization', async () => {
  const h = harness({ holdStart: true });
  h.send(start()); h.send(media());
  const flush = h.timers[h.timers.length - 1]; flush.fn();
  await settle();
  assert.equal(h.forwarded.length, 1);
  h.completeStart(); await settle();
  assert.equal(h.forwarded.length, 2);
  assert.equal(h.forwarded[1].event, 'media_batch');
  assert.equal(h.forwarded[1].callSid, 'CA-test');
  assert.equal(h.forwarded[1].media[0].payload, '/w==');
  assert.equal(h.forwarded[1].media[0].track, 'inbound');
});
test('connections without start authenticate within five seconds or close', () => {
  const h = harness(); h.timers[1].fn();
  assert.equal(h.ws.closed.code, 1008);
  assert.equal(h.forwarded.length, 0);
});
test('authenticated stop removes the stream and prevents duplicate stop', async () => {
  const h = harness(); h.send(start()); await settle();
  h.send({ event: 'stop', streamSid: 'MZ-test', stop: { callSid: 'CA-test' } });
  h.ws.close(1000, 'test finished'); await settle();
  assert.equal(h.forwarded.filter(p => p.event === 'stop').length, 1);
  assert.equal(h.forwarded[1].callSid, 'CA-test');
});
test('relay errors are visible rather than silently discarded', async () => {
  const h = harness({ relayStatus: 401 }); h.send(start()); await settle();
  assert.ok(h.logs.some(args => args.join(' ').includes('App relay returned HTTP 401 for start')));
});