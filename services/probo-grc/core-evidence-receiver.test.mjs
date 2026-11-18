import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makeSignedEnvelope } from './core-evidence-gateway.mjs';
import { createEvidenceReceiver } from './core-evidence-receiver.mjs';
import { verifyBridgeAck } from './core-evidence-ack.mjs';
const key='test-core-source-identity-key-0000000000001';
const ackKey='test-probo-ack-identity-key-000000000000001';
const now=new Date('2026-11-18T14:00:00.000Z');
const source='rosie-core-staging';
const event={contract:'rosie.grc.evidence.v1',app_key:'core',environment:'staging',
  control_id:'CORE-SEC-001',evidence_kind:'automated-security-test',source_event_id:'source-event-00001',
  occurred_at:now.toISOString(),source_sha256:'b'.repeat(64),outcome:'pass'};
const config=()=>({now,ackKey,sources:{[source]:{enabled:true,key,app_key:'core',
 source_org_id:'core-org-00001',probo_org_id:'probo-org-00001',approvedSourceOrganizations:['core-org-00001']}},adapter:{
 async commitUnique(){return {status:'accepted',receiptId:'receipt-00001'};}
}});
const env=()=>makeSignedEnvelope({event,key,source,timestamp:now.getTime(),nonce:'nonce-00000001'});
async function withServer(conf,fn) {
 const server=createEvidenceReceiver(conf);server.listen(0,'127.0.0.1');await once(server,'listening');
 try {return await fn('http://127.0.0.1:'+server.address().port);}
 finally {await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
}
test('HTTP receipt is signed and bound to request digest',async()=>withServer(config(),async base=>{
 const envelope=env();const resp=await fetch(base+'/v1/evidence',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(envelope)});
 assert.equal(resp.status,202);
 const ack=await resp.json();
 assert.deepEqual(verifyBridgeAck(ack,{key:ackKey,expectedDigest:envelope.digest,
   expectedEventId:event.source_event_id,now:now.getTime()}),{
   stage:'bridge_persisted',status:'accepted',receipt_id:'receipt-00001',event_id:event.source_event_id});
}));
test('unsigned and tampered payloads never reach database',async()=>{
 let calls=0;const cfg=config();cfg.adapter={async commitUnique(){calls++;throw Error('should_not_run');}};
 await withServer(cfg,async base=>{
  const unauthorized=await fetch(base+'/v1/evidence',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({...env(),signature:'0'.repeat(64)})});
  assert.equal(unauthorized.status,401);assert.deepEqual(await unauthorized.json(),{error:'unauthorized'});
 });
 assert.equal(calls,0);
});
test('invalid method and content type rejected',async()=>withServer(config(),async base=>{
 const get=await fetch(base+'/v1/evidence');assert.equal(get.status,404);
 const invalid=await fetch(base+'/v1/evidence',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'});
 assert.equal(invalid.status,415);
}));
test('transport rejects oversized requests',async()=>withServer(config(),async base=>{
 const oversized=await fetch(base+'/v1/evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(13000)});
 assert.equal(oversized.status,413);
}));
test('persistence failure returns 503 without signed success',async()=> {
 const cfg=config();cfg.adapter={async commitUnique(){throw Error('postgres_unavailable');}};
 await withServer(cfg,async base=>{
  const resp=await fetch(base+'/v1/evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(env())});
  assert.equal(resp.status,503);assert.deepEqual(await resp.json(),{error:'storage_unavailable'});
 });
});
