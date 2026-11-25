import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import test from 'node:test';
import {receiveReviewWebhook, reviewAssignment, reviewWebhookConfig, stagedRetrospectiveAssignments} from '../github-review-webhook.mjs';

const config = {
  GITHUB_REVIEW_REPOSITORY_ID: '123',
  GITHUB_REVIEW_A05_INSTALLATION_ID: '45',
  GITHUB_REVIEW_A14_INSTALLATION_ID: '67',
  GITHUB_REVIEW_A05_WEBHOOK_SECRET: 'a'.repeat(64),
  GITHUB_REVIEW_A14_WEBHOOK_SECRET: 'b'.repeat(64),
};
const hooks = reviewWebhookConfig(config);
const payload = {
  action: 'synchronize',
  number: 38,
  installation: {id: 45},
  repository: {id: 123, full_name: 'test/rosie-core-platform'},
  pull_request: {
    number: 38, state: 'open', body: 'レビュー',
    head: {sha: 'c'.repeat(40)},
    base: {sha: 'd'.repeat(40), ref: 'main', repo: {id: 123}},
  },
};

function request(body, {key = hooks.A05.secret, event = 'pull_request',
    delivery = '927a4599-56e7-4fb7-864e-901719d2d6b3'} = {}) {
  const bytes = Buffer.from(JSON.stringify(body));
  const split = bytes.indexOf(Buffer.from('レ')) + 1;
  const stream = Readable.from([bytes.subarray(0, split), bytes.subarray(split)]);
  stream.method = 'POST';
  stream.headers = {
    'x-github-event': event,
    'x-github-delivery': delivery,
    'x-hub-signature-256': 'sha256=' + createHmac('sha256', key).update(bytes).digest('hex'),
  };
  return stream;
}

const neverQueue = () => assert.fail('Unexpected enqueue');

test('authenticates exact bytes and queues only immutable review data', async () => {
  const [status, result] = await receiveReviewWebhook(request(payload), 'A05', hooks.A05, assignment => {
    assert.equal(assignment.agent, 'A05');
    assert.deepEqual(assignment.candidate, {
      contract: 'rosie.core.independent-review.v1', repository_id: 123,
      repository: 'test/rosie-core-platform', pull_number: 38,
      head_sha: 'c'.repeat(40), base_sha: 'd'.repeat(40), reviewer: 'rosieeyez',
    });
    return {delivery_ack: 'persisted', idempotent: false};
  });
  assert.equal(status, 202);
  assert.equal(result.durable_commit, true);
  assert.equal(result.delivery_ack, 'persisted');
});

test('rejects crossed reviewer secrets and unauthorized installations or repositories', async () => {
  assert.equal((await receiveReviewWebhook(request(payload), 'A14', hooks.A14, neverQueue))[0], 401);
  assert.equal((await receiveReviewWebhook(request({...payload, installation: {id: 67}}),
    'A05', hooks.A05, neverQueue))[0], 403);
  assert.equal((await receiveReviewWebhook(request({...payload, repository: {id: 124}}),
    'A05', hooks.A05, neverQueue))[0], 403);
});

test('redeliveries share an assignment while reviewer, head, and base changes get new ones', async () => {
  const ids = new Set();
  const enqueue = ({id}) => {
    const idempotent = ids.has(id);
    ids.add(id);
    return {delivery_ack: id, idempotent};
  };
  const receive = (body, options) => receiveReviewWebhook(request(body, options), 'A05', hooks.A05, enqueue);
  assert.equal((await receive(payload))[0], 202);
  assert.equal((await receive({...payload, action: 'opened'}, {delivery: '305dcf85-8198-4e0e-a02c-c379c432c637'}))[0], 200);
  assert.equal((await receive({...payload, pull_request: {...payload.pull_request, head: {sha: 'e'.repeat(40)}}}))[0], 202);
  assert.equal((await receive({...payload, pull_request: {...payload.pull_request, base: {...payload.pull_request.base, sha: 'f'.repeat(40)}}}))[0], 202);
  assert.equal((await receiveReviewWebhook(request({...payload, installation: {id: 67}}, {key: hooks.A14.secret}),
    'A14', hooks.A14, enqueue))[0], 202);
  assert.equal(ids.size, 4);
});

test('ignores irrelevant events and validates the candidate before commit', async () => {
  assert.equal((await receiveReviewWebhook(request(payload, {event: 'ping'}), 'A05', hooks.A05, neverQueue))[0], 200);
  assert.equal((await receiveReviewWebhook(request({...payload, action: 'edited'}), 'A05', hooks.A05, neverQueue))[0], 202);
  assert.equal((await receiveReviewWebhook(request({...payload, pull_request: {...payload.pull_request, head: {sha: 'main'}}}),
    'A05', hooks.A05, neverQueue))[0], 400);
  assert.equal((await receiveReviewWebhook(request(payload), 'A05', hooks.A05, async () => null))[0], 503);
});

test('retargeting to main queues the new commit pair without treating text edits as submissions', async () => {
  const retargeted = {...payload, action: 'edited', changes: {base: {
    ref: {from: 'codex/call-intelligence'}, sha: {from: 'e'.repeat(40)},
  }}};
  const queue = assignment => {
    assert.equal(assignment.candidate.head_sha, payload.pull_request.head.sha);
    assert.equal(assignment.candidate.base_sha, payload.pull_request.base.sha);
    return {delivery_ack: assignment.id};
  };
  const accepted = await receiveReviewWebhook(request(retargeted), 'A05', hooks.A05, queue);
  assert.equal(accepted[1].durable_commit, true);
  const metadata = await receiveReviewWebhook(request({...retargeted, changes: {title: {from: 'before'}}}),
    'A05', hooks.A05, neverQueue);
  assert.deepEqual(metadata, [202, {ignored: true}]);
});

test('fails closed on missing or shared credentials', () => {
  assert.deepEqual(reviewWebhookConfig({}), {});
  assert.deepEqual(reviewWebhookConfig({...config, GITHUB_REVIEW_A14_WEBHOOK_SECRET: hooks.A05.secret}), {});
  assert.deepEqual(reviewWebhookConfig({...config, GITHUB_REVIEW_A14_INSTALLATION_ID: '45'}), {});
});

test('a repository webhook commits a signed ping and fans a candidate out to both existing reviewers', async () => {
  const repoSecret = 'c'.repeat(64);
  const config = reviewWebhookConfig({...hooks, ...{
    GITHUB_REVIEW_REPOSITORY_ID: '123',
    GITHUB_REVIEW_REPOSITORY: 'test/rosie-core-platform',
    GITHUB_REVIEW_REPO_WEBHOOK_SECRET: repoSecret,
  }}).repository;
  const [status, acknowledgment] = await receiveReviewWebhook(
    request(payload, {event: 'ping', key: repoSecret}), 'repository', config, neverQueue,
    async (delivery, channel) => {
      assert.equal(channel, 'repository');
      assert.equal(delivery, '927a4599-56e7-4fb7-864e-901719d2d6b3');
      return delivery;
    });
  assert.equal(status, 200);
  assert.equal(acknowledgment.durable_commit, true);
  const received = await receiveReviewWebhook(request(payload, {key: repoSecret}), 'repository', config,
    async assignments => {
      assert.deepEqual(assignments.map(assignment => assignment.agent), ['A05', 'A14']);
      return assignments.map(({id}) => ({delivery_ack: id}));
    });
  assert.equal(received[0], 202);
  assert.equal(received[1].assignments.length, 2);
  const crossed = {...payload, repository: {...payload.repository, full_name: 'outside/repository'}};
  assert.equal((await receiveReviewWebhook(request(crossed, {key: repoSecret}), 'repository',
    config, neverQueue))[0], 403);
});

test('a merged event and a staged backfill match only retrospective assignment IDs', async () => {
  const scope = {repository_id:123, repository:'test/rosie-core-platform', pull_number:38,
    head_sha:'c'.repeat(40), base_sha:'d'.repeat(40), merge_sha:'e'.repeat(40)};
  const expected = stagedRetrospectiveAssignments({GITHUB_REVIEW_REPOSITORY_ID:'123',
    GITHUB_REVIEW_REPOSITORY:scope.repository, GITHUB_REVIEW_STAGING_RETROSPECTIVE_JSON:JSON.stringify(scope)});
  assert.notEqual(expected[0].id, reviewAssignment('A05', scope).id);
  const merged = {...payload, action:'closed', pull_request:{...payload.pull_request,
    state:'closed', merged:true, merge_commit_sha:scope.merge_sha}};
  const [code] = await receiveReviewWebhook(request(merged), 'A05', hooks.A05, async assignment => {
    assert.deepEqual(assignment, expected[0]);
    return {delivery_ack:'fixture'};
  });
  assert.equal(code, 202);
});
