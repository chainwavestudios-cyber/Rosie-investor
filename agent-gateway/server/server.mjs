/**
 * Rosie Core internal Agent Gateway — durable staging control plane.
 * 18 registered agents; 1,000-identity design target; zero runtime claims
 * until identity, executor and provider have been verified.
 * Signed HTTP events, Neon commit-before-ACK, fenced leases and recovery.
 * No customer calls, provider charges, or unverified worker execution.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import postgres from 'postgres';
import {generateAgent,inspectFactory} from './agent-factory.mjs';
import {auditScope,receiptAudit} from './receipt-audit.mjs';
import {auditIngress,relayAuditAssignment,publishAuditResult} from './audit-relay.mjs';
import {receiveReviewWebhook,reviewWebhookConfig,stagedRetrospectiveAssignments} from './github-review-webhook.mjs';
import {reviewAssignmentKeys,reviewAssignmentRequest} from './review-assignment.mjs';
import {githubReviewRepository,githubReviewSource,handleReviewControl,readReviewRegistry,registerReviewDecision} from './review-control.mjs';
import {readReviewSource} from './review-source-broker.mjs';
import {base44ReviewSource} from './review-checkpoint-source.mjs';
import {reconcilePendingReviews} from './review-reconciliation.mjs';
import {docsReviewDelivery,enqueueGuardianReviewArchive,syncRegisteredReviewDoc} from './review-archive.mjs';
import {registerAutomatedResult} from './review-automated-result.mjs';

const PORT=Number(process.env.PORT||10000);
const DSN=process.env.DATABASE_URL||'';
const INGEST_KEY=process.env.CORE_INGEST_HMAC_KEY||'';
const WORKER_KEY=process.env.WORKER_HMAC_KEY||'';
// Worker lease grants are never enabled just because a database row looks ready.
const WORKER_EXECUTION_ENABLED=process.env.WORKER_EXECUTION_ENABLED==='true';
const AGENT_FACTORY_ENABLED=process.env.AGENT_FACTORY_ENABLED==='true';
const WORKER_AGENT_KEYS_JSON=process.env.WORKER_AGENT_KEYS_JSON||'{}';
function parseWorkerAgentKeys(raw){
 const keys=JSON.parse(raw);
 if(!keys||Array.isArray(keys)||typeof keys!=='object')throw Error('invalid_worker_agent_keys');
 for(const [agent,key] of Object.entries(keys))
  if(!/^A[0-9]{2,4}$/.test(agent)||typeof key!=='string'||key.length<40)
   throw Error('invalid_agent_scoped_key');
 return keys;
}
const WORKER_AGENT_KEYS=parseWorkerAgentKeys(WORKER_AGENT_KEYS_JSON);
const ORG='rosie-core-internal';
const MAX_BYTES=8192;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AGENT=/^A[0-9]{2,4}$/;
const TICKET=/^rwt-[0-9a-f]{32}$/;
const WORKER=/^[a-zA-Z0-9_:-]{8,100}$/;
const ALLOWED_REPLY_KEYS=new Set(['org_id','agent_id','worker_id','job_id','fencing_token','nonce','event_id','recipient_agent_id','ticket_key','payload']);
const kinds=new Set(['ticket.assigned','rcis.message','support.call.received']);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function reply(res,code,data){
  res.writeHead(code,{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify(data));
}
function signature(key,method,path,timestamp,raw){
 return 'sha256='+crypto.createHmac('sha256',key)
   .update(method+'\n'+path+'\n'+timestamp+'\n'+raw).digest('hex');
}
function authentic(req,path,raw,key){
 if(!key||key.length<40)return false;
 if(req.headers.origin)return false;
 const ts=String(req.headers['x-rosie-timestamp']||'');
 if(!/^\d{10}$/.test(ts)||Math.abs(Math.floor(Date.now()/1000)-Number(ts))>180)
   return false;
 const supplied=String(req.headers['x-rosie-signature']||'');
 if(!/^sha256=[a-f0-9]{64}$/.test(supplied))return false;
 const a=Buffer.from(supplied),b=Buffer.from(signature(key,req.method,path,ts,raw));
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
async function readBody(req){
 let text='';
 for await(const chunk of req){
  text+=chunk.toString('utf8');
  if(Buffer.byteLength(text)>MAX_BYTES)throw Object.assign(Error('payload_too_large'),{http:413});
 }
 try{
  const object=JSON.parse(text);
  if(!object||Array.isArray(object)||typeof object!=='object')throw Error();
  return {text,object};
 }catch{throw Object.assign(Error('invalid_json'),{http:400});}
}
function validateEvent(x){
 if(x.org_id!==ORG||!UUID.test(x.event_id||'')||!UUID.test(x.nonce||'')||
    !AGENT.test(x.agent_id||'')||!kinds.has(x.event_type)||
    (x.ticket_key!==null&&x.ticket_key!==undefined&&!TICKET.test(x.ticket_key))||
    x.sender!=='rosie_core'||!x.payload||Array.isArray(x.payload)||
    typeof x.payload!=='object'||JSON.stringify(x.payload).length>3500||
    Object.keys(x).some(k=>!['org_id','event_id','nonce','agent_id','event_type','ticket_key','sender','payload'].includes(k)))
   return false;
 return true;
}
function checkWorker(x){
 return x.org_id===ORG&&AGENT.test(x.agent_id||'')&&
    WORKER.test(x.worker_id||'')&&UUID.test(x.nonce||'');
}
function validateReply(x){
 return checkLease(x)&&UUID.test(x.event_id||'')&&AGENT.test(x.recipient_agent_id||'')&&
   x.recipient_agent_id!==x.agent_id&&
   (x.ticket_key==null||TICKET.test(x.ticket_key))&&
   x.payload&&typeof x.payload==='object'&&!Array.isArray(x.payload)&&
   JSON.stringify(x.payload).length<=3500&&
   Object.keys(x).every(k=>ALLOWED_REPLY_KEYS.has(k));
}
function checkLease(x){
 return checkWorker(x)&&UUID.test(x.job_id||'')&&
    Number.isSafeInteger(x.fencing_token)&&x.fencing_token>0;
}
async function enqueueIndependentReview(t,{agent,id,candidate}){
  const target=await t`SELECT agent_id FROM core_agents.identities
   WHERE org_id=${ORG} AND agent_id=${agent} AND desired_state<>'revoked'`;
  if(target.length!==1)return null;
  const rows=await t`INSERT INTO core_agents.events
   (event_id,org_id,recipient_agent_id,sender,event_type,ticket_key,payload,nonce)
   VALUES(${id},${ORG},${agent},'rosie_core','rcis.message',NULL,${t.json(candidate)},${id})
   ON CONFLICT(event_id) DO NOTHING RETURNING event_id`;
  if(!rows.length){
   const existing=await t`SELECT a.ack_id FROM core_agents.events e
    JOIN core_agents.acks a ON a.event_id=e.event_id AND a.org_id=e.org_id
    WHERE e.event_id=${id} AND e.org_id=${ORG} AND e.recipient_agent_id=${agent}
      AND e.event_type='rcis.message' AND e.payload=${t.json(candidate)}::jsonb
      AND a.stage='persisted' AND a.actor='gateway'`;
   if(existing.length!==1)return null;
   return {idempotent:true,delivery_ack:existing[0].ack_id};
  }
  const ack=await t`INSERT INTO core_agents.acks(event_id,org_id,stage,actor)
   VALUES(${id},${ORG},'persisted','gateway') RETURNING ack_id`;
  return {idempotent:false,delivery_ack:ack[0].ack_id};
}

const enqueueReviewBatch=(sql,assignments)=>sql.begin(async tx=>{
 await tx`SET LOCAL statement_timeout='5000ms'`;
 const results=[];
 for(const assignment of assignments){
  const result=await enqueueIndependentReview(tx,assignment);
  if(!result?.delivery_ack)throw Error('review_assignment_unavailable');
  results.push(result);
 }
 return results;
});

async function persistWebhookPing(sql,delivery,channel){
 const agent=channel==='repository'?'A05':channel;
 const d=crypto.createHash('sha256').update('rosie.github.webhook.ping.v1\n'+channel+'\n'+delivery).digest('hex');
 const id=`${d.slice(0,8)}-${d.slice(8,12)}-8${d.slice(13,16)}-a${d.slice(17,20)}-${d.slice(20,32)}`;
 const payload={contract:'rosie.github.webhook.ping.v1',delivery_id:delivery,channel};
 const rows=await sql`INSERT INTO core_agents.events
  (event_id,org_id,recipient_agent_id,sender,event_type,ticket_key,payload,nonce)
  VALUES(${id},${ORG},${agent},'rosie_core','rcis.message',NULL,${sql.json(payload)},${id})
  ON CONFLICT(event_id) DO UPDATE SET event_id=core_agents.events.event_id
   WHERE core_agents.events.org_id=${ORG} AND core_agents.events.recipient_agent_id=${agent}
    AND core_agents.events.payload=${sql.json(payload)}::jsonb RETURNING event_id`;
 return rows[0]?.event_id;
}

function makeServer({sql,ingestKey=INGEST_KEY,workerKey=WORKER_KEY,agentKeys=WORKER_AGENT_KEYS,
  reviewHooks=reviewWebhookConfig(process.env), reviewKeys=reviewAssignmentKeys(process.env),
  reviewSource=githubReviewSource(process.env),reviewRepository=githubReviewRepository(process.env),
  checkpointSource=base44ReviewSource(process.env),
  reviewControlKey=process.env.GITHUB_REVIEW_CONTROL_KEY||'',
  reviewRegistry=readReviewRegistry(process.env.GITHUB_REVIEW_PUBLIC_REGISTRY_JSON),
  receiptScope=auditScope(process.env),auditKey=process.env.CORE_AUDIT_RELAY_HMAC||''}){
 if(!sql)throw Error('Database required');
 const enqueueReviews=assignments=>enqueueReviewBatch(sql,assignments);
 const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url||'/', 'http://localhost').pathname;
  const reviewHook=/^\/v1\/github-review\/(A05|A14|repository)$/.exec(path);
  if(reviewHook){
   try{
    const agent=reviewHook[1];
    const [status,body]=await receiveReviewWebhook(req,agent,reviewHooks[agent],async input=>{
     const batch=Array.isArray(input)?input:[input];
     const candidate=batch[0].candidate;
     if(reviewSource&&candidate.mode!=='retrospective'){
      const current=await reviewSource(candidate.pull_number);
      if(!current?.base_confirmed||candidate.head_sha!==current.head_sha||
         candidate.base_sha!==current.base_sha)return {superseded:true};
     }
     const results=await enqueueReviews(batch);
     return Array.isArray(input)?results:results[0];
    },(delivery,channel)=>persistWebhookPing(sql,delivery,channel));
    return reply(res,status,body);
   }catch{
    return reply(res,503,{error:'review_assignment_unavailable'});
   }
  }
  if(path==='/v1/independent-review/control'){
   if(req.method!=='POST')return reply(res,405,{error:'method_not_allowed'});
   try{
    const {text,object}=await readBody(req);
    if(!authentic(req,path,text,reviewControlKey))return reply(res,401,{error:'core_review_control_required'});
    const [status,body]=await handleReviewControl({sql,request:object,source:reviewSource,
     registry:reviewRegistry,enqueue:enqueueReviews,checkpointSource});
    return reply(res,status,body);
   }catch(error){
    if(error.http)return reply(res,error.http,{error:error.message});
    return reply(res,503,{error:'review_control_unavailable'});
   }
  }
  if(['/v1/independent-review/inbox','/v1/independent-review/ack',
   '/v1/independent-review/receipt','/v1/independent-review/automated-result',
   '/v1/independent-review/source'].includes(path)){
   if(req.method!=='POST')return reply(res,405,{error:'method_not_allowed'});
   try{
    const {text,object}=await readBody(req);
    const key=typeof object.agent_id==='string'&&Object.hasOwn(reviewKeys,object.agent_id)
     ?reviewKeys[object.agent_id]:undefined;
    if(!authentic(req,path,text,key))return reply(res,401,{error:'reviewer_authorization_required'});
    let result;
    if(path.endsWith('/receipt'))result=await registerReviewDecision({sql,body:object,source:reviewSource,registry:reviewRegistry});
    else if(path.endsWith('/automated-result'))result=await registerAutomatedResult(sql,object);
    else if(path.endsWith('/source'))result=await readReviewSource({sql,body:object,repository:reviewRepository,checkpointSource});
    else result=await reviewAssignmentRequest(sql,path,object);
    const [status,body]=result;
    return reply(res,status,body);
   }catch(error){
    if(error.http)return reply(res,error.http,{error:error.message});
    if(error.code==='23505')return reply(res,409,{error:'review_request_replayed'});
    return reply(res,503,{error:'review_assignment_unavailable'});
   }
  }
  if(req.method==='GET'&&path==='/health')
    return reply(res,200,{ok:true,service:'rosie-core-internal-agent-gateway',stage:'staging'});
  if(req.method==='GET'&&path==='/ready'){
   try{
    const roles=await sql`SELECT current_user AS name,
      (SELECT count(*)::integer FROM core_agents.identities) AS registered`;
    if(roles[0]?.name!=='rosie_agent_gateway')throw Error('unexpected_db_principal');
    return reply(res,200,{ready:true,registered_agents:roles[0].registered,
      worker_claims_enabled:WORKER_EXECUTION_ENABLED,
      worker_runtime_verified:false,automatic_execution_enabled:false});
   }catch{return reply(res,503,{ready:false,worker_runtime_verified:false});}
  }
  if(req.method!=='POST')return reply(res,405,{error:'method_not_allowed'});
  if(!['/v1/events','/v1/admin/status','/v1/worker/claim','/v1/worker/heartbeat',
    '/v1/worker/checkpoint','/v1/worker/finish','/v1/worker/reply','/v1/worker/result',
    '/v1/agent/send','/v1/agent/inbox','/v1/agent/ack','/v1/factory/generate','/v1/factory/status',
    '/v1/receipt-audit/claim','/v1/receipt-audit/finish'].includes(path))
    return reply(res,404,{error:'not_found'});
  try{
   const {text,object:x}=await readBody(req);
   const key=(path==='/v1/events'||path.startsWith('/v1/factory/'))?ingestKey:
     path==='/v1/admin/status'?workerKey:agentKeys[x.agent_id];
   const scopedIngress=path==='/v1/events' && auditIngress(x,receiptScope) && authentic(req,path,text,auditKey);
   if(!scopedIngress&&!authentic(req,path,text,key))return reply(res,401,{error:'signed_service_authorization_required'});
   if(path.startsWith('/v1/receipt-audit/')){
    const outcome=await receiptAudit(sql,path,x,receiptScope);
    return reply(res,outcome.status||200,outcome);
   }
   if(path==='/v1/factory/generate'||path==='/v1/factory/status'){
    if(!AGENT_FACTORY_ENABLED)return reply(res,503,{error:'agent_factory_staging_disabled'});
    if(!UUID.test(x.nonce||''))return reply(res,400,{error:'invalid_factory_nonce'});
    await sql`INSERT INTO core_agents.worker_nonces(nonce,org_id)
      VALUES(${x.nonce},${ORG})`;
    const outcome=path==='/v1/factory/status'?
      await inspectFactory(sql,x):await generateAgent(sql,x);
    return reply(res,outcome.status&&outcome.status>=400?outcome.status:
      outcome.idempotent?200:outcome.agent_id?201:200,outcome);
   }
   // Agent messaging uses a separate signed transport path: no worker lease,
   // inference endpoint, provider credential, or execution flag is involved.
   if(path.startsWith('/v1/agent/')){
    if(!AGENT.test(x.agent_id||'')||x.org_id!==ORG||!UUID.test(x.nonce||'')||
       !agentKeys[x.agent_id]||Object.keys(x).length>11)
      return reply(res,400,{error:'invalid_agent_transport_identity'});
    await sql`INSERT INTO core_agents.worker_nonces(nonce,org_id) VALUES(${x.nonce},${ORG})`;
    const live=await sql`SELECT agent_id,desired_state FROM core_agents.identities
      WHERE org_id=${ORG} AND agent_id=${x.agent_id}`;
    if(live.length!==1||live[0].desired_state==='revoked')
      return reply(res,403,{error:'agent_identity_not_authorized'});
    if(path==='/v1/agent/send'){
     const validKeys=new Set(['org_id','agent_id','recipient_agent_id',
      'event_id','nonce','kind','message','trace_id','reply_to']);
     if(Object.keys(x).some(k=>!validKeys.has(k))||
        !AGENT.test(x.recipient_agent_id||'')||
        x.agent_id===x.recipient_agent_id||
        !UUID.test(x.event_id||'')||!UUID.test(x.trace_id||'')||
        (x.reply_to!==undefined&&!UUID.test(x.reply_to))||
        !['probe','probe_ack','note'].includes(x.kind)||
        typeof x.message!=='string'||!x.message.trim()||
        Buffer.byteLength(x.message,'utf8')>1600)
       return reply(res,400,{error:'invalid_agent_message'});
     const data={contract:'rosie.core.rcis.transport.v1',
       kind:x.kind,message:x.message,trace_id:x.trace_id,
       reply_to:x.reply_to||null};
     const receipt=await sql.begin(async t=>{
      await t`SET LOCAL statement_timeout='5000ms'`;
      const target=await t`SELECT agent_id FROM core_agents.identities
       WHERE org_id=${ORG} AND agent_id=${x.recipient_agent_id}
         AND desired_state<>'revoked'`;
      if(target.length!==1)return {unknown:true};
      const added=await t`INSERT INTO core_agents.events
       (event_id,org_id,recipient_agent_id,sender,event_type,ticket_key,payload,nonce)
       VALUES(${x.event_id},${ORG},${x.recipient_agent_id},${x.agent_id},
         'rcis.message',NULL,${t.json(data)},${x.nonce})
       ON CONFLICT(event_id) DO NOTHING RETURNING event_id`;
      if(!added.length)return {collision:true};
      const ack=await t`INSERT INTO core_agents.acks(event_id,org_id,stage,actor)
        VALUES(${x.event_id},${ORG},'persisted','gateway')
        RETURNING ack_id`;
      return {ack_id:ack[0].ack_id};
     });
     if(receipt.unknown)return reply(res,404,{error:'recipient_unregistered'});
     if(receipt.collision)return reply(res,409,{error:'message_id_collision'});
     return reply(res,202,{accepted:true,durable_commit:true,
       event_id:x.event_id,delivery_ack:receipt.ack_id,
       recipient_agent_id:x.recipient_agent_id,model_calls:0});
    }
    if(path==='/v1/agent/inbox'){
     if(Object.keys(x).some(k=>!['org_id','agent_id','nonce','limit'].includes(k))||
        (x.limit!==undefined&&(!Number.isInteger(x.limit)||x.limit<1||x.limit>20)))
       return reply(res,400,{error:'invalid_agent_inbox_query'});
     const events=await sql`SELECT e.event_id,e.sender,e.payload,e.received_at
      FROM core_agents.events e
      LEFT JOIN core_agents.agent_message_receipts mr ON mr.event_id=e.event_id
        AND mr.recipient_agent_id=${x.agent_id}
      WHERE e.org_id=${ORG} AND e.recipient_agent_id=${x.agent_id}
       AND e.event_type='rcis.message'
       AND e.payload->>'contract'='rosie.core.rcis.transport.v1'
       AND mr.event_id IS NULL
      ORDER BY e.received_at LIMIT ${x.limit||20}`;
     return reply(res,200,{ok:true,agent_id:x.agent_id,messages:events,
       model_calls:0});
    }
    if(path==='/v1/agent/ack'){
     if(Object.keys(x).some(k=>!['org_id','agent_id','nonce','event_id'].includes(k))||
       !UUID.test(x.event_id||''))return reply(res,400,{error:'invalid_agent_receipt'});
     const receipts=await sql`INSERT INTO core_agents.agent_message_receipts
       (event_id,org_id,recipient_agent_id)
       SELECT event_id,${ORG},${x.agent_id} FROM core_agents.events
       WHERE event_id=${x.event_id} AND org_id=${ORG}
        AND recipient_agent_id=${x.agent_id}
        AND event_type='rcis.message'
        AND payload->>'contract'='rosie.core.rcis.transport.v1'
       ON CONFLICT(event_id,recipient_agent_id) DO UPDATE
        SET received_at=core_agents.agent_message_receipts.received_at
       RETURNING event_id,received_at`;
     if(!receipts.length)return reply(res,404,{error:'message_not_addressed_to_agent'});
     return reply(res,200,{accepted:true,durable_commit:true,
       event_id:x.event_id,recipient_agent_id:x.agent_id,
       received_at:receipts[0].received_at,model_calls:0});
    }
   }
   if(path==='/v1/admin/status'){
    if(Object.keys(x).length!==1||x.action!=='status')return reply(res,400,{error:'status_only'});
    const result=await sql`SELECT
      (SELECT count(*)::integer FROM core_agents.identities) AS registered_agents,
      (SELECT count(*)::integer FROM core_agents.jobs WHERE state='queued') AS queued_jobs,
      (SELECT count(*)::integer FROM core_agents.jobs WHERE state IN ('leased','running','checkpointed')) AS leased_jobs,
      (SELECT count(*)::integer FROM core_agents.jobs WHERE state='completed') AS completed_jobs,
      (SELECT count(*)::integer FROM core_agents.jobs WHERE state='dead_letter') AS dead_letter_jobs,
      (SELECT count(*)::integer FROM core_agents.acks WHERE stage='persisted') AS durable_acks,
      (SELECT count(*)::integer FROM core_agents.identities WHERE runtime_state='running') AS running_identities`;
    return reply(res,200,{ok:true,contract:'rosie.core.agent_gateway.ops.v1',
      ...result[0],worker_claims_enabled:WORKER_EXECUTION_ENABLED,
      worker_runtime_verified:false,automatic_execution_enabled:false});
   }
   if(path==='/v1/events'){
    if(!validateEvent(x))return reply(res,400,{error:'invalid_event'});
    const receipt=await sql.begin(async t=>{
     await t`SET LOCAL statement_timeout='5000ms'`;
     const added=await t`INSERT INTO core_agents.events
       (event_id,org_id,recipient_agent_id,sender,event_type,ticket_key,payload,nonce)
       VALUES (${x.event_id},${ORG},${x.agent_id},${x.sender},
         ${x.event_type},${x.ticket_key||null},${t.json(x.payload)},${x.nonce})
       ON CONFLICT(event_id) DO NOTHING RETURNING event_id`;
     if(!added.length){
      const found=await t`SELECT event_id,org_id,recipient_agent_id,
       sender,event_type,ticket_key,payload,nonce
       FROM core_agents.events WHERE event_id=${x.event_id}`;
      if(found.length!==1||found[0].recipient_agent_id!==x.agent_id||
       found[0].org_id!==x.org_id||found[0].sender!==x.sender||
       found[0].event_type!==x.event_type||found[0].ticket_key!==(x.ticket_key||null)||
       found[0].nonce!==x.nonce||
       !(await t`SELECT 1 FROM core_agents.events WHERE event_id=${x.event_id} AND payload=${t.json(x.payload)}::jsonb`).length)
        return {conflict:true};
      const ack=await t`SELECT ack_id FROM core_agents.acks
        WHERE event_id=${x.event_id} AND stage='persisted'`;
      return {idempotent:true,ack_id:ack[0]?.ack_id||null};
     }
     const job=await t`INSERT INTO core_agents.jobs(event_id,org_id,agent_id)
       VALUES(${x.event_id},${ORG},${x.agent_id}) RETURNING job_id`;
     const ack=await t`INSERT INTO core_agents.acks
       (event_id,org_id,stage,actor) VALUES(${x.event_id},${ORG},'persisted','gateway')
       RETURNING ack_id`;
     return {job_id:job[0].job_id,ack_id:ack[0].ack_id};
    });
    if(receipt.conflict)return reply(res,409,{error:'event_id_conflict'});
    return reply(res,receipt.idempotent?200:202,{
      accepted:true,durable_commit:true,delivery_ack:receipt.ack_id,
      event_id:x.event_id,job_id:receipt.job_id||null,
      idempotent:!!receipt.idempotent,worker_started:false});
   }
   if(path==='/v1/worker/claim'){
    if(!WORKER_EXECUTION_ENABLED)return reply(res,503,{claimed:false,execute_authorized:false,error:'worker_runtime_not_verified'});
    if(!checkWorker(x)||Object.keys(x).some(k=>!['org_id','agent_id','worker_id','nonce'].includes(k)))
      return reply(res,400,{error:'invalid_worker_claim'});
    await sql`INSERT INTO core_agents.worker_nonces(nonce,org_id) VALUES (${x.nonce},${ORG})`;
    const claimed=await sql.begin(async t=>{
     await t`SET LOCAL statement_timeout='5000ms'`;
     return t`WITH next AS(
       SELECT j.job_id FROM core_agents.jobs j
       JOIN core_agents.identities a ON a.org_id=j.org_id AND a.agent_id=j.agent_id
       JOIN core_agents.events e ON e.event_id=j.event_id AND e.org_id=j.org_id
       WHERE j.org_id=${ORG} AND j.agent_id=${x.agent_id} AND j.state='queued'
         AND e.ticket_key IS DISTINCT FROM ${receiptScope?.ticket||'no-audit-selected'}
         AND (e.payload->>'contract') IS DISTINCT FROM 'rosie.core.delivery-audit.v1'
         AND j.attempts<3 AND a.desired_state='ready' AND a.runtime_state='available'
       ORDER BY j.enqueued_at FOR UPDATE OF j SKIP LOCKED LIMIT 1
      ) UPDATE core_agents.jobs j
       SET state='leased',lease_owner=${x.worker_id},
          fencing_token=j.fencing_token+1,attempts=j.attempts+1,
          lease_until=now()+interval '90 seconds',updated_at=now()
       FROM next WHERE j.job_id=next.job_id
       RETURNING j.job_id,j.event_id,j.agent_id,j.fencing_token,j.lease_until`;
    });
    const event=claimed.length?await sql`SELECT event_type,ticket_key,payload FROM core_agents.events
       WHERE event_id=${claimed[0].event_id} AND org_id=${ORG}`:[];
    return reply(res,200,{claimed:claimed.length===1,
      execute_authorized:claimed.length===1,job:claimed.length?{...claimed[0],
       event:event[0]||null}:null});
   }
   if(!WORKER_EXECUTION_ENABLED)return reply(res,503,{accepted:false,execute_authorized:false,error:'worker_runtime_not_verified'});
   if(!checkLease(x))return reply(res,400,{error:'invalid_fenced_worker_request'});
   await sql`INSERT INTO core_agents.worker_nonces(nonce,org_id) VALUES (${x.nonce},${ORG})`;
   if(path==='/v1/worker/result'){
    const allowed=new Set(['org_id','agent_id','worker_id','job_id','fencing_token','nonce','provider','provider_response_id','result_text']);
    if(Object.keys(x).some(k=>!allowed.has(k)) ||
       x.provider!=='openai' ||
       typeof x.provider_response_id!=='string' ||
       !/^resp_[a-zA-Z0-9_-]{8,120}$/.test(x.provider_response_id) ||
       typeof x.result_text!=='string' ||
       !x.result_text.trim() ||
       Buffer.byteLength(x.result_text,'utf8')>3000)
      return reply(res,400,{error:'invalid_model_execution_receipt'});
    const digest=crypto.createHash('sha256').update(x.result_text,'utf8').digest('hex');
    const resultRef='core:jobs/'+x.job_id;
    const checkpoint={ref:resultRef,provider:x.provider,
      provider_response_id:x.provider_response_id,
      result_text:x.result_text,result_sha256:digest};
    const rows=await sql`UPDATE core_agents.jobs
      SET state='checkpointed',checkpoint=${sql.json(checkpoint)},updated_at=now()
      WHERE job_id=${x.job_id} AND org_id=${ORG} AND agent_id=${x.agent_id}
        AND lease_owner=${x.worker_id} AND fencing_token=${x.fencing_token}
        AND lease_until>now() AND state IN ('leased','running','checkpointed')
      RETURNING job_id`;
    return reply(res,rows.length?200:409,{
      accepted:rows.length===1,durable_commit:rows.length===1,
      result_ref:rows.length?resultRef:null,result_sha256:rows.length?digest:null});
   }
   if(path==='/v1/worker/reply'){
    if(!validateReply(x))return reply(res,400,{error:'invalid_agent_reply'});
    const receipt=await sql.begin(async t=>{
     await t`SET LOCAL statement_timeout='5000ms'`;
     const leases=await t`SELECT j.job_id,j.event_id,e.ticket_key
       FROM core_agents.jobs j JOIN core_agents.events e ON e.event_id=j.event_id
       WHERE j.job_id=${x.job_id} AND j.org_id=${ORG}
         AND j.agent_id=${x.agent_id} AND j.lease_owner=${x.worker_id}
         AND j.fencing_token=${x.fencing_token}
         AND j.lease_until>now() AND j.state='checkpointed'
       FOR UPDATE OF j`;
     if(!leases.length)return {denied:true};
     if((leases[0].ticket_key||null)!==(x.ticket_key||null))return {denied:true};
     const target=await t`SELECT agent_id FROM core_agents.identities
       WHERE org_id=${ORG} AND agent_id=${x.recipient_agent_id}`;
     if(target.length!==1)return {unknown:true};
     const body={...x.payload,causation_event_id:leases[0].event_id,
       source_job_id:x.job_id};
     if(JSON.stringify(body).length>3500)return {invalid:true};
     const existing=await t`SELECT event_id,recipient_agent_id,sender,ticket_key,payload
       FROM core_agents.events WHERE event_id=${x.event_id}`;
     if(existing.length){
      const e=existing[0];
      const same=await t`SELECT 1 FROM core_agents.events
        WHERE event_id=${x.event_id} AND payload=${t.json(body)}::jsonb`;
      if(e.recipient_agent_id!==x.recipient_agent_id||
         e.sender!==x.agent_id||e.ticket_key!==(x.ticket_key||null)||
         same.length!==1)return {conflict:true};
      const ack=await t`SELECT ack_id FROM core_agents.acks
        WHERE event_id=${x.event_id} AND stage='persisted'`;
      return {idempotent:true,ack_id:ack[0]?.ack_id||null};
     }
     await t`INSERT INTO core_agents.events(event_id,org_id,recipient_agent_id,
       sender,event_type,ticket_key,payload,nonce)
       VALUES(${x.event_id},${ORG},${x.recipient_agent_id},${x.agent_id},
         'rcis.message',${x.ticket_key||null},${t.json(body)},${x.nonce})`;
     const job=await t`INSERT INTO core_agents.jobs(event_id,org_id,agent_id)
       VALUES(${x.event_id},${ORG},${x.recipient_agent_id}) RETURNING job_id`;
     const ack=await t`INSERT INTO core_agents.acks(event_id,org_id,stage,actor)
       VALUES(${x.event_id},${ORG},'persisted',${x.agent_id})
       RETURNING ack_id`;
     return {job_id:job[0].job_id,ack_id:ack[0].ack_id};
    });
    if(receipt.denied)return reply(res,403,{error:'sender_lease_not_authorized'});
    if(receipt.unknown)return reply(res,404,{error:'recipient_unregistered'});
    if(receipt.invalid)return reply(res,400,{error:'reply_payload_too_large'});
    if(receipt.conflict)return reply(res,409,{error:'reply_id_collision'});
    return reply(res,receipt.idempotent?200:202,{
      accepted:true,durable_commit:true,idempotent:!!receipt.idempotent,
      delivery_ack:receipt.ack_id,event_id:x.event_id,
      job_id:receipt.job_id||null
    });
   }
   if(path==='/v1/worker/heartbeat'){
    const rows=await sql`UPDATE core_agents.jobs SET
      state='running',lease_until=now()+interval '90 seconds',updated_at=now()
      WHERE job_id=${x.job_id} AND org_id=${ORG} AND agent_id=${x.agent_id}
        AND lease_owner=${x.worker_id} AND fencing_token=${x.fencing_token}
        AND lease_until>now() AND state IN ('leased','running','checkpointed')
      RETURNING job_id,lease_until`;
    return reply(res,rows.length?200:409,{accepted:rows.length===1,lease_until:rows[0]?.lease_until||null});
   }
   if(path==='/v1/worker/checkpoint'){
    if(typeof x.checkpoint_ref!=='string'||!/^core:[a-zA-Z0-9_.:/-]{8,240}$/.test(x.checkpoint_ref))
      return reply(res,400,{error:'checkpoint_reference_required'});
    const rows=await sql`UPDATE core_agents.jobs SET
      state='checkpointed',checkpoint=${sql.json({ref:x.checkpoint_ref})},updated_at=now()
      WHERE job_id=${x.job_id} AND org_id=${ORG} AND agent_id=${x.agent_id}
        AND lease_owner=${x.worker_id} AND fencing_token=${x.fencing_token}
        AND lease_until>now() AND state IN ('leased','running','checkpointed')
      RETURNING job_id`;
    return reply(res,rows.length?200:409,{accepted:rows.length===1});
   }
   if(path==='/v1/worker/finish'){
    if(!['completed','blocked'].includes(x.result))
      return reply(res,400,{error:'invalid_finish_state'});
    const result=await sql.begin(async t=>{
     const rows=await t`UPDATE core_agents.jobs
       SET state=${x.result},lease_until=NULL,updated_at=now()
       WHERE job_id=${x.job_id} AND org_id=${ORG} AND agent_id=${x.agent_id}
         AND lease_owner=${x.worker_id} AND fencing_token=${x.fencing_token}
         AND lease_until>now() AND state IN ('leased','running','checkpointed')
       RETURNING job_id,event_id`;
     if(!rows.length)return null;
     const stage=x.result==='completed'?'worker_completed':'worker_blocked';
     const ack=await t`INSERT INTO core_agents.acks
       (event_id,org_id,stage,actor) VALUES
       (${rows[0].event_id},${ORG},${stage},${x.worker_id})
       ON CONFLICT(event_id,stage) DO NOTHING RETURNING ack_id`;
     return {ack_id:ack[0]?.ack_id||null};
    });
    return reply(res,result?200:409,{accepted:!!result,
      execution_receipt:result?.ack_id||null});
   }
  }catch(e){
   const code=e.http||(e.code==='23505'?409:503);
   return reply(res,code,{error:code===409?'nonce_or_event_collision':
      code===503?'gateway_persistence_unavailable':e.message});
  }
 });
 return server;
}
async function recoverExpired(sql){
 const rows=await sql`UPDATE core_agents.jobs
   SET state=CASE WHEN attempts>=3 THEN 'dead_letter' ELSE 'queued' END,
     lease_owner=NULL,lease_until=NULL,fencing_token=fencing_token+1,
     updated_at=now()
   WHERE state IN ('leased','running','checkpointed') AND lease_until<now()
   RETURNING job_id,state`;
 return rows.length;
}
async function main(){
 if(!DSN||INGEST_KEY.length<40||WORKER_KEY.length<40)
  throw Error('Gateway missing database or signed service keys');
 if(WORKER_EXECUTION_ENABLED&&(!WORKER_AGENT_KEYS.A02||!WORKER_AGENT_KEYS.A05))
  throw Error('Required agent-scoped worker keys not configured');
 const sql=postgres(DSN,{max:5,ssl:'require',connect_timeout:8,prepare:false,
  idle_timeout:15});
 const [{name}]=await sql`SELECT current_user AS name`;
 if(name!=='rosie_agent_gateway')throw Error('Wrong database identity');
 const server=makeServer({sql});
 server.listen(PORT,'0.0.0.0',()=>console.log('core_agent_gateway_listening',PORT));
 let retrospectiveTimer;
 try{
  const retrospective=stagedRetrospectiveAssignments(process.env);
  if(retrospective.length){
   const seed=async()=>{
    try{
     await enqueueReviewBatch(sql,retrospective);
     console.log('review_retrospective_assignments_persisted',retrospective[0].candidate.pull_number);
    }catch{
     console.warn('review_retrospective_assignment_pending');
     retrospectiveTimer=setTimeout(seed,30000);
     retrospectiveTimer.unref();
    }
   };
   retrospectiveTimer=setTimeout(seed,500);
   retrospectiveTimer.unref();
  }
 }catch{
  console.warn('review_retrospective_scope_invalid');
 }
 const pendingReviewRepository=githubReviewRepository(process.env);
 let pendingReviewTimer,pendingReviewPage=1,stopping=false;
 const reconcileReviews=async()=>{
  try{
   const result=await reconcilePendingReviews(pendingReviewRepository,
    assignments=>enqueueReviewBatch(sql,assignments),pendingReviewPage);
   pendingReviewPage=result.nextPage;
   if(result.added||result.errors)console.log('pending_reviews_reconciled',result);
  }catch{
   console.warn('pending_review_reconciliation_unavailable');
  }finally{
   if(!stopping){
    pendingReviewTimer=setTimeout(reconcileReviews,pendingReviewPage===1?90000:5000);
    pendingReviewTimer.unref();
   }
  }
 };
 if(pendingReviewRepository){
  pendingReviewTimer=setTimeout(reconcileReviews,1500);
  pendingReviewTimer.unref();
 }else{
  console.warn('pending_review_reconciliation_source_not_configured');
 }
 const scope=auditScope(process.env),auditKey=process.env.CORE_AUDIT_RELAY_HMAC||'';
 let relayTimer;
 if(scope && auditKey.length>=40){
  let delay=5000,assigned=false;
  const relay=async()=>{
   try{
    if(await publishAuditResult(sql,scope,auditKey)){
     console.log('core_audit_review_recorded',scope.ticket);return;
    }
    if(!assigned){
     const ack=await relayAuditAssignment({scope,key:auditKey,port:PORT});
     console.log('core_audit_dispatch_received',ack.event_id);assigned=true;
    }
    relayTimer=setTimeout(relay,5000);relayTimer.unref();
   }catch(e){
    console.warn('core_audit_dispatch_pending',e.message);
    delay=Math.min(60000,delay*2);relayTimer=setTimeout(relay,delay);relayTimer.unref();
   }
  };
  relayTimer=setTimeout(relay,1000);relayTimer.unref();
 }
 const supervisor=setInterval(()=>recoverExpired(sql)
   .catch(()=>console.error('supervisor_recovery_attempt_failed')),15000);
 supervisor.unref();
 const docDelivery=docsReviewDelivery(process.env);
 let reviewingArchives=false;
 const reviewArchiveTimer=setInterval(async()=>{
  if(reviewingArchives)return;
  reviewingArchives=true;
  try{
   await enqueueGuardianReviewArchive(sql);
  }catch{
   console.warn('independent_review_guardian_delivery_pending');
  }
  try{
   if(docDelivery)await syncRegisteredReviewDoc(sql,docDelivery);
  }catch{
   console.warn('independent_review_docs_delivery_pending');
  }finally{
   reviewingArchives=false;
  }
 },60000);
 reviewArchiveTimer.unref();
 const shutdown=async()=>{
  stopping=true;
  clearTimeout(pendingReviewTimer);clearTimeout(relayTimer);clearTimeout(retrospectiveTimer);clearInterval(supervisor);clearInterval(reviewArchiveTimer);server.close();await sleep(50);
  await sql.end({timeout:3});process.exit(0);
 };
 process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)
 main().catch(e=>{console.error('gateway_start_refused',e.message);process.exit(1);});
export {makeServer,authentic,signature,validateEvent,validateReply,parseWorkerAgentKeys,recoverExpired};
