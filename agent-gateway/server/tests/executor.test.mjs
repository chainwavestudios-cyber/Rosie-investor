import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExecutor,validateTask} from '../executor.mjs';
const TOKEN='t'.repeat(64),KEY='k'.repeat(64);
const cfg={RACP_EXECUTOR_ENABLED:'true',RACP_AGENT_ID:'A05',
  RACP_EXECUTOR_TOKEN:TOKEN,OPENAI_API_KEY:KEY};
const task={
 contract:'rosie.core.worker.task.v1',
 agent_id:'A05',job_id:'22222222-2222-4222-8222-222222222222',
 fencing_token:1,event:{event_type:'rcis.message',
  payload:{prompt:'Provide a short status',reply_to:'A02',hops_remaining:2}}
};
async function serve(env,modelFetch,fn){
 const server=makeExecutor({env,modelFetch});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{return await fn('http://127.0.0.1:'+server.address().port);}
 finally{await new Promise(resolve=>server.close(resolve));}
}
test('executor never invokes a model while not explicitly enabled',async()=>{
 let calls=0;
 await serve({...cfg,RACP_EXECUTOR_ENABLED:'false'},async()=>{calls++;},async base=>{
  const r=await fetch(base+'/v1/execute',{method:'POST',headers:{authorization:'Bearer '+TOKEN},body:JSON.stringify(task)});
  assert.equal(r.status,503);assert.equal(calls,0);
 });
});
test('executor requires matching agent bearer token',async()=>{
 await serve(cfg,async()=>{throw Error('must not call provider');},async base=>{
  const r=await fetch(base+'/v1/execute',{method:'POST',headers:{authorization:'Bearer incorrect'},body:JSON.stringify(task)});
  assert.equal(r.status,401);
 });
});
test('real provider ID and text returned with one bounded agent reply',async()=>{
 let calls=0;
 await serve(cfg,async(url,options)=>{
  calls++;
  assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(options.headers.authorization,'Bearer '+KEY);
  const req=JSON.parse(options.body);
  assert.equal(req.model,'gpt-6-luna');
  assert.equal(req.reasoning.effort,'none');
  assert.equal(req.store,false);
  return {ok:true,json:async()=>({id:'resp_123456789abcdef',output:[{type:'message',content:[{type:'output_text',text:'Completed analysis only'}]}]})};
 },async base=>{
  const r=await fetch(base+'/v1/execute',{method:'POST',
   headers:{authorization:'Bearer '+TOKEN},body:JSON.stringify(task)});
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.provider,'openai');
  assert.equal(body.provider_response_id,'resp_123456789abcdef');
  assert.equal(body.reply.recipient_agent_id,'A02');
  assert.equal(body.reply.payload.hops_remaining,1);
  assert.equal(calls,1);
 });
});
test('reply routing rejects self and invalid hop count',()=>{
 assert.equal(validateTask({...task,event:{...task.event,payload:{prompt:'Hi',reply_to:'A05',hops_remaining:2}}},'A05'),null);
 assert.equal(validateTask({...task,event:{...task.event,payload:{prompt:'Hi',reply_to:'A02',hops_remaining:999}}},'A05'),null);
});
test('invalid provider receipt must never be marked complete',async()=>{
 await serve(cfg,async()=>({ok:true,json:async()=>({id:'invalid',output:[{type:'message',content:[{type:'output_text',text:'Answer'}]}]})}),async base=>{
  const r=await fetch(base+'/v1/execute',{method:'POST',
   headers:{authorization:'Bearer '+TOKEN},body:JSON.stringify(task)});
  assert.equal(r.status,502);
 });
});
