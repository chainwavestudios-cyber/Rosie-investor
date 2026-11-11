import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRosieEvidenceV1 } from './rosie-evidence-v1.mjs';
const valid = Object.freeze({
  contract:'rosie.grc.evidence.v1', app_key:'bob', environment:'staging', control_id:'BOB-SEC-001',
  evidence_kind:'automated-security-test', source_event_id:'bob-tenant-isolation-0001',
  occurred_at:'2026-11-11T20:00:00Z', source_sha256:'a'.repeat(64), outcome:'pass'
});
test('accepts strictly allowlisted metadata', () => assert.deepEqual(validateRosieEvidenceV1(valid), valid));
for (const [label, mutation] of [
  ['raw transcript', {transcript:'customer text'}],
  ['PII', {email:'person@example.com'}],
  ['secrets', {api_key:'not-a-real-key'}],
  ['production evidence', {environment:'production'}],
  ['wrong app control', {app_key:'core'}],
  ['unknown app', {app_key:'insureiq'}],
  ['unsupported kind', {evidence_kind:'audio-recording'}],
  ['malformed digest', {source_sha256:'123'}],
  ['missing outcome', {outcome:undefined}],
  ['invalid date', {occurred_at:'not-a-date'}],
]) test('rejects ' + label, () => assert.throws(() => validateRosieEvidenceV1({...valid, ...mutation})));
