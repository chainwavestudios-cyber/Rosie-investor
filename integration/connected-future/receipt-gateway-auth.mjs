/**
 * SERVER-ONLY boundary for authenticating a Neon lease gateway claim receipt.
 * This module is a reference adapter, not a deployed Core/War Room endpoint.
 * Never pass the secret or replayStore to a browser/client bundle.
 *
 * Contract (v1): envelope = { payload: base64url(UTF8 JSON), signature:
 * base64url(HMAC_SHA256(secret, 'rosie.ticket.gateway.v1.' + payload)) }.
 * Signed JSON fields: version (1), issuer, audience, nonce, issued_at,
 * expires_at (both integer milliseconds since epoch), proof.
 * The signer must be a trusted gateway using Core-held secrets. The verifier
 * MUST receive a trusted tenant/job/seat/ticket view from Core, not clients.
 * Replay storage must implement durable, atomic claimOnce(key, expiresAtMs).
 * A local in-memory Set is adequate ONLY as a test double.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { verifyTicketLeaseProof } from './receipt-proof.mjs';

const prefix = 'rosie.ticket.gateway.v1.';
const reject = reason => ({ accepted: false, reason });
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const textValue = value => typeof value === 'string' && value.length > 0;

export async function authenticateAndVerifyTicketLeaseClaim({
  ticket, claim, envelope, secret, replayStore, now = Date.now(),
  expectedIssuer = 'rosie-neon-ticket-gateway',
  expectedAudience = 'rosie-core-connected-future',
} = {}) {
  if (!Number.isSafeInteger(now) || !textValue(expectedIssuer) || !textValue(expectedAudience)) {
    return reject('invalid_server_configuration');
  }
  const secretBytes = Buffer.isBuffer(secret) ? secret :
    typeof secret === 'string' ? Buffer.from(secret, 'utf8') : null;
  if (!secretBytes || secretBytes.length < 32 || typeof replayStore?.claimOnce !== 'function') {
    return reject('missing_trusted_backend');
  }
  if (!isRecord(envelope) || typeof envelope.payload !== 'string' ||
      envelope.payload.length < 16 || envelope.payload.length > 16384 ||
      !/^[A-Za-z0-9_-]+$/.test(envelope.payload) ||
      typeof envelope.signature !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(envelope.signature)) {
    return reject('invalid_envelope');
  }
  // Compare raw MACs in constant time; reject noncanonical base64url aliases.
  const provided = Buffer.from(envelope.signature, 'base64url');
  if (provided.length !== 32 || provided.toString('base64url') !== envelope.signature) {
    return reject('invalid_envelope');
  }
  const expected = createHmac('sha256', secretBytes).update(prefix + envelope.payload).digest();
  if (!timingSafeEqual(expected, provided)) return reject('bad_signature');

  let data;
  try {
    const payloadBytes = Buffer.from(envelope.payload, 'base64url');
    if (payloadBytes.toString('base64url') !== envelope.payload) return reject('invalid_envelope');
    data = JSON.parse(payloadBytes.toString('utf8'));
  } catch {
    return reject('invalid_payload');
  }
  if (!isRecord(data) || !isRecord(data.proof) || data.version !== 1 ||
      data.issuer !== expectedIssuer || data.audience !== expectedAudience) {
    return reject('wrong_sender_or_audience');
  }
  if (typeof data.nonce !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(data.nonce)) {
    return reject('invalid_nonce');
  }
  if (!Number.isSafeInteger(data.issued_at) || !Number.isSafeInteger(data.expires_at) ||
      data.issued_at > now + 5000 || data.issued_at < now - 60000 ||
      data.expires_at <= now || data.expires_at <= data.issued_at ||
      data.expires_at > data.issued_at + 60000) {
    return reject('expired_or_invalid_signed_window');
  }
  // "authenticated" and "source" are set only AFTER cryptographic verification;
  // any values supplied by a client or inside the signed proof are overwritten.
  const checked = verifyTicketLeaseProof({
    ticket, claim,
    gatewayProof: { ...data.proof, authenticated: true, source: 'neon_lease_gateway' }, now,
  });
  if (!checked.accepted) return checked;

  const replayKey = createHash('sha256').update(
    data.audience + '\0' + data.issuer + '\0' + data.nonce, 'utf8'
  ).digest('hex');
  try {
    // MUST be atomic and durable across workers; the verifier fails closed.
    if (await replayStore.claimOnce(replayKey, data.expires_at) !== true) {
      return reject('replayed_or_unrecorded');
    }
  } catch {
    return reject('replay_store_unavailable');
  }
  return { accepted: true, reason: 'authenticated_neon_lease_claim', receipt_id: checked.receipt_id };
}
