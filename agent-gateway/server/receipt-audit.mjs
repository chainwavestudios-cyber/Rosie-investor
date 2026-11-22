import crypto from 'node:crypto';

const org = 'rosie-core-internal';
const audit = 'rosie.core.delivery-audit.v1';
const ticketPattern = /^rwt-[0-9a-f]{32}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function auditScope(env) {
  const ticket = env.RACP_AUDIT_TICKET;
  const trace = env.RACP_AUDIT_TRACE;
  return ticketPattern.test(ticket || '') && uuidPattern.test(trace || '') ? {ticket, trace} : null;
}

// Ordered persisted timestamps come from the gateway. Each process obtains its own
// snapshot. Never accept a worker-supplied message list, argument, URL, or query.
export function summarizeDelivery(rows) {
  if (!Array.isArray(rows) || rows.length !== 2) throw Error('expected_two_messages');
  const [first, reply] = rows;
  if (first.sender !== 'A05' || first.recipient !== 'A02' || first.parent !== null ||
      reply.sender !== 'A02' || reply.recipient !== 'A05' || reply.parent !== first.id ||
      rows.some(row => !row.delivered || !row.received || !Number.isFinite(new Date(row.delivered).getTime()) ||
        !Number.isFinite(new Date(row.received).getTime()) || new Date(row.received) < new Date(row.delivered))) {
    throw Error('receipt_chain_incomplete');
  }
  const elapsedMs = new Date(reply.received).getTime() - new Date(first.delivered).getTime();
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) throw Error('invalid_receipt_times');
  return {messages: rows.length, receipts: rows.filter(row => row.received).length, elapsed_ms: elapsedMs};
}

function sameReport(a, b) {
  return a && b && Object.keys(a).length === 3 && a.messages === b.messages &&
    a.receipts === b.receipts && a.elapsed_ms === b.elapsed_ms;
}

async function loadEvidence(t, trace) {
  return t`SELECT e.event_id AS id, e.sender, e.recipient_agent_id AS recipient,
      e.payload->>'reply_to' AS parent, e.received_at AS delivered, r.received_at AS received
    FROM core_agents.events e LEFT JOIN core_agents.agent_message_receipts r
      ON r.event_id=e.event_id AND r.org_id=e.org_id AND r.recipient_agent_id=e.recipient_agent_id
    WHERE e.org_id=${org} AND e.event_type='rcis.message'
      AND e.payload->>'contract'='rosie.core.rcis.transport.v1' AND e.payload->>'trace_id'=${trace}
    ORDER BY e.received_at,e.event_id LIMIT 3`;
}

function roleFor(event, agent, scope) {
  if (event.ticket_key !== scope.ticket) return null;
  if (event.event_type === 'ticket.assigned' && event.sender === 'rosie_core' &&
      event.payload?.source === 'core_verified_ticket') {
    if (agent === 'A05') return 'assign';
  }
  if (event.event_type !== 'rcis.message' || event.payload?.contract !== audit ||
      event.payload.trace !== scope.trace) return null;
  if (event.sender === 'A05' && agent === 'A02' && event.payload.step === 'audit') return 'audit';
  if (event.sender === 'A02' && agent === 'A05' && event.payload.step === 'review') return 'review';
  return null;
}

// A separate, explicitly paired staging capability. Ordinary worker claims still
// require their own execution gate. Both the gateway and each worker pin one ticket.
export async function receiptAudit(sql, path, input, scope) {
  const agent = input.agent_id;
  const worker = agent + '-receipt-audit';
  const allowed = path.endsWith('/claim') ? ['org_id','agent_id','nonce','ticket_key'] :
    ['org_id','agent_id','nonce','ticket_key','job_id','fencing_token','report'];
  if (!scope || !['A02','A05'].includes(agent) || input.ticket_key !== scope.ticket ||
      input.org_id !== org || !uuidPattern.test(input.nonce || '') ||
      Object.keys(input).some(k => !allowed.includes(k))) return {status:403,error:'audit_not_authorized'};
  const claim = path.endsWith('/claim');
  if (!claim && (!uuidPattern.test(input.job_id || '') || !Number.isSafeInteger(input.fencing_token) ||
      input.fencing_token < 1)) return {status:400,error:'invalid_audit_lease'};

  return sql.begin(async t => {
    await t`SET LOCAL statement_timeout='5000ms'`;
    await t`INSERT INTO core_agents.worker_nonces(nonce,org_id) VALUES(${input.nonce},${org})`;
    const ids = await t`SELECT agent_id FROM core_agents.identities
      WHERE org_id=${org} AND agent_id IN ('A02','A05') AND desired_state<>'revoked' FOR SHARE`;
    if (ids.length !== 2) return {status:403,error:'audit_identity_unavailable'};
    const jobs = claim ? await t`SELECT j.job_id,j.event_id,j.fencing_token,e.sender,e.ticket_key,e.event_type,e.payload
      FROM core_agents.jobs j JOIN core_agents.events e USING(event_id,org_id)
      WHERE j.org_id=${org} AND j.agent_id=${agent} AND e.ticket_key=${scope.ticket}
        AND (e.event_type='ticket.assigned' AND j.agent_id='A05' AND e.sender='rosie_core' AND e.payload->>'source'='core_verified_ticket'
          OR e.event_type='rcis.message' AND e.payload->>'contract'=${audit} AND e.payload->>'trace'=${scope.trace})
        AND j.state='queued' AND j.attempts<3 ORDER BY j.enqueued_at FOR UPDATE OF j SKIP LOCKED LIMIT 1`
      : await t`SELECT j.job_id,j.event_id,j.fencing_token,e.sender,e.ticket_key,e.event_type,e.payload
        FROM core_agents.jobs j JOIN core_agents.events e USING(event_id,org_id)
        WHERE j.org_id=${org} AND j.agent_id=${agent} AND j.job_id=${input.job_id}
          AND j.lease_owner=${worker} AND j.fencing_token=${input.fencing_token}
          AND j.lease_until>now() AND j.state='leased' FOR UPDATE OF j`;
    const job = jobs[0];
    if (!job) return claim ? {claimed:false} : {status:409,error:'audit_lease_expired'};
    const step = roleFor(job,agent,scope);
    if (!step) return {status:409,error:'audit_task_mismatch'};
    if (step !== 'assign') {
      const originStep = step === 'audit' ? 'assign' : 'audit';
      const origin = await t`SELECT j.job_id FROM core_agents.jobs j JOIN core_agents.events e USING(event_id,org_id)
        WHERE j.org_id=${org} AND j.job_id::text=${String(job.payload.source_job)}
          AND j.event_id::text=${String(job.payload.source_event)} AND j.state='completed'
          AND j.agent_id=${job.sender} AND e.ticket_key=${scope.ticket}
          AND j.checkpoint->>'contract'=${audit} AND j.checkpoint->>'step'=${originStep}
          AND j.checkpoint->>'trace'=${scope.trace} AND j.checkpoint->>'handoff_event'= ${job.event_id}`;
      if (origin.length !== 1) return {status:409,error:'audit_handoff_lineage_invalid'};
    }

    const rows = step === 'assign' ? [] : await loadEvidence(t,scope.trace);
    if (claim) {
      const lease = await t`UPDATE core_agents.jobs SET state='leased',lease_owner=${worker},
        fencing_token=fencing_token+1,attempts=attempts+1,lease_until=now()+interval '90 seconds',updated_at=now()
        WHERE job_id=${job.job_id} RETURNING fencing_token`;
      await t`INSERT INTO core_agents.acks(event_id,org_id,stage,actor)
        VALUES(${job.event_id},${org},'worker_started',${agent}) ON CONFLICT(event_id,stage) DO NOTHING`;
      const fence=Number(lease[0].fencing_token);
      if (!Number.isSafeInteger(fence) || fence<1) throw Error('audit_fence_out_of_range');
      return {claimed:true,job_id:job.job_id,fencing_token:fence,step,rows,
        submitted:step==='review'?job.payload.report:null};
    }
    let report = null;
    if (step !== 'assign') {
      report = summarizeDelivery(rows);
      if (!sameReport(input.report,report) || (step==='review' && !sameReport(job.payload.report,report)))
        return {status:409,error:'audit_result_disagrees'};
    } else if (input.report != null) return {status:400,error:'unexpected_report'};

    const evidence = {contract:audit,step,trace:scope.trace,ticket:scope.ticket,report,
      actor:agent,source_event:job.event_id,source_job:job.job_id,fencing_token:job.fencing_token};
    if (step !== 'review') {
      const recipient=step==='assign'?'A02':'A05';
      const next={...evidence,step:step==='assign'?'audit':'review'};
      const id=crypto.randomUUID();
      evidence.handoff_event=id;
      await t`INSERT INTO core_agents.events(event_id,org_id,recipient_agent_id,sender,event_type,ticket_key,payload,nonce)
        VALUES(${id},${org},${recipient},${agent},'rcis.message',${scope.ticket},${t.json(next)},${crypto.randomUUID()})`;
      await t`INSERT INTO core_agents.jobs(event_id,org_id,agent_id) VALUES(${id},${org},${recipient})`;
      await t`INSERT INTO core_agents.acks(event_id,org_id,stage,actor)
        VALUES(${id},${org},'persisted',${agent})`;
    }
    await t`UPDATE core_agents.jobs SET state='completed',lease_until=NULL,checkpoint=${t.json(evidence)},
      updated_at=now() WHERE job_id=${job.job_id}`;
    const acks=await t`INSERT INTO core_agents.acks(event_id,org_id,stage,actor)
      VALUES(${job.event_id},${org},'worker_completed',${agent}) RETURNING ack_id`;
    return {accepted:true,execution_receipt:acks[0].ack_id,step};
  });
}

export async function auditOnce(config, scope, post) {
  const base=()=>({org_id:org,agent_id:config.agent,ticket_key:scope.ticket,nonce:crypto.randomUUID()});
  const job=await post(config,'/v1/receipt-audit/claim',base());
  if (!job.claimed) return false;
  let report=null;
  if(job.step==='audit' && config.agent==='A02') {
    report=summarizeDelivery(job.rows);
  } else if(job.step==='review' && config.agent==='A05') {
    // QA independently checks the ordered primary records and recomputes the
    // quantities from timestamps. It receives a new database read on its own lease.
    const [origin,response]=job.rows??[];
    if(job.rows.length!==2 || origin.sender!=='A05' || origin.recipient!=='A02' ||
       response.sender!=='A02' || response.recipient!=='A05' || origin.parent!==null ||
       response.parent!==origin.id || !origin.received || !response.received) throw Error('qa_chain_invalid');
    report={messages:2,receipts:2,elapsed_ms:Date.parse(response.received)-Date.parse(origin.delivered)};
    if(!sameReport(job.submitted,report)) throw Error('qa_rejected_report');
  } else if(job.step!=='assign'||config.agent!=='A05') throw Error('unexpected_audit_step');
  const done=await post(config,'/v1/receipt-audit/finish',{...base(),job_id:job.job_id,
    fencing_token:job.fencing_token,report});
  if(!done.accepted || !done.execution_receipt) throw Error('audit_completion_unacknowledged');
  return true;
}
