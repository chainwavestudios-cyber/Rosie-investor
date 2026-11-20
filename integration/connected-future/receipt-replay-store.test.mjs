import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresReplayStore } from './receipt-replay-store.mjs';

const digest = 'a'.repeat(64);
const expiry = Date.parse('2030-01-01T00:00:00.000Z');
test('refuses an unbound, untrusted PostgreSQL query', () => {
  assert.throws(() => createPostgresReplayStore(), TypeError);
});
test('uses one atomic insert with ON CONFLICT for first claim', async () => {
  const calls = [];
  const store = createPostgresReplayStore({
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ nonce_digest: digest }] };
    },
  });
  assert.equal(await store.claimOnce(digest, expiry), true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /ON CONFLICT \(nonce_digest\) DO NOTHING/);
  assert.match(calls[0].sql, /clock_timestamp\(\)/);
  assert.deepEqual(calls[0].params, [digest, expiry]);
});
test('rejects already claimed nonce with no returned row', async () => {
  const store = createPostgresReplayStore({ query: async () => ({ rows: [] }) });
  assert.equal(await store.claimOnce(digest, expiry), false);
});
test('fails closed if returned digest differs', async () => {
  const store = createPostgresReplayStore({ query: async () => ({ rows: [{ nonce_digest: 'b'.repeat(64) }] }) });
  assert.equal(await store.claimOnce(digest, expiry), false);
});
test('fails closed on malformed arguments without touching database', async () => {
  let calls = 0;
  const store = createPostgresReplayStore({ query: async () => { calls++; return { rows: [] }; } });
  for (const [key, time] of [['z'.repeat(64), expiry], [digest, NaN], [digest, -1], [digest, 1.3]]) {
    assert.equal(await store.claimOnce(key, time), false);
  }
  assert.equal(calls, 0);
});
test('propagates query failure to fail-closed verifier', async () => {
  const store = createPostgresReplayStore({ query: async () => { throw new Error('Neon offline'); } });
  await assert.rejects(store.claimOnce(digest, expiry), /Neon offline/);
});
test('returns a frozen adapter', () => {
  const store = createPostgresReplayStore({ query: async () => ({ rows: [] }) });
  assert.equal(Object.isFrozen(store), true);
});
