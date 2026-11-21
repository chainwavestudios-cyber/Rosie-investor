/**
 * RCIS transport consumer. This is NOT an AI agent executor.
 * A signed agent reads its inbox and acknowledges actual receipt.
 * A staging-only, one-time probe causes Agent 2 to reply to Agent 5.
 * Zero LLM calls; no execution-worker lease or model secrets.
 */
import crypto from 'node:crypto';
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
async function runTransport(env=process.env,transportFetch=fetch){
 const c=cfg(env);
 if(!c.enabled||!c.valid)throw Error('transport_identity_not_configured');
 if(c.probe&&c.agent==='A05'){
  const sent=await send(c,{recipient:'A02',kind:'probe',
   message:'RCIS real transport acceptance probe: Agent 5 to Agent 2. Reply and acknowledge without LLM.'},transportFetch);
  console.log('rcis_staging_probe_sent',sent.event_id);
 }
 while(true){
  try{await receiveOnce(c,transportFetch);}
  catch(e){console.error('rcis_transport_poll_failed',e.message);}
  await nap(2000);
 }
}
export {cfg,signedPost,send,receiveOnce,runTransport};
