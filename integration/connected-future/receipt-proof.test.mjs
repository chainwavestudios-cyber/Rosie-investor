import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTicketLeaseProof } from './receipt-proof.mjs';

const create = () => {
  const common = {
    ticket_key: 'rwt-demo', organization_id: 'staging-org', job_id: 'warjob-demo',
    seat_id: 'seat-demo', lease_token: '6c89c731-9e11-4325-81a6-05bfde7d8349',
    fencing_token: 2,
  };
  return {
    ticket: { ...common, tenant_verified: true },
    claim: { ...common, status: 'claimed', tenant_verified: true, lease_until: '2035-01-01T00:00:00.000Z' },
    gatewayProof: { ...common, receipt_id: 'receipt-demo', source: 'neon_lease_gateway', authenticated: true, event_type: 'claim', lease_until: '2035-01-01T00:00:00.000Z' },
    now: Date.parse('2030-01-01T00:00:00.000Z'),
  };
};
test('accepts exact independently authenticated and unexpired synthetic match', () => {
  assert.equal(verifyTicketLeaseProof(create()).accepted, true);
});
for (const [name, mutate] of [
  ['no independent proof', d => { d.gatewayProof = null; }],
  ['untrusted proof', d => { d.gatewayProof.authenticated = false; }],
  ['spoofed source', d => { d.gatewayProof.source = 'client'; }],
  ['cross tenant', d => { d.gatewayProof.organization_id = 'other'; }],
  ['wrong job', d => { d.gatewayProof.job_id = 'other'; }],
  ['wrong seat', d => { d.gatewayProof.seat_id = 'other'; }],
  ['wrong ticket', d => { d.gatewayProof.ticket_key = 'other'; }],
  ['wrong token', d => { d.gatewayProof.lease_token = 'other'; }],
  ['wrong fence', d => { d.gatewayProof.fencing_token = 1; }],
  ['missing receipt', d => { d.gatewayProof.receipt_id = ''; }],
  ['unverified tenant', d => { d.claim.tenant_verified = false; }],
  ['expired claim', d => { d.now = Date.parse('2036-01-01T00:00:00Z'); }],
  ['mismatched expiry', d => { d.gatewayProof.lease_until = '2034-01-01T00:00:00Z'; }],
  ['invalid claim state', d => { d.claim.status = 'pending'; }],
  ['missing fence', d => { d.ticket.fencing_token = undefined; }],
  ['invalid clock', d => { d.now = NaN; }],
]) {
  test(`denies ${name}`, () => { const data = create(); mutate(data); assert.equal(verifyTicketLeaseProof(data).accepted, false); });
}
