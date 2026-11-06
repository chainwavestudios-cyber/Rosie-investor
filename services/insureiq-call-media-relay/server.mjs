import http from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {installDeepgramKeepAlive} from './keepalive.mjs';
import {notifyCoreDocSync} from './notifyDocSync.mjs';

const PORT=Number(process.env.PORT||10000);
const WS_URL=String(process.env.INSUREIQ_RELAY_WSS||'');
const SECRET=String(process.env.INSUREIQ_RELAY_SHARED_SECRET||'');
const DEEPGRAM=String(process.env.DEEPGRAM_API_KEY||'');
const APP_ORIGIN='https://underwriteriq-platform.base44.app';
const ROOT=APP_ORIGIN+'/api/apps/6ae799f05cb5944c6a12fce7/functions/';
const READY=WS_URL.startsWith('wss://')&&WS_URL.endsWith('/media')&&SECRET.length>=40&&DEEPGRAM.length>=20;
const MAX_MESSAGES=200000;
const now=()=>Date.now();
const trim=(x,max=140)=>String(x||'').slice(0,max);
const safeId=x=>/^(?:AC|CA|MZ)[a-f0-9]{32}$/i.test(x);
const dgUrl='wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&encoding=mulaw&sample_rate=8000&channels=1&interim_results=true&punctuate=true&smart_format=true&endpointing=300';
const server=http.createServer((req,res)=>{
 if(req.url==='/health'){
  res.writeHead(READY?200:503,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({ok:READY,relay:'insureiq-call-media',configured:READY,active_streams:active.size}));
 }else{res.writeHead(404);res.end('Not found')}
});
const wss=new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
const active=new Map();
server.on('upgrade',(req,socket,head)=>{
 if(!READY||req.url!=='/media'||!req.headers['x-twilio-signature']){
  socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;
 }
 if(active.size>=40){socket.write('HTTP/1.1 503 Busy\r\nConnection: close\r\n\r\n');socket.destroy();return}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
async function bridge(body,fn='insureRelayBridge'){
 const response=await fetch(ROOT+fn,{method:'POST',headers:{'content-type':'application/json','x-insureiq-relay-key':SECRET},
   body:JSON.stringify(body),signal:AbortSignal.timeout(17000)});
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw Error('Bridge '+fn+' failed (HTTP '+response.status+'): '+trim(json.error,110));
 return json;
}
function newConnection(t,conn){
 const socket=new WebSocket(dgUrl,{headers:{Authorization:'Token '+DEEPGRAM},handshakeTimeout:12000,
   perMessageDeflate:false,maxPayload:1048576});
 const part={ws:socket,track:t,ready:false,buffer:[],bufferBytes:0,finals:0,keepalive:null};
 socket.on('open',()=>{
  part.ready=true;
  part.keepalive=installDeepgramKeepAlive(socket);
  for(const b of part.buffer){part.keepalive.markAudio();socket.send(b,{binary:true})}
  part.buffer=[];part.bufferBytes=0;
 });
 socket.on('message',raw=>{
  if(conn.closed)return;
  let data;try{data=JSON.parse(String(raw))}catch{return}
  if(data.type!=='Results'||data.is_final!==true)return;
  const alt=data.channel?.alternatives?.[0],text=trim(alt?.transcript,7000).trim();
  if(!text)return;
  const seq=++conn.sequence;
  const packet={action:'segment',account_sid:conn.account,call_sid:conn.call,stream_sid:conn.stream,
    sequence:seq,track:t,start_seconds:Number(data.start)||0,end_seconds:(Number(data.start)||0)+(Number(data.duration)||0),text};
  conn.lastWrite=conn.lastWrite.then(()=>bridge(packet)).catch(e=>{conn.writeFailure=true;console.warn('Transcript write failure:',trim(e.message))});
  part.finals++;
 });
 socket.on('error',e=>{part.keepalive?.stop();conn.mediaFailure=true;console.warn('Deepgram session error:',trim(e.message))});
 socket.on('close',(code)=>{part.keepalive?.stop();if(!conn.closed&&code!==1000)conn.mediaFailure=true});
 return part;
}
async function complete(conn){
 if(conn.finalizing)return;conn.finalizing=true;
 if(conn.analysisTimer)clearInterval(conn.analysisTimer);
 for(const p of Object.values(conn.dg)){
  p.keepalive?.stop();
  if(p.ws.readyState===WebSocket.OPEN){
   try{p.ws.send(JSON.stringify({type:'Finalize'}))}catch{}
  }
 }
 await new Promise(resolve=>setTimeout(resolve,1700));
 for(const p of Object.values(conn.dg)){try{p.ws.close(1000)}catch{}}
 await conn.lastWrite;
 try{
  const stopped=await bridge({action:'stop',account_sid:conn.account,call_sid:conn.call,
    stream_sid:conn.stream,error:conn.mediaFailure||conn.writeFailure?'Incomplete media or transcript write':''});
  if(stopped.finalize&&stopped.session_id){
   await bridge({action:'relayFinish',session_id:stopped.session_id,
    duration_seconds:Math.round((now()-conn.started)/1000)},'liveIntelligence');
  }
 }catch(e){console.error('Relay stopped with pending review:',trim(e.message))}
 conn.closed=true;active.delete(conn.stream);
}
wss.on('connection',(twilio,req)=>{
 let conn=null,opening=false,closing=false,early=[];
 const handshake=trim(req.headers['x-twilio-signature'],200);
 const close=(code=1008)=>{try{twilio.close(code)}catch{}};
 const timer=setTimeout(()=>{if(!conn)close(1008)},10000);
 twilio.on('message',async raw=>{
  if(closing)return;
  let msg;try{msg=JSON.parse(String(raw))}catch{return close()}
  if(msg.event==='connected')return;
  if(msg.event==='start'&&!conn&&!opening){
   opening=true;
   const start=msg.start||{},account=trim(start.accountSid,45),call=trim(start.callSid,45),stream=trim(msg.streamSid,45);
   if(!safeId(account)||!safeId(call)||!safeId(stream)||active.has(stream))return close();
   try{
    const auth=await bridge({action:'authorize',account_sid:account,call_sid:call,twilio_signature:handshake,ws_url:WS_URL});
    // The Twilio stream can stop or disconnect while asynchronous authorization runs.
    // Do not create Deepgram sockets or register a session for a dead media connection.
    if(closing||twilio.readyState!==WebSocket.OPEN){clearTimeout(timer);early=[];return;}
    conn={account,call,stream,session:auth.session_id,agency:auth.agency_id,sequence:(Number(auth.next_sequence)||1)-1,started:now(),mediaCount:0,analysisBusy:false,analysisTimer:null,
      closed:false,finalizing:false,mediaFailure:false,writeFailure:false,lastWrite:Promise.resolve(),dg:{}};
    conn.dg.inbound=newConnection('inbound',conn);
    conn.dg.outbound=newConnection('outbound',conn);
    active.set(stream,conn);clearTimeout(timer);
    conn.analysisTimer=setInterval(async()=>{
      if(conn.finalizing||conn.closed||conn.sequence<2||conn.analysisBusy)return;
      conn.analysisBusy=true;
      try{await bridge({action:'relayAnalyze',session_id:conn.session},'liveIntelligence')}
      catch(e){console.warn('Live analysis pending:',trim(e.message))}
      finally{conn.analysisBusy=false}
    },30000);
    // Twilio may send its first frames while the server validates the signed start event.
    for(const event of early){const part=conn.dg[event.media?.track];if(!part)continue;
      const bytes=Buffer.from(String(event.media?.payload||''),'base64');
      if(bytes.length&&bytes.length<=5000&&part.bufferBytes+bytes.length<=160000){part.buffer.push(bytes);part.bufferBytes+=bytes.length}}
    early=[];
   }catch(e){console.warn('Rejected Twilio media connection:',trim(e.message));close()}
   return;
  }
  if(msg.event==='media'&&!conn&&opening){if(early.length<400)early.push(msg);else return close(1013);return;}
  if(msg.event==='media'&&conn&&!conn.finalizing){
   const track=msg.media?.track;
   if(!['inbound','outbound'].includes(track))return;
   const part=conn.dg[track];
   conn.mediaCount++;
   if(!part||conn.mediaCount>MAX_MESSAGES){conn.mediaFailure=true;return close(1009)}
   const bytes=Buffer.from(String(msg.media?.payload||''),'base64');
   if(bytes.length===0||bytes.length>5000)return;
   if(part.ready&&part.ws.readyState===WebSocket.OPEN){part.keepalive?.markAudio();part.ws.send(bytes,{binary:true});}
   else if(part.bufferBytes+bytes.length<=160000){part.buffer.push(bytes);part.bufferBytes+=bytes.length}
   else{conn.mediaFailure=true;return close(1013)}
  }
  if(msg.event==='stop'){closing=true;clearTimeout(timer);early=[];if(conn)await complete(conn);try{twilio.close(1000)}catch{}}
 });
 twilio.on('error',e=>console.warn('Twilio media connection error:',trim(e.message)));
 twilio.on('close',()=>{clearTimeout(timer);if(conn&&!conn.finalizing)complete(conn).catch(()=>{});});
});
server.listen(PORT,'0.0.0.0',()=>{
 console.log('InsureIQ media relay listening; configured='+READY);
 // Fail-open: documentation notification never delays or prevents serving calls.
 if(READY)void notifyCoreDocSync().catch(()=>{});
});