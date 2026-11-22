import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import test from 'node:test';
import {makeServer,signature} from '../server.mjs';
import {candidateFromRow,getCommandCandidate} from '../command-candidate.mjs';

const org='rosie-core-internal',ticket='rwt-'+'a'.repeat(32);
const request={organization_id:org,ticket_key:ticket,agent_id:'A17'};
const manifest={contract:'rosie.command.candidate.v1',artifact_ref:'github:fixture/repo/'+'b'.repeat(40)+'/src/file.js',artifact_sha256:'c'.repeat(64)};
function row(candidate=manifest){
 const result_text=JSON.stringify(candidate);
 return {org_id:org,ticket_key:ticket,agent_id:'A17',lease_owner:'fixture_worker_017',
  fencing_token:1,ack_id:randomUUID(),job_id:randomUUID(),result_text,result_sha256:createHash('sha256').update(result_text).digest('hex')};
}
test('candidate response is limited to verified completion metadata',async()=>{
 const item=row();
 const response=await getCommandCandidate(async()=>[item],request,org);
 assert.equal(response.status,200);
 assert.equal(response.body.completion_ack,item.ack_id);
 assert.equal(response.body.artifact_sha256,manifest.artifact_sha256);
 assert.equal(response.body.result_text,undefined);
 assert.equal(candidateFromRow({...item,result_sha256:'a'.repeat(64)}),null);
 assert.equal(candidateFromRow(row({...manifest,artifact_ref:'github:fixture/repo/main/file.js'})),null);
 assert.equal(candidateFromRow(row({...manifest,artifact_ref:manifest.artifact_ref+'/../other'})),null);
 assert.equal((await getCommandCandidate(async()=>[],request,org)).status,404);
 assert.equal((await getCommandCandidate(async()=>[item,item],request,org)).status,409);
 assert.equal((await getCommandCandidate(()=>assert.fail(),{...request,organization_id:'foreign'},org)).status,400);
});

test('HTTP candidate lookup authenticates Core and returns the durable completion receipt',async t=>{
 const item=row(),key='a'.repeat(64);
 const server=makeServer({sql:async()=>[item],ingestKey:key,workerKey:'',agentKeys:{}});
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const path='/v1/admin/candidate',url='http://127.0.0.1:'+server.address().port+path;
 const body=JSON.stringify(request),timestamp=String(Math.floor(Date.now()/1000));
 const send=headers=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body});
 assert.equal((await send({})).status,401);
 const response=await send({'x-rosie-timestamp':timestamp,'x-rosie-signature':signature(key,'POST',path,timestamp,body)});
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),candidateFromRow(item));
});
