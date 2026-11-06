import assert from 'node:assert/strict';
import {installDeepgramKeepAlive} from './keepalive.mjs';
let tick=1000,frames=[],open=1;
const socket={get readyState(){return open},send(s){frames.push(s)}};
const service=installDeepgramKeepAlive(socket,{now:()=>tick,intervalMs:4000});
try{
 assert.equal(service.pulse(),false,'should not send while audio is current');
 tick=5001;assert.equal(service.pulse(),true);
 assert.equal(frames.length,1);assert.equal(frames[0],JSON.stringify({type:'KeepAlive'}));
 service.markAudio();assert.equal(service.pulse(),false);
 tick=9002;open=3;assert.equal(service.pulse(),false,'closed socket must not receive messages');
 open=1;service.stop();assert.equal(service.pulse(),false,'cleaned up interval must not send');
 console.log('PASS Deepgram silence keepalive, audio reset and cleanup');
}finally{service.stop()}