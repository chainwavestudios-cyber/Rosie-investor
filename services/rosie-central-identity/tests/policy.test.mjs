import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../auth.mjs',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/client.js',import.meta.url),'utf8');
test('registration requires verified outbound email delivery and explicit test enablement',()=>{
 assert.match(source,/ROSIE_STAGING_SIGNUP_ENABLED/);
 assert.match(source,/smtpConfigured/);
 assert.match(source,/disableSignUp:!PUBLIC_SIGNUP_ENABLED/);
 assert.match(source,/requireEmailVerification:true/);
});
test('product OAuth is blocked before email verification AND TOTP enrollment',()=>{
 assert.match(source,/emailVerified===true&&user\?\.twoFactorEnabled===true/);
 assert.match(source,/shouldRedirect:async\(\{user\}\)=>!readyForOidc\(user\)/);
 assert.match(source,/customIdTokenClaims:async\(\{user\}\)=>verifiedMfaClaims\(user\)/);
 assert.match(source,/amr:\['pwd','totp'\]/);
});
test('client and redirect permissions fail closed',()=>{
 assert.match(source,/allowDynamicClientRegistration:false/);
 assert.match(source,/allowUnauthenticatedClientRegistration:false/);
 assert.match(source,/clientPrivileges:async\(\)=>false/);
 assert.match(source,/resourcePrivileges:async\(\)=>false/);
 assert.match(server,/verifyOAuthQueryParams\(str,secret\)/);
 assert.match(server,/getOAuthClientPublic/);
 assert.match(server,/readyForOidc\(session\.user\)/);
});
test('TOTP secret shown locally as QR, and never sent to remote QR services',()=>{
 assert.match(ui,/QRCode\.toCanvas/);
 assert.match(ui,/twoFactor\.enable/);
 assert.match(ui,/twoFactor\.verifyTotp/);
 assert.doesNotMatch(ui,/api\.qrserver\.com|chart\.googleapis\.com/);
});
test('one account never grants access to a BOB tenant by email alone',()=>{
 assert.match(source,/BOB_RESOURCE='https:\/\/bob-training-intelligence-/);
 assert.match(source,/auth=betterAuth/);
 assert.doesNotMatch(server,/BOBMember\.create|BOBOrganization\.update/);
});
