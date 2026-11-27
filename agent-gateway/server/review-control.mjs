import {createHash} from 'node:crypto';
import {reviewAssignment} from './github-review-webhook.mjs';
import {verifyIndependentReviewReceipt} from './independent-review-receipt.mjs';
import {automatedContract,automatedResultId} from './review-automated-result.mjs';

const org = 'rosie-core-internal';
const roles = ['A05', 'A14'];
const assignmentContract = 'rosie.core.independent-review.v1';
const receiptContract = 'rosie.core.independent-review.registered.v1';
const sha = /^[a-f0-9]{40}$/;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const iamStagingService = 'srv-dbvkq4utlv9c73e4o5i0';
const iamStagingScope = Object.freeze({
  repository: 'chainwavestudios-cyber/rosie-core-platform',
  repository_id: 1461312036,
  pull_number: 47,
  head_sha: '76a357cda0dc293e7256e3a7571b6b3f2bdce566',
  base_sha: 'e94765c3b93d71fc1ebbb7dd4bca59eb77f1d762',
});

export function reviewControlCredential(action, controlKey, inboxKey) {
  if (action !== 'reviewer_inbox') return controlKey;
  return reviewReaderCredential(controlKey, inboxKey);
}

function reviewReaderCredential(controlKey, inboxKey) {
  return typeof inboxKey === 'string' && inboxKey.length >= 40 && inboxKey !== controlKey
    ? inboxKey : undefined;
}

export function stagingIamStatusCredential(request, serviceId, controlKey, inboxKey) {
  if (serviceId !== iamStagingService || controlKey || request?.action !== 'status' ||
      request.pull_number !== iamStagingScope.pull_number || Object.keys(request).length !== 2) return undefined;
  return reviewReaderCredential(controlKey, inboxKey);
}

export function readReviewRegistry(raw) {
  try {
    const registry = JSON.parse(raw || 'null');
    return registry && typeof registry === 'object' && !Array.isArray(registry) ? registry : null;
  } catch {
    return null;
  }
}

export function githubReviewRepository(env, transport = fetch) {
  const token = env.GITHUB_REVIEW_SOURCE_READ_TOKEN;
  const repository = env.GITHUB_REVIEW_REPOSITORY;
  const repositoryId = Number(env.GITHUB_REVIEW_REPOSITORY_ID);
  if (!token || !repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
      !Number.isSafeInteger(repositoryId) || repositoryId < 1) return null;
  async function read(path) {
    const response = await transport('https://api.github.com/repos/' + repository + path, {
      redirect: 'error',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: 'Bearer ' + token,
        'x-github-api-version': '2026-03-10',
      },
      signal: AbortSignal.timeout(5500),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw Error('github_source_unavailable');
    return response.json();
  }
  return {repository, repositoryId, read};
}

export function githubReviewSource(env, transport = fetch) {
  const configured = githubReviewRepository(env, transport);
  if (!configured) return null;
  const {repository, repositoryId, read} = configured;
  return async number => {
    const pull = await read('/pulls/' + number);
    if (pull?.number !== number || pull.base?.repo?.id !== repositoryId ||
        pull.base?.ref !== 'main' || pull.state !== 'open' || !sha.test(pull.head?.sha || '')) return null;
    const branch = await read('/branches/main');
    const base = branch?.commit?.sha;
    if (typeof base !== 'string' || !sha.test(base)) throw Error('github_source_unavailable');
    return {
      repository_id: repositoryId, repository, pull_number: number, head_sha: pull.head.sha,
      base_sha: base, implementer_id: String(pull.user?.id || ''),
      base_confirmed: pull.base.sha === base,
    };
  };
}

function receiptId(assignmentId) {
  const d = createHash('sha256').update(receiptContract + '\n' + assignmentId).digest('hex');
  return `${d.slice(0,8)}-${d.slice(8,12)}-8${d.slice(13,16)}-a${d.slice(17,20)}-${d.slice(20,32)}`;
}

export function reviewScope(candidate) {
  const {repository_id, repository, pull_number, head_sha, base_sha} = candidate;
  return {repository_id, repository, pull_number, head_sha, base_sha};
}

async function reviewState(sql, source, registry) {
  const scope = reviewScope(source);
  const rows = await Promise.all(roles.map(async agent => {
    const assignment = reviewAssignment(agent, scope);
    const [row] = await sql`SELECT e.received_at,mr.received_at AS acknowledged_at,r.payload AS receipt,
      m.payload AS automated
      FROM core_agents.events e
      LEFT JOIN core_agents.agent_message_receipts mr ON mr.event_id=e.event_id
        AND mr.recipient_agent_id=e.recipient_agent_id
      LEFT JOIN core_agents.events r ON r.event_id=${receiptId(assignment.id)} AND r.org_id=e.org_id
        AND r.recipient_agent_id=e.recipient_agent_id AND r.payload->>'contract'=${receiptContract}
      LEFT JOIN core_agents.events m ON m.event_id=${automatedResultId(assignment.id)} AND m.org_id=e.org_id
        AND m.recipient_agent_id=e.recipient_agent_id AND m.payload->>'contract'=${automatedContract}
      WHERE e.org_id=${org} AND e.event_id=${assignment.id} AND e.recipient_agent_id=${agent}
        AND e.payload->>'contract'=${assignmentContract}`;
    const receipt = row?.receipt?.decision;
    const verified = await verifyIndependentReviewReceipt(receipt, {
      ...scope, id: assignment.id, agent_id: agent, issued_at: Date.parse(row?.received_at),
      implementer_id: source.implementer_id,
    }, registry);
    const acknowledged = !!row?.acknowledged_at;
    return {
      agent_id: agent, assignment_id: assignment.id,
      status: verified && acknowledged ? receipt.verdict : acknowledged ? 'acknowledged'
        : row ? (Date.now() - Date.parse(row.received_at) >= 900000 ? 'escalation_required' : 'queued') : 'missing',
      receipt_id: verified && acknowledged ? receiptId(assignment.id) : null,
      evidence_sha256: verified && acknowledged ? receipt.evidence_sha256 : null,
      proof: verified && acknowledged ? {
        receipt, assignment_issued_at: Date.parse(row.received_at),
      } : null,
      automated: row?.automated?.report ?? null,
    };
  }));
  return {
    candidate: scope, reviewers: rows, base_confirmed: source.base_confirmed,
    implementer_id: source.implementer_id,
    accepted: source.base_confirmed && rows.every(row => row.status === 'accept'),
  };
}

async function readReviewerInbox(sql, request) {
  const {agent_id, assignment_ids} = request;
  if (Object.keys(request).length !== 3 || !roles.includes(agent_id) ||
      !Array.isArray(assignment_ids) || assignment_ids.length < 1 || assignment_ids.length > 16 ||
      assignment_ids.some(id => typeof id !== 'string' || !uuid.test(id)) ||
      new Set(assignment_ids).size !== assignment_ids.length) {
    return [400, {error: 'invalid_reviewer_inbox_request'}];
  }
  const rows = await sql`SELECT e.event_id::text AS assignment_id,e.received_at,
      ack.received_at AS acknowledged_at,e.payload->>'pull_number' AS pull_number,
      e.payload->>'product_key' AS product_key,report.event_id::text AS automated_report_id,
      report.payload->'report'->>'state' AS automated_state
    FROM core_agents.events e
    JOIN core_agents.identities i ON i.org_id=e.org_id AND i.agent_id=e.recipient_agent_id
    LEFT JOIN core_agents.agent_message_receipts ack ON ack.event_id=e.event_id
      AND ack.org_id=e.org_id AND ack.recipient_agent_id=e.recipient_agent_id
    LEFT JOIN core_agents.events report ON report.org_id=e.org_id
      AND report.recipient_agent_id=e.recipient_agent_id AND report.payload->>'contract'=${automatedContract}
      AND report.payload->>'assignment_id'=e.event_id::text
    WHERE e.org_id=${org} AND e.recipient_agent_id=${agent_id} AND i.desired_state<>'revoked'
      AND e.payload->>'contract'=${assignmentContract} AND e.event_id IN ${sql(assignment_ids)}
    ORDER BY e.received_at,e.event_id LIMIT ${assignment_ids.length}`;
  const assignments = rows.map(row => ({assignment_id: row.assignment_id, received_at: row.received_at,
    acknowledged_at: row.acknowledged_at ?? null,
    ...(/^[1-9][0-9]{0,8}$/.test(row.pull_number ?? '') ? {pull_number: Number(row.pull_number)} : {}),
    ...(/^[a-z][a-z0-9_-]{1,49}$/.test(row.product_key ?? '') ? {product_key: row.product_key} : {}),
    ...(uuid.test(row.automated_report_id ?? '') && ['source_verified','superseded'].includes(row.automated_state)
      ? {automated_report_id: row.automated_report_id, automated_state: row.automated_state} : {}),
  }));
  return [200, {ok: true, assignments, release_authorized: false}];
}

export async function handleReviewControl({sql, request, source, registry, enqueue}) {
  if (request?.action === 'reviewer_inbox') return readReviewerInbox(sql, request);
  const {action, pull_number} = request;
  if (!['request', 'status'].includes(action) || Object.keys(request).length !== 2 ||
      !Number.isSafeInteger(pull_number) || pull_number < 1) return [400, {error: 'invalid_review_request'}];
  if (!source) return [503, {error: 'github_source_not_configured'}];
  const candidate = await source(pull_number);
  if (!candidate) return [404, {error: 'review_candidate_not_open'}];
  if (action === 'request') {
    if (!candidate.base_confirmed) return [409, {error: 'review_candidate_base_changed'}];
    const results = await enqueue(roles.map(agent => reviewAssignment(agent, reviewScope(candidate))));
    if (!results) return [503, {error: 'review_assignment_unavailable'}];
  }
  return [200, {ok: true, ...await reviewState(sql, candidate, registry)}];
}

export async function readStagingIamStatus({sql, source, registry}) {
  if (!source) return [503, {error: 'github_source_not_configured'}];
  const candidate = await source(iamStagingScope.pull_number);
  if (candidate?.base_confirmed !== true ||
      !Object.entries(iamStagingScope).every(([key, value]) => candidate[key] === value)) {
    return [409, {error: 'staging_iam_candidate_changed'}];
  }
  const state = await reviewState(sql, candidate, registry);
  if (!state.accepted) return [409, {error: 'staging_iam_approvals_unavailable'}];
  const reviewers = state.reviewers.map(({agent_id, assignment_id, status, receipt_id, evidence_sha256, proof}) =>
    ({agent_id, assignment_id, status, receipt_id, evidence_sha256, proof}));
  return [200, {ok: true, ...state, reviewers, environment: 'staging', independent: false, release_authorized: false}];
}

export async function registerReviewDecision({sql, body, source, registry}) {
  const {org_id, agent_id, nonce, receipt} = body;
  if (org_id !== org || !roles.includes(agent_id) || typeof nonce !== 'string' || !uuid.test(nonce) ||
      Object.keys(body).length !== 4 || !Number.isSafeInteger(receipt?.pull_number) || receipt.pull_number < 1) {
    return [400, {error: 'invalid_review_receipt_request'}];
  }
  if (!source || !registry) return [503, {error: 'review_verification_not_configured'}];
  const current = await source(receipt.pull_number);
  if (!current?.base_confirmed) return [409, {error: 'review_candidate_base_changed'}];
  const {id} = reviewAssignment(agent_id, reviewScope(current));
  if (receipt.assignment_id !== id) return [409, {error: 'review_candidate_superseded'}];
  return sql.begin(async tx => {
    await tx`SET LOCAL statement_timeout='5000ms'`;
    const [assignment] = await tx`SELECT e.received_at FROM core_agents.events e
      JOIN core_agents.identities a ON a.org_id=e.org_id AND a.agent_id=e.recipient_agent_id
      JOIN core_agents.agent_message_receipts mr ON mr.event_id=e.event_id
        AND mr.recipient_agent_id=e.recipient_agent_id
      WHERE e.org_id=${org} AND e.event_id=${id} AND e.recipient_agent_id=${agent_id}
        AND e.payload->>'contract'=${assignmentContract} AND a.desired_state<>'revoked'
      FOR UPDATE OF e`;
    if (!assignment) return [409, {error: 'review_assignment_not_acknowledged'}];
    const valid = await verifyIndependentReviewReceipt(receipt, {
      ...reviewScope(current), id, agent_id, issued_at: Date.parse(assignment.received_at),
      implementer_id: current.implementer_id,
    }, registry);
    if (!valid) return [403, {error: 'independent_review_signature_invalid'}];
    await tx`INSERT INTO core_agents.worker_nonces(nonce,org_id) VALUES(${nonce},${org})`;
    const event = receiptId(id);
    const payload = {contract: receiptContract, decision: receipt};
    const added = await tx`INSERT INTO core_agents.events
      (event_id,org_id,recipient_agent_id,sender,event_type,ticket_key,payload,nonce)
      VALUES(${event},${org},${agent_id},${agent_id},'rcis.message',NULL,${tx.json(payload)},${event})
      ON CONFLICT(event_id) DO NOTHING RETURNING event_id`;
    if (!added.length) {
      const same = await tx`SELECT event_id FROM core_agents.events WHERE event_id=${event}
        AND org_id=${org} AND recipient_agent_id=${agent_id} AND payload=${tx.json(payload)}::jsonb`;
      if (!same.length) return [409, {error: 'review_assignment_already_decided'}];
    }
    return [added.length ? 201 : 200, {ok: true, durable_commit: true, receipt_id: event}];
  });
}
