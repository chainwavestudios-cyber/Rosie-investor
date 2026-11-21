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
  // The verified executor must durably store the output and return a Core reference.
  if(!execution.ok || receipt?.status!=='completed' ||
     typeof receipt?.result_ref!=='string' ||
     !/^core:[a-zA-Z0-9_.:/-]{8,240}$/.test(receipt.result_ref))
    throw Error('executor_has_no_durable_completion_receipt');
  const checkpoint=await signedPost(cfg.gateway,'/v1/worker/checkpoint',
    {...common,nonce:uuid(),checkpoint_ref:receipt.result_ref},cfg.hmac);
  if(checkpoint.status!==200||checkpoint.body.accepted!==true)
    throw Error('checkpoint_not_committed');
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
export {validateConfig,signedHeaders,completeJob};
