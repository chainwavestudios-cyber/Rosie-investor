import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';
import {githubReviewSource, handleReviewControl, readReviewRegistry, reviewControlCredential} from '../review-control.mjs';
import {docsReviewDelivery, syncRegisteredReviewDoc} from '../review-archive.mjs';

const head = 'a'.repeat(40), base = 'b'.repeat(40);
const url = 'https://api.github.com/repos/test/rosie';
const env = {GITHUB_REVIEW_SOURCE_READ_TOKEN: 'fixture', GITHUB_REVIEW_REPOSITORY: 'test/rosie',
  GITHUB_REVIEW_REPOSITORY_ID: '12'};
const candidate = {repository_id: 12, repository: 'test/rosie', head_sha: head,
  base_sha: base, pull_number: 41, base_confirmed: true};

test('the reviewer inbox key cannot authenticate request or signed-proof status actions', () => {
  const requestKey = 'q'.repeat(40), reader = 'r'.repeat(40);
  assert.equal(reviewControlCredential('reviewer_inbox',requestKey,reader),reader);
  assert.equal(reviewControlCredential('request',requestKey,reader),requestKey);
  assert.equal(reviewControlCredential('status',requestKey,reader),requestKey);
  assert.equal(reviewControlCredential('reviewer_inbox',requestKey,requestKey),undefined);
  assert.equal(reviewControlCredential('reviewer_inbox',requestKey,''),undefined);
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
