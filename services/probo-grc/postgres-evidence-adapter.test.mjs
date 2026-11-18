import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresEvidenceAdapter } from './postgres-evidence-adapter.mjs';
const data={replayKey:'rosie-core-staging:nonce-00000001',dedupeKey:'probo-org-001:core:source-event-001',envelopeDigest:'a'.repeat(64),
record:{source:'rosie-core-staging',proboOrgId:'probo-org-001',receivedAt:'2026-11-18T14:00:00.000Z',event:{contract:'rosie.grc.evidence.v1'}}};
function pool({failReplay=false,duplicate=false,conflict=false}={}) {
 const logs=[],client={
 async query(sql,params) {
  logs.push({sql,params});
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK') return {rowCount:0,rows:[]};
  if(sql.includes('replay_nonce')) return {rowCount:failReplay?0:1,rows:[]};
  if(sql.includes('INSERT INTO rosie_grc_bridge.evidence_inbox'))return{rowCount:duplicate?0:1,rows:[]};
  if(sql.includes('SELECT receipt_id'))return{rowCount:1,rows:[{receipt_id:'receipt-old-123456',envelope_digest:conflict?'b'.repeat(64):data.envelopeDigest}]};
  throw Error('unexpected_sql');
 },release(){logs.push({sql:'RELEASE'});}};
 return {logs,connect:async()=>client};
}
test('accepted receipt commits and releases',async()=>{
 const p=pool();const r=await postgresEvidenceAdapter(p).commitUnique(data);
 assert.equal(r.status,'accepted');assert.match(r.receiptId,/^receipt-/);
 assert.deepEqual(p.logs.map(x=>x.sql).filter(x=>['BEGIN','COMMIT','ROLLBACK','RELEASE'].includes(x)),['BEGIN','COMMIT','RELEASE']);
});
test('same event new nonce returns durable duplicate receipt',async()=>{
 const p=pool({duplicate:true});
 const r=await postgresEvidenceAdapter(p).commitUnique(data);
 assert.deepEqual(r,{status:'duplicate',receiptId:'receipt-old-123456'});
});
test('nonce replay aborts transaction and releases',async()=>{
 const p=pool({failReplay:true});
 await assert.rejects(postgresEvidenceAdapter(p).commitUnique(data),/replay_detected/);
 assert.ok(p.logs.some(x=>x.sql==='ROLLBACK'));
 assert.ok(p.logs.some(x=>x.sql==='RELEASE'));
});
test('changed payload on existing event aborts transaction',async()=>{
 const p=pool({duplicate:true,conflict:true});
 await assert.rejects(postgresEvidenceAdapter(p).commitUnique(data),/conflicting_duplicate/);
 assert.ok(p.logs.some(x=>x.sql==='ROLLBACK'));
});
test('invalid input never checks out a connection',async()=>{
 const p=pool();
 await assert.rejects(postgresEvidenceAdapter(p).commitUnique({...data,envelopeDigest:'x'}),/invalid_envelope_digest/);
 assert.equal(p.logs.length,0);
});
