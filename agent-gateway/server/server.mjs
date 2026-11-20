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

const PORT=Number(process.env.PORT||10000);
const DSN=process.env.DATABASE_URL||'';
const INGEST_KEY=process.env.CORE_INGEST_HMAC_KEY||'';
const WORKER_KEY=process.env.WORKER_HMAC_KEY||'';
// Worker lease grants are never enabled just because a database row looks ready.
const WORKER_EXECUTION_ENABLED=process.env.WORKER_EXECUTION_ENABLED==='true';
const ORG='rosie-core-internal';
const MAX_BYTES=8192;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AGENT=/^A[0-9]{2,4}$/;
const TICKET=/^rwt-[0-9a-f]{32}$/;
const WORKER=/^[a-zA-Z0-9_:-]{8,100}$/;
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
function checkLease(x){
 return checkWorker(x)&&UUID.test(x.job_id||'')&&
    Number.isSafeInteger(x.fencing_token)&&x.fencing_token>0;
}
function makeServer({sql,ingestKey=INGEST_KEY,workerKey=WORKER_KEY}){
 if(!sql)throw Error('Database required');
 const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url||'/', 'http://localhost').pathname;
  if(req.method==='GET'&&path==='/health')
    return reply(res,200,{ok:true,service:'rosie-core-internal-agent-gateway',stage:'staging'});
  if(req.method==='GET'&&path==='/ready'){
   try{
    const roles=await sql`SELECT current_user AS name,
      (SELECT count(*)::integer FROM core_agents.identities) AS registered`;
    if(roles[0]?.name!=='rosie_agent_gateway')throw Error('unexpected_db_principal');
    return reply(res,200,{ready:true,registered_agents:roles[0].registered,
      worker_runtime_verified:WORKER_EXECUTION_ENABLED,automatic_execution_enabled:WORKER_EXECUTION_ENABLED});
   }catch{return reply(res,503,{ready:false,worker_runtime_verified:false});}
  }
  if(req.method!=='POST')return reply(res,405,{error:'method_not_allowed'});
  if(!['/v1/events','/v1/admin/status','/v1/worker/claim','/v1/worker/heartbeat',
    '/v1/worker/checkpoint','/v1/worker/finish'].includes(path))
    return reply(res,404,{error:'not_found'});
  try{
   const {text,object:x}=await readBody(req);
   const key=path==='/v1/events'?ingestKey:workerKey;
   if(!authentic(req,path,text,key))return reply(res,401,{error:'signed_service_authorization_required'});
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
      ...result[0],worker_runtime_verified:WORKER_EXECUTION_ENABLED,
      automatic_execution_enabled:WORKER_EXECUTION_ENABLED});
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
       WHERE j.org_id=${ORG} AND j.agent_id=${x.agent_id} AND j.state='queued'
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
 const sql=postgres(DSN,{max:5,ssl:'require',connect_timeout:8,prepare:false,
  idle_timeout:15});
 const [{name}]=await sql`SELECT current_user AS name`;
 if(name!=='rosie_agent_gateway')throw Error('Wrong database identity');
 const server=makeServer({sql});
 server.listen(PORT,'0.0.0.0',()=>console.log('core_agent_gateway_listening',PORT));
 const supervisor=setInterval(()=>recoverExpired(sql)
   .catch(()=>console.error('supervisor_recovery_attempt_failed')),15000);
 supervisor.unref();
 const shutdown=async()=>{
  clearInterval(supervisor);server.close();await sleep(50);
  await sql.end({timeout:3});process.exit(0);
 };
 process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)
 main().catch(e=>{console.error('gateway_start_refused',e.message);process.exit(1);});
export {makeServer,authentic,signature,validateEvent,recoverExpired};
