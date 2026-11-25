import test from 'node:test';
import assert from 'node:assert/strict';
import {readReviewSource, reviewSourceResource} from '../review-source-broker.mjs';

const candidate = {repository: 'owner/repo', repository_id: 42, pull_number: 38,
  head_sha: 'a'.repeat(40), base_sha: 'b'.repeat(40)};
const request = {org_id: 'rosie-core-internal', agent_id: 'A05',
  assignment_id: '00000000-1111-8222-a333-444444444444',
  nonce: '55555555-1111-8222-a333-444444444444', resource: '/pulls/38'};

test('the source broker projects only pinned metadata and never fetches an unassigned resource', async () => {
  const accesses = [];
  const repository = {repository: candidate.repository, repositoryId: 42, async read(path) {
    accesses.push(path);
    return {state: 'open', body: 'private draft notes', user: {login: 'someone'},
      head: {sha: candidate.head_sha}, base: {sha: candidate.base_sha, ref: 'main', repo: {id: 42}}};
  }};
  const sql = {begin: fn => fn(async (query, ...params) => {
    if (!query[0].startsWith('SELECT')) return [];
    return params.includes('A05') ? [{payload: candidate}] : [];
  })};
  const [status, projected] = await readReviewSource({sql, body: request, repository});
  assert.equal(status, 200);
  assert.equal(projected.head.sha, candidate.head_sha);
  assert.equal(projected.body, undefined);
  assert.equal(projected.user, undefined);
  assert.equal((await readReviewSource({sql, body: {...request, agent_id: 'A14'}, repository}))[0], 403);
  assert.equal((await readReviewSource({sql, body: {...request, resource: '/pulls/39'}, repository}))[0], 403);
  assert.deepEqual(accesses, ['/pulls/38']);
});

test('retrospective resources allow the exact merge object and exclude the live branch', () => {
  const merge = 'c'.repeat(40);
  const historical = {...candidate, mode: 'retrospective', merge_sha: merge};
  assert.ok(reviewSourceResource(historical, '/git/commits/' + merge));
  assert.equal(reviewSourceResource(historical, '/branches/main'), null);
  assert.equal(reviewSourceResource(historical, '/git/commits/' + 'd'.repeat(40)), null);
});
