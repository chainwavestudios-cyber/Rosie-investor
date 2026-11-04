/* Managed Plain BOB transport via Deepgram Voice Agent.
 * A single managed Deepgram connection handles Flux listen + Google Gemini
 * think + Flux speak. No separate Gemini key or LLM/TTS HTTP provider call.
 * This module never exposes DEEPGRAM_API_KEY to the browser.
 */
'use strict';
const DEEPGRAM_AGENT_URL='wss://agent.deepgram.com/v1/agent/converse';
function startPlainBobAgent({browser,sessionId,settings,apiKey,WebSocket,emit,reportUsage,reportStop,onExit,now=Date.now}){
 if(!browser||typeof browser.send!=='function'||!apiKey)throw Error('Authorized browser and Deepgram credential required');
 if(!settings||settings.type!=='Settings'||
    settings.agent?.think?.provider?.type!=='google'||
    settings.agent?.think?.provider?.model!=='gemini-2.5-flash'||
    settings.agent?.think?.endpoint||settings.agent?.think?.provider?.endpoint)
    throw Error('Plain BOB requires managed Deepgram Google thinking model');
 if(settings.audio?.input?.encoding!=='mulaw'||settings.audio?.input?.sample_rate!==8000||
    settings.audio?.output?.encoding!=='mulaw'||settings.audio?.output?.sample_rate!==8000)
    throw Error('Plain BOB browser codec must be 8kHz mulaw');
 const upstream=new WebSocket(DEEPGRAM_AGENT_URL,{headers:{Authorization:'Token '+apiKey}});
 let startedAt=null,ready=false,finished=false,settingsSent=false,requestId='';
 let buffered=[],bufferedSize=0;
 const maxBufferBytes=16000; // 2 seconds of 8kHz mulaw, never an unbounded audio queue
 const error=(reason)=>{
  if(finished)return;
  emit({event:'bob_error',message:String(reason||'Deepgram Voice Agent unavailable').slice(0,180)});
  finish();
  try{browser.close(1011,'Deepgram agent unavailable')}catch{}
 };
 const sendToUpstream=(buf)=>{if(upstream.readyState===WebSocket.OPEN)upstream.send(buf,{binary:true})};
 upstream.on('open',()=>{startedAt=now()});
 upstream.on('message',(data,isBinary)=>{
  if(finished)return;
  if(isBinary){if(ready)emit({event:'media',streamSid:sessionId,media:{payload:Buffer.from(data).toString('base64')}});return}
  let msg;try{msg=JSON.parse(String(data))}catch{return}
  if(msg.type==='Welcome'){
   if(settingsSent)return;
   settingsSent=true;requestId=String(msg.request_id||'').slice(0,130);
   upstream.send(JSON.stringify(settings));return;
  }
  if(msg.type==='SettingsApplied'){
   ready=true;
   for(const chunk of buffered)sendToUpstream(chunk);
   buffered=[];bufferedSize=0;
   return;
  }
  if(msg.type==='ConversationText' && typeof msg.content==='string'){
   emit({event:'bob_transcript',role:msg.role==='user'?'user':'bob',text:msg.content.slice(0,2500)});return;
  }
  if(msg.type==='UserStartedSpeaking'){emit({event:'clear',streamSid:sessionId});return}
  if(msg.type==='AgentAudioDone'){emit({event:'mark',streamSid:sessionId,mark:{name:'managed-deepgram-playback-complete'}});return}
  if(msg.type==='Error'){error('Deepgram Voice Agent returned '+String(msg.code||'error').slice(0,50));return}
 });
 upstream.on('error',()=>error('Deepgram managed Voice Agent connection failed'));
 upstream.on('close',()=>{if(!finished)error('Deepgram managed Voice Agent connection closed')});
 function audio(payload){
  if(finished)return;
  if(typeof payload!=='string'||payload.length>32768||!(/^[A-Za-z0-9+/=]+$/).test(payload))return;
  const chunk=Buffer.from(payload,'base64');
  if(!chunk.length||chunk.length>16384)return;
  if(!ready){
   // Drop earliest audio once 2 seconds is buffered to bound memory use.
   while(bufferedSize+chunk.length>maxBufferBytes&&buffered.length)bufferedSize-=buffered.shift().length;
   if(chunk.length<=maxBufferBytes){buffered.push(chunk);bufferedSize+=chunk.length}
   return;
  }
  sendToUpstream(chunk);
 }
 function finish(){
  if(finished)return;
  finished=true;
  const endedAt=now();
  const duration=startedAt===null?0:Math.max(0,(endedAt-startedAt)/1000);
  buffered=[];bufferedSize=0;
  try{upstream.close()}catch{}
  Promise.resolve().then(async()=>{
   if(startedAt!==null){
    try{await reportUsage({event:'usage',streamSid:sessionId,leadId:sessionId,callSid:sessionId,
      _bobTransport:true,usage:{service:'bob_training',provider:'deepgram',
      model:'voice-agent-standard-google-gemini-2.5-flash',providerRequestId:requestId,
      audioSeconds:duration,providerUnits:duration,providerUnitType:'websocket_connection_seconds_unreconciled',
      requestId:'managed-voice-agent:'+sessionId,providerCostStatus:'unavailable'}})}
    catch {/* Reporting failure is visible in authenticated bridge telemetry; no settled charge is inferred */ }
   }
   try{await reportStop({event:'stop',streamSid:sessionId,leadId:sessionId,callSid:sessionId,
     _bobTransport:true,durationSeconds:Math.round(duration),conversation:[],recordingBase64:''})}
   catch {/* No cross-product fallback */ }
   onExit?.(sessionId);
  }).catch(()=>onExit?.(sessionId));
 }
 return {audio,finish,get ready(){return ready},get requestId(){return requestId}};
}
module.exports={DEEPGRAM_AGENT_URL,startPlainBobAgent};
