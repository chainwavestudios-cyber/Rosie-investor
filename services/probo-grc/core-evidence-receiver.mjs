/** Node HTTP receiver for independently deployed staging bridge, behind trusted TLS ingress.
 * Never expose directly on public internet or assume headers are authenticated.
 * No Probo API write is performed. This ONLY stores evidence in the bridge inbox.
 */
import { createServer } from 'node:http';
import { acceptSignedEvidence } from './core-evidence-gateway.mjs';
import { signBridgeAck } from './core-evidence-ack.mjs';

const maxBytes=12000;
async function parseLimited(req) {
 let chunks=[],count=0;
 for await (const chunk of req) {
   count+=chunk.length;
   if(count>maxBytes) {const e=new Error('request_too_large');e.httpStatus=413;throw e;}
   chunks.push(chunk);
 }
 try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 catch {const e=new Error('invalid_json');e.httpStatus=400;throw e;}
}
export function createEvidenceReceiver(config) {
 if(!config || !config.adapter || !config.sources || typeof config.ackKey!=='string' || config.ackKey.length<32)
   throw Error('receiver_not_configured');
 return createServer(async(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   res.setHeader('X-Content-Type-Options','nosniff');
   const send=(code,value)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
   if(req.url==='/healthz' && req.method==='GET') return send(200,{status:'up',connectivity:'not_proven'});
   if(req.url!=='/v1/evidence' || req.method!=='POST') return send(404,{error:'not_found'});
   if(!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type']||''))
     return send(415,{error:'unsupported_media_type'});
   const length=req.headers['content-length'];
   if(length && (!/^\d+$/.test(length)||Number(length)>maxBytes))
     return send(413,{error:'request_too_large'});
   try {
     const env=await parseLimited(req);
     const accepted=await acceptSignedEvidence(env,{sources:config.sources,adapter:config.adapter,now:config.now});
     const ack=signBridgeAck(accepted,{key:config.ackKey,requestDigest:env.digest,
       timestamp:config.now instanceof Date?config.now.getTime():Date.now()});
     return send(202,ack);
   } catch(e) {
     // Never leak authorization internals, signatures, tenant identifiers or event contents.
     if(e.httpStatus===413) return send(413,{error:'request_too_large'});
     if(e.httpStatus===400) return send(400,{error:'invalid_request'});
     if(e.message==='replay_detected'||e.message==='conflicting_duplicate') return send(409,{error:'conflict'});
     if(e.message==='invalid_storage_receipt') return send(503,{error:'storage_unavailable'});
     if(e.message==='durable_adapter_required') return send(503,{error:'storage_unavailable'});
     // Database errors must not be misreported as authentication failures.
     if(!e.code && !/^invalid_|^stale_|^missing_|^untrusted_|^wrong_|^source_|^expired_|^unknown_/.test(e.message||'')) 
       return send(503,{error:'storage_unavailable'});
     return send(401,{error:'unauthorized'});
   }
 });
}
