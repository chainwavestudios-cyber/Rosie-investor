/**
 * RCIS transport consumer. This is NOT an AI agent executor.
 * A signed agent reads its inbox and acknowledges actual receipt.
 * A staging-only, one-time probe causes Agent 2 to reply to Agent 5.
 * Zero LLM calls; no execution-worker lease or model secrets.
 */
import crypto from 'node:crypto';
import {auditScope,auditOnce} from './receipt-audit.mjs';
const uuid=()=>crypto.randomUUID();
const nap=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function cfg(env=process.env){
 const agent=env.RACP_AGENT_ID||'';
 const key=env.RACP_WORKER_HMAC_KEY||'';
 const endpoint=env.RACP_GATEWAY_URL||'';
 const enabled=env.RACP_MESSAGING_ENABLED==='true';
 const valid=['A02','A05'].includes(agent)&&key.length>=40&&
  /^https:\/\/[^/]+\/?$/.test(endpoint);
 return {agent,key,endpoint:endpoint.replace(/\/$/,''),enabled,valid,
   probe:env.RACP_TRANSPORT_PROBE_ON_START==='true'};
}
async function signedPost(c,path,payload,transportFetch=fetch){
 const raw=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000));
 const signature='sha256='+crypto.createHmac('sha256',c.key)
   .update('POST\n'+path+'\n'+timestamp+'\n'+raw).digest('hex');
 const res=await transportFetch(c.endpoint+path,{method:'POST',
  headers:{'content-type':'application/json','x-rosie-timestamp':timestamp,
   'x-rosie-signature':signature},body:raw,signal:AbortSignal.timeout(15000)});
 const body=await res.json().catch(()=>({}));
 if(!res.ok)throw Error('transport_http_'+res.status+'_'+String(body.error||''));
 return body;
}
const base=c=>({org_id:'rosie-core-internal',agent_id:c.agent,nonce:uuid()});
async function send(c,{recipient,kind,message,traceId,replyTo},transportFetch=fetch){
 if(!['A02','A05'].includes(recipient)||recipient===c.agent)throw Error('bad_transport_recipient');
 const payload={...base(c),recipient_agent_id:recipient,
  event_id:uuid(),kind,message,trace_id:traceId||uuid()};
 if(replyTo)payload.reply_to=replyTo;
 const ack=await signedPost(c,'/v1/agent/send',payload,transportFetch);
 if(!ack.accepted||!ack.durable_commit||!ack.delivery_ack)
  throw Error('transport_not_durably_committed');
 return {...payload,ack};
}
async function receiveOnce(c,transportFetch=fetch){
 const response=await signedPost(c,'/v1/agent/inbox',{...base(c),limit:10},transportFetch);
 if(!Array.isArray(response.messages))throw Error('invalid_transport_inbox');
 for(const msg of response.messages){
  // A02 responds to the specific internal probe, not arbitrary instructions.
  if(c.agent==='A02'&&msg.sender==='A05'&&msg.payload?.kind==='probe'&&
     msg.payload?.contract==='rosie.core.rcis.transport.v1'){
   await send(c,{recipient:'A05',kind:'probe_ack',
    message:'A02 received your signed RCIS message; response requires no AI model.',
    traceId:msg.payload.trace_id,replyTo:msg.event_id},transportFetch);
  }
  const ack=await signedPost(c,'/v1/agent/ack',{
    ...base(c),event_id:msg.event_id},transportFetch);
  if(!ack.accepted||!ack.durable_commit)throw Error('transport_delivery_receipt_failed');
  console.log('rcis_transport_received',c.agent,msg.event_id,msg.sender);
 }
 return response.messages.length;
}

export async function acknowledgeMission001Assignment(c, assignment, transportFetch=fetch){
 const {eventId,captainId,traceId,assignmentSha256}=assignment??{};
 const agentId=/^A[0-9]{2,4}$/;
 const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
 if(c?.endpoint!=='https://rosie-core-agent-gateway-staging.onrender.com'||!agentId.test(c.agent??'')||
    !agentId.test(captainId??'')||c.agent===captainId||typeof c.key!=='string'||c.key.length<40||
    !uuidPattern.test(eventId??'')||!uuidPattern.test(traceId??'')||!/^[a-f0-9]{64}$/.test(assignmentSha256??''))
  throw Error('mission_001_assignment_identity_required');
 const inbox=await signedPost(c,'/v1/agent/inbox',{...base(c),event_id:eventId,limit:1},transportFetch);
 if(!Array.isArray(inbox.messages))throw Error('invalid_transport_inbox');
 if(!inbox.messages.length)return {accepted:false,event_id:eventId};
 const [item]=inbox.messages;
 const expectedMessage=JSON.stringify({contract:'rosie.core.browser_worker_assignment.v1',assignment_sha256:assignmentSha256});
 if(inbox.messages.length!==1||item.event_id!==eventId||item.sender!==captainId||
    item.payload?.contract!=='rosie.core.rcis.transport.v1'||item.payload.kind!=='note'||item.payload.trace_id!==traceId||
    item.payload.reply_to!==null||item.payload.message!==expectedMessage)throw Error('mission_001_assignment_binding_mismatch');
 const ack=await signedPost(c,'/v1/agent/ack',{...base(c),event_id:eventId},transportFetch);
 if(ack.accepted!==true||ack.durable_commit!==true||ack.event_id!==eventId||ack.recipient_agent_id!==c.agent||
    !Number.isFinite(Date.parse(ack.received_at)))throw Error('mission_001_recipient_receipt_not_committed');
 return {accepted:true,event_id:ack.event_id,recipient_agent_id:ack.recipient_agent_id,received_at:ack.received_at};
}

async function runTransport(env=process.env,transportFetch=fetch){
 const c=cfg(env);
 const receiptScope=auditScope(env);
 if(!c.enabled||!c.valid)throw Error('transport_identity_not_configured');
 if(c.probe&&c.agent==='A05'){
  const sent=await send(c,{recipient:'A02',kind:'probe',
   message:'RCIS real transport acceptance probe: Agent 5 to Agent 2. Reply and acknowledge without LLM.'},transportFetch);
  console.log('rcis_staging_probe_sent',sent.event_id);
 }
 while(true){
  try{await receiveOnce(c,transportFetch);}
  catch(e){console.error('rcis_transport_poll_failed',e.message);}
  if(receiptScope){
   try{await auditOnce(c,receiptScope,(cfg,path,payload)=>signedPost(cfg,path,payload,transportFetch));}
   catch(e){console.error('receipt_audit_failed',c.agent,e.message);}
  }
  await nap(2000);
 }
}
export {cfg,signedPost,send,receiveOnce,runTransport};
