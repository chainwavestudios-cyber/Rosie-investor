import crypto from 'node:crypto';

const ticketPattern=/^rwt-[a-f0-9]{32}$/;
const digestPattern=/^[a-f0-9]{64}$/;
const manifestContract='rosie.command.candidate.v1';
const manifestKeys=['contract','artifact_ref','artifact_sha256'];

// Workers submit an immutable repository reference and artifact digest inside their
// ordinary result. The distinct result hash covers the entire submitted manifest.
export function candidateFromRow(row) {
 if(typeof row?.result_text!=='string'||Buffer.byteLength(row.result_text)>3000||
    crypto.createHash('sha256').update(row.result_text).digest('hex')!==row.result_sha256)return null;
 let manifest;
 try{manifest=JSON.parse(row.result_text);}catch{return null;}
 if(!manifest||Object.keys(manifest).length!==manifestKeys.length||
    !manifestKeys.every(key=>Object.hasOwn(manifest,key))||manifest.contract!==manifestContract||
    typeof manifest.artifact_ref!=='string'||manifest.artifact_ref.length>220||
    !/^github:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[a-f0-9]{40}\/([A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(manifest.artifact_ref)||
    manifest.artifact_ref.split('/').some(part=>part==='.'||part==='..')||
    typeof manifest.artifact_sha256!=='string'||!digestPattern.test(manifest.artifact_sha256))return null;
 const fence=Number(row.fencing_token);
 if(!Number.isSafeInteger(fence)||fence<1)return null;
 return {contract:'rosie.command.candidate.receipt.v1',organization_id:row.org_id,ticket_key:row.ticket_key,
  job_id:row.job_id,agent_id:row.agent_id,worker_id:row.lease_owner,fence,completion_ack:row.ack_id,
  artifact_ref:manifest.artifact_ref,artifact_sha256:manifest.artifact_sha256,manifest_sha256:row.result_sha256};
}

export async function getCommandCandidate(sql,request,org) {
 if(!request||Object.keys(request).length!==3||request.organization_id!==org||
    !ticketPattern.test(request.ticket_key)||!/^A(0[1-9]|1[0-8])$/.test(request.agent_id))
  return {status:400,body:{error:'invalid_candidate_lookup'}};
 const rows=await sql`SELECT e.org_id,e.ticket_key,j.job_id,j.agent_id,j.lease_owner,j.fencing_token,a.ack_id,
   j.checkpoint->>'result_text' AS result_text,j.checkpoint->>'result_sha256' AS result_sha256
   FROM core_agents.events e
   JOIN core_agents.jobs j ON j.org_id=e.org_id AND j.event_id=e.event_id AND j.agent_id=e.recipient_agent_id
   JOIN core_agents.acks a ON a.org_id=e.org_id AND a.event_id=e.event_id AND a.actor=j.lease_owner AND a.stage='worker_completed'
   WHERE e.org_id=${org} AND e.sender='rosie_core' AND e.event_type='ticket.assigned'
     AND e.ticket_key=${request.ticket_key} AND e.recipient_agent_id=${request.agent_id}
     AND j.state='completed' AND j.checkpoint->>'ref'=('core:jobs/'||j.job_id::text)
   LIMIT 2`;
 if(rows.length!==1)return {status:rows.length?409:404,body:{error:'unique_completed_candidate_required'}};
 const candidate=candidateFromRow(rows[0]);
 return candidate?{status:200,body:candidate}:{status:409,body:{error:'candidate_manifest_required'}};
}
