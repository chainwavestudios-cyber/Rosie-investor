/** Rosie Core -> Probo sanitized evidence metadata contract; no network or secrets. */
const APP_KEYS = new Set(['core', 'bob']);
const SOURCES = new Set(['automated-security-test', 'access-review', 'backup-restore-test', 'change-control', 'provider-dpa-review']);
const KEYS = ['contract', 'app_key', 'environment', 'control_id', 'evidence_kind', 'source_event_id', 'occurred_at', 'source_sha256', 'outcome'];
const SHA256 = /^[0-9a-f]{64}$/;
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const CONTROL = /^(CORE|BOB)-SEC-[0-9]{3}$/;
export function validateRosieEvidenceV1(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid evidence object');
  if (Object.keys(value).length !== KEYS.length || Object.keys(value).some(k => !KEYS.includes(k))) throw new Error('unapproved fields');
  if (value.contract !== 'rosie.grc.evidence.v1') throw new Error('invalid contract');
  if (!APP_KEYS.has(value.app_key) || value.environment !== 'staging') throw new Error('invalid app or environment');
  if (!CONTROL.test(value.control_id) || (value.app_key === 'bob' ? !value.control_id.startsWith('BOB-') : !value.control_id.startsWith('CORE-'))) throw new Error('invalid control ID');
  if (!SOURCES.has(value.evidence_kind)) throw new Error('invalid evidence kind');
  if (typeof value.source_event_id !== 'string' || !EVENT_ID.test(value.source_event_id)) throw new Error('invalid event ID');
  if (typeof value.source_sha256 !== 'string' || !SHA256.test(value.source_sha256)) throw new Error('invalid source digest');
  if (typeof value.occurred_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value.occurred_at) || Number.isNaN(Date.parse(value.occurred_at))) throw new Error('invalid timestamp');
  if (!['pass', 'fail', 'review'].includes(value.outcome)) throw new Error('invalid outcome');
  return Object.freeze({ ...value });
}
// Caller must supply authorized transport and a durable idempotency store.
// This module deliberately cannot send evidence or bypass Probo admin access.
