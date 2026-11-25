import {createHash} from 'node:crypto';
import {checkpointScope} from './review-checkpoint-source.mjs';

const org = 'rosie-core-internal';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{40}$/;
export const automatedContract = 'rosie.core.independent-review.automated-result.v1';
const assignmentContract = 'rosie.core.independent-review.v1';
const required = ['state','head_tree','base_tree','changed_files','comparison_limited',
  'workflow_files','authority_files','test_execution','release_authorized'];

export function automatedResultId(assignment) {
  const d = createHash('sha256').update(automatedContract + '\n' + assignment).digest('hex');
  return `${d.slice(0,8)}-${d.slice(8,12)}-8${d.slice(13,16)}-a${d.slice(17,20)}-${d.slice(20,32)}`;
}

function checkpointReportScope(report) {
  if (Object.keys(report).length !== 6 || !Array.isArray(report.checkpoints)) return null;
  const pins = [];
  for (const row of report.checkpoints) {
    if (!row || Object.keys(row).length !== 7 || !/^[a-f0-9]{64}$/.test(row.manifest_sha256 ?? '') ||
        !Number.isSafeInteger(row.file_count) || row.file_count < 1 || row.file_count > 20000 ||
        typeof row.authority_files_present !== 'boolean') return null;
    pins.push({app_id: row.app_id, branch_id: row.branch_id, checkpoint_id: row.checkpoint_id, commit_sha: row.commit_sha});
  }
  return checkpointScope({...report, checkpoints: pins});
}

function validReport(report) {
  if (!report || Array.isArray(report) || report.release_authorized !== false ||
      report.test_execution !== 'not_run') return false;
  if (report.state === 'superseded') return Object.keys(report).length === 3;
  if (report.state === 'source_verified' && report.source_kind === 'base44_checkpoint') {
    return Boolean(checkpointReportScope(report));
  }
  return report.state === 'source_verified' &&
    required.every(field => Object.hasOwn(report, field)) &&
    Object.keys(report).every(field => required.includes(field) || field === 'merge_tree') &&
    [report.head_tree,report.base_tree].every(value => typeof value === 'string' && sha.test(value)) &&
    (!Object.hasOwn(report,'merge_tree') || typeof report.merge_tree === 'string' && sha.test(report.merge_tree)) &&
    Number.isSafeInteger(report.changed_files) && report.changed_files >= 0 && report.changed_files <= 300 &&
    [report.comparison_limited,report.workflow_files,report.authority_files].every(value => typeof value === 'boolean');
}

export async function registerAutomatedResult(sql, body) {
  const {org_id, agent_id, assignment_id, nonce, report} = body;
  if (org_id !== org || !['A05','A14'].includes(agent_id) || Object.keys(body).length !== 5 ||
      typeof assignment_id !== 'string' || !uuid.test(assignment_id) ||
      typeof nonce !== 'string' || !uuid.test(nonce) || !validReport(report)) {
    return [400, {error:'invalid_automated_review_result'}];
  }
  return sql.begin(async tx => {
    await tx`SET LOCAL statement_timeout='5000ms'`;
    const [assignment] = await tx`SELECT e.payload FROM core_agents.events e
      JOIN core_agents.agent_message_receipts a ON a.event_id=e.event_id
        AND a.recipient_agent_id=e.recipient_agent_id
      JOIN core_agents.identities i ON i.org_id=e.org_id AND i.agent_id=e.recipient_agent_id
      WHERE e.org_id=${org} AND e.event_id=${assignment_id} AND e.recipient_agent_id=${agent_id}
        AND e.payload->>'contract'=${assignmentContract} AND i.desired_state<>'revoked'
      FOR UPDATE OF e`;
    if (!assignment) return [409,{error:'automated_result_assignment_not_acknowledged'}];
    if (report.state === 'source_verified') {
      const expected = checkpointScope(assignment.payload);
      const actual = report.source_kind === 'base44_checkpoint' ? checkpointReportScope(report) : null;
      if (expected || actual) {
        if (!expected || !actual || JSON.stringify(expected) !== JSON.stringify(actual)) {
          return [400,{error:'automated_result_source_scope_invalid'}];
        }
      } else if ((assignment.payload.mode === 'retrospective') !== Object.hasOwn(report,'merge_tree')) {
        return [400,{error:'automated_result_source_scope_invalid'}];
      }
    }
    const id = automatedResultId(assignment_id);
    const payload = {contract:automatedContract, assignment_id, candidate:assignment.payload, report};
    await tx`INSERT INTO core_agents.worker_nonces(nonce,org_id) VALUES(${nonce},${org})`;
    const rows = await tx`INSERT INTO core_agents.events
      (event_id,org_id,recipient_agent_id,sender,event_type,ticket_key,payload,nonce)
      VALUES(${id},${org},${agent_id},${agent_id},'rcis.message',NULL,${tx.json(payload)},${id})
      ON CONFLICT(event_id) DO NOTHING RETURNING event_id`;
    if (!rows.length) {
      const match = await tx`SELECT event_id FROM core_agents.events WHERE event_id=${id}
        AND org_id=${org} AND recipient_agent_id=${agent_id} AND payload=${tx.json(payload)}::jsonb`;
      if (!match.length) return [409,{error:'automated_result_conflict'}];
    }
    return [rows.length?201:200,{report_id:id,durable_commit:true,release_authorized:false}];
  });
}
