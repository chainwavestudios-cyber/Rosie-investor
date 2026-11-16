import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { authenticateAndVerifyTicketLeaseClaim as verify } from './receipt-gateway-auth.mjs';

// Local-only deterministic fixture: NEVER use this key in production.
const SECRET = 'test-only-not-a-real-secret-'.repeat(3);
const NOW = Date.parse('2026-11-15T23:00:00.000Z');
const common = {
  ticket_key: 'rwt-staging-demo', organization_id: 'synthetic-tenant',
  job_id: 'synthetic-warjob', seat_id: 'synthetic-seat',
  lease_token: '6c89c731-9e11-4325-81a6-05bfde7d8349', fencing_token: 3,
};
const make = () => {
  const used = new Set();
  const replayStore = {
    async claimOnce(key) {
      if (used.has(key)) return false;
      used.add(key);
      return true;
    },
  };
  const ticket = { ...common, tenant_verified: true };
  const claim = { ...common, tenant_verified: true, status: 'claimed', lease_until: '2026-11-16T01:00:00.000Z' };
  const data = {
    version: 1, issuer: 'rosie-neon-ticket-gateway',
    audience: 'rosie-core-connected-future', nonce: 'synthetic_unique_nonce_001',
    issued_at: NOW - 1000, expires_at: NOW + 30000,
    proof: { ...common, receipt_id: 'synthetic-receipt-id', event_type: 'claim',
      lease_until: '2026-11-16T01:00:00.000Z',
      authenticated: false, source: 'client' },
  };
  const pack = (input = data, key = SECRET) => {
    const payload = Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
    return { payload, signature: createHmac('sha256', key)
      .update('rosie.ticket.gateway.v1.' + payload).digest('base64url') };
  };
  return { ticket, claim, data, pack, replayStore };
};
const args = fixture => ({
  ticket: fixture.ticket, claim: fixture.claim, envelope: fixture.pack(),
  secret: SECRET, replayStore: fixture.replayStore, now: NOW,
});

test('accepts a cryptographically verified, scoped, unexpired synthetic claim once', async () => {
  const fixture = make();
  const result = await verify(args(fixture));
  assert.deepEqual(result, {
    accepted: true, reason: 'authenticated_neon_lease_claim',
    receipt_id: 'synthetic-receipt-id',
  });
});
test('rejects replay of an otherwise authentic envelope', async () => {
  const fixture = make();
  assert.equal((await verify(args(fixture))).accepted, true);
  assert.equal((await verify(args(fixture))).reason, 'replayed_or_unrecorded');
});
test('rejects tampered payload without corresponding MAC', async () => {
  const fixture = make();
  const original = fixture.pack();
  fixture.data.proof.job_id = 'attacker-job';
  assert.equal((await verify({ ...args(fixture), envelope: {
    payload: Buffer.from(JSON.stringify(fixture.data)).toString('base64url'),
    signature: original.signature,
  } })).reason, 'bad_signature');
});
test('rejects signature made by a different secret', async () => {
  const fixture = make();
  assert.equal((await verify({ ...args(fixture), envelope: fixture.pack(fixture.data, 'wrong-key'.repeat(7)) })).reason, 'bad_signature');
});
for (const [name, mutate, reason] of [
  ['wrong audience', d => { d.audience = 'warroom-client'; }, 'wrong_sender_or_audience'],
  ['wrong issuer', d => { d.issuer = 'unknown-gateway'; }, 'wrong_sender_or_audience'],
  ['expired signed proof', d => { d.expires_at = NOW - 1; }, 'expired_or_invalid_signed_window'],
  ['stale timestamp', d => { d.issued_at = NOW - 60001; }, 'expired_or_invalid_signed_window'],
  ['future timestamp', d => { d.issued_at = NOW + 5001; }, 'expired_or_invalid_signed_window'],
  ['oversized window', d => { d.expires_at = NOW + 61000; }, 'expired_or_invalid_signed_window'],
  ['short nonce', d => { d.nonce = 'short'; }, 'invalid_nonce'],
  ['wrong tenant', d => { d.proof.organization_id = 'another-tenant'; }, 'mismatched_organization_id'],
  ['wrong job', d => { d.proof.job_id = 'another-job'; }, 'mismatched_job_id'],
  ['wrong seat', d => { d.proof.seat_id = 'another-seat'; }, 'mismatched_seat_id'],
  ['wrong fence', d => { d.proof.fencing_token = 4; }, 'mismatched_fencing_token'],
  ['wrong receipt event', d => { d.proof.event_type = 'release'; }, 'invalid_claim_state'],
  ['missing receipt ID', d => { d.proof.receipt_id = ''; }, 'missing_receipt_id'],
]) {
  test('rejects ' + name, async () => {
    const fixture = make();
    mutate(fixture.data);
    const result = await verify(args(fixture));
    assert.equal(result.accepted, false);
    assert.equal(result.reason, reason);
  });
}
test('rejects an absent secret', async () => {
  const fixture = make();
  assert.equal((await verify({ ...args(fixture), secret: undefined })).reason, 'missing_trusted_backend');
});
test('rejects an absent durable replay store', async () => {
  const fixture = make();
  assert.equal((await verify({ ...args(fixture), replayStore: undefined })).reason, 'missing_trusted_backend');
});
test('fails closed if replay storage is unavailable', async () => {
  const fixture = make();
  const replayStore = { async claimOnce() { throw new Error('offline'); } };
  assert.equal((await verify({ ...args(fixture), replayStore })).reason, 'replay_store_unavailable');
});
test('fails closed on noncanonical MAC bytes', async () => {
  const fixture = make();
  const envelope = fixture.pack();
  envelope.signature = envelope.signature + '=';
  assert.equal((await verify({ ...args(fixture), envelope })).reason, 'invalid_envelope');
});
test('rejects browser-supplied authenticated flag without signature', async () => {
  const fixture = make();
  assert.equal((await verify({ ...args(fixture), envelope: {
    payload: fixture.pack().payload, signature: 'A'.repeat(43), authenticated: true,
  } })).accepted, false);
});
