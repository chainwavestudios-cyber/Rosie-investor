/**
 * Rosie verified product-seat linking protocol v1.
 * HMAC is a transport authentication mechanism for the PRODUCT BACKEND only.
 * Never accept an email or organization claim made by the browser as authority.
 */
import {createHmac,createHash,randomBytes,timingSafeEqual} from 'node:crypto';

export const PRODUCT_KEYS=Object.freeze(['bob','directd','insureiq','settlementiq','emailiq']);
export const ID24=/^[a-f0-9]{24}$/;
export const SUBJECT=/^[A-Za-z0-9_-]{8,128}$/;
export const NONCE=/^[A-Za-z0-9_-]{20,120}$/;
export const SHA256=/^[a-f0-9]{64}$/;
export const CHALLENGE_TTL_SEC=180;
export const STEP_UP_TTL_SEC=300;
export const ISSUER='https://rosie-central-identity-staging.onrender.com/api/auth';
const encoder=(data)=>typeof data==='string'?data:JSON.stringify(data);
export const sha=(data)=>createHash('sha256').update(encoder(data)).digest('hex');
export const opaque=()=>randomBytes(32).toString('base64url');
const canon=(method,path,body,ts,nonce,product)=>[method.toUpperCase(),path,sha(body),String(ts),nonce,product].join('\n');
export function signedProductHeaders({method='POST',path,body,timestamp,nonce,product,secret}){
 if(!PRODUCT_KEYS.includes(product)||!path?.startsWith('/api/links/')||
  typeof secret!=='string'||secret.length<32||!NONCE.test(nonce)||
  !Number.isSafeInteger(Number(timestamp)))throw Error('link_signature_input_invalid');
 const digest=createHmac('sha256',secret).update(canon(method,path,body,timestamp,nonce,product)).digest('hex');
 return {'x-rosie-product':product,'x-rosie-timestamp':String(timestamp),
  'x-rosie-nonce':nonce,'x-rosie-signature':'v1='+digest};
}
export function verifyProductHeaders({method='POST',path,body,headers,secret,now=Date.now()}){
 const read=(key)=>typeof headers?.get==='function'?headers.get(key):headers?.[key];
 const product=String(read('x-rosie-product')||'');
 const nonce=String(read('x-rosie-nonce')||'');
 const timestamp=Number(read('x-rosie-timestamp'));
 const sig=String(read('x-rosie-signature')||'');
 if(!PRODUCT_KEYS.includes(product)||!NONCE.test(nonce)||
  !Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>60000||
  !/^v1=[a-f0-9]{64}$/.test(sig)||typeof secret!=='string'||secret.length<32)
  return {ok:false,reason:'invalid_signature'};
 const supplied=Buffer.from(sig.slice(3),'hex');
 const expected=Buffer.from(createHmac('sha256',secret)
   .update(canon(method,path,body,timestamp,nonce,product)).digest('hex'),'hex');
 return {ok:supplied.length===expected.length&&timingSafeEqual(supplied,expected),
  product,nonce,timestamp};
}
export function validateProductLinkInput(v){
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid_link_input');
 if(!PRODUCT_KEYS.includes(v.product)||!ID24.test(v.organizationId)||
 !SUBJECT.test(v.productPrincipalId)||Object.keys(v).some(x=>!['product','organizationId','productPrincipalId'].includes(x)))
 throw Error('invalid_product_membership_reference');
 return {product:v.product,organizationId:v.organizationId,productPrincipalId:v.productPrincipalId};
}
export function assertFreshMfa({session,user,stepUp,now=new Date()}){
 const n=now.getTime();
 if(!session?.id||!user?.id||user.emailVerified!==true||
 user.twoFactorEnabled!==true||stepUp?.session_id!==session.id||
 stepUp?.user_id!==user.id||stepUp?.method!=='totp'||
 !Number.isFinite(Date.parse(stepUp.expires_at))||
 Date.parse(stepUp.expires_at)<=n||Date.parse(stepUp.proved_at)>n||
 n-Date.parse(stepUp.proved_at)>STEP_UP_TTL_SEC*1000)
 throw Error('fresh_totp_and_verified_email_required');
 return {subject:user.id,sessionId:session.id,verified:true};
}
export function safeLinkHost(url){
 try{return new URL(url).origin==='https://rosie-central-identity-staging.onrender.com';}
 catch{return false;}
}
