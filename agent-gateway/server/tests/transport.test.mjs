import test from 'node:test';
import assert from 'node:assert/strict';
import {cfg,send,receiveOnce} from '../transport.mjs';
const options={RACP_AGENT_ID:'A05',RACP_WORKER_HMAC_KEY:'k'.repeat(64),
 RACP_GATEWAY_URL:'https://gateway.example/',RACP_MESSAGING_ENABLED:'true'};
const response=(status,body)=>({ok:status<400,status,json:async()=>body});
test('transport is independent of AI execution config',()=>{
 const c=cfg(options);
 assert.equal(c.valid,true);
 assert.equal(c.enabled,true);
 assert.equal(cfg({...options,RACP_MESSAGING_ENABLED:'false'}).enabled,false);
 assert.equal(cfg({...options,RACP_WORKER_HMAC_KEY:''}).valid,false);
});
test('signed agent send uses zero model calls and durable commit receipt',async()=>{
 const urls=[];const calls=async(url,opt)=>{
  urls.push(url);const x=JSON.parse(opt.body);
  assert.equal(x.agent_id,'A05');assert.equal(x.recipient_agent_id,'A02');
  assert.equal(x.kind,'probe');
  assert.match(opt.headers['x-rosie-signature'],/^sha256=[0-9a-f]{64}$/);
  return response(202,{accepted:true,durable_commit:true,delivery_ack:'123'});
 };
 const sent=await send(cfg(options),{recipient:'A02',kind:'probe',message:'A05 is online'},calls);
 assert.deepEqual(urls,['https://gateway.example/v1/agent/send']);
 assert.equal(sent.ack.durable_commit,true);
});
test('A02 replies before recording its receipt; A05 only acknowledges',async()=>{
 const calls=[];
 const data={event_id:'22222222-2222-4222-8222-222222222222',
  sender:'A05',payload:{contract:'rosie.core.rcis.transport.v1',kind:'probe',
   trace_id:'33333333-3333-4333-8333-333333333333'}};
 const fake=async(url,opt)=>{
  const p=new URL(url).pathname;calls.push(p);const x=JSON.parse(opt.body);
  if(p==='/v1/agent/inbox')return response(200,{messages:[data]});
  if(p==='/v1/agent/send'){
   assert.equal(x.recipient_agent_id,'A05');assert.equal(x.kind,'probe_ack');
   assert.equal(x.reply_to,data.event_id);
   return response(202,{accepted:true,durable_commit:true,delivery_ack:'ack'});
  }
  if(p==='/v1/agent/ack')return response(200,{accepted:true,durable_commit:true});
  throw Error('unexpected route');
 };
 await receiveOnce(cfg({...options,RACP_AGENT_ID:'A02'}),fake);
 assert.deepEqual(calls,['/v1/agent/inbox','/v1/agent/send','/v1/agent/ack']);
});
test('no delivery acknowledgement when receiver has not committed it',async()=>{
 const fake=async(url)=>new URL(url).pathname==='/v1/agent/inbox'?
  response(200,{messages:[{event_id:'22222222-2222-4222-8222-222222222222',sender:'A02',
  payload:{contract:'rosie.core.rcis.transport.v1',kind:'probe_ack'}}]}):
  response(503,{error:'unavailable'});
 await assert.rejects(()=>receiveOnce(cfg(options),fake),/transport_http_503/);
});
