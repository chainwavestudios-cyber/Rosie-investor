import {createHash, createHmac, timingSafeEqual} from 'node:crypto';

const reviewers = {A05: 'rosieeyez', A14: 'check_agent'};
const candidateActions = new Set(['opened', 'reopened', 'synchronize', 'ready_for_review']);
const sha = /^[a-f0-9]{40}$/;
const deliveryId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const maxBodyBytes = 1024 * 1024;

export function reviewWebhookConfig(env) {
  const repositoryId = Number(env.GITHUB_REVIEW_REPOSITORY_ID);
  const repository = env.GITHUB_REVIEW_REPOSITORY;
  const repositorySecret = env.GITHUB_REVIEW_REPO_WEBHOOK_SECRET;
  const a05Secret = env.GITHUB_REVIEW_A05_WEBHOOK_SECRET;
  const a14Secret = env.GITHUB_REVIEW_A14_WEBHOOK_SECRET;
  const a05Installation = Number(env.GITHUB_REVIEW_A05_INSTALLATION_ID);
  const a14Installation = Number(env.GITHUB_REVIEW_A14_INSTALLATION_ID);
  if (!Number.isSafeInteger(repositoryId) || repositoryId < 1) return {};
  const hooks = {};
  if (repositorySecret?.length >= 32 && repositorySecret !== a05Secret && repositorySecret !== a14Secret &&
      /^[\w.-]+\/[\w.-]+$/.test(repository || '')) {
    hooks.repository = {repositoryId, repository, secret: repositorySecret};
  }
  if (
      !a05Secret || a05Secret.length < 32 || !a14Secret || a14Secret.length < 32 ||
      a05Secret === a14Secret || !Number.isSafeInteger(a05Installation) || a05Installation < 1 ||
      !Number.isSafeInteger(a14Installation) || a14Installation < 1 || a05Installation === a14Installation) return hooks;
  return {...hooks,
    A05: {repositoryId, installationId: a05Installation, secret: a05Secret},
    A14: {repositoryId, installationId: a14Installation, secret: a14Secret},
  };
}

async function readBytes(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({destroyOnReturn: false})) {
    size += chunk.length;
    if (size > maxBodyBytes) throw Object.assign(Error('payload_too_large'), {http: 413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function reviewEventId(agent, candidate) {
  const identity = [
    'rosie.core.independent-review.v1', agent, candidate.repository_id,
    candidate.pull_number, candidate.head_sha, candidate.base_sha,
  ];
  if (candidate.mode === 'retrospective') identity.push(candidate.mode, candidate.merge_sha);
  const digest = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export function reviewAssignment(agent, candidate) {
  const scoped = {...candidate, contract: 'rosie.core.independent-review.v1', reviewer: reviewers[agent]};
  return {agent, id: reviewEventId(agent, scoped), candidate: scoped};
}

export function stagedRetrospectiveAssignments(env) {
  if (!env.GITHUB_REVIEW_STAGING_RETROSPECTIVE_JSON) return [];
  const value = JSON.parse(env.GITHUB_REVIEW_STAGING_RETROSPECTIVE_JSON);
  const repositoryId = Number(env.GITHUB_REVIEW_REPOSITORY_ID);
  if (!value || value.repository_id !== repositoryId || value.repository !== env.GITHUB_REVIEW_REPOSITORY ||
      !/^[\w.-]+\/[\w.-]+$/.test(value.repository || '') || !Number.isSafeInteger(repositoryId) ||
      repositoryId < 1 || !Number.isSafeInteger(value.pull_number) || value.pull_number < 1 ||
      ![value.head_sha, value.base_sha, value.merge_sha].every(commit => typeof commit === 'string' && sha.test(commit))) {
    throw Error('review_retrospective_scope_invalid');
  }
  return Object.keys(reviewers).map(agent => reviewAssignment(agent, {
    repository_id: repositoryId, repository: value.repository, pull_number: value.pull_number,
    head_sha: value.head_sha, base_sha: value.base_sha, mode: 'retrospective', merge_sha: value.merge_sha,
  }));
}

export async function receiveReviewWebhook(request, agent, config, enqueue, acknowledgePing) {
  if (request.method !== 'POST') return [405, {error: 'method_not_allowed'}];
  const repositoryHook = agent === 'repository';
  if ((!repositoryHook && !Object.hasOwn(reviewers, agent)) || !config) return [404, {error: 'not_found'}];
  const supplied = request.headers['x-hub-signature-256'];
  if (typeof supplied !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(supplied)) {
    return [401, {error: 'github_signature_required'}];
  }
  let raw;
  try {
    raw = await readBytes(request);
  } catch (error) {
    if (error.http === 413) return [413, {error: 'payload_too_large'}];
    throw error;
  }
  const expected = createHmac('sha256', config.secret).update(raw).digest();
  if (!timingSafeEqual(Buffer.from(supplied.slice(7), 'hex'), expected)) {
    return [401, {error: 'github_signature_invalid'}];
  }
  const event = request.headers['x-github-event'];
  const delivery = request.headers['x-github-delivery'];
  if (typeof delivery !== 'string' || !deliveryId.test(delivery)) {
    return [400, {error: 'invalid_github_delivery'}];
  }
  if (event === 'ping') {
    if (!acknowledgePing) return [200, {ok: true}];
    const receipt = await acknowledgePing(delivery.toLowerCase(), agent);
    if (!receipt) return [503, {error: 'ping_acknowledgment_unavailable'}];
    return [200, {ok: true, durable_commit: true, event_id: receipt}];
  }
  if (event !== 'pull_request') return [202, {ignored: true}];
  let body;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return [400, {error: 'invalid_json'}];
  }
  if ((repositoryHook ? body?.repository?.full_name !== config.repository :
      body?.installation?.id !== config.installationId) ||
      body?.repository?.id !== config.repositoryId) {
    return [403, {error: 'github_installation_or_repository_not_allowed'}];
  }
  const pr = body.pull_request;
  const retrospective = body.action === 'closed' && pr?.merged === true;
  if (!retrospective && !candidateActions.has(body.action)) return [202, {ignored: true}];
  const repository = body.repository.full_name;
  if (!Number.isSafeInteger(body.number) || body.number < 1 || pr?.number !== body.number ||
      pr.base?.repo?.id !== config.repositoryId || pr.base?.ref !== 'main' ||
      (retrospective ? pr.state !== 'closed' || !sha.test(pr.merge_commit_sha || '') : pr.state !== 'open') ||
      typeof pr.head?.sha !== 'string' || !sha.test(pr.head.sha) ||
      typeof pr.base?.sha !== 'string' || !sha.test(pr.base.sha) ||
      typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    return [400, {error: 'invalid_review_candidate'}];
  }
  const candidate = {
    repository_id: config.repositoryId,
    repository,
    pull_number: body.number,
    head_sha: pr.head.sha,
    base_sha: pr.base.sha,
    ...(retrospective ? {mode: 'retrospective', merge_sha: pr.merge_commit_sha} : {}),
  };
  if (repositoryHook) {
    const batch = Object.keys(reviewers).map(reviewer => reviewAssignment(reviewer, candidate));
    const receipts = await enqueue(batch);
    if (receipts?.superseded) return [202, {ignored: true, reason: 'superseded'}];
    if (!Array.isArray(receipts) || receipts.length !== batch.length ||
        receipts.some(result => !result?.delivery_ack)) return [503, {error: 'review_assignment_unavailable'}];
    return [receipts.every(result => result.idempotent) ? 200 : 202, {
      accepted: true, durable_commit: true,
      assignments: batch.map(({agent, id}, index) => ({
        agent, event_id: id, delivery_ack: receipts[index].delivery_ack,
      })),
    }];
  }
  const assignment = reviewAssignment(agent, candidate);
  const receipt = await enqueue(assignment);
  if (receipt?.superseded) return [202, {ignored: true, reason: 'superseded'}];
  if (!receipt?.delivery_ack) return [503, {error: 'review_assignment_unavailable'}];
  return [receipt.idempotent ? 200 : 202, {
    accepted: true, durable_commit: true, event_id: assignment.id, ...receipt,
  }];
}
