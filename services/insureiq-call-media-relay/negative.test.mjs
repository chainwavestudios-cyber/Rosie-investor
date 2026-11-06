import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import {WebSocket} from 'ws';

const port=24000+Math.floor(Math.random()*5000);
const url='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port),INSUREIQ_RELAY_WSS:'',INSUREIQ_RELAY_SHARED_SECRET:'',DEEPGRAM_API_KEY:''},stdio:['ignore','pipe','pipe']});
const output=[];
child.stderr.on('data',x=>output.push(String(x)));
try{
 let response;
 for(let i=0;i<40;i++){
  try{response=await fetch(url+'/health');break}catch{await sleep(100)}
 }
 assert.ok(response,'Relay must start');
 assert.equal(response.status,503,'Unconfigured relay must fail health');
 const health=await response.json();
 assert.equal(health.ok,false);
 assert.equal(health.configured,false);
 const invalid=await fetch(url+'/any-other-path');
 assert.equal(invalid.status,404,'Unexpected routes must not be exposed');
 const upgrade=await new Promise((resolve,reject)=>{
  const socket=new WebSocket('ws://127.0.0.1:'+port+'/media');
  socket.once('unexpected-response',(_,res)=>resolve(res.statusCode));
  socket.once('error',reject);
  setTimeout(()=>reject(Error('No rejection from unconfigured relay')),1200);
 });
 assert.equal(upgrade,403,'WebSocket without credentials must be rejected');
 console.log('PASS 1: unconfigured relay reports HTTP 503 (not ready)');
 console.log('PASS 2: unsupported HTTP routes return 404');
 console.log('PASS 3: unauthenticated WebSocket upgrade rejected with 403');
}finally{child.kill('SIGTERM');await Promise.race([once(child,'exit'),sleep(1000)]).catch(()=>{});}