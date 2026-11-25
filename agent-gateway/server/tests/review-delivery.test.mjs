import assert from 'node:assert/strict';
import test from 'node:test';
import {enqueueGuardianReviewArchive, enqueueReviewFeedback, reviewFeedbackRoutes} from '../review-archive.mjs';

const row = {event_id:'11111111-2222-8333-a444-555555555555', recipient_agent_id:'A14',
  payload:{candidate:{head_sha:'a'.repeat(40),base_sha:'b'.repeat(40)},report:{state:'superseded'}}};

function storage(agent, withRecipient = true) {
  const inserts = [];
  const tx = async (fragments, ...values) => {
    if (fragments[0].includes('SELECT agent_id')) return withRecipient ? [{agent_id:agent}] : [];
    if (fragments[0].includes('SELECT e.event_id')) return [row];
    if (fragments[0].includes('INSERT INTO core_agents.events')) inserts.push(values);
    return [];
  };
  tx.json = value => value;
  return {inserts,sql:{begin: work => work(tx)}};
}

test('a registered feedback route sends an exact-revision remediation note to the agent inbox', async () => {
  const routes = reviewFeedbackRoutes('{"39":"A10","41":"A05","bad":"A99"}');
  assert.deepEqual(routes,[['39','A10']]);
  const {inserts,sql} = storage('A10');
  assert.equal(await enqueueReviewFeedback(sql,routes[0]),true);
  const [, , recipient, sender, message] = inserts[0];
  assert.equal(recipient,'A10');
  assert.equal(sender,'A14');
  assert.equal(message.contract,'rosie.core.rcis.transport.v1');
  assert.equal(message.review.remediation_required,true);
  assert.equal(message.review.head_sha,row.payload.candidate.head_sha);
});

test('Guardian delivery requires a configured live archival identity and uses the readable RCIS envelope', async () => {
  const missing = storage('A03',false);
  assert.equal(await enqueueGuardianReviewArchive(missing.sql),false);
  assert.equal(await enqueueGuardianReviewArchive(missing.sql,'A03'),false);
  assert.deepEqual(missing.inserts,[]);
  const authorized = storage('A25');
  assert.equal(await enqueueGuardianReviewArchive(authorized.sql,'A25'),true);
  const [, , recipient, message] = authorized.inserts[0];
  assert.equal(recipient,'A25');
  assert.equal(message.contract,'rosie.core.rcis.transport.v1');
  assert.equal(message.archive.receipt_id,row.event_id);
});
