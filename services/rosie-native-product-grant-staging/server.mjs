/**
 * Agent2 native product-grant isolated staging — read-only Neon acceptance
 * transport. No end-user, provider token, or production grant permissions.
 * A1 and A3 issuer keys intentionally unconfigured pending independent review.
 */
import {createServer} from 'node:http';
import pg from 'pg';
const port=Number.parseInt(process.env.PORT||'10000',10);
const url=process.env.A2_NEON_READONLY_URL||'';
const pool=url?new pg.Pool({connectionString:url,ssl:{rejectUnauthorized:true},
 max:2,connectionTimeoutMillis:4000,statement_timeout:4000,
 idleTimeoutMillis:12000,application_name:'rosie_a2_isolated_readonly'}):null;
const contract='rosie.core.native-product-grants.isolated-staging.v1';
const headers={
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
 'x-frame-options':'DENY','content-security-policy':"default-src 'none'"
};
const respond=(res,code,object)=>{res.writeHead(code,headers);res.end(JSON.stringify(object));};
const deny=(res,reason,status=503)=>respond(res,status,{
 ok:false,contract,environment:'isolated_staging',error:reason,
 authorization_granted:false,provider_operation_authorized:false,
 customer_billing_authorized:false,token_exposed:false,
 platform_admin_granted:false,production_authorized:false
});
async function restrictedNeonProbe(){
 if(!pool)return false;
 const result=await pool.query(`SELECT current_user AS role,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass,
  (SELECT count(*)::int FROM rosie_native.product_consent_event) AS visible_consent,
  (SELECT count(*)::int FROM rosie_native.consent_audit_event) AS visible_audit`);
 const v=result.rows?.[0];
 return v?.role==='a2_service_readonly'&&v.bypass===false&&
  v.visible_consent===0&&v.visible_audit===0;
}
const srv=createServer(async(req,res)=>{
 let path;
 try{path=new URL(req.url||'/', 'http://localhost').pathname;}
 catch{return deny(res,'route_invalid',400)}
 if(path==='/healthz'&&req.method==='GET'){
  let connected=false;
  try{connected=await restrictedNeonProbe();}catch{connected=false}
  return respond(res,connected?200:503,{
   ok:connected,contract,environment:'isolated_staging',
   database_readonly_connected:connected,restricted_rls_verified:connected,
   current_a1_signed_identity_ready:false,current_a3_consent_issuer_ready:false,
   atomic_writable_consent_adapter_ready:false,provider_account_verified:false,
   authorization_granted:false,independent_a5_accepted:false,production_authorized:false
  });
 }
 if(path!=='/v1/product-grants')return deny(res,'route_not_found',404);
 if(req.method!=='POST')return deny(res,'method_not_allowed',405);
 if(req.headers.origin)return deny(res,'server_to_server_only',403);
 if(!String(req.headers['content-type']||'').startsWith('application/json'))
  return deny(res,'content_type_invalid',415);
 const length=req.headers['content-length'];
 if(length!==undefined&&(!/^(0|[1-9][0-9]*)$/.test(length)||Number(length)>4096))
  return deny(res,'request_too_large',413);
 let bytes=0;
 try{for await(const chunk of req){
  bytes+=chunk.length;
  if(bytes>4096)return deny(res,'request_too_large',413);
 }}catch{return deny(res,'request_body_invalid',400)}
 // Intentionally reject every customer request: A1 signed customer invocation,
 // A3 explicit product consent, restricted serializable writer, durable current
 // read and A5 acceptance are all required and are not configured here.
 return deny(res,'current_a1_a3_customer_authority_unavailable');
});
srv.requestTimeout=10000;srv.headersTimeout=10000;
srv.listen(port,'0.0.0.0',()=>process.stdout.write('A2 isolated grant read-only service listening\n'));
process.on('SIGTERM',async()=>{srv.close();if(pool)await pool.end();});
