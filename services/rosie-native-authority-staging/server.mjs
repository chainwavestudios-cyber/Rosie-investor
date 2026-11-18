/**
 * NATIVE-INT-5A Agent2 isolated deployment skeleton, 2026-11-18.
 * This is a public-facing but intentionally non-authorizing staging runtime.
 * No customer data, OAuth tokens or secrets. Not a Core production service.
 * Replace only after A1/A3/A4 issuer and committed-ledger checks are accepted.
 */
import {createServer} from 'node:http';
const port=Number.parseInt(process.env.PORT||'10000',10);
const contract='rosie.core.native-authority.isolated-staging.v1';
const max=4096;
const headers={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, max-age=0',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'x-frame-options':'DENY',
 'content-security-policy':"default-src 'none'",
};
function respond(res,status,data){
 res.writeHead(status,headers);
 res.end(JSON.stringify(data));
}
function fail(res,reason='native_customer_authority_not_accepted',status=503){
 respond(res,status,{ok:false,contract,environment:'isolated_staging',
  error:reason,authorization_granted:false,provider_operation_authorized:false,
  customer_billing_authorized:false,platform_admin_granted:false,
  token_exposed:false,production_authorized:false});
}
const server=createServer(async(req,res)=>{
 const path=new URL(req.url||'/', 'http://localhost').pathname;
 if(path==='/healthz'&&req.method==='GET'){
  return respond(res,200,{ok:true,contract,environment:'isolated_staging',
   backend_reachable:true,authority_accepted:false,product_grants_accepted:false,
   a1_identity_verifier_ready:false,a3_consent_issuer_ready:false,
   committed_neon_ledger_ready:false,independent_a5_accepted:false,
   production_authorized:false});
 }
 if(!['/v1/authority','/v1/product-grants'].includes(path))
  return fail(res,'route_not_found',404);
 if(req.method!=='POST')return fail(res,'method_not_allowed',405);
 if(req.headers.origin)return fail(res,'server_to_server_only',403);
 if(!req.headers['content-type']?.startsWith('application/json'))
  return fail(res,'content_type_invalid',415);
 const n=req.headers['content-length'];
 if(n!==undefined&&(!/^(0|[1-9][0-9]*)$/.test(n)||Number(n)>max))
  return fail(res,'payload_limit_exceeded',413);
 let bytes=0;
 try{
  for await(const chunk of req){
   bytes+=chunk.length;
   if(bytes>max)return fail(res,'payload_limit_exceeded',413);
  }
 }catch{return fail(res,'request_body_invalid',400)}
 // Bounded parsing does not confer authority: no installed A1/A3 signers,
 // no durable ledger, no scoped Core customer membership in this service.
 return fail(res);
});
server.requestTimeout=10000;
server.headersTimeout=10000;
server.keepAliveTimeout=5000;
server.listen(port,'0.0.0.0',()=>process.stdout.write('A2 isolated staging listening\n'));
