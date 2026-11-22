/**
 * Isolated staging OAuth gateway for the first two providers.
 * Shared access to products remains disabled pending independently signed
 * product gateway and explicit product-grant acceptance.
 */
import express from 'express';
import {createHash} from 'node:crypto';
import {CONNECTOR_DEFINITIONS,CONNECTOR_ORIGIN,connectorRedirectUri,connectorConfig,hashSecret,safeEqualHash,loadVaultKey,encryptVault,decryptVault,validateConnectorScopes,authorizationPackage} from './connector-security.mjs';
const R=express.Router();
const allowedProducts=new Set(['bob','directd','insureiq','settlementiq','emailiq']);
const reply=(res,status,body)=>res.status(status).set('Cache-Control','no-store').json(body);
const hash=x=>createHash('sha256').update(String(x)).digest('hex');
function sessionHeaders(req){
 const h=new Headers();
 for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')h.set(k,v);
 return h;
}
async function identitySession(req,auth){
 const session=await auth.api.getSession({headers:sessionHeaders(req)}).catch(()=>null);
 if(!session?.user?.id||!session?.session?.id||session.user.emailVerified!==true||
    session.user.twoFactorEnabled!==true)return null;
 return session;
}
async function verifiedLinkedSeat(pool,s,organizationId,productKey){
 if(!/^[a-f0-9]{24}$/.test(organizationId||'')||!allowedProducts.has(productKey))return false;
 const r=await pool.query(
  "SELECT 1 FROM rosie_identity_link.linked_seat WHERE organization_id=$1 AND product_key=$2 AND central_subject=$3 AND state='verified' LIMIT 1",
  [organizationId,productKey,s.user.id]);
 return r.rowCount===1;
}
async function audit(pool,provider,action,result,org,subject){
 await pool.query('INSERT INTO rosie_connector.audit(provider_key,action,result,org_hash,subject_hash) VALUES($1,$2,$3,$4,$5)',
  [provider,action,result,org?hash(org):null,subject?hash(subject):null]).catch(()=>{});
}
export function createConnectorRouter({auth,pool}){
 R.get('/readiness',async(_req,res)=>{
  try{
   await pool.query('SELECT 1 FROM rosie_connector.oauth_transaction LIMIT 0');
   const vaultReady=Boolean(loadVaultKey());
   const ready=Object.fromEntries(Object.keys(CONNECTOR_DEFINITIONS).map(k=>[k,connectorConfig(k).configured]));
   return reply(res,200,{stage:'isolated',databaseReady:true,vaultReady,providerConfigured:ready,
    centralIdentityEnrollmentRequired:true,crossProductGatewayEnabled:false});
  }catch{return reply(res,503,{databaseReady:false,installationEnabled:false})}
 });
 R.post('/start',express.json({limit:'900b'}),async(req,res)=>{
  const provider=req.body?.provider,config=connectorConfig(provider);
  if(!config)return reply(res,400,{error:'unsupported_provider'});
  if(req.get('Origin')!==CONNECTOR_ORIGIN)return reply(res,403,{error:'origin_not_trusted'});
  if(!config.configured)return reply(res,503,{error:'provider_configuration_pending'});
  const key=loadVaultKey();
  if(!key)return reply(res,503,{error:'encrypted_vault_not_ready'});
  const s=await identitySession(req,auth);
  if(!s)return reply(res,401,{error:'verified_email_and_totp_required'});
  const {organizationId,productKey,scopes}=req.body||{};
  if(!validateConnectorScopes(provider,scopes))return reply(res,400,{error:'scopes_not_permitted'});
  try{
   if(!await verifiedLinkedSeat(pool,s,organizationId,productKey))
    return reply(res,403,{error:'verified_product_membership_required'});
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    // Fresh server-issued TOTP step-up is mandatory and one-time.
    const mfa=await client.query(
     "DELETE FROM rosie_identity_link.mfa_stepup WHERE session_id=$1 AND user_id=$2 AND method='totp' AND expires_at>now() RETURNING session_id",
     [s.session.id,s.user.id]);
    if(mfa.rowCount!==1){await client.query('ROLLBACK');return reply(res,403,{error:'fresh_totp_stepup_required'})}
    const redirectUri=connectorRedirectUri(provider);
    const tx=authorizationPackage({provider,scopes,clientId:config.clientId,redirectUri});
    const aad=tx.stateHash+':'+provider+':'+organizationId;
    const encrypted=encryptVault(tx.verifier,key,aad);
    await client.query(
     "INSERT INTO rosie_connector.oauth_transaction(state_hash,provider_key,organization_id,product_key,central_subject,session_hash,scopes,verifier_cipher,verifier_iv,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,now()+interval '5 minutes')",
     [tx.stateHash,provider,organizationId,productKey,s.user.id,hash(s.session.id),
      JSON.stringify(scopes),encrypted.ciphertext,encrypted.iv]);
    await client.query('COMMIT');
    await audit(pool,provider,'start','accepted',organizationId,s.user.id);
    return reply(res,200,{authorizationUrl:tx.url,expiresInSeconds:300,
     crossProductAccessGranted:false});
   }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  }catch{return reply(res,503,{error:'oauth_transaction_unavailable'})}
 });
 R.get('/callback/:provider',async(req,res)=>{
  const provider=req.params.provider,config=connectorConfig(provider);
  if(!config)return reply(res,400,{error:'unsupported_provider'});
  if(!config.configured||!loadVaultKey())return reply(res,503,{error:'provider_gateway_not_ready'});
  const state=String(req.query.state||''),code=String(req.query.code||'');
  if(!/^[A-Za-z0-9_-]{42,128}$/.test(state)||!code||code.length>4096||req.query.error)
   return reply(res,400,{error:'oauth_callback_invalid'});
  const s=await identitySession(req,auth);
  if(!s)return reply(res,401,{error:'rosie_session_required'});
  const stateHash=hashSecret(state);
  const client=await pool.connect();
  let row;
  try{
   await client.query('BEGIN');
   const found=await client.query(
    'SELECT * FROM rosie_connector.oauth_transaction WHERE state_hash=$1 FOR UPDATE',
    [stateHash]);
   row=found.rows[0];
   if(!row||row.provider_key!==provider||row.consumed_at||row.revoked_at||
      Date.parse(row.expires_at)<=Date.now()||row.central_subject!==s.user.id||
      !safeEqualHash(row.session_hash,hash(s.session.id))){
     await client.query('ROLLBACK');
     return reply(res,403,{error:'state_expired_replayed_or_identity_mismatch'});
   }
   // Recheck membership at callback so revocation between start and callback wins.
   if(!await verifiedLinkedSeat(client,s,row.organization_id,row.product_key)){
    await client.query('ROLLBACK');return reply(res,403,{error:'organization_access_revoked'});
   }
   const consumed=await client.query(
    'UPDATE rosie_connector.oauth_transaction SET consumed_at=now() WHERE state_hash=$1 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>now() RETURNING state_hash',
    [stateHash]);
   if(consumed.rowCount!==1){await client.query('ROLLBACK');return reply(res,409,{error:'state_already_consumed'})}
   await client.query('COMMIT');
  }catch{await client.query('ROLLBACK');return reply(res,503,{error:'callback_database_unavailable'})}
  finally{client.release()}
  try{
   const aad=stateHash+':'+provider+':'+row.organization_id;
   const verifier=decryptVault({ciphertext:row.verifier_cipher,iv:row.verifier_iv},loadVaultKey(),aad);
   const redirectUri=connectorRedirectUri(provider);
   const payload=new URLSearchParams({
    grant_type:'authorization_code',code,client_id:config.clientId,client_secret:config.clientSecret,
    redirect_uri:redirectUri,code_verifier:verifier
   });
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
   let tokenResponse;
   try{tokenResponse=await fetch(config.def.token,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:payload,signal:controller.signal})}
   finally{clearTimeout(timer)}
   if(!tokenResponse.ok)return reply(res,502,{error:'provider_token_exchange_failed'});
   const token=await tokenResponse.json();
   if(!token?.access_token||typeof token.access_token!=='string'||!token.refresh_token||
     typeof token.refresh_token!=='string')return reply(res,403,{error:'offline_provider_authorization_not_confirmed'});
   if(token.scope && !row.scopes.every(scope=>String(token.scope).split(' ').includes(scope)))
    return reply(res,403,{error:'oauth_scope_mismatch'});
   // Authenticated provider subject: no email-based customer joins.
   const aboutUrl=provider==='googleworkspace'?
    'https://www.googleapis.com/drive/v3/about?fields=user(permissionId)':
    'https://api.dropboxapi.com/2/users/get_current_account';
   const profile=await fetch(aboutUrl,{
    method:provider==='googleworkspace'?'GET':'POST',
    headers:{Authorization:'Bearer '+token.access_token,...(provider==='dropbox'?{'content-type':'application/json'}:{})},
    ...(provider==='dropbox'?{body:'null'}:{})
   });
   if(!profile.ok)return reply(res,403,{error:'provider_identity_unverified'});
   const profileBody=await profile.json();
   const providerSubject=provider==='googleworkspace'?profileBody?.user?.permissionId:profileBody?.account_id;
   if(typeof providerSubject!=='string'||providerSubject.length<8)
    return reply(res,403,{error:'provider_identity_missing'});
   const key=loadVaultKey();
   const ident=provider+':'+row.organization_id+':'+row.product_key+':'+hash(providerSubject);
   const encAccess=encryptVault(token.access_token,key,ident+':access');
   const encRefresh=encryptVault(token.refresh_token,key,ident+':refresh');
   // This records provider credentials for *one* verified organization/product.
   // Cross-product grant issuance remains disabled.
   await pool.query(
    `WITH saved_connection AS (
      INSERT INTO rosie_connector.provider_connection(organization_id,product_key,central_subject,provider_key,provider_subject_hash,state,scopes,access_token_cipher,access_token_iv,refresh_token_cipher,refresh_token_iv,token_expires_at,last_verified_at) VALUES($1,$2,$3,$4,$5,'authorized',$6::jsonb,$7,$8,$9,$10,$11,now())
      RETURNING provider_key
     )
     INSERT INTO rosie_connector.audit(provider_key,action,result,org_hash,subject_hash)
     SELECT provider_key,'callback','verified',$12,$13 FROM saved_connection`,
    [row.organization_id,row.product_key,s.user.id,provider,hash(providerSubject),
     JSON.stringify(row.scopes),encAccess.ciphertext,encAccess.iv,encRefresh.ciphertext,
     encRefresh.iv,new Date(Date.now()+Math.max(60,Math.min(86400,Number(token.expires_in)||3600))*1000),
      hash(row.organization_id),hash(s.user.id)]);
   return reply(res,200,{connected:true,provider,organizationId:row.organization_id,
    productKey:row.product_key,crossProductAccessGranted:false,
    note:'Verified scoped staging connector. No access granted to other Rosie products.'});
  }catch{
   await audit(pool,provider,'callback','error',row.organization_id,s.user.id);
   return reply(res,502,{error:'provider_verification_unavailable'});
  }
 });
 return R;
}

