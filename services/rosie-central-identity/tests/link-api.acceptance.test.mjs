import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createRosieLinkRouter} from '../link-api.mjs';
import {opaque,sha,signedProductHeaders} from '../link-contract.mjs';

const key='synthetic-rosie-link-service-secret-for-only-test-001';
const payload={product:'bob',organizationId:'a'.repeat(24),productPrincipalId:'b'.repeat(24)};
let server,endpoint;
const challenges=new Map(),nonce=new Set(),links=new Map();
const db={
 async connect(){return{query:query,release(){}}},
 query
};
async function query(sql,args=[]){
 const done=(rows=[])=>({rowCount:rows.length,rows});
 if(/^(BEGIN|COMMIT|ROLLBACK)/.test(sql))return done();
 if(sql.includes('INSERT INTO rosie_identity_link.product_nonce')){
  const id=args[0]+'|'+args[1];if(nonce.has(id))return done();
  nonce.add(id);return done([{request_nonce:args[1]}]);
 }
 if(sql.includes('INSERT INTO rosie_identity_link.link_challenge')){
  challenges.set(args[0],{challenge_hash:args[0],product_key:args[1],organization_id:args[2],
   product_principal_id:args[3],approved_at:null,approved_subject:null,redeemed_at:null,
   expires_at:new Date(Date.now()+180000)});
  return done();
 }
 if(sql.includes('SELECT * FROM rosie_identity_link.link_challenge'))
  return done(challenges.has(args[0])?[challenges.get(args[0])]:[]);
 if(sql.includes('SELECT central_subject,state FROM rosie_identity_link.linked_seat')){
  const p=args.join(':');return done(links.has(p)?[links.get(p)]:[]);
 }
 if(sql.includes('INSERT INTO rosie_identity_link.linked_seat')){
  links.set(args.slice(0,3).join(':'),{central_subject:args[3],state:'verified'});return done();
 }
 if(sql.includes('UPDATE rosie_identity_link.link_challenge SET redeemed_at=now()')){
  challenges.get(args[0]).redeemed_at=new Date();return done();
 }
 if(sql.includes('INSERT INTO rosie_identity_link.link_audit'))return done();
 if(sql.includes('SELECT * FROM rosie_identity_link.mfa_stepup'))return done();
 throw Error('Unexpected SQL in test: '+sql.slice(0,140));
}
async function signAndPost(path,data,{freshNonce=opaque(),secret=key,product='bob',timestamp=Date.now()}={}){
 const body=JSON.stringify(data);
 const headers={
  'Content-Type':'application/json',
  ...signedProductHeaders({path,body,nonce:freshNonce,secret,product,timestamp})
 };
 const r=await fetch(endpoint+path,{method:'POST',headers,body});
 return {status:r.status,data:await r.json(),headers};
}
test.before(async()=>{
 process.env.ROSIE_LINK_BOB_SHARED_KEY=key;
 const app=express();
 app.use('/api/links',createRosieLinkRouter({pool:db,auth:{api:{getSession:async()=>null}}}));
 await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve)});
 endpoint='http://127.0.0.1:'+server.address().port;
});
test.after(async()=>{delete process.env.ROSIE_LINK_BOB_SHARED_KEY;
 await new Promise(resolve=>server.close(resolve))});
let approvedCode='';
test('untrusted browsers and unregistered product credentials cannot prepare',async()=>{
 const r=await fetch(endpoint+'/api/links/prepare',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 assert.equal(r.status,401);
 const wrong=await signAndPost('/api/links/prepare',payload,{secret:'untrusted'.repeat(6)});
 assert.equal(wrong.status,401);
});
test('a signed product principal receives a single 3-minute opaque challenge',async()=>{
 const r=await signAndPost('/api/links/prepare',payload);
 assert.equal(r.status,201);
 assert.equal(r.data.approved,false);
 assert.equal(r.data.expiresInSeconds,180);
 assert.match(r.data.approvalUrl,/^https:\/\/rosie-central-identity-staging\.onrender\.com\/link\/approve\?code=/);
 approvedCode=r.data.challenge;
 assert.equal(challenges.has(sha(approvedCode)),true);
 assert.equal(Object.hasOwn(r.data,'centralSubject'),false);
});
test('same signed nonce cannot prepare twice, even with matching claims',async()=>{
 const n=opaque();
 assert.equal((await signAndPost('/api/links/prepare',payload,{freshNonce:n})).status,201);
 const same=await signAndPost('/api/links/prepare',payload,{freshNonce:n});
 assert.equal(same.status,409);
 assert.equal(same.data.error,'signed_request_replayed');
});
test('email-selected tenant roles and unsignatured body modifications cannot grant access',async()=>{
 const withEmail=await signAndPost('/api/links/prepare',{...payload,email:'owner@example.invalid'});
 assert.equal(withEmail.status,400);
 const p=JSON.stringify({...payload,organizationId:'c'.repeat(24)});
 const validBody=JSON.stringify(payload);
 const h=signedProductHeaders({path:'/api/links/prepare',body:validBody,
  nonce:opaque(),timestamp:Date.now(),product:'bob',secret:key});
 const bad=await fetch(endpoint+'/api/links/prepare',{method:'POST',headers:{'Content-Type':'application/json',...h},body:p});
 assert.equal(bad.status,401);
});
test('no redemption until central user has explicitly approved via fresh TOTP',async()=>{
 const r=await signAndPost('/api/links/redeem',{...payload,challenge:approvedCode});
 assert.equal(r.status,403);
 assert.equal(r.data.error,'unapproved_expired_or_consumed_challenge');
});
test('verified approval may redeem once; replay and conflicting organizations are rejected',async()=>{
 const row=challenges.get(sha(approvedCode));
 row.approved_subject='verified-synthetic-central-user-001';
 row.approved_at=new Date();
 const denied=await signAndPost('/api/links/redeem',{...payload,organizationId:'d'.repeat(24),challenge:approvedCode});
 assert.equal(denied.status,403);
 const ok=await signAndPost('/api/links/redeem',{...payload,challenge:approvedCode});
 assert.equal(ok.status,200);
 assert.equal(ok.data.centralSubject,row.approved_subject);
 assert.equal(ok.data.verified,true);
 assert.equal(links.get([payload.product,payload.organizationId,payload.productPrincipalId].join(':')).central_subject,row.approved_subject);
 const replay=await signAndPost('/api/links/redeem',{...payload,challenge:approvedCode});
 assert.equal(replay.status,403);
});
test('central preview and approval require a signed-in Rosie user, not product HMAC',async()=>{
 const preview=await fetch(endpoint+'/api/links/preview?code='+approvedCode);
 assert.equal(preview.status,401);
 const req=await fetch(endpoint+'/api/links/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge:approvedCode})});
 assert.equal(req.status,403);
});
