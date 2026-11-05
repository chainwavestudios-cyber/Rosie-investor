const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {EventEmitter}=require('node:events');
const crypto=require('node:crypto');
const vm=require('node:vm');
const SECRET='s'.repeat(64);
const ORIGIN='https://bob-staging.example';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function ticket({org='org-A',session='session-1',mode,expiry=Math.floor(Date.now()/1000)+60}={}){
 const obj={app_key:'bob',org_id:org,session_id:session,seat_id:'seat-test',...(mode?{mode_id:mode}:{}),
  issued_at:Math.floor(Date.now()/1000),expires_at:expiry,nonce:'nonce-'+session};
 const encoded=Buffer.from(JSON.stringify(obj)).toString('base64url');
 return encoded+'.'+crypto.createHmac('sha256',SECRET).update(encoded).digest('hex');
}
function setup(overrides={}){
 const servers=new Map(),calls=[],targets=[],routes=new Map(),managedCalls=[],managedAudio=[],managedStops=[];
 const app={use(){},get(path,fn){routes.set(path,fn)},post(){}};const express=()=>app;express.json=()=>()=>{};
 class WSServer extends EventEmitter{constructor({path}){super();this.clients=new Set();servers.set(path,this)}}
 class WS extends EventEmitter{static OPEN=1;constructor(){super();this.readyState=1;this.isAlive=true;this.sent=[]}
  send(m){this.sent.push(JSON.parse(m))}
  close(code,reason){this.closed={code,reason};this.readyState=3;this.emit('close',code,Buffer.from(reason))}
  ping(){}terminate(){}
 }
 const ctx={require(name){if (name === './insureiq-bob-adapter.cjs') return {installInsureIqBobTransport(){return {path:'/insureiq/bob/ws',wss:{clients:new Set(),on(){}}}}}; if(name==='./managed-voice-agent.cjs')return {startPlainBobAgent(args){managedCalls.push(args);return {audio(payload){managedAudio.push(payload)},finish(){managedStops.push(args.sessionId)}}}};if(name==='express')return express;if(name==='http')return {createServer: () => ({ listen() {}, close() {}, on() {} })};if(name==='ws')return {WebSocket:WS,WebSocketServer:WSServer};if(name==='crypto')return crypto;throw Error(name)},
  process:{env:{NODE_ENV:'development',APP_WEBHOOK_URL:'https://fronter.invalid/functions/mediaStreamRelay',
   APP_AUTH_TOKEN:'legacy-fronter-token-0123456789',
   BOB_BRIDGE_ENABLED:'true',BOB_APP_WEBHOOK_URL:'https://bob.invalid/functions/bobMediaRelay',
   BOB_APP_AUTH_TOKEN:'bob-callback-token-0123456789',
   BOB_PLAY_AUTH_TOKEN:'bob-runtime-token-0123456789',
   BOB_BRIDGE_SESSION_SECRET:SECRET,BOB_ALLOWED_ORIGINS:ORIGIN,DEEPGRAM_API_KEY:'simulated-deepgram-test-key',
   ...overrides},on(){}},   
  console:{log(){},debug(){}},URL,URLSearchParams,AbortSignal,Date,Buffer,
  setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},
  fetch:async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);targets.push({url:_url,authorization:options.headers.Authorization});
   return {ok:true,status:200,json:async()=>body.event==='init'?body.streamSid==='session-plain'?{
    serviceTier:'plain',voiceAgentSettings:{type:'Settings',audio:{input:{encoding:'mulaw',sample_rate:8000},output:{encoding:'mulaw',sample_rate:8000}},agent:{think:{provider:{type:'google',model:'gemini-2.5-flash'}}}}}:
    {pipeline:{valid:true,version:'selector-runtime-v1',sttModel:'nova-3',ttsEngine:'deepgram-aura'},greeting:''}:{ok:true}}},
 };
 vm.runInNewContext(readFileSync(join(__dirname,'server.js'),'utf8'),ctx);
 const connect=(origin=ORIGIN)=>{const ws=new WS();servers.get('/bob/ws').emit('connection',ws,{headers:{origin}});return ws};
 const connectTwilio=()=>{const ws=new WS();servers.get('/ws').emit('connection',ws);return ws};
 const startTwilio=(ws)=>ws.emit('message',Buffer.from(JSON.stringify({event:'start',start:{streamSid:'MZ-fronter',callSid:'CA-fronter',customParameters:{leadId:'lead-fronter'}}})));
 const start=(ws,{token=ticket(),org='org-A',session='session-1',prompt='Practice only'}={})=>
  ws.emit('message',Buffer.from(JSON.stringify({event:'start',ticket:token,sessionId:session,organizationId:org,trainingPrompt:prompt})));
 return {servers,calls,targets,routes,context:ctx,connect,start,connectTwilio,startTwilio,managedCalls,managedAudio,managedStops};
}
test('browser adapter uses separate /bob/ws; Twilio transport remains on /ws',()=>{
 const h=setup();assert.ok(h.servers.has('/ws'));assert.ok(h.servers.has('/bob/ws'));
});
test('signed session tickets authenticate and keep organization ID out of investor lead records',async()=>{
 const h=setup(),ws=h.connect();h.start(ws);await settle();
 assert.equal(ws.closed,undefined);assert.equal(ws.sent[0].event,'accepted');
 assert.equal(ws.sent[0].codec,'mulaw');assert.equal(ws.sent[0].sampleRate,8000);
 const init=h.calls.find(x=>x.event==='init');assert.equal(init.leadId,'session-1');
 assert.equal(init.trainingPrompt,'Practice only');assert.ok(!('streamToken' in init));
 assert.equal(h.targets[0].url,'https://bob.invalid/functions/bobMediaRelay');
 assert.equal(h.targets[0].authorization,'Bearer ' + 'bob-callback-token-0123456789');
});
test('cross-tenant org mismatch is rejected before relay invocation',async()=>{
 const h=setup(),ws=h.connect();h.start(ws,{org:'org-B'});await settle();
 assert.equal(ws.closed.code,1008);assert.equal(h.calls.length,0);
});
test('expired ticket is rejected',async()=>{
 const h=setup(),ws=h.connect();h.start(ws,{token:ticket({expiry:Math.floor(Date.now()/1000)-1})});
 await settle();assert.equal(ws.closed.code,1008);assert.equal(h.calls.length,0);
});
test('tampered signature is rejected',async()=>{
 const h=setup(),ws=h.connect(),valid=ticket(),invalid=valid.slice(0,-2)+'ab';
 h.start(ws,{token:invalid});await settle();assert.equal(ws.closed.code,1008);
});
test('ticket replay is rejected on same staging process',async()=>{
 const h=setup(),valid=ticket(),first=h.connect();h.start(first,{token:valid});await settle();
 const second=h.connect();h.start(second,{token:valid});await settle();
 assert.equal(first.closed,undefined);assert.equal(second.closed.code,1008);
});
test('unexpected browser origin is rejected even with a valid ticket',()=>{
 const h=setup(),ws=h.connect('https://attacker.example');assert.equal(ws.closed.code,1008);
});
test('unauthenticated browser audio cannot reach Deepgram or relay',async()=>{
 const h=setup(),ws=h.connect();
 ws.emit('message',Buffer.from(JSON.stringify({event:'audio',sessionId:'session-1',payload:'//8='})));
 await settle();assert.equal(h.calls.length,0);assert.equal(ws.sent.length,0);
});

test('shared Render leaves the Fronter /ws callback and credential untouched',async()=>{
 const h=setup();const ws=h.connectTwilio();h.startTwilio(ws);await settle();
 const call=h.calls.find(v=>v.event==='init'&&v.streamSid==='MZ-fronter');
 assert.ok(call,'legacy investor call must still initialize');
 assert.equal(h.targets.find(v=>v.url.includes('mediaStreamRelay'))?.url,
  'https://fronter.invalid/functions/mediaStreamRelay');
 assert.equal(h.targets.find(v=>v.url.includes('mediaStreamRelay'))?.authorization,
  'Bearer ' + 'legacy-fronter-token-0123456789');
 assert.equal(call.trainingPrompt,undefined);
});

test('BOB callback cannot fall through to Fronter when BOB is disabled',async()=>{
 const h=setup({BOB_BRIDGE_ENABLED:'false'});
 const ws=h.connect();
 assert.equal(ws.closed?.code,1013);assert.equal(h.calls.length,0);
 const legacy=h.connectTwilio();h.startTwilio(legacy);await settle();
 assert.equal(h.targets[0]?.url,'https://fronter.invalid/functions/mediaStreamRelay');
});

test('BOB callback rejects an invalid or missing BOB-only backend URL',async()=>{
 for (const endpoint of ['', 'https://fronter.invalid/functions/mediaStreamRelay','http://bob.invalid/functions/bobMediaRelay']){
   const h=setup({BOB_APP_WEBHOOK_URL:endpoint});
   const ws=h.connect();
   assert.equal(ws.closed?.code,1013,'BOB must stay disabled for '+endpoint);
   assert.equal(h.calls.length,0);
 }
});

test('terminal BOB receipts route to BOB even after stream removal',async()=>{
 const h=setup();
 const res=await h.context.callRelay({event:'stop',streamSid:'ended-session',
  _bobTransport:true,callSid:'ended-session',leadId:'ended-session',recordingBase64:''});
 assert.ok(res);
 assert.equal(h.targets[0]?.url,'https://bob.invalid/functions/bobMediaRelay');
 assert.equal(h.targets[0]?.authorization,'Bearer ' + 'bob-callback-token-0123456789');
 assert.equal(h.calls[0]._bobTransport,undefined);
});

test('separate runtime diagnostics do not accept each other’s tokens',()=>{
 const h=setup();
 const makeRes=()=>({code:200,headers:{},status(n){this.code=n;return this},set(n,v){this.headers[n]=v;return this},
   json(v){this.body=v;return this}});
 const bob=h.routes.get('/bob/runtime'),investor=h.routes.get('/runtime');
 assert.ok(bob);assert.ok(investor);
 const denied=makeRes();bob({headers:{authorization:'Bearer ' + 'wrong-bob-runtime-token'}},denied);
 assert.equal(denied.code,401);
 const accepted=makeRes();bob({headers:{authorization:'Bearer ' + 'bob-runtime-token-0123456789'}},accepted);
 assert.equal(accepted.code,200);assert.equal(accepted.body.ready,true);
 assert.ok(Array.isArray(accepted.body.calls));
 const invDenied=makeRes();investor({headers:{authorization:'Bearer ' + 'bob-runtime-token-0123456789'}},invDenied);
 assert.equal(invDenied.code,401);
});
