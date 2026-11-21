/**
 * Staging-only, bounded real-model executor for Rosie Core RACP.
 * No browser, shell, CRM, database or deployment tools. The only side effect
 * is a permitted OpenAI Responses API call; the worker commits the output
 * to the Core gateway before ACK or delivery.
 */
import http from 'node:http';
import crypto from 'node:crypto';

const ALLOWED=new Set(['A02','A05']);
const MODEL='gpt-6-luna';
const equal=(a,b)=>{
 const x=Buffer.from(a||''),y=Buffer.from(b||'');
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
};
function config(env=process.env){
 return {
  enabled:env.RACP_EXECUTOR_ENABLED==='true',
  agent:env.RACP_AGENT_ID||'',
  token:env.RACP_EXECUTOR_TOKEN||'',
  openaiKey:env.OPENAI_API_KEY||'',
  model:MODEL
 };
}
function validateTask(task,agent){
 if(!task||task.contract!=='rosie.core.worker.task.v1'||task.agent_id!==agent||
    typeof task.job_id!=='string'||!/^[-a-f0-9]{36}$/i.test(task.job_id)||
    !Number.isSafeInteger(task.fencing_token)||task.fencing_token<1||
    !task.event||!['rcis.message','ticket.assigned'].includes(task.event.event_type)||
    !task.event.payload||typeof task.event.payload!=='object')
  return null;
 const data=task.event.payload;
 const prompt=data.prompt||data.message;
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>1600)return null;
 const hops=Number.isSafeInteger(data.hops_remaining)?data.hops_remaining:0;
 if(hops<0||hops>3)return null;
 const replyTo=data.reply_to;
 if(replyTo!==undefined&&(!ALLOWED.has(replyTo)||replyTo===agent))return null;
 return {prompt:prompt.trim(),hops,replyTo};
}
function makeExecutor({env=process.env,modelFetch=fetch}={}){
 const cfg=config(env);
 return http.createServer(async(req,res)=>{
  const send=(status,body)=>{
   res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify(body));
  };
  if(req.method==='GET'&&req.url==='/health')
   return send(200,{ok:true,service:'rosie-racp-model-executor',enabled:cfg.enabled,
     configured:ALLOWED.has(cfg.agent)&&cfg.token.length>=40&&cfg.openaiKey.length>=20});
  if(req.method!=='POST'||req.url!=='/v1/execute')
   return send(404,{error:'not_found'});
  if(!cfg.enabled||!ALLOWED.has(cfg.agent)||cfg.token.length<40||cfg.openaiKey.length<20)
   return send(503,{error:'real_model_executor_not_configured'});
  const auth=String(req.headers.authorization||'');
  if(!auth.startsWith('Bearer ')||!equal(auth.slice(7),cfg.token))
   return send(401,{error:'executor_authorization_required'});
  let raw='';
  try{
   for await(const chunk of req){
    raw+=chunk.toString('utf8');
    if(Buffer.byteLength(raw)>6000)return send(413,{error:'oversized_task'});
   }
   const task=JSON.parse(raw),valid=validateTask(task,cfg.agent);
   if(!valid)return send(400,{error:'invalid_task_contract'});
   const system='You are a Rosie Core internal engineering agent. Respond with a concise factual analysis of the given message. Do not claim to have executed actions, queried systems, or completed tickets. You have no tools or credentials. Output plain text only.';
   const upstream=await modelFetch('https://api.openai.com/v1/responses',{
    method:'POST',headers:{'content-type':'application/json',
      'authorization':'Bearer '+cfg.openaiKey},
    body:JSON.stringify({model:cfg.model,max_output_tokens:500,
      reasoning:{effort:'none'},store:false,
      instructions:system,input:valid.prompt}),
    signal:AbortSignal.timeout(45000)
   });
   if(!upstream.ok)return send(502,{error:'model_provider_request_failed',provider_status:upstream.status});
   const result=await upstream.json();
   const output=(result.output||[]).filter(x=>x.type==='message')
      .flatMap(x=>x.content||[]).filter(x=>x.type==='output_text')
      .map(x=>x.text||'').join('\n').trim();
   if(!/^resp_[a-zA-Z0-9_-]{8,120}$/.test(result.id||'')||!output)
    return send(502,{error:'model_provider_receipt_invalid'});
   const reply=valid.hops>0&&valid.replyTo?{
     recipient_agent_id:valid.replyTo,
     payload:{message:output.slice(0,1600),
       reply_to:cfg.agent,hops_remaining:valid.hops-1}
   }:undefined;
   return send(200,{status:'completed',provider:'openai',
     provider_response_id:result.id,result_text:output.slice(0,3000),reply});
  }catch(e){
   console.error('executor_request_failed',e?.name||'error');
   return send(503,{error:'executor_unavailable'});
  }
 });
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const server=makeExecutor();
 server.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('racp_executor_listening'));
}
export {makeExecutor,validateTask,config};
