import test from 'node:test';
import assert from 'node:assert/strict';
import {completeJob} from '../worker.mjs';

const cfg={
 gateway:'https://gateway.example',executor:'https://executor.example/v1/execute',
 agent:'A05',worker:'worker-agent05',hmac:'a'.repeat(64),
 token:'b'.repeat(64),org:'rosie-core-internal'
};
const job={
 agent_id:'A05',job_id:'22222222-2222-4222-8222-222222222222',
 event_id:'33333333-3333-4333-8333-333333333333',
 fencing_token:7,event:{event_type:'rcis.message',ticket_key:null,payload:{task:'verify'}}
};
const reply=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
test('real reply is persisted before the source worker can finish',async()=>{
 const old=globalThis.fetch;const paths=[];
 globalThis.fetch=async url=>{
  const path=new URL(url).pathname;paths.push(path);
  if(path==='/v1/execute')
   return reply(200,{status:'completed',provider:'anthropic',provider_response_id:'msg_abc123456789',result_text:'genuine provider reply',
    reply:{recipient_agent_id:'A02',payload:{answer:'verified'}}});
  if(path==='/v1/worker/result')return reply(200,{accepted:true,durable_commit:true,result_ref:'core:jobs/id',result_sha256:'hash'});
  if(path==='/v1/worker/reply')return reply(202,{accepted:true,durable_commit:true,delivery_ack:'ack1'});
  return reply(200,{accepted:true,execution_receipt:'ack2'});
 };
 try{
  const done=await completeJob(cfg,job);
  assert.equal(done.accepted,true);
  assert.deepEqual(paths,[
   '/v1/worker/heartbeat','/v1/execute','/v1/worker/result',
   '/v1/worker/reply','/v1/worker/finish']);
 }finally{globalThis.fetch=old;}
});
test('missing durable reply ACK prevents false completion',async()=>{
 const old=globalThis.fetch;const paths=[];
 globalThis.fetch=async url=>{
  const path=new URL(url).pathname;paths.push(path);
  if(path==='/v1/execute')
   return reply(200,{status:'completed',provider:'anthropic',provider_response_id:'msg_abc123456789',result_text:'genuine provider reply',
    reply:{recipient_agent_id:'A02',payload:{answer:'verified'}}});
  if(path==='/v1/worker/result')return reply(200,{accepted:true,durable_commit:true,result_ref:'core:jobs/id',result_sha256:'hash'});
  if(path==='/v1/worker/reply')return reply(503,{accepted:false});
  return reply(200,{accepted:true});
 };
 try{
  await assert.rejects(()=>completeJob(cfg,job),/reply_not_durably_committed/);
  assert.equal(paths.includes('/v1/worker/finish'),false);
 }finally{globalThis.fetch=old;}
});
test('executor must provide verifiable provider receipt',async()=>{
 const old=globalThis.fetch;const paths=[];
 globalThis.fetch=async url=>{
  const path=new URL(url).pathname;paths.push(path);
  if(path==='/v1/execute')return reply(200,{status:'completed',result_ref:'not-core'});
  return reply(200,{accepted:true});
 };
 try{
  await assert.rejects(()=>completeJob(cfg,job),/executor_has_no_verified_provider_output/);
  assert.equal(paths.includes('/v1/worker/finish'),false);
 }finally{globalThis.fetch=old;}
});
