import {reviewAssignment} from './github-review-webhook.mjs';

const sha = /^[a-f0-9]{40}$/;
const pageSize = 30;
const roles = ['A05', 'A14'];

export async function reconcilePendingReviews(repository, enqueue, page = 1) {
  const {read, repositoryId} = repository;
  const [pulls, branch] = await Promise.all([
    read(`/pulls?state=open&base=main&sort=created&direction=asc&per_page=${pageSize}&page=${page}`),
    read('/branches/main'),
  ]);
  const base = branch?.commit?.sha;
  if (!Array.isArray(pulls) || pulls.length > pageSize || typeof base !== 'string' || !sha.test(base)) {
    throw Error('review_reconciliation_source_invalid');
  }
  let added = 0;
  let deferred = 0;
  let errors = 0;
  for (const pull of pulls) {
    if (pull?.state !== 'open' || pull.base?.ref !== 'main' || pull.base.repo?.id !== repositoryId ||
        !Number.isSafeInteger(pull.number) || pull.number < 1 || typeof pull.head?.sha !== 'string' ||
        !sha.test(pull.head.sha)) continue;
    if (pull.base.sha !== base) {
      deferred++;
      continue;
    }
    const scope = {repository_id: repositoryId, repository: repository.repository,
      pull_number: pull.number, head_sha: pull.head.sha, base_sha: base};
    try {
      const receipts = await enqueue(roles.map(agent => reviewAssignment(agent, scope)));
      if (!Array.isArray(receipts) || receipts.length !== roles.length ||
          receipts.some(receipt => !receipt?.delivery_ack)) throw Error('review_reconciliation_not_persisted');
      added += receipts.filter(receipt => !receipt.idempotent).length;
    } catch {
      errors++;
    }
  }
  return {nextPage: pulls.length === pageSize ? page + 1 : 1, added, deferred, errors};
}
