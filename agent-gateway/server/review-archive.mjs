import {createHash, createHmac} from 'node:crypto';
import {automatedContract} from './review-automated-result.mjs';

const org = 'rosie-core-internal';
const receiptContract = 'rosie.core.independent-review.registered.v1';
const guardianContract = 'rosie.core.independent-review.guardian.v1';
const docsContract = 'rosie.core.independent-review.documentation.v1';
const feedbackContract = 'rosie.core.independent-review.feedback.v1';
const transportContract = 'rosie.core.rcis.transport.v1';
const agentId = /^A[0-9]{2,4}$/;

function deliveryEventId(contract, receiptId) {
  const d = createHash('sha256').update(contract + '\n' + receiptId).digest('hex');
  return `${d.slice(0,8)}-${d.slice(8,12)}-8${d.slice(13,16)}-a${d.slice(17,20)}-${d.slice(20,32)}`;
}

export async function enqueueGuardianReviewArchive(sql, guardianAgent) {
  if (!agentId.test(guardianAgent ?? '')) return false;
  return sql.begin(async tx => {
    await tx`SET LOCAL statement_timeout='5000ms'`;
    const [guardian] = await tx`SELECT agent_id FROM core_agents.identities
      WHERE org_id=${org} AND agent_id=${guardianAgent} AND role='guardian_memory'
        AND desired_state='ready' AND runtime_state IN ('available','running')`;
    if (!guardian) return false;
    const [row] = await tx`SELECT e.event_id,e.payload FROM core_agents.events e
      LEFT JOIN core_agents.acks a ON a.event_id=e.event_id AND a.stage='persisted'
      WHERE e.org_id=${org} AND e.payload->>'contract' IN (${receiptContract},${automatedContract})
        AND a.event_id IS NULL ORDER BY e.received_at LIMIT 1 FOR UPDATE OF e SKIP LOCKED`;
    if (!row) return false;
    const event = deliveryEventId(guardianContract, row.event_id);
    const payload = {contract: transportContract, kind:'note', trace_id:row.event_id, reply_to:null,
      message:'Archive Rosie review evidence ' + row.event_id + ' and return the Guardian receipt after read-back.',
      archive:{contract: guardianContract, receipt_id: row.event_id, evidence: row.payload}};
    await tx`INSERT INTO core_agents.events
      (event_id,org_id,recipient_agent_id,sender,event_type,ticket_key,payload,nonce)
      VALUES(${event},${org},${guardian.agent_id},'rosie_core','rcis.message',NULL,${tx.json(payload)},${event})
      ON CONFLICT(event_id) DO NOTHING`;
    await tx`INSERT INTO core_agents.acks(event_id,org_id,stage,actor)
      VALUES(${row.event_id},${org},'persisted','guardian_outbox')
      ON CONFLICT(event_id,stage) DO NOTHING`;
    return true;
  });
}

export function reviewFeedbackRoutes(raw) {
  try {
    const mapping = JSON.parse(raw || '{}');
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return [];
    return Object.entries(mapping).flatMap(([pull, agent]) =>
      /^[1-9][0-9]{0,8}$/.test(pull) && typeof agent === 'string' && agentId.test(agent) &&
      !['A05','A14'].includes(agent) ? [[pull,agent]] : []);
  } catch {
    return [];
  }
}

export async function enqueueReviewFeedback(sql, [pull, agent]) {
  return sql.begin(async tx => {
    await tx`SET LOCAL statement_timeout='5000ms'`;
    const [recipient] = await tx`SELECT agent_id FROM core_agents.identities
      WHERE org_id=${org} AND agent_id=${agent} AND desired_state='ready'
        AND runtime_state IN ('available','running')`;
    if (!recipient) return false;
    const [row] = await tx`SELECT e.event_id,e.recipient_agent_id,e.payload FROM core_agents.events e
      LEFT JOIN core_agents.events f ON f.org_id=e.org_id AND f.recipient_agent_id=${agent}
        AND f.payload->'review'->>'contract'=${feedbackContract} AND f.payload->>'trace_id'=e.event_id::text
      WHERE e.org_id=${org} AND e.payload->>'contract' IN (${receiptContract},${automatedContract})
        AND COALESCE(e.payload->'candidate'->>'pull_number',e.payload->'decision'->>'pull_number')=${pull}
        AND f.event_id IS NULL ORDER BY e.received_at LIMIT 1 FOR UPDATE OF e SKIP LOCKED`;
    if (!row) return false;
    const {candidate, decision, report} = row.payload;
    const source = candidate ?? decision;
    const remediation = report?.state === 'superseded' || ['reject','veto'].includes(decision?.verdict);
    const message = `PR #${pull} at ${source.head_sha}. ${row.recipient_agent_id} recorded ` +
      `${report?.state ?? decision.verdict}. Review evidence ${row.event_id}.` +
      (remediation ? ' Remediation or resubmission is required before release.' : '');
    const event = deliveryEventId(feedbackContract + ':' + agent, row.event_id);
    const payload = {contract:transportContract,kind:'note',message,trace_id:row.event_id,reply_to:null,
      review:{contract:feedbackContract,head_sha:source.head_sha,base_sha:source.base_sha,
        evidence_id:row.event_id,remediation_required:remediation,automated:Boolean(report)}};
    await tx`INSERT INTO core_agents.events
      (event_id,org_id,recipient_agent_id,sender,event_type,ticket_key,payload,nonce)
      VALUES(${event},${org},${agent},${row.recipient_agent_id},'rcis.message',NULL,${tx.json(payload)},${event})
      ON CONFLICT(event_id) DO NOTHING`;
    return true;
  });
}

export function docsReviewDelivery(env) {
  const secret = env.GITHUB_REVIEW_DOCSYNC_HMAC;
  const repository = env.GITHUB_REVIEW_REPOSITORY;
  const target = env.GITHUB_REVIEW_DOCSYNC_URL;
  if (!secret || secret.length < 40 || !repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
      !target) return null;
  try {
    const url = new URL(target);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return {secret, repository, url: url.href};
  } catch {
    return null;
  }
}

export async function syncRegisteredReviewDoc(sql, config, transport = fetch) {
  return sql.begin(async tx => {
    await tx`SET LOCAL statement_timeout='5000ms'`;
    const [row] = await tx`SELECT e.event_id,e.payload,e.recipient_agent_id FROM core_agents.events e
      LEFT JOIN core_agents.events a ON a.org_id=e.org_id AND a.payload->>'contract'=${docsContract}
        AND a.payload->>'receipt_id'=e.event_id::text
      WHERE e.org_id=${org} AND e.payload->>'contract' IN (${receiptContract},${automatedContract})
        AND a.event_id IS NULL ORDER BY e.received_at LIMIT 1 FOR UPDATE OF e SKIP LOCKED`;
    if (!row) return false;
    const decision = row.payload.decision;
    const payload = JSON.stringify(decision ? {
      app_key: 'core', source_type: 'acceptance_test', source_event_id: 'review:' + row.event_id,
      source_ref: 'https://github.com/' + config.repository + '/pull/' + decision.pull_number,
      event_type: 'independent_review_receipt', title: 'Independent review receipt for PR #' + decision.pull_number,
      change_summary: [
        'Reviewer ' + decision.reviewer_role + ' recorded ' + decision.verdict + '.',
        'Candidate ' + decision.head_sha + ' against ' + decision.base_sha + '.',
      ].join(' '),
      evidence: ['Core receipt ' + row.event_id, 'Evidence SHA-256 ' + decision.evidence_sha256],
    } : {
      app_key:'core',source_type:'manual_change',source_event_id:'review:' + row.event_id,
      source_ref:'https://github.com/' + config.repository + '/pull/' + row.payload.candidate.pull_number,
      event_type:'independent_review_automated_result',
      title:'Automated source inspection for PR #' + row.payload.candidate.pull_number,
      change_summary:'Reviewer ' + row.recipient_agent_id + ' reported ' + row.payload.report.state +
        ' for candidate ' + row.payload.candidate.head_sha + '. Isolated tests and signed approval were not issued by this report.',
      evidence:['Core automated report ' + row.event_id],
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', config.secret).update(timestamp + '.' + payload).digest('hex');
    const response = await transport(config.url, {
      method: 'POST', redirect: 'error', body: payload, signal: AbortSignal.timeout(8000),
      headers: {'content-type': 'application/json', 'x-docsync-timestamp': timestamp,
        'x-docsync-signature': 'sha256=' + signature},
    });
    if (!response.ok) throw Error('review_docsync_delivery_unavailable');
    const result = await response.json();
    if (result.accepted !== true || typeof result.job_id !== 'string' || !result.job_id ||
        !['queued', 'draft_ready'].includes(result.status)) throw Error('review_docsync_receipt_invalid');
    const event = deliveryEventId(docsContract, row.event_id);
    const ack = {contract: docsContract, receipt_id: row.event_id, job_id: result.job_id};
    await tx`INSERT INTO core_agents.events
      (event_id,org_id,recipient_agent_id,sender,event_type,ticket_key,payload,nonce)
      VALUES(${event},${org},${row.recipient_agent_id},'rosie_core','rcis.message',NULL,${tx.json(ack)},${event})
      ON CONFLICT(event_id) DO NOTHING`;
    return true;
  });
}
