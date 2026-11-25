const org = 'rosie-core-internal';
const assignmentContract = 'rosie.core.independent-review.v1';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{40}$/;

export function reviewSourceResource(candidate, resource) {
  const {pull_number, head_sha, base_sha, mode, merge_sha} = candidate;
  const target = mode === 'retrospective' ? merge_sha : head_sha;
  if (!Number.isSafeInteger(pull_number) || pull_number < 1 ||
      ![head_sha, base_sha, target].every(value => typeof value === 'string' && sha.test(value))) return null;
  const projectCommit = object => ({sha: object.sha, tree: {sha: object.tree?.sha}});
  switch (resource) {
  case '/pulls/' + pull_number:
    return {path: resource, project: object => ({state: object.state, merged: object.merged,
      merge_commit_sha: object.merge_commit_sha, head: {sha: object.head?.sha},
      base: {sha: object.base?.sha, ref: object.base?.ref, repo: {id: object.base?.repo?.id}}})};
  case '/branches/main':
    return mode === 'retrospective' ? null : {path: resource,
      project: object => ({commit: {sha: object.commit?.sha}})};
  case '/git/commits/' + head_sha:
  case '/git/commits/' + base_sha:
  case '/git/commits/' + target:
    return {path: resource, project: projectCommit};
  case '/compare/' + base_sha + '...' + target + '?per_page=1':
    return {path: resource, project: object => ({base_commit: {sha: object.base_commit?.sha},
      files: Array.isArray(object.files) ? object.files.slice(0, 300).map(file => ({filename: file.filename})) : null})};
  default:
    return null;
  }
}

export async function readReviewSource({sql, body, repository}) {
  const {org_id, agent_id, nonce, assignment_id, resource} = body;
  if (org_id !== org || !['A05', 'A14'].includes(agent_id) || Object.keys(body).length !== 5 ||
      typeof nonce !== 'string' || !uuid.test(nonce) ||
      typeof assignment_id !== 'string' || !uuid.test(assignment_id) ||
      typeof resource !== 'string' || resource.length > 110) {
    return [400, {error: 'invalid_review_source_request'}];
  }
  if (!repository) return [503, {error: 'github_source_not_configured'}];
  const allowed = await sql.begin(async tx => {
    await tx`SET LOCAL statement_timeout='5000ms'`;
    const [row] = await tx`SELECT e.payload FROM core_agents.events e
      JOIN core_agents.agent_message_receipts a ON a.event_id=e.event_id
        AND a.recipient_agent_id=e.recipient_agent_id
      JOIN core_agents.identities i ON i.org_id=e.org_id AND i.agent_id=e.recipient_agent_id
      WHERE e.org_id=${org} AND e.event_id=${assignment_id} AND e.recipient_agent_id=${agent_id}
        AND e.payload->>'contract'=${assignmentContract} AND i.desired_state<>'revoked'`;
    if (row?.payload?.repository !== repository.repository ||
        row?.payload?.repository_id !== repository.repositoryId) return null;
    const selected = reviewSourceResource(row.payload, resource);
    if (!selected) return null;
    await tx`INSERT INTO core_agents.worker_nonces(nonce,org_id) VALUES(${nonce},${org})`;
    return selected;
  });
  if (!allowed) return [403, {error: 'review_source_out_of_scope'}];
  const object = await repository.read(allowed.path);
  if (!object) return [404, {error: 'review_source_not_found'}];
  return [200, allowed.project(object)];
}
