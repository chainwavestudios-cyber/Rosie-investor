'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {EventEmitter}=require('node:events');
const {installInsureIqBobTransport,ROUTE,RUNTIME}=require('./insureiq-bob-adapter.cjs');
const ORIGIN='https://underwriteriq-platform.base44.app';
const SECRET='S'.repeat(48);
class WSS extends EventEmitter{
 constructor(options){super();this.options=options;this.clients=new Set()}
}
class WS extends EventEmitter{
 static OPEN=1;
 constructor(){super();this.readyState=1;this.sent=[];this.isAlive=true}
 send(x){this.sent.push(JSON.parse(x))}
 close(code,reason){this.readyState=3;this.closed={code,reason};this.emit('close')}
}
function makeTicket({agency_id='agency-123456789',session_id='session-123456789',
 owner_id='owner-123456789',app_key='insureiq_bob',mode_id='plain',expiresAt}={}){
 const now=Math.floor(Date.now()/1000);
 const encoded=Buffer.from(JSON.stringify({app_key,agency_id,owner_id,session_id,mode_id,
  issued_at:now,expires_at:expiresAt||now+60,nonce:'nonce-123456789',max_session_seconds:90})).toString('base64url');
 return encoded+'.'+crypto.createHmac('sha256',SECRET).update(encoded).digest('hex');
}
function harness(config={}){
 const original={};
 const env={INSUREIQ_BOB_ENABLED:'true',INSUREIQ_BOB_SESSION_SECRET:SECRET,
  INSUREIQ_BOB_APP_AUTH_TOKEN:'isolated-callback-token-0123456789',
  INSUREIQ_BOB_PLAY_AUTH_TOKEN:'isolated-runtime-token-0123456789',
  INSUREIQ_BOB_APP_WEBHOOK_URL:ORIGIN+'/functions/insureBobVoiceRelay',
  INSUREIQ_BOB_ALLOWED_ORIGINS:ORIGIN,...config};
 for(const k of Object.keys(env)){original[k]=process.env[k];process.env[k]=env[k]}
 const routes=new Map(),calls=[],started=[],usage=[],stops=[],responses=[];
 const app={get(p,fn){routes.set(p,fn)}};
 const request=async(url,options)=>{
  const data=JSON.parse(options.body);calls.push({url,auth:options.headers.Authorization,...data});
  return {ok:true,json:async()=>data.event==='init'?{serviceTier:'plain',
   voiceAgentSettings:{agent:{think:{provider:{type:'google'}}}}}:{ok:true}};
 };
 const startPlainBobAgent=args=>{
  started.push(args);
  return {audio(data){usage.push(data)},finish(){stops.push(args.sessionId);
   args.reportUsage({event:'usage',usage:{service:'bob_training',provider:'deepgram',
    audioSeconds:30,providerUnitType:'websocket_connection_seconds_unreconciled',requestId:'provider-'+args.sessionId}});
   args.reportStop({event:'stop',durationSeconds:30}).catch(()=>{});
   args.onExit?.(args.sessionId);
  }};
 };
 const api=installInsureIqBobTransport({app,WebSocket:WS,WebSocketServer:WSS,
  deepgramKey:'synthetic-deepgram-key',startPlainBobAgent,request});
 const connect=origin=>{const ws=new WS();api.wss.emit('connection',ws,{headers:{origin:origin||ORIGIN}});return ws};
 const send=(ws,obj)=>ws.emit('message',Buffer.from(JSON.stringify(obj)));
 const start=(ws,token=makeTicket(),org='agency-123456789')=>send(ws,{event:'start',
  sessionId:'session-123456789',organizationId:org,ticket:token});
 const restore=()=>{for(const [k,v] of Object.entries(original)){if(v===undefined)delete process.env[k];else process.env[k]=v}};
 return {api,connect,send,start,calls,started,usage,stops,routes,restore};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('InsureIQ route and diagnostics stay independent from Fronter and commercial BOB',()=>{
 const h=harness();try{
  assert.equal(ROUTE,'/insureiq/bob/ws');
  assert.equal(RUNTIME,'/insureiq/bob/runtime');
  assert.ok(h.api.wss.options.path===ROUTE);
  assert.equal(h.api.ready().ready,true);
  assert.ok(!h.routes.has('/bob/runtime'));assert.ok(!h.routes.has('/runtime'));
 }finally{h.restore()}
});
test('InsureIQ runtime diagnostics require own token',()=>{
 const h=harness();try{
  const res=()=>({statusCode:200,status(code){this.statusCode=code;return this},set(){return this},json(data){this.data=data;return this}});
  const fn=h.routes.get(RUNTIME),bad=res(),good=res();
  fn({headers:{authorization:'Bearer wrong'}},bad);assert.equal(bad.statusCode,401);
  fn({headers:{authorization:'Bearer isolated-runtime-token-0123456789'}},good);
  assert.equal(good.statusCode,200);assert.equal(good.data.ready,true);
  assert.equal(good.data.activeSessions,0);
 }finally{h.restore()}
});
test('authorized session uses only InsureIQ relay and managed Deepgram',async()=>{
 const h=harness();try{
  const ws=h.connect();h.start(ws);await settle();
  assert.equal(ws.closed,undefined);
  assert.equal(ws.sent[0]?.event,'accepted');
  assert.equal(h.started.length,1);
  assert.equal(h.calls[0].url,ORIGIN+'/functions/insureBobVoiceRelay');
  assert.equal(h.calls[0].agency_id,'agency-123456789');
  assert.equal(h.calls[0].owner_id,'owner-123456789');
  assert.equal(h.calls[0].app_key,'insureiq_bob');
  assert.equal(h.calls[0].auth,'Bearer isolated-callback-token-0123456789');
  h.send(ws,{event:'audio',sessionId:'session-123456789',payload:'/w=='});
  assert.equal(h.usage.length,1);
  h.started[0].emit({event:'bob_transcript',role:'user',text:'What are my choices?'});
  await settle();
  assert.equal(h.calls.find(c=>c.event==='transcript')?.role,'agent');
  h.send(ws,{event:'stop',sessionId:'session-123456789'});await settle();
  assert.ok(h.calls.find(c=>c.event==='usage'));
  assert.ok(h.calls.find(c=>c.event==='stop'));
  assert.equal(h.api.ready().ready,true);
 }finally{h.restore()}
});
test('cross-agency ticket mismatch rejected before callback',async()=>{
 const h=harness();try{
  const ws=h.connect();h.start(ws,makeTicket(),'different-agency-123456');await settle();
  assert.equal(ws.closed.code,1008);assert.equal(h.calls.length,0);
 }finally{h.restore()}
});
test('commercial BOB ticket cannot authorize InsureIQ',async()=>{
 const h=harness();try{
  const ws=h.connect();h.start(ws,makeTicket({app_key:'bob'}));await settle();
  assert.equal(ws.closed.code,1008);assert.equal(h.calls.length,0);
 }finally{h.restore()}
});
test('wrong origin rejected before signature is checked',()=>{
 const h=harness();try{
  const ws=h.connect('https://bob-training-intelligence-8019bf2b.base44.app');
  assert.equal(ws.closed.code,1008);assert.equal(h.calls.length,0);
 }finally{h.restore()}
});
test('missing key or disabled mode fails closed without touching other routes',()=>{
 const h=harness({INSUREIQ_BOB_ENABLED:'false'});
 try{assert.equal(h.api.ready().ready,false);assert.equal(h.connect().closed.code,1013);assert.equal(h.calls.length,0)}
 finally{h.restore()}
});
test('ticket replay is rejected for a second session',async()=>{
 const h=harness();try{
  const token=makeTicket(),one=h.connect();h.start(one,token);await settle();
  const second=h.connect();h.start(second,token);await settle();
  assert.equal(one.closed,undefined);assert.equal(second.closed.code,1008);
  assert.equal(h.calls.filter(c=>c.event==='init').length,1);
 }finally{h.restore()}
});
