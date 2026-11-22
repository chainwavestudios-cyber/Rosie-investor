import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID,createHmac} from 'node:crypto';
import {auditIngress,relayAuditAssignment} from '../audit-relay.mjs';

const ticket='rwt-'+'a'.repeat(32),scope={ticket,trace:randomUUID()},key='q'.repeat(64);
function stable(label){
 const b=createHash('sha256').update('core-v1:'+label+':rosie-core-internal:'+ticket+':A05').digest();
 b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;
 const h=b.toString('hex');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20,32)].join('-');
}
const event={org_id:'rosie-core-internal',agent_id:'A05',sender:'rosie_core',event_type:'ticket.assigned',
 ticket_key:ticket,event_id:stable('event'),nonce:stable('nonce'),payload:{priority:'P2',ticket_key:ticket,source:'core_verified_ticket'}};
test('dedicated signer accepts only the canonical event, nonce, recipient and exact bounded payload',()=>{
 assert.ok(auditIngress(event,scope));
 for(const changed of [{event_id:randomUUID()},{nonce:randomUUID()},{agent_id:'A02'},{payload:{...event.payload,prompt:'other'}}])
   assert.equal(auditIngress({...event,...changed},scope),false);
 assert.equal(auditIngress(event,null),false);
});
test('relay forwards Core-issued bytes and requires a matching durable acknowledgement',async()=>{
 const body=JSON.stringify(event),timestamp=String(Math.floor(Date.now()/1000));
 const signature='sha256='+createHmac('sha256',key).update(['POST','/v1/events',timestamp,body].join('\n')).digest('hex');
 let calls=0;
 const request=async(url,opts)=>{
  calls++;
  if(calls===1){assert.equal(new URL(url).hostname,'core.rosieai.tech');return Response.json({body,signature,timestamp,nonce:JSON.parse(opts.body).nonce});}
  assert.equal(url,'http://127.0.0.1:10000/v1/events');assert.equal(opts.body,body);
  assert.equal(opts.headers['x-rosie-signature'],signature);return Response.json({accepted:true,durable_commit:true,event_id:event.event_id,delivery_ack:randomUUID()});
 };
 assert.equal((await relayAuditAssignment({scope,key,port:10000,request})).event_id,event.event_id);
});
