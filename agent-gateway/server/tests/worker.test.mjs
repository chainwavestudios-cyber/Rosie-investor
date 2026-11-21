import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {signedHeaders,validateConfig} from '../worker.mjs';

const config={
 RACP_WORKER_ENABLED:'true',
 RACP_GATEWAY_URL:'https://rosie-core-agent-gateway-staging.onrender.com',
 RACP_EXECUTOR_URL:'https://internal.example.test/v1/execute',
 RACP_AGENT_ID:'A02',RACP_WORKER_ID:'worker-agent02',
 RACP_WORKER_HMAC_KEY:'a'.repeat(48),
 RACP_EXECUTOR_TOKEN:'b'.repeat(48)
};
test('worker refuses startup by default',()=>{
 assert.throws(()=>validateConfig({...config,RACP_WORKER_ENABLED:'false'}),/worker_explicitly_disabled/);
});
test('worker rejects noncanonical identities',()=>{
 const previous=process.env.RACP_AGENT_ID;
 Object.assign(process.env,config,{RACP_AGENT_ID:'agent2-sim'});
 try { assert.throws(()=>validateConfig(process.env),/invalid_canonical_agent_id/); }
 finally {if(previous===undefined)delete process.env.RACP_AGENT_ID;else process.env.RACP_AGENT_ID=previous;}
});
test('worker requires authenticated HTTPS executor with real callback path',()=>{
 Object.assign(process.env,config);
 assert.throws(()=>validateConfig({...process.env,RACP_EXECUTOR_URL:'http://example.test/v1/execute'}),/https_required/);
 assert.throws(()=>validateConfig({...process.env,RACP_EXECUTOR_URL:'https://example.test/'}),/executor_explicit_path_required/);
});
test('worker signs byte-exact method/path/timestamp/body',()=>{
 const raw=JSON.stringify({nonce:'abc',worker_id:'worker-agent02'});
 const headers=signedHeaders('x'.repeat(48),'POST','/v1/worker/claim',raw);
 const expected='sha256='+crypto.createHmac('sha256','x'.repeat(48))
 .update('POST\n/v1/worker/claim\n'+headers['x-rosie-timestamp']+'\n'+raw).digest('hex');
 assert.equal(headers['x-rosie-signature'],expected);
});
