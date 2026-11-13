/**
 * Probo-only pre-ingestion security gate. Pure; no I/O or credentials.
 * This is a prototype for the approved Core adapter, NOT a token verifier
 * or a live receiver. The caller MUST independently verify cryptographic
 * signatures and supply authorized, signed claims from an identity verifier.
 */
import { validateRosieEvidenceV1 } from './rosie-evidence-v1.mjs';
const scope = 'rosie.grc.evidence:write';
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;
export function assessEvidenceAdmission(event, auth, opts = {}) {
  const validated = validateRosieEvidenceV1(event);
  if (!auth || typeof auth !== 'object' || auth.verified !== true) throw Error('identity_not_verified');
  if (auth.issuer !== 'rosie-central-identity-staging' || auth.audience !== 'probo-grc-staging') throw Error('untrusted_issuer_or_audience');
  if (!Array.isArray(auth.scopes) || !auth.scopes.includes(scope)) throw Error('missing_evidence_scope');
  if (auth.app_key !== validated.app_key || auth.environment !== validated.environment) throw Error('source_mismatch');
  if (typeof auth.subject !== 'string' || !ID.test(auth.subject)) throw Error('invalid_subject');
  // Both sides must agree on organization by signed, independently verified claims.
  // Organization IDs do not belong in the public sanitized evidence event.
  if (typeof auth.source_org_id !== 'string' || !ID.test(auth.source_org_id)) throw Error('invalid_source_organization');
  if (typeof auth.probo_org_id !== 'string' || !ID.test(auth.probo_org_id)) throw Error('invalid_target_organization');
  if (typeof opts.expectedProboOrg !== 'string' || auth.probo_org_id !== opts.expectedProboOrg) throw Error('wrong_target_organization');
  const now = opts.now instanceof Date ? opts.now.getTime() : Date.now();
  if (!Number.isFinite(now)) throw Error('invalid_clock');
  const eventTime = Date.parse(validated.occurred_at);
  if (Math.abs(now - eventTime) > 300000) throw Error('stale_or_future_event');
  if (!Number.isInteger(auth.expires_at) || auth.expires_at * 1000 <= now) throw Error('expired_identity');
  if (!Number.isInteger(auth.issued_at) || auth.issued_at * 1000 > now + 30000 || auth.issued_at * 1000 < now - 300000) throw Error('stale_identity');
  if (!Array.isArray(opts.approvedSourceOrganizations) || !opts.approvedSourceOrganizations.includes(auth.source_org_id)) throw Error('source_org_not_granted');
  const dedupeKey = [auth.probo_org_id, validated.app_key, validated.source_event_id].join(':');
  // This is merely a candidate key. An atomic durable unique constraint MUST
  // be implemented by the authorized live transport. We do not mutate state.
  return Object.freeze({event:validated, dedupeKey, approvedProboOrg:auth.probo_org_id});
}
