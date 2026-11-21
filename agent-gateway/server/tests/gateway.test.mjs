import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {authentic,signature,validateEvent,validateReply} from '../server.mjs';
const KEY='t'.repeat(64);
const body=JSON.stringify({agent_id:'A04',event_type:'ticket.assigned'});
const ts=String(Math.floor(Date.now()/1000));
const req=(path='/v1/events',timestamp=ts,source=body,key=KEY)=>({
 method:'POST',headers:{
  'x-rosie-timestamp':timestamp,
  'x-rosie-signature':signature(key,'POST',path,timestamp,source)
 }
});
const event=()=>({org_id:'rosie-core-internal',agent_id:'A04',
 event_id:crypto.randomUUID(),nonce:crypto.randomUUID(),
 sender:'rosie_core',event_type:'ticket.assigned',
 ticket_key:'rwt-'+'a'.repeat(32),payload:{checkpoint_ref:'core:checkpoint/A04/1'}});
test('correct signed request is accepted',()=>{
 assert.equal(authentic(req(),'/v1/events',body,KEY),true);
});
test('wrong path, body, secret and stale timestamp fail closed',()=>{
 const good=req();
 assert.equal(authentic(good,'/v1/worker/claim',body,KEY),false);
 assert.equal(authentic(good,'/v1/events',body+' ',KEY),false);
 assert.equal(authentic(good,'/v1/events',body,'x'.repeat(64)),false);
 const stale=String(Number(ts)-500);
 assert.equal(authentic(req('/v1/events',stale),'/v1/events',body,KEY),false);
});
test('browser origin and malformed HMAC fail closed',()=>{
 const request=req();request.headers.origin='https://bad.example';
 assert.equal(authentic(request,'/v1/events',body,KEY),false);
 request.headers.origin=undefined;request.headers['x-rosie-signature']='sha256=invalid';
 assert.equal(authentic(request,'/v1/events',body,KEY),false);
});
test('internal event validation pins tenant and known role address',()=>{
 const e=event();
 assert.equal(validateEvent(e),true);
 assert.equal(validateEvent({...e,org_id:'another-tenant'}),false);
 assert.equal(validateEvent({...e,agent_id:'A99999'}),false);
 assert.equal(validateEvent({...e,event_type:'deploy.production'}),false);
 assert.equal(validateEvent({...e,secret:'unallowed'}),false);
});

test('agent-to-agent reply requires a current fenced job and distinct canonical recipient',()=>{
 const valid={org_id:'rosie-core-internal',agent_id:'A05',
  worker_id:'worker-agent05',job_id:crypto.randomUUID(),
  fencing_token:1,nonce:crypto.randomUUID(),event_id:crypto.randomUUID(),
  recipient_agent_id:'A02',ticket_key:null,payload:{type:'task_result',ok:true}};
 assert.equal(validateReply(valid),true);
 assert.equal(validateReply({...valid,recipient_agent_id:'A05'}),false);
 assert.equal(validateReply({...valid,recipient_agent_id:'agent2-sim'}),false);
 assert.equal(validateReply({...valid,fencing_token:0}),false);
 assert.equal(validateReply({...valid,worker_id:'xx'}),false);
 assert.equal(validateReply({...valid,payload:{text:'x'.repeat(3501)}}),false);
 assert.equal(validateReply({...valid,unexpected:true}),false);
});
