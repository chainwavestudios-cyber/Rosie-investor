import assert from 'node:assert/strict';
import test from 'node:test';
import {reconcilePendingReviews} from '../review-reconciliation.mjs';

const base = 'b'.repeat(40);
const draft = (number, baseSha = base, repositoryId = 8) => ({number, state: 'open', draft: true,
  head: {sha: 'a'.repeat(40)}, base: {sha: baseSha, ref: 'main', repo: {id: repositoryId}}});

test('reconciles existing drafts, skips stale or unrelated candidates and retries idempotently', async () => {
  const repo = {repository: 'pilot/review', repositoryId: 8, async read(path) {
    if (path === '/branches/main') return {commit: {sha: base}};
    assert.equal(path, '/pulls?state=open&base=main&sort=created&direction=asc&per_page=30&page=1');
    return [draft(39), draft(38, 'c'.repeat(40)), draft(1, base, 9), draft(42)];
  }};
  const ids = new Set();
  const numbers = [];
  const enqueue = async assignments => assignments.map(assignment => {
    assert.equal(assignment.candidate.base_sha, base);
    numbers.push(assignment.candidate.pull_number);
    const idempotent = ids.has(assignment.id);
    ids.add(assignment.id);
    return {delivery_ack: assignment.id, idempotent};
  });
  assert.deepEqual(await reconcilePendingReviews(repo, enqueue), {nextPage: 1, added: 4, deferred: 1, errors: 0});
  assert.deepEqual(numbers, [39, 39, 42, 42]);
  assert.deepEqual(await reconcilePendingReviews(repo, enqueue), {nextPage: 1, added: 0, deferred: 1, errors: 0});
});
