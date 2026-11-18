import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverEvidenceOnce } from './core-evidence-sender.mjs';
import { signBridgeAck } from './core-evidence-ack.mjs';
const key='source-test-key-of-32bytes-111111111111111';
const ackKey='ack-test-key-of-32bytes-222222222222222';
const event={contract:'rosie.grc.evidence.v1',app_key:'core',environment:'staging',
 control_id:'CORE-SEC-001',evidence_kind:'access-review',source_event_id:'source-event-00001',
 occurred_at:new Date().toISOString(),source_sha256:'b'.repeat(64),outcome:'review'};
const args={event,endpoint:'https://staging-bridge.example.test/v1/evidence',source:'rosie-core-staging',key,ackKey};
test('sender accepts verified signed bridge persistence receipt',async()=>{
 const result=await deliverEvidenceOnce({...args,send:async(url,opts)=>{
  assert.equal(url,args.endpoint);assert.equal(opts.method,'POST');
  const req=JSON.parse(opts.body);assert.equal(req.source,args.source);
  const ack=signBridgeAck({status:'accepted',receipt_id:'receipt-test00001',event_id:event.source_event_id},
    {key:ackKey,requestDigest:req.digest,timestamp:Date.now()});
  return {status:202,text:async()=>JSON.stringify(ack)};
 }});
 assert.equal(result.stage,'bridge_persisted');assert.equal(result.status,'accepted');
});
test('sender rejects forged ACK',async()=>{
 await assert.rejects(deliverEvidenceOnce({...args,send:async(url,opts)=>{
  const req=JSON.parse(opts.body);
  const ack=signBridgeAck({status:'accepted',receipt_id:'receipt-test00001',event_id:event.source_event_id},
    {key:ackKey,requestDigest:req.digest,timestamp:Date.now()});
  ack.signature='0'.repeat(64);return {status:202,text:async()=>JSON.stringify(ack)};
 }}),/invalid_ack_signature/);
});
test('sender rejects non-HTTPS endpoint',async()=>{
 await assert.rejects(deliverEvidenceOnce({...args,endpoint:'http://example.test/v1/evidence'}),/insecure_or_unapproved_endpoint/);
});
test('sender rejects unsuccessful response and redirect',async()=>{
 await assert.rejects(deliverEvidenceOnce({...args,send:async()=>({status:302,text:async()=>''})}),/bridge_delivery_not_accepted/);
});
