import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorkerHost} from '../worker-host.mjs';

async function health(env){
 const {server}=makeWorkerHost(env);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const r=await fetch('http://127.0.0.1:'+server.address().port+'/health');
  assert.equal(r.status,200);
  return r.json();
 }finally{await new Promise(resolve=>server.close(resolve));}
}
test('disabled worker host is alive but never claims certification',async()=>{
 const status=await health({RACP_AGENT_ID:'A02',RACP_WORKER_ENABLED:'false'});
 assert.equal(status.process_alive,true);
 assert.equal(status.worker_enabled,false);
 assert.equal(status.configured,false);
 assert.equal(status.certified,false);
});
test('even a configured worker host does not self-certify',async()=>{
 const status=await health({
  RACP_WORKER_ENABLED:'true',RACP_AGENT_ID:'A05',
  RACP_WORKER_ID:'worker-agent05',
  RACP_GATEWAY_URL:'https://gateway.example/',
  RACP_EXECUTOR_URL:'https://executor.example/v1/execute',
  RACP_WORKER_HMAC_KEY:'a'.repeat(64),
  RACP_EXECUTOR_TOKEN:'b'.repeat(64)
 });
 assert.equal(status.configured,true);
 assert.equal(status.certified,false);
});
