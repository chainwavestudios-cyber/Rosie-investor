import http from 'node:http';
import {run,validateConfig} from './worker.mjs';

/**
 * A worker has a running HTTP health process even when disabled. The endpoint
 * never advertises ready until real credentials and the activation flag exist.
 * Gateway /ready and durable job receipts remain authoritative for execution.
 */
function makeWorkerHost(env=process.env){
 let configured=false,reason='worker_explicitly_disabled';
 try{validateConfig(env);configured=true;reason='configured_not_attested';}
 catch(e){reason=e.message;}
 const server=http.createServer((req,res)=>{
  if(req.method!=='GET'||req.url!=='/health'){
   res.writeHead(404,{'content-type':'application/json'});
   return res.end(JSON.stringify({error:'not_found'}));
  }
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({service:'rosie-racp-worker',agent_id:env.RACP_AGENT_ID||null,
   process_alive:true,configured,certified:false,
   worker_enabled:env.RACP_WORKER_ENABLED==='true',reason}));
 });
 return {server,configured};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const {server,configured}=makeWorkerHost();
 server.listen(Number(process.env.PORT||10000),'0.0.0.0',
  ()=>console.log('racp_worker_host_listening'));
 if(configured)run().catch(e=>{console.error('racp_worker_fatal',e.message);process.exitCode=1;server.close();});
}
export {makeWorkerHost};
