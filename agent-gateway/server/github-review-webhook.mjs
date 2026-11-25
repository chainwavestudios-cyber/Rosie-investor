import {createHash, createHmac, timingSafeEqual} from 'node:crypto';

const reviewers = {A05: 'rosieeyez', A14: 'check_agent'};
const candidateActions = new Set(['opened', 'reopened', 'synchronize', 'ready_for_review']);
const sha = /^[a-f0-9]{40}$/;
const deliveryId = /^[a-f0-9-]{36}$/i;
const maxBodyBytes = 1024 * 1024;

export function reviewWebhookConfig(env) {
  const repositoryId = Number(env.GITHUB_REVIEW_REPOSITORY_ID);
  const a05Secret = env.GITHUB_REVIEW_A05_WEBHOOK_SECRET;
  const a14Secret = env.GITHUB_REVIEW_A14_WEBHOOK_SECRET;
  const a05Installation = Number(env.GITHUB_REVIEW_A05_INSTALLATION_ID);
  const a14Installation = Number(env.GITHUB_REVIEW_A14_INSTALLATION_ID);
  if (!Number.isSafeInteger(repositoryId) || repositoryId < 1 ||
      !a05Secret || a05Secret.length < 32 || !a14Secret || a14Secret.length < 32 ||
      a05Secret === a14Secret || !Number.isSafeInteger(a05Installation) || a05Installation < 1 ||
      !Number.isSafeInteger(a14Installation) || a14Installation < 1 || a05Installation === a14Installation) return {};
  return {
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

function eventId(agent, candidate) {
  const digest = createHash('sha256').update(JSON.stringify([
    'rosie.core.independent-review.v1', agent, candidate.repository_id,
    candidate.pull_number, candidate.head_sha, candidate.base_sha,
  ])).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export async function receiveReviewWebhook(request, agent, config, enqueue) {
  if (request.method !== 'POST') return [405, {error: 'method_not_allowed'}];
  if (!Object.hasOwn(reviewers, agent) || !config) return [404, {error: 'not_found'}];
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
  if (event === 'ping') return [200, {ok: true}];
  if (event !== 'pull_request') return [202, {ignored: true}];
  let body;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return [400, {error: 'invalid_json'}];
  }
  if (body?.installation?.id !== config.installationId ||
      body?.repository?.id !== config.repositoryId) {
    return [403, {error: 'github_installation_or_repository_not_allowed'}];
  }
  if (!candidateActions.has(body.action)) return [202, {ignored: true}];
  const pr = body.pull_request;
  const repository = body.repository.full_name;
  if (!Number.isSafeInteger(body.number) || body.number < 1 || pr?.number !== body.number ||
      pr.base?.repo?.id !== config.repositoryId || pr.state !== 'open' ||
      typeof pr.head?.sha !== 'string' || !sha.test(pr.head.sha) ||
      typeof pr.base?.sha !== 'string' || !sha.test(pr.base.sha) ||
      typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    return [400, {error: 'invalid_review_candidate'}];
  }
  const candidate = {
    contract: 'rosie.core.independent-review.v1',
    repository_id: config.repositoryId,
    repository,
    pull_number: body.number,
    head_sha: pr.head.sha,
    base_sha: pr.base.sha,
    reviewer: reviewers[agent],
  };
  const id = eventId(agent, candidate);
  const receipt = await enqueue({agent, id, candidate});
  if (!receipt?.delivery_ack) return [503, {error: 'review_assignment_unavailable'}];
  return [receipt.idempotent ? 200 : 202, {
    accepted: true, durable_commit: true, event_id: id, ...receipt,
  }];
}
