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
// Pinned peer-only health dependency: Authority -> Product Grants -> restricted
// Neon reader. No customer payload, service secret, or authorization passes here.
const grantsHealthUrl='https://rosie-native-product-grants-a2-staging.onrender.com/healthz';
const corePublicManifestUrl='https://rosie-ai-core-46e10df3.base44.app/api/apps/6aeabe88ef37542746e10df3/functions/coreSharedServicesManifest';
const coreProviderDirectoryUrl='https://rosie-ai-core-46e10df3.base44.app/api/apps/6aeabe88ef37542746e10df3/functions/coreProviderDirectory';
async function verifyCorePublicManifest(){
 try{
  const response=await fetch(corePublicManifestUrl,{
   method:'POST',redirect:'manual',cache:'no-store',
   headers:{'content-type':'application/json','accept':'application/json'},
   body:'{"action":"abracadabra_onboarding"}',
   signal:AbortSignal.timeout(11000)});
  if(response.status!==200||Number(response.headers.get('content-length')||0)>4096)
   return false;
  const body=await response.text();
  if(Buffer.byteLength(body,'utf8')>4096)return false;
  const data=JSON.parse(body);
  const onboarding=data?.onboarding;
  return data?.ok===true&&data?.issuer==='rosie-core'&&
   data?.contract==='rosie.core.abracadabra-onboarding.v1'&&
   onboarding?.service_key==='abracadabra'&&
   onboarding?.first_screen===true&&
   onboarding?.production_pairing_allowed===false&&
   onboarding?.encrypted_data_sync_allowed===false&&
   data?.customer_identity_or_org_authorized===false&&
   data?.encrypted_data_sync_authorized===false&&
   data?.production_pairing_authorized===false;
 }catch{return false;}
}
/**
 * Core's single 94-provider metadata source. Public discovery only:
 * this check does not issue customer identity or product access.
 */
async function verifyCoreProviderDirectory(){
 try{
  const response=await fetch(coreProviderDirectoryUrl,{
   method:'POST',redirect:'manual',cache:'no-store',
   headers:{'content-type':'application/json','accept':'application/json'},
   body:'{"action":"catalog"}',signal:AbortSignal.timeout(11000)});
  if(response.status!==200||Number(response.headers.get('content-length')||0)>65536)
   return false;
  const raw=await response.text();
  if(Buffer.byteLength(raw,'utf8')>65536)return false;
  const data=JSON.parse(raw),providers=data?.providers;
  if(data?.ok!==true||data?.issuer!=='rosie-core'||
     data?.contract!=='rosie.core.provider_directory.v1'||
     data?.provider_count!==94||!Array.isArray(providers)||providers.length!==94||
     data?.customer_connections_verified!==false||
     data?.customer_installation_authorized!==false||
     data?.provider_api_execution_authorized!==false||
     data?.cross_product_access_authorized!==false)return false;
  const keys=new Set();
  for(const p of providers){
   if(!p||typeof p.provider_key!=='string'||
      !/^[a-z][a-z0-9_]{1,63}$/.test(p.provider_key)||keys.has(p.provider_key)||
      typeof p.name!=='string'||p.name.length>100||
      !['all','shared_only','byo_shared_and_app_user','custom_required'].includes(p.native_mode)||
      p.requires_verified_customer_oauth!==true||
      p.requires_signed_core_tenant_grant!==true||
      p.requires_explicit_product_scope!==true)return false;
   keys.add(p.provider_key);
  }
  return ['googlecalendar','gmail','salesforce','zohocrm','twilio','ringcentral','droid_sms','zendesk_alt']
   .every(k=>keys.has(k));
 }catch{return false}
}
async function verifyGrantsReadonlyPeer(){
 try{
  const result=await fetch(grantsHealthUrl,{method:'GET',redirect:'manual',
   cache:'no-store',headers:{accept:'application/json'},
   signal:AbortSignal.timeout(11000)});
  if(result.status!==200)return {ok:false,reason:'peer_http_non_200'};
  if(Number(result.headers.get('content-length')||0)>2048)
   return {ok:false,reason:'peer_response_oversized'};
  const body=await result.text();
  if(Buffer.byteLength(body,'utf8')>2048)
   return {ok:false,reason:'peer_response_oversized'};
  let data;
  try{data=JSON.parse(body)}catch{return {ok:false,reason:'peer_invalid_json'}}
  const verified=data?.ok===true&&
   data?.contract==='rosie.core.native-product-grants.isolated-staging.v1'&&
   data?.environment==='isolated_staging'&&
   data?.database_readonly_connected===true&&
   data?.restricted_rls_verified===true&&
   data?.authorization_granted===false&&
   data?.production_authorized===false&&
   data?.current_a1_signed_identity_ready===false&&
   data?.current_a3_consent_issuer_ready===false&&
   data?.atomic_writable_consent_adapter_ready===false;
  return {ok:verified,reason:verified?'peer_verified':'peer_contract_mismatch'};
 }catch(error){
  return {ok:false,reason:error?.name==='TimeoutError'?'peer_timeout':'peer_transport_unavailable'};
 }
}
const headers={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, max-age=0',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'x-frame-options':'DENY',
 'content-security-policy':"default-src 'none'",
};
function respond(res,status,data,extraHeaders=null){
 res.writeHead(status,extraHeaders?{...headers,...extraHeaders}:headers);
 res.end(JSON.stringify(data));
}
// Exact published Rosie origins may read ONLY the informational /readyz
// response. Customer authority POST endpoints remain non-browser.
const readinessOrigins=new Set([
 'https://rosie-ai-core-46e10df3.base44.app',
 'https://underwriteriq-platform.base44.app',
 'https://directd.tech'
]);
function fail(res,reason='native_customer_authority_not_accepted',status=503){
 respond(res,status,{ok:false,contract,environment:'isolated_staging',
  error:reason,authorization_granted:false,provider_operation_authorized:false,
  customer_billing_authorized:false,platform_admin_granted:false,
  token_exposed:false,production_authorized:false});
}
const server=createServer(async(req,res)=>{
 const path=new URL(req.url||'/', 'http://localhost').pathname;
 if(path==='/readyz'&&req.method==='GET'){
  const [peer,coreLinked,providerLinked]=await Promise.all([verifyGrantsReadonlyPeer(),verifyCorePublicManifest(),verifyCoreProviderDirectory()]);
  const linked=peer.ok;
  const healthy=linked&&coreLinked&&providerLinked;
  const origin=String(req.headers.origin||'');
  const cors=readinessOrigins.has(origin)?
   {'access-control-allow-origin':origin,'vary':'Origin'}:null;
  return respond(res,healthy?200:503,{ok:healthy,contract,
   environment:'isolated_staging',
   linked_product_grants_readonly:linked,
   restricted_neon_reader_verified:linked,
   peer_readiness_reason:peer.reason,
   linked_core_public_manifest:coreLinked,
   linked_core_provider_directory:providerLinked,
   provider_directory_count:providerLinked?94:0,
   // Network reachability and database visibility are NOT customer consent.
   authority_accepted:false,product_grants_accepted:false,
   a1_identity_verifier_ready:false,a3_consent_issuer_ready:false,
   atomic_writable_consent_adapter_ready:false,
   customer_grant_authorized:false,provider_operation_authorized:false,
   production_authorized:false},cors);
 }
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
