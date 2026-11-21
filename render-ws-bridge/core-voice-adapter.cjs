/* Isolated Rosie Core voice route: never shares Fronter/BOB session auth. */
const crypto=require('crypto');
module.exports.installRosieCoreVoice=({app,WebSocket,WebSocketServer,onStart,onAudio,onMark,onStop,deepgramReady})=>{
 const PATH='/core/ws',SECRET=process.env.CORE_ROSIE_STREAM_HMAC||'',
 RELAY=process.env.CORE_ROSIE_RELAY_AUTH||'';
 const enabled=SECRET.length>=32&&RELAY.length>=32&&!!deepgramReady;
 const wss=new WebSocketServer({noServer:true,path:PATH});
 const replay=new Map();
 const ready=()=>({ready:enabled,version:'rosie-core-voice-v1',
   providers:{deepgram:!!deepgramReady},scope:'core_only'});
 app.get('/core/runtime',(req,res)=>{
  if(!RELAY||req.headers.authorization!=='Bearer '+RELAY)return res.status(401).json({error:'unauthorized'});
  res.set('Cache-Control','no-store');
  return res.status(enabled?200:503).json(ready());
 });
 const validTicket=(signed,callSid)=>{
  if(!enabled)return null;
  const p=String(signed||'').split('.');
  if(p.length!==2||!/^[A-Za-z0-9_-]{32,1024}$/.test(p[0])||!/^[a-f0-9]{64}$/.test(p[1]))return null;
  const expected=crypto.createHmac('sha256',SECRET).update(p[0]).digest('hex');
  if(!crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(p[1],'hex')))return null;
  let item;try{item=JSON.parse(Buffer.from(p[0],'base64url').toString('utf8'))}catch{return null}
  const now=Math.floor(Date.now()/1000);
  if(!/^[\p{L}][\p{L}'-]{0,39}$/u.test(String(item?.first_name||''))||item?.app_key!=='rosie_core_vip'||item.call_sid!==callSid||!/^CA[a-f0-9]{32}$/i.test(callSid)||
     !Number.isInteger(item.issued_at)||!Number.isInteger(item.expires_at)||
     item.issued_at>now+30||item.expires_at<now||item.expires_at>item.issued_at+90)return null;
  for(const [k,exp] of replay)if(exp<now)replay.delete(k);
  if(replay.has(p[1])||replay.size>3000)return null;
  replay.set(p[1],item.expires_at);
  return item;
 };
 wss.on('connection',(ws)=>{
  if(!enabled){ws.close(1013,'Core voice unavailable');return}
  let sid='',initialized=false,callSid='';
  const guard=setTimeout(()=>{if(!initialized)ws.close(1008,'signed Core start required')},5000);
  guard.unref?.();let durationTimer=null;
  ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true});
  ws.on('message',raw=>{
   let m;try{m=JSON.parse(raw.toString())}catch{return}
   if(m.event==='connected')return;
   if(!initialized){
    if(m.event!=='start')return;
    const start=m.start||{};
    const verified=/^MZ[a-f0-9]{32}$/i.test(start.streamSid||'')?validTicket(start.customParameters?.coreTicket,start.callSid):null;
    if(!verified){
     clearTimeout(guard);ws.close(1008,'invalid Core ticket');return;
    }
    initialized=true;clearTimeout(guard);sid=start.streamSid;callSid=start.callSid;
    onStart(ws,sid,{streamSid:sid,callSid,customParameters:{core:true,leadId:'rosie_core_vip',firstName:verified.first_name}});
    durationTimer=setTimeout(()=>{if(ws.readyState===WebSocket.OPEN)ws.close(1000,'Core test time limit')},300000);
    durationTimer.unref?.();
    return;
   }
   if(m.streamSid!==sid)return;
   if(m.event==='media'&&m.media?.payload&&m.media.track!=='outbound')onAudio(sid,m.media.payload);
   if(m.event==='mark')onMark(sid,m.mark);
   if(m.event==='stop')onStop(sid);
  });
  ws.on('close',()=>{clearTimeout(guard);if(durationTimer)clearTimeout(durationTimer);if(sid)onStop(sid)});
  ws.on('error',()=>{});
 });
 return {wss,path:PATH,ready};
};