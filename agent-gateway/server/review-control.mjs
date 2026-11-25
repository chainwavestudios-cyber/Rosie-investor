import {createHash} from 'node:crypto';
import {reviewAssignment} from './github-review-webhook.mjs';
import {verifyIndependentReviewReceipt} from './independent-review-receipt.mjs';

const org = 'rosie-core-internal';
const roles = ['A05', 'A14'];
const assignmentContract = 'rosie.core.independent-review.v1';
const receiptContract = 'rosie.core.independent-review.registered.v1';
const sha = /^[a-f0-9]{40}$/;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export function readReviewRegistry(raw) {
  try {
    const registry = JSON.parse(raw || 'null');
    return registry && typeof registry === 'object' && !Array.isArray(registry) ? registry : null;
  } catch {
    return null;
  }
}

export function githubReviewSource(env, transport = fetch) {
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
    const [row] = await sql`SELECT e.received_at,mr.received_at AS acknowledged_at,r.payload AS receipt
      FROM core_agents.events e
      LEFT JOIN core_agents.agent_message_receipts mr ON mr.event_id=e.event_id
        AND mr.recipient_agent_id=e.recipient_agent_id
      LEFT JOIN core_agents.events r ON r.event_id=${receiptId(assignment.id)} AND r.org_id=e.org_id
        AND r.recipient_agent_id=e.recipient_agent_id AND r.payload->>'contract'=${receiptContract}
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
    };
  }));
  return {
    candidate: scope, reviewers: rows, base_confirmed: source.base_confirmed,
    accepted: source.base_confirmed && rows.every(row => row.status === 'accept'),
  };
}

export async function handleReviewControl({sql, request, source, registry, enqueue}) {
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
