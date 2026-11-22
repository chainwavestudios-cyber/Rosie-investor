import crypto from 'node:crypto';

const corePath = '/functions/coreReceiptAuditOutbox';
const coreUrl = 'https://core.rosieai.tech' + corePath;
const org = 'rosie-core-internal';

function mac(key, path, timestamp, body) {
  return 'sha256=' + crypto.createHmac('sha256', key)
    .update(['POST', path, timestamp, body].join('\n')).digest('hex');
}

// Core owns the ticket and the event signature. The relay forwards the exact
// envelope to ordinary ingress. It cannot manufacture a delivery receipt.
export async function relayAuditAssignment({scope,key,port,request=fetch}) {
  const probe=JSON.stringify({ticket_key:scope.ticket,trace_id:scope.trace,nonce:crypto.randomUUID()});
  const timestamp=String(Math.floor(Date.now()/1000));
  const fetched=await request(coreUrl,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
    headers:{'content-type':'application/json','x-rosie-timestamp':timestamp,
      'x-rosie-signature':mac(key,corePath,timestamp,probe)},body:probe});
  if(!fetched.ok) throw Error('core_outbox_http_'+fetched.status);
  const text=await fetched.text();
  if(text.length>3200) throw Error('core_outbox_response_too_large');
  const envelope=JSON.parse(text);
  if(envelope.nonce!==JSON.parse(probe).nonce || typeof envelope.body!=='string' ||
     !/^sha256=[a-f0-9]{64}$/.test(envelope.signature||'') || !/^\d{10}$/.test(envelope.timestamp||''))
    throw Error('core_outbox_response_invalid');
  const event=JSON.parse(envelope.body);
  if(!auditIngress(event,scope)) throw Error('core_outbox_event_out_of_scope');
  const result=await request('http://127.0.0.1:'+port+'/v1/events',{method:'POST',redirect:'error',
    signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json',
      'x-rosie-timestamp':envelope.timestamp,'x-rosie-signature':envelope.signature},body:envelope.body});
  if(!result.ok) throw Error('audit_ingress_http_'+result.status);
  const ack=await result.json();
  if(!ack.accepted||!ack.durable_commit||!ack.delivery_ack||ack.event_id!==event.event_id)
    throw Error('audit_gateway_ack_invalid');
  return ack;
}

export function auditIngress(event,scope) {
  if(!scope || event.org_id!==org || event.agent_id!=='A05' || event.sender!=='rosie_core' ||
    event.ticket_key!==scope.ticket || event.event_type!=='ticket.assigned') return false;
  const stableId=label=>{
    const bytes=crypto.createHash('sha256').update('core-v1:'+label+':'+org+':'+scope.ticket+':A05').digest().subarray(0,16);
    bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
    const h=bytes.toString('hex');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
  };
  if(event.event_id!==stableId('event')||event.nonce!==stableId('nonce')) return false;
  const p=event.payload;
  return p && Object.keys(p).sort().join(',')==='priority,source,ticket_key' &&
    p.ticket_key===scope.ticket && p.source==='core_verified_ticket' && ['P0','P1','P2','P3'].includes(p.priority);
}

export async function publishAuditResult(sql,scope,key,request=fetch) {
  const rows=await sql`SELECT e.event_id,e.sender,j.agent_id,j.job_id,j.checkpoint,
      a.ack_id,a.occurred_at AS completed_at
    FROM core_agents.events e JOIN core_agents.jobs j USING(event_id,org_id)
    JOIN core_agents.acks a USING(event_id,org_id)
    WHERE e.org_id=${org} AND e.ticket_key=${scope.ticket} AND j.state='completed'
      AND j.checkpoint->>'contract'='rosie.core.delivery-audit.v1' AND j.checkpoint->>'trace'=${scope.trace}
      AND a.stage='worker_completed' AND a.actor=j.agent_id ORDER BY e.received_at LIMIT 4`;
  if(rows.length<3) return false;
  const [a,b,c]=rows;
  if(rows.length!==3 || a.sender!=='rosie_core'||a.agent_id!=='A05'||b.sender!=='A05'||b.agent_id!=='A02'||
     c.sender!=='A02'||c.agent_id!=='A05'||a.checkpoint.step!=='assign'||b.checkpoint.step!=='audit'||
     c.checkpoint.step!=='review'||a.checkpoint.handoff_event!==b.event_id||b.checkpoint.handoff_event!==c.event_id)
    throw Error('audit_history_mismatch');
  const proof=rows.map(r=>({agent:r.agent_id,step:r.checkpoint.step,event_id:r.event_id,job_id:r.job_id,
    ack_id:r.ack_id,completed_at:r.completed_at,report:r.checkpoint.report,handoff_event:r.checkpoint.handoff_event||null}));
  const raw=JSON.stringify({action:'record_result',ticket_key:scope.ticket,trace_id:scope.trace,nonce:crypto.randomUUID(),proof});
  const timestamp=String(Math.floor(Date.now()/1000));
  const res=await request(coreUrl,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{'content-type':'application/json','x-rosie-timestamp':timestamp,'x-rosie-signature':mac(key,corePath,timestamp,raw)},body:raw});
  if(!res.ok)throw Error('core_audit_projection_http_'+res.status);
  const ack=await res.json();
  if(ack.verified!==true||ack.ticket_key!==scope.ticket||ack.review_receipt!==c.ack_id)
    throw Error('core_audit_projection_unconfirmed');
  return true;
}
