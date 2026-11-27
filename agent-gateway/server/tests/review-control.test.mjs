import assert from 'node:assert/strict';
import {createHmac, generateKeyPairSync, sign} from 'node:crypto';
import test from 'node:test';
import {githubReviewSource, handleReviewControl, readReviewRegistry, readStagingIamStatus,
  reviewControlCredential, stagingIamStatusCredential} from '../review-control.mjs';
import {reviewAssignment} from '../github-review-webhook.mjs';
import {reviewReceiptBytes, reviewReceiptContract} from '../independent-review-receipt.mjs';
import {docsReviewDelivery, syncRegisteredReviewDoc} from '../review-archive.mjs';

const head = 'a'.repeat(40), base = 'b'.repeat(40);
const url = 'https://api.github.com/repos/test/rosie';
const env = {GITHUB_REVIEW_SOURCE_READ_TOKEN: 'fixture', GITHUB_REVIEW_REPOSITORY: 'test/rosie',
  GITHUB_REVIEW_REPOSITORY_ID: '12'};
const candidate = {repository_id: 12, repository: 'test/rosie', head_sha: head,
  base_sha: base, pull_number: 41, base_confirmed: true};
const stageService = 'srv-dbvkq4utlv9c73e4o5i0';
const stageCandidate = {
  repository: 'chainwavestudios-cyber/rosie-core-platform', repository_id: 1461312036, pull_number: 47,
  head_sha: '76a357cda0dc293e7256e3a7571b6b3f2bdce566',
  base_sha: 'e94765c3b93d71fc1ebbb7dd4bca59eb77f1d762', base_confirmed: true, implementer_id: '55',
};

test('the reviewer inbox key cannot authenticate request or signed-proof status actions', () => {
  const requestKey = 'q'.repeat(40), reader = 'r'.repeat(40);
  assert.equal(reviewControlCredential('reviewer_inbox',requestKey,reader),reader);
  assert.equal(reviewControlCredential('request',requestKey,reader),requestKey);
  assert.equal(reviewControlCredential('status',requestKey,reader),requestKey);
  assert.equal(reviewControlCredential('reviewer_inbox',requestKey,requestKey),undefined);
  assert.equal(reviewControlCredential('reviewer_inbox',requestKey,''),undefined);
});

test('only the isolated IAM gateway accepts its reader key for the exact PR status request', () => {
  const reader = 'r'.repeat(40);
  const status = {action: 'status', pull_number: 47};
  assert.equal(stagingIamStatusCredential(status, stageService, '', reader), reader);
  assert.equal(stagingIamStatusCredential(status, 'srv-production000000', '', reader), undefined);
  assert.equal(stagingIamStatusCredential(status, undefined, '', reader), undefined);
  assert.equal(stagingIamStatusCredential(status, stageService, 'c'.repeat(40), reader), undefined);
  assert.equal(stagingIamStatusCredential(status, stageService, '', 'short'), undefined);
  for (const request of [{action:'request', pull_number:47}, {action:'status', pull_number:48},
    {action:'status', pull_number:'47'}, {...status, agent_id:'A05'}, null]) {
    assert.equal(stagingIamStatusCredential(request, stageService, '', reader), undefined);
  }
});

test('staging IAM status fences changed candidates before reading the ledger', async () => {
  for (const override of [{head_sha:head}, {base_sha:base}, {base_confirmed:false}, {repository_id:12},
    {repository:'test/rosie'}, {pull_number:41}]) {
    const result = await readStagingIamStatus({
      sql: () => assert.fail('No ledger access for an unapproved candidate'),
      source: async number => {
        assert.equal(number, 47);
        return {...stageCandidate, ...override};
      },
    });
    assert.deepEqual(result, [409, {error:'staging_iam_candidate_changed'}]);
  }
});

test('staging IAM status returns only the two acknowledged, cryptographically verified approvals', async () => {
  const enrolled = Date.now() - 3000, assigned = enrolled + 1000, issued = assigned + 1000;
  const registry = {};
  const decisions = {};
  for (const [agent, role, workload] of [['A05','rosieeyez','srv-testreviewer05'], ['A14','check_agent','srv-testreviewer14']]) {
    const {publicKey, privateKey} = generateKeyPairSync('ed25519');
    registry[agent] = {id:workload, public_key:publicKey.export({format:'der', type:'spki'}).subarray(-32).toString('base64'),
      enrolled_at:enrolled};
    const assignment = reviewAssignment(agent, stageCandidate);
    const decision = {contract:reviewReceiptContract, assignment_id:assignment.id, repository_id:stageCandidate.repository_id,
      pull_number:47, head_sha:stageCandidate.head_sha, base_sha:stageCandidate.base_sha, reviewer_id:workload,
      reviewer_role:role, evidence_sha256:'e'.repeat(64), verdict:'accept', issued_at:issued};
    decisions[agent] = {...decision, signature:sign(null, reviewReceiptBytes(decision), privateKey).toString('base64')};
  }
  const sql = async (parts, ...values) => {
    assert.match(parts.join(''), /^\s*SELECT\b/);
    const agent = values.find(value => value === 'A05' || value === 'A14');
    return [{received_at:new Date(assigned).toISOString(), acknowledged_at:new Date(assigned).toISOString(),
      receipt:{decision:decisions[agent]}, automated:{report:{unrelated:'private automation data'}}}];
  };
  const args = {source:async () => stageCandidate, sql, registry};
  const [status, body] = await readStagingIamStatus(args);
  assert.equal(status, 200);
  assert.equal(body.accepted, true);
  assert.equal(body.environment, 'staging');
  assert.equal(body.independent, false);
  assert.equal(body.release_authorized, false);
  assert.deepEqual(body.reviewers.map(row => row.proof.receipt), [decisions.A05, decisions.A14]);
  assert.ok(body.reviewers.every(row => !Object.hasOwn(row, 'automated')));

  decisions.A14.evidence_sha256 = 'a'.repeat(64);
  assert.deepEqual(await readStagingIamStatus(args), [409, {error:'staging_iam_approvals_unavailable'}]);
});

test('GitHub snapshot detects a stale base independently of the pull request cache', async () => {
  const github = githubReviewSource(env, async (target, request) => {
    assert.equal(request.redirect, 'error');
    assert.equal(request.headers.authorization, 'Bearer fixture');
    if (target === url + '/pulls/41') return Response.json({
      number: 41, state: 'open', head: {sha: head}, base: {sha: base, ref: 'main', repo: {id: 12}},
      user: {id: 55},
    });
    assert.equal(target, url + '/branches/main');
    return Response.json({commit: {sha: 'f'.repeat(40)}});
  });
  const current = await github(41);
  assert.equal(current.base_confirmed, false);
  assert.deepEqual(await handleReviewControl({
    source: github, request: {action: 'request', pull_number: 41},
    enqueue: () => assert.fail('Stale candidate was assigned'),
  }), [409, {error: 'review_candidate_base_changed'}]);
});

test('one Core request queues both reviewer roles and returns the exact candidate', async () => {
  let pending = [];
  const [status, result] = await handleReviewControl({
    sql: async () => [], request: {action: 'request', pull_number: 41},
    source: async () => candidate,
    enqueue: async assignments => {
      pending = assignments;
      return assignments.map(({id}) => ({delivery_ack: id}));
    },
  });
  assert.equal(status, 200);
  assert.equal(result.accepted, false);
  assert.equal(result.candidate.head_sha, head);
  assert.deepEqual(pending.map(row => row.agent), ['A05', 'A14']);
  assert.notEqual(pending[0].id, pending[1].id);
  assert.equal(readReviewRegistry('malformed'), null);
});

test('the human reviewer inbox reads only the permitted role and exact assignment IDs', async () => {
  const assignment = '11111111-2222-8333-a444-555555555555';
  const otherRole = '99999999-2222-8333-a444-555555555555';
  const report = '55555555-2222-8333-a444-555555555555';
  function sql(statement, ...values) {
    if (Array.isArray(statement) && !Object.hasOwn(statement, 'raw')) return statement;
    assert.match(statement.join('?'), /e\.recipient_agent_id=\?.*e\.event_id IN \?/s);
    assert.deepEqual(values, ['rosie.core.independent-review.automated-result.v1', 'rosie-core-internal',
      'A05', 'rosie.core.independent-review.v1', [assignment, otherRole], 2]);
    assert.doesNotMatch(statement.join('?'), /INSERT|UPDATE|registered\.v1/);
    return [{assignment_id: assignment, received_at:'2026-11-25T10:00:00.000Z', acknowledged_at:null,
      pull_number:'42', automated_report_id:report, automated_state:'source_verified', proof:'private'}];
  }
  const [status, body] = await handleReviewControl({sql,
    request: {action:'reviewer_inbox',agent_id:'A05',assignment_ids:[assignment,otherRole]},
    source: () => assert.fail('Source access is unnecessary'),
    enqueue: () => assert.fail('Read path must not enqueue')});
  assert.equal(status,200);
  assert.deepEqual(body,{ok:true,release_authorized:false,assignments:[{assignment_id:assignment,
    received_at:'2026-11-25T10:00:00.000Z',acknowledged_at:null,pull_number:42,
    automated_report_id:report,automated_state:'source_verified'}]});
});

test('the human reviewer inbox rejects roles, duplicates, oversized and malformed scopes', async () => {
  const id = '11111111-2222-8333-a444-555555555555';
  for (const request of [{agent_id:'A08',assignment_ids:[id]}, {agent_id:'A05',assignment_ids:[id,id]},
    {agent_id:'A05',assignment_ids:Array(17).fill(id)}, {agent_id:'A14',assignment_ids:['untrusted']},
    {agent_id:'A14',assignment_ids:[id],user_id:'untrusted'}, {agent_id:'A14',assignment_ids:[]}]) {
    const result = await handleReviewControl({sql:() => assert.fail('Unexpected ledger access'),
      request:{action:'reviewer_inbox',...request}});
    assert.deepEqual(result,[400,{error:'invalid_reviewer_inbox_request'}]);
  }
});

test('records documentation delivery only after Core acknowledges a real job identifier', async () => {
  const config = docsReviewDelivery({...env, GITHUB_REVIEW_DOCSYNC_HMAC: 's'.repeat(48),
    GITHUB_REVIEW_DOCSYNC_URL: 'https://docs.example/coreDocSyncIntake'});
  const calls = [];
  const tx = async (parts, ...values) => {
    const statement = parts.join('?');
    if (statement.includes('SELECT e.event_id')) return [{
      event_id: 'a'.repeat(8) + '-aaaa-8aaa-aaaa-aaaaaaaaaaaa', recipient_agent_id: 'A14',
      payload: {decision: {head_sha: head, base_sha: base, pull_number: 41, reviewer_role: 'check_agent',
        verdict: 'accept', evidence_sha256: 'c'.repeat(64)}},
    }];
    if (statement.includes('INSERT INTO')) calls.push(values);
    return [];
  };
  tx.json = value => value;
  const sql = {begin: callback => callback(tx)};
  const transport = async (target, request) => {
    assert.equal(target, config.url);
    assert.equal(request.redirect, 'error');
    const time = request.headers['x-docsync-timestamp'];
    const expected = createHmac('sha256', config.secret).update(time + '.' + request.body).digest('hex');
    assert.equal(request.headers['x-docsync-signature'], 'sha256=' + expected);
    assert.equal(JSON.parse(request.body).source_type, 'acceptance_test');
    return Response.json({accepted: true, status: 'queued', job_id: 'fixture-core-job'});
  };
  await assert.rejects(syncRegisteredReviewDoc(sql, config, async () =>
    Response.json({accepted: true, status: 'queued'})), /receipt_invalid/);
  assert.equal(calls.length, 0);
  assert.equal(await syncRegisteredReviewDoc(sql, config, transport), true);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].some(value => value?.job_id === 'fixture-core-job'));
});
