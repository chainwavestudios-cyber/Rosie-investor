const org = 'rosie-core-internal';
const contract = 'rosie.core.independent-review.v1';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function reviewAssignmentKeys(env) {
  const a05 = env.GITHUB_REVIEW_A05_INBOX_KEY;
  const a14 = env.GITHUB_REVIEW_A14_INBOX_KEY;
  if (!a05 || a05.length < 40 || !a14 || a14.length < 40 || a05 === a14) return {};
  return {A05: a05, A14: a14};
}

export async function reviewAssignmentRequest(sql, path, body) {
  const {org_id, agent_id, nonce, event_id} = body;
  const acknowledge = path.endsWith('/ack');
  if (org_id !== org || !['A05', 'A14'].includes(agent_id) ||
      typeof nonce !== 'string' || !uuid.test(nonce) ||
      Object.keys(body).length !== (acknowledge ? 4 : 3) ||
      (acknowledge && (typeof event_id !== 'string' || !uuid.test(event_id)))) {
    return [400, {error: 'invalid_review_assignment_request'}];
  }
  return sql.begin(async tx => {
    await tx`SET LOCAL statement_timeout='5000ms'`;
    const enabled = await tx`SELECT agent_id FROM core_agents.identities
      WHERE org_id=${org} AND agent_id=${agent_id} AND desired_state<>'revoked'`;
    if (enabled.length !== 1) return [403, {error: 'reviewer_not_active'}];
    await tx`INSERT INTO core_agents.worker_nonces(nonce,org_id) VALUES(${nonce},${org})`;
    if (!acknowledge) {
      const assignments = await tx`SELECT e.event_id,e.payload,e.received_at
        FROM core_agents.events e
        LEFT JOIN core_agents.agent_message_receipts mr ON mr.event_id=e.event_id
          AND mr.recipient_agent_id=e.recipient_agent_id
        WHERE e.org_id=${org} AND e.recipient_agent_id=${agent_id}
          AND e.sender='rosie_core' AND e.event_type='rcis.message'
          AND e.payload->>'contract'=${contract} AND mr.event_id IS NULL
        ORDER BY e.received_at,e.event_id LIMIT 10`;
      return [200, {agent_id, assignments}];
    }
    const receipts = await tx`INSERT INTO core_agents.agent_message_receipts
      (event_id,org_id,recipient_agent_id)
      SELECT event_id,${org},${agent_id} FROM core_agents.events
      WHERE event_id=${event_id} AND org_id=${org} AND recipient_agent_id=${agent_id}
        AND sender='rosie_core' AND event_type='rcis.message' AND payload->>'contract'=${contract}
      ON CONFLICT(event_id,recipient_agent_id) DO UPDATE
        SET received_at=core_agents.agent_message_receipts.received_at
      RETURNING event_id,received_at`;
    if (receipts.length !== 1) return [404, {error: 'review_assignment_not_found'}];
    return [200, {agent_id, durable_commit: true, ...receipts[0]}];
  });
}
