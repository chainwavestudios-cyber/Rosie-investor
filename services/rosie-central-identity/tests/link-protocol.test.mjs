import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 sha,opaque,signedProductHeaders,verifyProductHeaders,validateProductLinkInput,
 assertFreshMfa,ISSUER
} from '../link-contract.mjs';

const TEST_KEY='synthetic-private-key-for-tests-32-characters-minimum-001';
const input={product:'bob',organizationId:'a'.repeat(24),productPrincipalId:'b'.repeat(24)};
const body=JSON.stringify(input);
const nonce=opaque();
const now=Date.now();

test('HMAC signs exact endpoint, product, body, nonce and 60-second freshness',()=>{
 const h=signedProductHeaders({path:'/api/links/prepare',body,product:'bob',secret:TEST_KEY,timestamp:now,nonce});
 assert.equal(verifyProductHeaders({path:'/api/links/prepare',body,headers:h,secret:TEST_KEY,now}).ok,true);
 assert.equal(verifyProductHeaders({path:'/api/links/redeem',body,headers:h,secret:TEST_KEY,now}).ok,false);
 assert.equal(verifyProductHeaders({path:'/api/links/prepare',body:body+' ',headers:h,secret:TEST_KEY,now}).ok,false);
 assert.equal(verifyProductHeaders({path:'/api/links/prepare',body,headers:h,secret:'wrong-key'.repeat(6),now}).ok,false);
 assert.equal(verifyProductHeaders({path:'/api/links/prepare',body,headers:h,secret:TEST_KEY,now:now+60001}).ok,false);
});
test('HMAC cannot be forged by changing product key or using nonprivate secret',()=>{
 const h=signedProductHeaders({path:'/api/links/prepare',body,product:'bob',secret:TEST_KEY,timestamp:now,nonce});
 assert.equal(verifyProductHeaders({path:'/api/links/prepare',body,headers:{...h,'x-rosie-product':'emailiq'},secret:TEST_KEY,now}).ok,false);
 assert.throws(()=>signedProductHeaders({path:'/api/links/prepare',body,product:'bob',secret:'abc',timestamp:now,nonce}),/signature_input_invalid/);
});
test('No email, user-selected role, or arbitrary organization is an identity link authority',()=>{
 assert.deepEqual(validateProductLinkInput(input),input);
 for(const invalid of [
  {...input,email:'other@example.invalid'},
  {...input,role:'admin'},
  {...input,organizationId:'not-a-real-id'},
  {...input,productPrincipalId:'short'},
  {...input,product:'unsupported'},
 ])assert.throws(()=>validateProductLinkInput(invalid),/invalid_product_membership_reference/);
});
test('Only a same-session fresh authenticated TOTP proof and verified email allow approval',()=>{
 const session={id:'session-acceptance-01'};
 const user={id:'user-acceptance-01',emailVerified:true,twoFactorEnabled:true};
 const proved_at=new Date(now-10000).toISOString(),expires_at=new Date(now+200000).toISOString();
 const proof={session_id:session.id,user_id:user.id,method:'totp',proved_at,expires_at};
 assert.equal(assertFreshMfa({session,user,stepUp:proof,now:new Date(now)}).verified,true);
 for(const [s,u,p] of [
  [{id:'other-session'},user,proof],
  [session,{...user,emailVerified:false},proof],
  [session,{...user,twoFactorEnabled:false},proof],
  [session,user,{...proof,method:'sms'}],
  [session,user,{...proof,user_id:'different-user'}],
  [session,user,{...proof,expires_at:new Date(now-1).toISOString()}],
  [session,user,{...proof,proved_at:new Date(now-301000).toISOString()}]
 ])assert.throws(()=>assertFreshMfa({session:s,user:u,stepUp:p,now:new Date(now)}),/fresh_totp_and_verified_email_required/);
});
test('Central link API can never issue identity from a matching email or social provider alone',()=>{
 const api=readFileSync(new URL('../link-api.mjs',import.meta.url),'utf8');
 const migration=readFileSync(new URL('../link-migrate.mjs',import.meta.url),'utf8');
 assert.match(api,/const checked=verifyProductHeaders/);
 assert.match(api,/assertFreshMfa\(/);
 assert.match(api,/auth\.api\.verifyTOTP/);
 assert.match(api,/FOR UPDATE/);
 assert.match(api,/redeemed_at/);
 assert.match(api,/identity_link_conflict/);
 assert.doesNotMatch(api,/user_email|account_email|email_address|email\s*===\s*.*email/);
 assert.match(migration,/rosie_identity_mfa_staging/);
 assert.match(migration,/REVOKE ALL ON ALL TABLES/);
 assert.match(ISSUER,/rosie-central-identity-staging/);
});
