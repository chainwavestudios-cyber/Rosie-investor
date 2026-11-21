import test from 'node:test';
import assert from 'node:assert/strict';
import {makeServer,signature} from '../server.mjs';

// These HTTP tests deliberately exercise the real route handler without a database.
// Before an independently attested runtime is deployed, even a correctly signed
// worker claim MUST NOT lease a ticket or imply that inference has started.
const MASTER='m'.repeat(64);
function bodyRequest(path,object){
 const body=JSON.stringify(object),ts=String(Math.floor(Date.now()/1000));
 return {body,headers:{'content-type':'application/json','x-rosie-timestamp':ts,
   'x-rosie-signature':signature(MASTER,'POST',path,ts,body)}};
}
async function withServer(fn){
 const sql=()=>{throw Error('database_must_not_be_touched');};
 const server=makeServer({sql,workerKey:MASTER,ingestKey:MASTER,agentKeys:{A04:MASTER}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port;
  await fn(url);
 }finally{await new Promise(resolve=>server.close(resolve));}
}
test('validly signed claim does not bypass disabled worker runtime',async()=>{
 await withServer(async url=>{
  const path='/v1/worker/claim',req=bodyRequest(path,{
   org_id:'rosie-core-internal',agent_id:'A04',worker_id:'worker-12345678',
   nonce:'11111111-2222-4333-8444-555555555555'
  });
  const response=await fetch(url+path,{method:'POST',headers:req.headers,body:req.body});
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{
    claimed:false,execute_authorized:false,error:'worker_runtime_not_verified'});
 });
});
test('validly signed heartbeat does not bypass disabled worker runtime',async()=>{
 await withServer(async url=>{
  const path='/v1/worker/heartbeat',req=bodyRequest(path,{
   org_id:'rosie-core-internal',agent_id:'A04',worker_id:'worker-12345678',
   nonce:'11111111-2222-4333-8444-555555555555',job_id:'11111111-2222-4333-8444-555555555556',
   fencing_token:1
  });
  const response=await fetch(url+path,{method:'POST',headers:req.headers,body:req.body});
  assert.equal(response.status,503);
  const data=await response.json();
  assert.equal(data.execute_authorized,false);
  assert.equal(data.accepted,false);
 });
});
test('unsigned event and admin status are both denied',async()=>{
 await withServer(async url=>{
  for(const path of ['/v1/events','/v1/admin/status']){
   const response=await fetch(url+path,{method:'POST',headers:{'content-type':'application/json'},
      body:'{"action":"status"}'});
   assert.equal(response.status,401);
  }
 });
});
test('health route identifies staging and does not claim a worker',async()=>{
 await withServer(async url=>{
  const response=await fetch(url+'/health');
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.stage,'staging');
  assert.equal(data.service,'rosie-core-internal-agent-gateway');
 });
});
