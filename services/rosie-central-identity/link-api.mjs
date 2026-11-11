/**
 * Staging-only secure product <-> Rosie account link API.
 * Assumes a trusted product backend has independently verified its local
 * authenticated principal AND exact tenant membership before HMAC signing.
 * Browser requests cannot set product actor/role or grant a seat.
 */
import express from 'express';
import {
 sha,opaque,verifyProductHeaders,validateProductLinkInput,
 assertFreshMfa,PRODUCT_KEYS,CHALLENGE_TTL_SEC,STEP_UP_TTL_SEC,NONCE,ISSUER
} from './link-contract.mjs';

const ORIGIN='https://rosie-central-identity-staging.onrender.com';
const keys={
 bob:'ROSIE_LINK_BOB_SHARED_KEY',
 directd:'ROSIE_LINK_DIRECTD_SHARED_KEY',
 insureiq:'ROSIE_LINK_INSUREIQ_SHARED_KEY',
 settlementiq:'ROSIE_LINK_SETTLEMENTIQ_SHARED_KEY',
 emailiq:'ROSIE_LINK_EMAILIQ_SHARED_KEY'
};
const R=express.Router();
const reply=(res,status,body)=>res.status(status).set('Cache-Control','no-store').json(body);
const POST_BODY=express.raw({type:'application/json',limit:'1500b'});
const REDIRECTS={
 bob:'https://bob-training-intelligence-8019bf2b.base44.app/bob/portal'
};
const loggedIn=async(req,auth)=>{
 const headers=new Headers();
 for(const [k,v] of Object.entries(req.headers))
  if(typeof v==='string')headers.set(k,v);
 const s=await auth.api.getSession({headers}).catch(()=>null);
 return s&&s.session?.id&&s.user?.id?s:null;
};
async function productAuth(req,res,pool,operation){
 const body=Buffer.isBuffer(req.body)?req.body.toString('utf8'):'';
 if(!body||body.length>1500)return {error:reply(res,400,{error:'invalid_request_body'})};
 const product=String(req.header('x-rosie-product')||'');
 const secret=process.env[keys[product]]||'';
 const checked=verifyProductHeaders({
  path:'/api/links/'+operation,body,method:'POST',headers:req.headers,secret
 });
 if(!checked.ok)return {error:reply(res,401,{error:'invalid_product_signature'})};
 let data;
 try{data=JSON.parse(body)}catch{return {error:reply(res,400,{error:'invalid_json'})}}
 if(!data||data.product!==checked.product)
  return {error:reply(res,403,{error:'product_claim_mismatch'})};
 const client=await pool.connect();
 try{
  const created=await client.query(
   'INSERT INTO rosie_identity_link.product_nonce(product_key,request_nonce) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING request_nonce',
   [product,checked.nonce]);
  if(created.rowCount!==1)return {error:reply(res,409,{error:'signed_request_replayed'})};
 }finally{client.release()}
 return {data,product};
}
async function audit(db,action,result,{product,organizationId,productPrincipalId,subject}={}){
 await db.query(
  'INSERT INTO rosie_identity_link.link_audit(product_key,organization_id,principal_hash,subject_hash,action,result) VALUES($1,$2,$3,$4,$5,$6)',
  [product||null,organizationId||null,productPrincipalId?sha(productPrincipalId):null,
   subject?sha(subject):null,action,result]);
}
export function createRosieLinkRouter({auth,pool}){
 R.post('/prepare',POST_BODY,async(req,res)=>{
  try{
   const verified=await productAuth(req,res,pool,'prepare');
   if(verified.error)return;
   const {data}=verified;
   const identity=validateProductLinkInput(data);
   const token=opaque(),hash=sha(token);
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    await client.query(
     "INSERT INTO rosie_identity_link.link_challenge(challenge_hash,product_key,organization_id,product_principal_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '3 minutes')",
     [hash,identity.product,identity.organizationId,identity.productPrincipalId]);
    await audit(client,'prepare','success',identity);
    await client.query('COMMIT');
   }catch(e){await client.query('ROLLBACK');throw e}
   finally{client.release()}
   return reply(res,201,{
    approved:false,expiresInSeconds:CHALLENGE_TTL_SEC,
    challenge:token,
    approvalUrl:ORIGIN+'/link/approve?code='+encodeURIComponent(token)
   });
  }catch(e){return reply(res,400,{error:'link_prepare_failed'})}
 });
 R.post('/redeem',POST_BODY,async(req,res)=>{
  try{
   const verified=await productAuth(req,res,pool,'redeem');
   if(verified.error)return;
   const {data}=verified;
   if(!NONCE.test(data.challenge)||Object.keys(data).some(k=>!['product','organizationId','productPrincipalId','challenge'].includes(k)))
    return reply(res,400,{error:'invalid_redemption_request'});
   const identity=validateProductLinkInput({
    product:data.product,organizationId:data.organizationId,productPrincipalId:data.productPrincipalId
   });
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const challenge=await client.query(
     "SELECT * FROM rosie_identity_link.link_challenge WHERE challenge_hash=$1 FOR UPDATE",
     [sha(data.challenge)]);
    const row=challenge.rows[0];
    if(!row||row.product_key!==identity.product||
      row.organization_id!==identity.organizationId||
      row.product_principal_id!==identity.productPrincipalId||
      row.approved_at===null||row.redeemed_at!==null||
      new Date(row.expires_at).getTime()<=Date.now()){
      await client.query('ROLLBACK');
      return reply(res,403,{error:'unapproved_expired_or_consumed_challenge'});
    }
    const prev=await client.query(
      "SELECT central_subject,state FROM rosie_identity_link.linked_seat WHERE product_key=$1 AND organization_id=$2 AND product_principal_id=$3 FOR UPDATE",
      [identity.product,identity.organizationId,identity.productPrincipalId]);
    if(prev.rows[0] && (prev.rows[0].central_subject!==row.approved_subject||prev.rows[0].state!=='verified')){
      await client.query('ROLLBACK');
      return reply(res,409,{error:'identity_link_conflict'});
    }
    await client.query(
      "INSERT INTO rosie_identity_link.linked_seat(product_key,organization_id,product_principal_id,central_subject,issuer) VALUES($1,$2,$3,$4,$5) ON CONFLICT (product_key,organization_id,product_principal_id) DO NOTHING",
      [identity.product,identity.organizationId,identity.productPrincipalId,row.approved_subject,ISSUER]);
    await client.query(
      'UPDATE rosie_identity_link.link_challenge SET redeemed_at=now() WHERE challenge_hash=$1',
      [sha(data.challenge)]);
    await audit(client,'redeem','success',{...identity,subject:row.approved_subject});
    await client.query('COMMIT');
    return reply(res,200,{
      verified:true,centralSubject:row.approved_subject,issuer:ISSUER,
      product:identity.product,organizationId:identity.organizationId,
      productPrincipalId:identity.productPrincipalId
    });
   }catch(e){await client.query('ROLLBACK');throw e}
   finally{client.release()}
  }catch(e){return reply(res,400,{error:'redemption_failed'})}
 });
 R.get('/preview',async(req,res)=>{
  try{
   const s=await loggedIn(req,auth);
   if(!s)return reply(res,401,{error:'rosie_sign_in_required'});
   if(!NONCE.test(req.query.code||''))return reply(res,400,{error:'invalid_link_code'});
   const result=await pool.query(
    "SELECT product_key,organization_id,created_at,expires_at,approved_at,redeemed_at FROM rosie_identity_link.link_challenge WHERE challenge_hash=$1",
    [sha(req.query.code)]);
   const row=result.rows[0];
   if(!row||row.redeemed_at||row.approved_at||new Date(row.expires_at).getTime()<=Date.now())
    return reply(res,410,{error:'link_challenge_expired_or_used'});
   return reply(res,200,{product:row.product_key,expiresAt:row.expires_at,
    emailVerified:s.user.emailVerified===true,totpEnabled:s.user.twoFactorEnabled===true});
  }catch{return reply(res,400,{error:'link_preview_failed'})}
 });
 R.post('/step-up',express.json({limit:'350b'}),async(req,res)=>{
  try{
   if(req.header('Origin')!==ORIGIN)return reply(res,403,{error:'invalid_origin'});
   const s=await loggedIn(req,auth);
   if(!s||s.user.emailVerified!==true||s.user.twoFactorEnabled!==true)
    return reply(res,403,{error:'verified_rosie_session_required'});
   if(!/^\d{6}$/.test(req.body?.code||''))
    return reply(res,400,{error:'invalid_totp_format'});
   const headers=new Headers();
   for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
   // Better Auth is the sole TOTP verifier. Do not implement shadow TOTP
   // secrets, accept social-only login as a second factor, or trust a flag.
   const proof=await auth.api.verifyTOTP({
    headers,body:{code:req.body.code,trustDevice:false}
   }).catch(()=>null);
   if(!proof?.user?.id||proof.user.id!==s.user.id)
    return reply(res,403,{error:'fresh_totp_not_verified'});
   await pool.query(
    "INSERT INTO rosie_identity_link.mfa_stepup(session_id,user_id,method,proved_at,expires_at) VALUES($1,$2,'totp',now(),now()+interval '5 minutes') ON CONFLICT(session_id) DO UPDATE SET user_id=EXCLUDED.user_id,proved_at=EXCLUDED.proved_at,expires_at=EXCLUDED.expires_at",
    [s.session.id,s.user.id]);
   return reply(res,200,{verified:true,validSeconds:STEP_UP_TTL_SEC});
  }catch{return reply(res,403,{error:'fresh_totp_not_verified'})}
 });
 R.post('/approve',express.json({limit:'400b'}),async(req,res)=>{
  try{
   if(req.header('Origin')!==ORIGIN)return reply(res,403,{error:'invalid_origin'});
   const s=await loggedIn(req,auth);
   if(!s)return reply(res,401,{error:'rosie_sign_in_required'});
   const token=String(req.body?.challenge||'');
   if(!NONCE.test(token))return reply(res,400,{error:'invalid_link_challenge'});
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const mfa=await client.query(
      'SELECT * FROM rosie_identity_link.mfa_stepup WHERE session_id=$1 FOR UPDATE',
      [s.session.id]);
    try{assertFreshMfa({session:s.session,user:s.user,stepUp:mfa.rows[0]});}
    catch{await client.query('ROLLBACK');return reply(res,403,{error:'fresh_totp_and_verified_email_required'})}
    const found=await client.query(
      'SELECT * FROM rosie_identity_link.link_challenge WHERE challenge_hash=$1 FOR UPDATE',
      [sha(token)]);
    const row=found.rows[0];
    if(!row||row.approved_at||row.redeemed_at||
      new Date(row.expires_at).getTime()<=Date.now()){
      await client.query('ROLLBACK');
      return reply(res,410,{error:'expired_or_consumed_link_challenge'});
    }
    const prev=await client.query(
      "SELECT central_subject,state FROM rosie_identity_link.linked_seat WHERE product_key=$1 AND organization_id=$2 AND product_principal_id=$3",
      [row.product_key,row.organization_id,row.product_principal_id]);
    if(prev.rows[0]&&(prev.rows[0].central_subject!==s.user.id||prev.rows[0].state!=='verified')){
      await client.query('ROLLBACK');
      return reply(res,409,{error:'identity_link_conflict'});
    }
    await client.query(
      'UPDATE rosie_identity_link.link_challenge SET approved_subject=$2,approved_at=now() WHERE challenge_hash=$1',
      [sha(token),s.user.id]);
    await client.query(
      'DELETE FROM rosie_identity_link.mfa_stepup WHERE session_id=$1',
      [s.session.id]);
    await audit(client,'approve','success',{product:row.product_key,
      organizationId:row.organization_id,productPrincipalId:row.product_principal_id,
      subject:s.user.id});
    await client.query('COMMIT');
    return reply(res,200,{approved:true,returnTo:REDIRECTS[row.product_key]||null});
   }catch(e){await client.query('ROLLBACK');throw e}
   finally{client.release()}
  }catch{return reply(res,400,{error:'link_approval_failed'})}
 });
 return R;
}
