import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSignedEnvelope, acceptSignedEvidence } from './core-evidence-gateway.mjs';
const key = 'unit-test-key-32-bytes-please-do-not-use-in-prod';
const now = new Date('2026-11-18T14:00:00.000Z');
const event = { contract:'rosie.grc.evidence.v1', app_key:'core', environment:'staging',
control_id:'CORE-SEC-001', evidence_kind:'automated-security-test',
source_event_id:'source-event-001', occurred_at:now.toISOString(),source_sha256:'a'.repeat(64), outcome:'pass' };
const source='rosie-core-staging';
const cfg = adapter => ({now, sources:{[source]:{enabled:true,key,app_key:'core',source_org_id:'core-org-001',probo_org_id:'probo-org-001',approvedSourceOrganizations:['core-org-001']}},adapter});
function store() {
 const replay = new Map(), dedupe=new Map();
 return {async commitUnique({replayKey,dedupeKey,envelopeDigest}) {
   if (replay.has(replayKey)) throw Error('replay_detected');
   if (dedupe.has(dedupeKey)) {
     const prior=dedupe.get(dedupeKey);
     if(prior.digest !== envelopeDigest) throw Error('conflicting_duplicate');
     replay.set(replayKey,true);
     return {status:'duplicate',receiptId:prior.id};
   }
   const id='receipt-'+String(dedupe.size+1).padStart(8,'0');
   dedupe.set(dedupeKey,{id,digest:envelopeDigest}); replay.set(replayKey,true);
   return {status:'accepted',receiptId:id};
 }};
}
const make = (nonce='nonce-00000001', ev=event)=>makeSignedEnvelope({event:ev,key,source,timestamp:now.getTime(),nonce});
test('valid signed event accepted; distinct nonce same content idempotent',async()=>{
 const adapter=store();
 assert.equal((await acceptSignedEvidence(make(),cfg(adapter))).status,'accepted');
 assert.equal((await acceptSignedEvidence(make('nonce-00000002'),cfg(adapter))).status,'duplicate');
});
test('exact envelope replay denied',async()=>{
 const adapter=store();await acceptSignedEvidence(make(),cfg(adapter));
 await assert.rejects(acceptSignedEvidence(make(),cfg(adapter)),/replay_detected/);
});
test('tampered payload and signature denied',async()=>{
 const adapter=store();
 await assert.rejects(acceptSignedEvidence({...make(),payload:'{}'},cfg(adapter)),/invalid_digest/);
 await assert.rejects(acceptSignedEvidence({...make(),signature:'0'.repeat(64)},cfg(adapter)),/invalid_signature/);
});
test('unknown source, absent durable adapter, forged organization denied',async()=>{
 await assert.rejects(acceptSignedEvidence({...make(),source:'unknown-source-001'},cfg(store())),/source_not_authorized/);
 await assert.rejects(acceptSignedEvidence(make(),cfg(undefined)),/durable_adapter_required/);
 const wrong=cfg(store());wrong.sources[source].approvedSourceOrganizations=[];
 await assert.rejects(acceptSignedEvidence(make(),wrong),/source_org_not_granted/);
});
test('stale and extra fields denied',async()=>{
 const adapter=store();
 await assert.rejects(acceptSignedEvidence({...make(),timestamp:now.getTime()-600000},cfg(adapter)),/stale_or_future_envelope/);
 await assert.rejects(acceptSignedEvidence({...make(),email:'secret'},cfg(adapter)),/unknown_envelope_fields/);
});
test('tampered metadata and replay with different payload rejected',async()=>{
 const adapter=store();const changed={...event,outcome:'fail'};
 await acceptSignedEvidence(make(),cfg(adapter));
 await assert.rejects(acceptSignedEvidence(make('nonce-00000003',changed),cfg(adapter)),/conflicting_duplicate/);
});
