'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {startPlainBobAgent}=require('./managed-voice-agent.cjs');
const sessionId='session-plain-test';
const config={type:'Settings',audio:{input:{encoding:'mulaw',sample_rate:8000},output:{encoding:'mulaw',sample_rate:8000,container:'none'}},
 agent:{listen:{provider:{type:'deepgram',version:'v2',model:'flux-general-en'}},
 think:{provider:{type:'google',model:'gemini-2.5-flash'},prompt:'Fictional test buyer'},
 speak:{provider:{type:'deepgram',version:'v2',model:'flux-hannah-en'}},greeting:'Hello'}};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const emitted=[],usage=[],stops=[],wsClients=[];let nowMs=1000;
 class FakeDeepgram extends EventEmitter{
  static OPEN=1;constructor(url,options){super();this.url=url;this.options=options;this.sent=[];this.readyState=1;wsClients.push(this)}
  send(data,opt){this.sent.push({data,options:opt})}close(){this.readyState=3;}
 }
 const browser={send(){},close(){}};
 const agent=startPlainBobAgent({browser,sessionId,settings:structuredClone(config),
  apiKey:'inert-test-only-deepgram',WebSocket:FakeDeepgram,
  emit:x=>emitted.push(x),reportUsage:async x=>usage.push(x),reportStop:async x=>stops.push(x),
  now:()=>nowMs});
 const upstream=wsClients[0];upstream.emit('open');
 const message=x=>upstream.emit('message',Buffer.from(JSON.stringify(x)),false);
 return {agent,upstream,emitted,usage,stops,message,setTime:n=>nowMs=n};
}
test('managed Google Gemini runs inside Deepgram with no browser API key',()=>{
 const h=harness();assert.equal(h.upstream.url,'wss://agent.deepgram.com/v1/agent/converse');
 assert.equal(h.upstream.options.headers.Authorization,'Token inert-test-only-deepgram');
 h.message({type:'Welcome',request_id:'req-managed-001'});
 const msg=JSON.parse(h.upstream.sent[0].data);
 assert.equal(msg.agent.think.provider.type,'google');
 assert.equal(msg.agent.think.provider.model,'gemini-2.5-flash');
 assert.equal(msg.agent.think.endpoint,undefined);
 assert.equal(msg.agent.speak.provider.model,'flux-hannah-en');
 assert.equal(JSON.stringify(msg).includes('inert-test-only-deepgram'),false);
 assert.equal(h.emitted.length,0);
});
test('settings handshake buffers two seconds of mulaw; browser gets binary playback and transcript',()=>{
 const h=harness();h.upstream.emit('open');
 const audio=Buffer.alloc(160,128).toString('base64');
 h.agent.audio(audio);
 assert.equal(h.upstream.sent.length,0,'no audio before SettingsApplied');
 h.message({type:'Welcome'});h.message({type:'SettingsApplied'});
 assert.equal(h.upstream.sent.length,2);
 assert.deepEqual(h.upstream.sent[1].data,Buffer.alloc(160,128));
 h.message({type:'ConversationText',role:'user',content:'hello'});
 h.message({type:'ConversationText',role:'assistant',content:'buyer response'});
 h.upstream.emit('message',Buffer.from([0,1,2,3]),true);
 h.message({type:'UserStartedSpeaking'});
 h.message({type:'AgentAudioDone'});
 assert.equal(h.emitted.find(x=>x.event==='bob_transcript'&&x.role==='user')?.text,'hello');
 assert.equal(h.emitted.find(x=>x.event==='bob_transcript'&&x.role==='bob')?.text,'buyer response');
 assert.equal(h.emitted.find(x=>x.event==='media')?.media.payload,Buffer.from([0,1,2,3]).toString('base64'));
 assert.equal(h.emitted.filter(x=>x.event==='clear').length,1);
 assert.equal(h.emitted.filter(x=>x.event==='mark').length,1);
});
test('the managed package records one connection-time receipt, not separate STT, TTS and LLM costs',async()=>{
 const h=harness();h.message({type:'Welcome',request_id:'req-v1'});h.message({type:'SettingsApplied'});
 h.setTime(61000);h.agent.finish();h.agent.finish();
 await settle();await settle();
 assert.equal(h.usage.length,1);assert.equal(h.stops.length,1);
 assert.equal(h.usage[0].usage.service,'bob_training');
 assert.equal(h.usage[0].usage.provider,'deepgram');
 assert.equal(h.usage[0].usage.providerUnitType,'websocket_connection_seconds_unreconciled');
 assert.equal(h.usage[0].usage.audioSeconds,60);
 assert.equal(h.usage[0].usage.providerCostStatus,'unavailable');
 assert.equal(h.stops[0]._bobTransport,true);
});
test('rejects any model configured with a bring-your-own Gemini endpoint',()=>{
 for(const value of [
  {...config,agent:{...config.agent,think:{provider:{type:'google',model:'gemini-2.5-flash'},endpoint:{url:'https://example.com'}}}},
  {...config,agent:{...config.agent,think:{provider:{type:'anthropic',model:'gemini-2.5-flash'}}}}
 ])assert.throws(()=>startPlainBobAgent({browser:{send(){}},sessionId,settings:value,apiKey:'dummy',WebSocket:class {}}),/managed Deepgram/);
});
