/**
 * Rosie Core RACP verified-worker adapter (staging).
 *
 * Deliberately disabled unless every required executor credential and the
 * explicit staging execution flag are provided. No simulated completions.
 * Receipts are written only AFTER the executor durably accepts the result.
 */
import crypto from 'node:crypto';

const required = (name) => {
  const v = process.env[name];
  if (!v) throw Error('missing_' + name.toLowerCase());
  return v;
};
const uuid = () => crypto.randomUUID();
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const SIGNATURE_CLOCK_SKEW = 180;
function signedHeaders(key, method, path, raw) {
  const timestamp = String(Math.floor(Date.now()/1000));
  const signature = crypto.createHmac('sha256', key)
    .update(method + '\n' + path + '\n' + timestamp + '\n' + raw).digest('hex');
  return {'content-type':'application/json',
    'x-rosie-timestamp':timestamp,'x-rosie-signature':'sha256='+signature};
}
async function signedPost(base, path, payload, key) {
  const raw=JSON.stringify(payload);
  const res=await fetch(base+path,{
    method:'POST',headers:signedHeaders(key,'POST',path,raw),body:raw,
    signal:AbortSignal.timeout(12000)
  });
  const json=await res.json().catch(()=>({error:'invalid_response'}));
  return {status:res.status,body:json};
}
function validateConfig(env) {
  const get=(name)=>{const v=env[name];if(!v)throw Error('missing_'+name.toLowerCase());return v;};
  if (env.RACP_WORKER_ENABLED !== 'true') throw Error('worker_explicitly_disabled');
  const url=new URL(get('RACP_GATEWAY_URL'));
  const executor=new URL(get('RACP_EXECUTOR_URL'));
  if(url.protocol!=='https:' || executor.protocol!=='https:') throw Error('https_required');
  if(url.username||url.password||executor.username||executor.password) throw Error('url_credentials_forbidden');
  if(!/^A[0-9]{2,4}$/.test(get('RACP_AGENT_ID'))) throw Error('invalid_canonical_agent_id');
  if(!/^[a-zA-Z0-9_:-]{8,100}$/.test(get('RACP_WORKER_ID'))) throw Error('invalid_worker_id');
  if(get('RACP_WORKER_HMAC_KEY').length<40) throw Error('short_worker_key');
  if(get('RACP_EXECUTOR_TOKEN').length<40) throw Error('short_executor_token');
  if(url.pathname!=='/' && url.pathname!=='') throw Error('gateway_root_url_required');
  if(executor.pathname==='/' || !executor.pathname) throw Error('executor_explicit_path_required');
  return {
    gateway:url.origin,executor:executor.toString(),
    agent:env.RACP_AGENT_ID,worker:env.RACP_WORKER_ID,
    hmac:env.RACP_WORKER_HMAC_KEY,token:env.RACP_EXECUTOR_TOKEN,
    org:'rosie-core-internal'
  };
}
async function completeJob(cfg,job) {
  if(!job||job.agent_id!==cfg.agent||!job.job_id||!job.event)
    throw Error('invalid_claimed_job');
  if(!['ticket.assigned','rcis.message'].includes(job.event.event_type))
    throw Error('event_type_requires_separate_approved_executor');
  const common={org_id:cfg.org,agent_id:cfg.agent,
    worker_id:cfg.worker,job_id:job.job_id,fencing_token:job.fencing_token};
  const heartbeat=await signedPost(cfg.gateway,'/v1/worker/heartbeat',
    {...common,nonce:uuid()},cfg.hmac);
  if(heartbeat.status!==200 || heartbeat.body.accepted!==true)
    throw Error('worker_lease_not_held');
  const payload={
    contract:'rosie.core.worker.task.v1',
    job_id:job.job_id,event_id:job.event_id,
    agent_id:cfg.agent,worker_id:cfg.worker,
    fencing_token:job.fencing_token,event:job.event
  };
  const execution=await fetch(cfg.executor,{
    method:'POST',
    headers:{'content-type':'application/json','authorization':'Bearer '+cfg.token,
      'idempotency-key':job.job_id},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)
  });
  const receipt=await execution.json().catch(()=>null);
  // A provider ID alone is not sufficient: commit the actual output to Core
  // before notifying a recipient or marking the source job complete.
  if(!execution.ok || receipt?.status!=='completed' ||
     receipt?.provider!=='anthropic' ||
     typeof receipt?.provider_response_id!=='string' ||
     !/^msg_[a-zA-Z0-9_-]{8,120}$/.test(receipt.provider_response_id) ||
     typeof receipt?.result_text!=='string' ||
     !receipt.result_text.trim() ||
     Buffer.byteLength(receipt.result_text,'utf8')>3000)
    throw Error('executor_has_no_verified_provider_output');
  const stored=await signedPost(cfg.gateway,'/v1/worker/result',
    {...common,nonce:uuid(),provider:receipt.provider,
      provider_response_id:receipt.provider_response_id,
      result_text:receipt.result_text},cfg.hmac);
  if(stored.status!==200||stored.body.accepted!==true||
     stored.body.durable_commit!==true||!stored.body.result_ref||
     !stored.body.result_sha256)
    throw Error('model_output_not_durably_committed');
  // A real agent may return a durable, explicitly addressed message for another agent.
  // The reply is committed before the source job can be marked completed.
  if(receipt.reply!==undefined){
    if(!receipt.reply||!/^A[0-9]{2,4}$/.test(receipt.reply.recipient_agent_id||'')||
       receipt.reply.recipient_agent_id===cfg.agent||
       !receipt.reply.payload||typeof receipt.reply.payload!=='object'||
       Array.isArray(receipt.reply.payload))
      throw Error('invalid_executor_reply');
    const sent=await signedPost(cfg.gateway,'/v1/worker/reply',{
      ...common,nonce:uuid(),event_id:job.job_id,
      recipient_agent_id:receipt.reply.recipient_agent_id,
      ticket_key:job.event.ticket_key||null,payload:receipt.reply.payload
    },cfg.hmac);
    if(![200,202].includes(sent.status)||sent.body.accepted!==true||
       sent.body.durable_commit!==true||!sent.body.delivery_ack)
      throw Error('reply_not_durably_committed');
  }
  const finish=await signedPost(cfg.gateway,'/v1/worker/finish',
    {...common,nonce:uuid(),result:'completed'},cfg.hmac);
  if(finish.status!==200||finish.body.accepted!==true)
    throw Error('finish_ack_not_committed');
  return finish.body;
}
async function run() {
  const cfg=validateConfig(process.env);
  console.log('verified_worker_started',cfg.agent);
  let failures=0;
  while(true) {
    try {
      const claim=await signedPost(cfg.gateway,'/v1/worker/claim',{
        org_id:cfg.org,agent_id:cfg.agent,worker_id:cfg.worker,nonce:uuid()
      },cfg.hmac);
      if(claim.status!==200) throw Error('claim_http_'+claim.status);
      if(claim.body.claimed===true) {
        await completeJob(cfg,claim.body.job);
        console.log('verified_worker_completed',claim.body.job.job_id);
      } else if(claim.body.claimed!==false) throw Error('malformed_claim_reply');
      failures=0;
      await pause(claim.body.claimed?100:1500);
    } catch(e) {
      failures++;
      console.error('worker_attempt_failed',e.message);
      await pause(Math.min(30000,1000*(2**Math.min(5,failures))));
    }
  }
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href)
  run().catch(e=>{console.error('worker_start_refused',e.message);process.exit(1);});
export {validateConfig,signedHeaders,completeJob,run};
