import test from 'node:test';
import assert from 'node:assert/strict';
import { signBridgeAck,verifyBridgeAck } from './core-evidence-ack.mjs';
const key='ack-unit-test-key-32-bytes-do-not-use-in-production',now=Date.parse('2026-11-18T14:00:00Z');
const eventId='source-event-00001',digest='a'.repeat(64);
const result={status:'accepted',receipt_id:'receipt-00000001',event_id:eventId};
const make=()=>signBridgeAck(result,{key,requestDigest:digest,timestamp:now});
test('signed bridge acknowledgement verifies',()=>{
 assert.deepEqual(verifyBridgeAck(make(),{key,expectedDigest:digest,expectedEventId:eventId,now}),{stage:'bridge_persisted',status:'accepted',receipt_id:'receipt-00000001',event_id:eventId});
});
test('ack tamper and wrong source rejected',()=>{
 const a=make();
 assert.throws(()=>verifyBridgeAck({...a,status:'duplicate'},{key,expectedDigest:digest,expectedEventId:eventId,now}),/invalid_ack_signature/);
 assert.throws(()=>verifyBridgeAck(a,{key,expectedDigest:'b'.repeat(64),expectedEventId:eventId,now}),/ack_context_mismatch/);
 assert.throws(()=>verifyBridgeAck(a,{key,expectedDigest:digest,expectedEventId:'different-event-00001',now}),/ack_context_mismatch/);
});
test('ack expiry and spoofed stage rejected',()=>{
 assert.throws(()=>verifyBridgeAck(make(),{key,expectedDigest:digest,expectedEventId:eventId,now:now+600000}),/stale_ack/);
 assert.throws(()=>verifyBridgeAck({...make(),stage:'probo_ingested'},{key,expectedDigest:digest,expectedEventId:eventId,now}),/invalid_ack_claims/);
});
