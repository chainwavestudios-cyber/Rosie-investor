const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const {installRosieCoreVoice}=require('./core-voice-adapter.cjs');
class MockWss extends EventEmitter{constructor(){super();this.clients=new Set()}}
class MockWs extends EventEmitter{constructor(){super();this.readyState=1;this.closed=null}close(code,reason){this.closed={code,reason};this.emit('close')}}
test('Core route requires a signed, call-scoped, one-time ticket and isolated callbacks',()=>{
 const prev={s:process.env.CORE_ROSIE_STREAM_HMAC,r:process.env.CORE_ROSIE_RELAY_AUTH};
 process.env.CORE_ROSIE_STREAM_HMAC='s'.repeat(40);
 process.env.CORE_ROSIE_RELAY_AUTH='r'.repeat(40);
 try{
  const app={routes:{},get(path,cb){this.routes[path]=cb}},starts=[];
  const handler=installRosieCoreVoice({app,WebSocket:{OPEN:1},WebSocketServer:MockWss,deepgramReady:true,
   onStart:(...args)=>starts.push(args),onAudio:()=>{},onMark:()=>{},onStop:()=>{}});
  assert.equal(handler.path,'/core/ws');assert.equal(handler.ready().ready,true);
  const streamSid='MZ'+'1'.repeat(32),callSid='CA'+'2'.repeat(32),now=Math.floor(Date.now()/1000);
  const payload=Buffer.from(JSON.stringify({app_key:'rosie_core_vip',call_sid:callSid,first_name:'Ada',issued_at:now,expires_at:now+60})).toString('base64url');
  const sig=crypto.createHmac('sha256',process.env.CORE_ROSIE_STREAM_HMAC).update(payload).digest('hex');
  const m={event:'start',start:{streamSid,callSid,customParameters:{coreTicket:payload+'.'+sig}}};
  const authorized=new MockWs();handler.wss.emit('connection',authorized);authorized.emit('message',Buffer.from(JSON.stringify(m)));
  assert.equal(starts.length,1);assert.equal(starts[0][2].customParameters.core,true);
  assert.equal(starts[0][2].customParameters.firstName,'Ada');
  const replay=new MockWs();handler.wss.emit('connection',replay);replay.emit('message',Buffer.from(JSON.stringify(m)));
  assert.equal(replay.closed.code,1008);
  const altered=new MockWs();handler.wss.emit('connection',altered);
  altered.emit('message',Buffer.from(JSON.stringify({...m,start:{...m.start,callSid:'CA'+'3'.repeat(32)}})));
  assert.equal(altered.closed.code,1008);
 }finally{
  if(prev.s===undefined)delete process.env.CORE_ROSIE_STREAM_HMAC;else process.env.CORE_ROSIE_STREAM_HMAC=prev.s;
  if(prev.r===undefined)delete process.env.CORE_ROSIE_RELAY_AUTH;else process.env.CORE_ROSIE_RELAY_AUTH=prev.r;
 }
});
test('Core runtime requires a distinct server-side bearer and fails closed',()=>{
 const oldS=process.env.CORE_ROSIE_STREAM_HMAC,oldR=process.env.CORE_ROSIE_RELAY_AUTH;
 delete process.env.CORE_ROSIE_STREAM_HMAC;delete process.env.CORE_ROSIE_RELAY_AUTH;
 try{
  const app={routes:{},get(path,cb){this.routes[path]=cb}};
  const handler=installRosieCoreVoice({app,WebSocket:{OPEN:1},WebSocketServer:MockWss,deepgramReady:true,onStart:()=>{},onAudio:()=>{},onMark:()=>{},onStop:()=>{}});
  assert.equal(handler.ready().ready,false);
  const response={status(c){this.code=c;return this},json(v){this.value=v;return this},set(){return this}};
  app.routes['/core/runtime']({headers:{}},response);
  assert.equal(response.code,401);
 }finally{if(oldS===undefined)delete process.env.CORE_ROSIE_STREAM_HMAC;else process.env.CORE_ROSIE_STREAM_HMAC=oldS;if(oldR===undefined)delete process.env.CORE_ROSIE_RELAY_AUTH;else process.env.CORE_ROSIE_RELAY_AUTH=oldR}
});