/* Isolated InsureIQ BOB audio adapter for the shared Rosie/Fronter Render bridge.
 * Reuses the managed Deepgram audio engine, never Fronter/commercial BOB callbacks.
 * Opt-in via INSUREIQ_BOB_ENABLED; no provider key reaches a browser.
 */
'use strict';
const crypto=require('node:crypto');
const ROUTE='/insureiq/bob/ws',RUNTIME='/insureiq/bob/runtime';
const APP_ORIGIN='https://underwriteriq-platform.base44.app';
const CALLBACK=APP_ORIGIN+'/functions/insureBobVoiceRelay';
const MAX_SESSIONS=12;
function installInsureIqBobTransport({app,WebSocket,WebSocketServer,deepgramKey,startPlainBobAgent,now=Date.now,request=fetch}){
 if(!app||!WebSocket||!WebSocketServer||typeof startPlainBobAgent!=='function')throw Error('InsureIQ audio dependencies missing');
 const secret=process.env.INSUREIQ_BOB_SESSION_SECRET||'';
 const callbackKey=process.env.INSUREIQ_BOB_APP_AUTH_TOKEN||'';
 const runtimeKey=process.env.INSUREIQ_BOB_PLAY_AUTH_TOKEN||'';
 const endpoint=process.env.INSUREIQ_BOB_APP_WEBHOOK_URL||'';
 const origins=new Set((process.env.INSUREIQ_BOB_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean));
 const enabled=process.env.INSUREIQ_BOB_ENABLED==='true';
 const active=new Map(),replays=new Map();
 const wss=new WebSocketServer({noServer:true,path:ROUTE});
 function ready(){
  const checks={enabled,secret:secret.length>=32,callbackToken:callbackKey.length>=24,
   runtimeToken:runtimeKey.length>=24,callback:endpoint===CALLBACK,
   origin:origins.size===1&&origins.has(APP_ORIGIN),deepgram:!!deepgramKey};
  return {ready:Object.values(checks).every(Boolean),checks};
 }
 app.get(RUNTIME,(req,res)=>{
  if(!runtimeKey||req.headers.authorization!=='Bearer '+runtimeKey)
   return res.status(401).json({error:'unauthorized'});
  res.set('Cache-Control','no-store');
  const r=ready();
  return res.status(r.ready?200:503).json({version:'insureiq-bob-voice-v1',
   ready:r.ready,checks:r.checks,activeSessions:active.size,credentials:{deepgram:!!deepgramKey}});
 });
 async function relay(event,ticket,body={}){
  if(!ready().ready)throw Error('InsureIQ BOB disabled');
  const reqBody={event,app_key:'insureiq_bob',session_id:ticket.session_id,
   agency_id:ticket.agency_id,owner_id:ticket.owner_id,nonce:ticket.nonce,...body};
  const res=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json',
   Authorization:'Bearer '+callbackKey},body:JSON.stringify(reqBody),
   signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error('InsureIQ BOB callback '+event+' HTTP '+res.status);
  return res.json();
 }
 function verifyTicket(value){
  const [payload,mac,...extra]=String(value||'').split('.');
  if(extra.length||!/^[\w-]+$/.test(payload||'')||!/^[a-f0-9]{64}$/.test(mac||''))
   throw Error('Malformed ticket');
  const expected=crypto.createHmac('sha256',secret).update(payload).digest();
  if(!crypto.timingSafeEqual(expected,Buffer.from(mac,'hex')))throw Error('Ticket signature invalid');
  const t=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')),n=Math.floor(now()/1000);
  const validId=x=>typeof x==='string'&&/^[\w.-]{8,130}$/.test(x);
  if(t.app_key!=='insureiq_bob'||!validId(t.agency_id)||!validId(t.owner_id)||!validId(t.session_id)||
    t.mode_id!=='plain'||!Number.isSafeInteger(t.issued_at)||!Number.isSafeInteger(t.expires_at)||
    t.issued_at>n+30||t.expires_at<n||t.expires_at>t.issued_at+90||
    t.expires_at>n+90||!validId(t.nonce))throw Error('InsureIQ ticket not authorized');
  for(const [key,until] of replays)if(until<n)replays.delete(key);
  if(replays.has(mac))throw Error('InsureIQ ticket replay');
  if(replays.size>2000)throw Error('InsureIQ replay cache full');
  replays.set(mac,t.expires_at);
  return t;
 }
 function send(ws,payload){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(payload))}
 wss.on('connection',(ws,req)=>{
  if(!ready().ready){ws.close(1013,'InsureIQ BOB disabled or unconfigured');return}
  if(!origins.has(req.headers.origin||'')){ws.close(1008,'InsureIQ origin rejected');return}
  if(active.size>=MAX_SESSIONS){ws.close(1013,'InsureIQ BOB capacity reached');return}
  let ticket=null,agent=null,accepted=false,finished=false,sequence=0;
  let transcriptQueue=Promise.resolve();
  const authTimer=setTimeout(()=>{if(!accepted)ws.close(1008,'InsureIQ ticket required')},5000);
  let sessionTimer=null;
  function finish(){
   if(finished)return;finished=true;clearTimeout(authTimer);if(sessionTimer)clearTimeout(sessionTimer);
   if(agent)agent.finish();
   if(ticket)active.delete(ticket.session_id);
  }
  ws.on('message',async raw=>{
   let msg;
   try{if(Buffer.byteLength(raw)>65536)return;msg=JSON.parse(raw.toString())}catch{return}
   if(!accepted){
    if(msg.event!=='start'||ticket)return;
    try{
     const claim=verifyTicket(msg.ticket);
     if(claim.session_id!==msg.sessionId||claim.agency_id!==msg.organizationId)
      throw Error('InsureIQ agency/session binding mismatch');
     if(active.has(claim.session_id))throw Error('Duplicate InsureIQ session');
     ticket=claim;
     const init=await relay('init',claim);
     if(init?.serviceTier!=='plain'||init?.voiceAgentSettings?.agent?.think?.provider?.type!=='google')
      throw Error('InsureIQ managed training settings not authorized');
     if(ws.readyState!==WebSocket.OPEN)return;
     const report=async body=>relay(body.event,claim,body.event==='usage'?{usage:body.usage}:body.event==='stop'?{duration_seconds:body.durationSeconds||0}:{});
     const emit=payload=>{
      if(payload.event==='bob_transcript'&&typeof payload.text==='string'){
       const s=++sequence;
       const role=payload.role==='user'?'agent':'customer';
       transcriptQueue=transcriptQueue.then(()=>relay('transcript',claim,
        {sequence:s,role,text:payload.text.slice(0,2500)})).catch(()=>{});
      }
      send(ws,payload);
     };
     agent=startPlainBobAgent({browser:ws,sessionId:claim.session_id,settings:init.voiceAgentSettings,
      apiKey:deepgramKey,WebSocket,emit,reportUsage:report,
      reportStop:async body=>{await transcriptQueue;return report(body)},
      onExit:()=>active.delete(claim.session_id)});
     accepted=true;clearTimeout(authTimer);
     active.set(claim.session_id,{agencyId:claim.agency_id,startedAt:now()});
     sessionTimer=setTimeout(()=>{try{ws.close(1000,'InsureIQ practice time limit')}catch{}},
      Math.max(60,Math.min(1200,Number(claim.max_session_seconds)||600))*1000);
     send(ws,{event:'accepted',sessionId:claim.session_id,codec:'mulaw',sampleRate:8000});
    }catch(e){ws.close(1008,'InsureIQ BOB authentication failed')}
    return;
   }
   if(msg.sessionId!==ticket.session_id)return;
   if(msg.event==='audio'&&typeof msg.payload==='string'&&msg.payload.length<=32768&&
     /^[A-Za-z0-9+/=]+$/.test(msg.payload))agent?.audio(msg.payload);
   if(msg.event==='stop'){finish();try{ws.close(1000,'InsureIQ practice ended')}catch{}}
  });
  ws.on('close',finish);
  ws.on('error',()=>finish());
 });
 return {path:ROUTE,runtimePath:RUNTIME,wss,ready,shutdown(){
  for(const ws of wss.clients)try{ws.close(1001,'server_shutdown')}catch{}
  for(const item of active.values())void item;
 }};
}
module.exports={installInsureIqBobTransport,ROUTE,RUNTIME};
