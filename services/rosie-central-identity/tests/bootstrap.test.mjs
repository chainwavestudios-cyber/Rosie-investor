import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const s=readFileSync(new URL('../auth.mjs',import.meta.url),'utf8');
test('OAuth registration requires signed bearer token, and public anonymous registration remains prohibited',()=>{
 assert.match(s,/allowDynamicClientRegistration:true/);
 assert.match(s,/allowUnauthenticatedClientRegistration:false/);
 assert.match(s,/validateInitialAccessToken:approveBootstrapClient/);
 assert.match(s,/expected\.length<48/);
 assert.match(s,/timingSafeEqual\(actual,wanted\)/);
 assert.match(s,/clientPrivileges:async\(\)=>false/);
});
test('bootstrap can only register the specific confidential BOB callback and authorization-code grant',()=>{
 assert.match(s,/BOB_CALLBACK='https:\/\/app\.base44\.com\/api\/apps\/6aeab8051a8d4e4d8019bf2b\/auth\/sso\/callback'/);
 assert.match(s,/md\.token_endpoint_auth_method!=='client_secret_basic'/);
 assert.match(s,/md\.application_type!=='web'/);
 assert.match(s,/md\.grant_types\[0\]!=='authorization_code'/);
 assert.match(s,/md\.scope!=='openid email profile'/);
});
test('MFA evidence uses custom OIDC claims (reserved amr and acr are stripped by Better Auth)',()=>{
 assert.match(s,/oidc_mfa_stepup_acceptance_pending/);
 assert.doesNotMatch(s,/return \{rosie_mfa_verified:true/);
 assert.doesNotMatch(s,/return \{amr:/);
 assert.match(s,/disabledPaths:\['\/token'\]/);
});
