/**
 * Staging-only Rosie Core -> Probo signed evidence gateway.
 * Transport-neutral: the authenticated HTTPS service must call acceptSignedEvidence.
 * Never accept organization claims from event body; tenant mapping is preconfigured.
 * Deliberately fail-closed until a durable storage adapter and scoped secrets exist.
 */
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { assessEvidenceAdmission } from './evidence-admission.mjs';

const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;
const HEX = /^[a-f0-9]{64}$/;
function deny(code) { const error = new Error(code); error.code = code; throw error; }
function hmac(key, payload) { return createHmac('sha256', key).update(payload).digest('hex'); }
function safeEqualHex(a, b) {
  if (typeof a !== 'string' || !HEX.test(a) || !HEX.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
export function makeSignedEnvelope({ event, key, source, timestamp, nonce }) {
  if (typeof key !== 'string' || key.length < 32) deny('invalid_signing_key');
  if (!ID.test(source) || !ID.test(nonce) || !Number.isSafeInteger(timestamp)) deny('invalid_envelope_identity');
  const payload = JSON.stringify(event);
  const digest = createHash('sha256').update(payload).digest('hex');
  const message = [ 'rosie.grc.evidence.v1', source, timestamp, nonce, digest ].join('\n');
  return { payload, source, timestamp, nonce, digest, signature: hmac(key, message) };
}
/**
 * adapter.commitUnique({ replayKey, dedupeKey, envelopeDigest, record })
 * MUST atomically persist replayKey and dedupeKey with UNIQUE constraints.
 * On exact duplicate return {status:'duplicate', receiptId}; changed payload must throw.
 * On new event return {status:'accepted', receiptId}.
 * No in-memory map is acceptable for a deployed adapter.
 */
export async function acceptSignedEvidence(envelope, config) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) deny('invalid_envelope');
  const fields = ['payload', 'source', 'timestamp', 'nonce', 'digest', 'signature'];
  if (Object.keys(envelope).length !== fields.length || fields.some(k => !(k in envelope))) deny('unknown_envelope_fields');
  const { payload, source, timestamp, nonce, digest, signature } = envelope;
  if (typeof payload !== 'string' || Buffer.byteLength(payload) > 8192) deny('invalid_payload_size');
  if (!ID.test(source) || !ID.test(nonce) || !Number.isSafeInteger(timestamp)) deny('invalid_identity');
  const now = config?.now instanceof Date ? config.now.getTime() : Date.now();
  if (Math.abs(now - timestamp) > 300000) deny('stale_or_future_envelope');
  if (!safeEqualHex(digest, createHash('sha256').update(payload).digest('hex'))) deny('invalid_digest');
  const sourceConfig = config?.sources?.[source];
  if (!sourceConfig || !sourceConfig.enabled || typeof sourceConfig.key !== 'string' || sourceConfig.key.length < 32) deny('source_not_authorized');
  const message = ['rosie.grc.evidence.v1', source, timestamp, nonce, digest].join('\n');
  if (!safeEqualHex(signature, hmac(sourceConfig.key, message))) deny('invalid_signature');
  let event;
  try { event = JSON.parse(payload); } catch { deny('invalid_json'); }
  // Claims are sourced ONLY from trusted server-side source config after verified HMAC.
  const auth = Object.freeze({
    verified: true, issuer: 'rosie-central-identity-staging', audience: 'probo-grc-staging',
    scopes: ['rosie.grc.evidence:write'], app_key: sourceConfig.app_key,
    environment: 'staging', subject: source,
    source_org_id: sourceConfig.source_org_id, probo_org_id: sourceConfig.probo_org_id,
    issued_at: Math.floor(timestamp / 1000), expires_at: Math.floor(timestamp / 1000) + 300
  });
  const admission = assessEvidenceAdmission(event, auth, {
    now: new Date(now), expectedProboOrg: sourceConfig.probo_org_id,
    approvedSourceOrganizations: sourceConfig.approvedSourceOrganizations
  });
  if (!config?.adapter || typeof config.adapter.commitUnique !== 'function') deny('durable_adapter_required');
  const replayKey = source + ':' + nonce;
  const outcome = await config.adapter.commitUnique({
    replayKey, dedupeKey: admission.dedupeKey, envelopeDigest: digest,
    record: { event: admission.event, source, proboOrgId: admission.approvedProboOrg, receivedAt: new Date(now).toISOString() }
  });
  if (!outcome || !['accepted', 'duplicate'].includes(outcome.status) || !ID.test(outcome.receiptId)) deny('invalid_storage_receipt');
  // Signed ACK should be issued by deployment-layer receiver using a separate scoped key;
  // this response alone is NOT a cryptographically signed Core acknowledgement.
  return Object.freeze({ status: outcome.status, receipt_id: outcome.receiptId, event_id: event.source_event_id });
}
