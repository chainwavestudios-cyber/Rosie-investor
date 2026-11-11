import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const auth=readFileSync(new URL('../auth.mjs',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/client.js',import.meta.url),'utf8');

test('Google, Facebook and Outlook/Microsoft are explicit, server-secret-gated social providers',()=>{
 for(const provider of ['google','facebook','microsoft']){
  assert.match(auth,new RegExp("SOCIAL_PROVIDER_CONFIGURED\\."+provider+"\\?"));
  assert.match(ui,new RegExp("id:'"+provider+"'"));
 }
 for(const prefix of ['GOOGLE','FACEBOOK','MICROSOFT']){
  assert.match(auth,new RegExp("hasPair\\('"+prefix+"'\\)"));
 }
 assert.match(auth,/SOCIAL_SIGNUP_ENABLED=process\.env\.ROSIE_STAGING_SOCIAL_SIGNUP_ENABLED==='true'/);
 assert.match(auth,/disableSignUp:!SOCIAL_SIGNUP_ENABLED/g);
});
test('Outlook.com and Hotmail personal Microsoft accounts are included in Entra common authority',()=>{
 assert.match(auth,/tenantId:'common'/);
 assert.match(auth,/authority:'https:\/\/login\.microsoftonline\.com'/);
 assert.match(auth,/prompt:'select_account'/);
});
test('No automatic user merging by matching email, and no provider chosen by arbitrary input',()=>{
 assert.match(auth,/accountLinking:\{disableImplicitLinking:true,trustedProviders:\[\]\}/);
 assert.match(ui,/SOCIAL_CHOICES/);
 assert.match(ui,/client\.linkSocial\(\{provider:btn\.dataset\.linkProvider/);
 assert.match(ui,/config\.socialProviders\?\.\[provider\]!==true/);
});
test('Social-only users can enroll TOTP without inventing a password, credential users still require it',()=>{
 assert.match(auth,/twoFactor\(\{issuer:'Rosie AI',allowPasswordless:true/);
 assert.match(ui,/needsAccountPassword=.*providerId==='credential'/);
 assert.match(ui,/needsAccountPassword\?\{password:/);
 assert.match(ui,/twoFactor\.verifyTotp/);
});
test('Social buttons and availability flags are visible for both login and signup without leaking secrets',()=>{
 assert.match(ui,/socialButtons\('signin'\)/);
 assert.match(ui,/socialButtons\('signup'\)/);
 assert.match(ui,/client\.signIn\.social\(\{provider,callbackURL\}\)/);
 assert.match(ui,/callbackURL=location\.origin\+oauthPage\('setup-mfa'\)/);
 assert.match(server,/socialProviders:SOCIAL_PROVIDER_CONFIGURED/);
 assert.match(server,/socialSignupEnabled:SOCIAL_SIGNUP_ENABLED/);
 assert.doesNotMatch(server,/socialProviders:\s*\{.*clientSecret/);
});
test('OAuth callback URIs are HTTPS, pinned to Rosie staging and never constructed from the request',()=>{
 for(const provider of ['google','facebook','microsoft'])
  assert.match(auth,new RegExp("ORIGIN\\+'/api/auth/callback/"+provider+"'"));
 assert.match(auth,/trustedOrigins:\[ORIGIN\]/);
});
