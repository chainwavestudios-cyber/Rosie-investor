/**
 * ROSIE CUSTOMER IDENTITY — ISOLATED STAGING ISSUER
 * Separate Neon Postgres database. Never reuse managed Neon Auth user tables.
 * Release policy: public signup off without verified SMTP, MFA enrollment
 * required before OAuth authorization, and each product independently authorizes
 * the immutable OIDC sub instead of email.
 */
import {betterAuth} from 'better-auth';
import {jwt, twoFactor} from 'better-auth/plugins';
import {oauthProvider} from '@better-auth/oauth-provider';
import pg from 'pg';
import nodemailer from 'nodemailer';
import {createHash,timingSafeEqual} from 'node:crypto';

export const ORIGIN=process.env.ROSIE_IDENTITY_ORIGIN||'https://rosie-central-identity-staging.onrender.com';
export const BOB_RESOURCE='https://bob-training-intelligence-8019bf2b.base44.app';
const smtpConfigured=Boolean(
 process.env.ROSIE_SMTP_HOST&&process.env.ROSIE_SMTP_USER&&
 process.env.ROSIE_SMTP_PASSWORD&&process.env.ROSIE_SMTP_FROM
);
export const PUBLIC_SIGNUP_ENABLED=process.env.ROSIE_STAGING_SIGNUP_ENABLED==='true'&&smtpConfigured;
// Three identity providers for the same Rosie customer account (not product
// API integrations). Keys exist ONLY in Render environment secrets.
export const SOCIAL_PROVIDER_CALLBACKS=Object.freeze({
 google:ORIGIN+'/api/auth/callback/google',
 facebook:ORIGIN+'/api/auth/callback/facebook',
 microsoft:ORIGIN+'/api/auth/callback/microsoft'
});
const hasPair=(prefix)=>Boolean(process.env[prefix+'_CLIENT_ID']&&process.env[prefix+'_CLIENT_SECRET']);
export const SOCIAL_PROVIDER_CONFIGURED=Object.freeze({
 google:hasPair('GOOGLE'),
 facebook:hasPair('FACEBOOK'),
 microsoft:hasPair('MICROSOFT')
});
// Social sign-in for existing accounts and creation of NEW social identities
// are separate switches. No public customer registration during staging.
export const SOCIAL_SIGNUP_ENABLED=process.env.ROSIE_STAGING_SOCIAL_SIGNUP_ENABLED==='true';
export const socialProviders={
 ...(SOCIAL_PROVIDER_CONFIGURED.google?{
  google:{clientId:process.env.GOOGLE_CLIENT_ID,
   clientSecret:process.env.GOOGLE_CLIENT_SECRET,
   prompt:'select_account',disableSignUp:!SOCIAL_SIGNUP_ENABLED}
 }:{}),
 ...(SOCIAL_PROVIDER_CONFIGURED.facebook?{
  facebook:{clientId:process.env.FACEBOOK_CLIENT_ID,
   clientSecret:process.env.FACEBOOK_CLIENT_SECRET,
   // The provider can return a missing email: we do NOT manufacture one.
   scopes:['email','public_profile'],disableSignUp:!SOCIAL_SIGNUP_ENABLED}
 }:{}),
 ...(SOCIAL_PROVIDER_CONFIGURED.microsoft?{
  microsoft:{clientId:process.env.MICROSOFT_CLIENT_ID,
   clientSecret:process.env.MICROSOFT_CLIENT_SECRET,
   // 'common' supports personal Outlook.com/Hotmail and work/school accounts.
   tenantId:'common',authority:'https://login.microsoftonline.com',
   prompt:'select_account',disableSignUp:!SOCIAL_SIGNUP_ENABLED,
   // Do not copy large base64 Microsoft photo payloads into cookies.
   mapProfileToUser:()=>({image:null})}
 }:{})
};

export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:7000});
const secret=process.env.BETTER_AUTH_SECRET;
if(!secret||secret.length<32)throw Error('BETTER_AUTH_SECRET of 32+ characters is required');
if(!process.env.DATABASE_URL)throw Error('Dedicated staging DATABASE_URL is required');
const transport=smtpConfigured?nodemailer.createTransport({
 host:process.env.ROSIE_SMTP_HOST,port:Number(process.env.ROSIE_SMTP_PORT||587),
 secure:process.env.ROSIE_SMTP_PORT==='465',requireTLS:process.env.ROSIE_SMTP_PORT!=='465',
 auth:{user:process.env.ROSIE_SMTP_USER,pass:process.env.ROSIE_SMTP_PASSWORD}
}):null;
const sendVerificationEmail=async({user,url})=>{
 if(!transport||!PUBLIC_SIGNUP_ENABLED)throw Error('Verification delivery not enabled in staging');
 if(!url.startsWith(ORIGIN+'/api/auth/'))throw Error('Unexpected verification destination');
 await transport.sendMail({from:process.env.ROSIE_SMTP_FROM,to:user.email,
  subject:'Verify your Rosie AI account',text:'Verify your Rosie AI email using this secure link:\n'+url+'\n\nIf you did not register, ignore this message.'});
};

// Temporary, high-entropy, one-use operator token for registering exactly
// ONE confidential staging client. No public registration is permitted.
export const BOB_CALLBACK='https://app.base44.com/api/apps/6aeab8051a8d4e4d8019bf2b/auth/sso/callback';
export const BOB_CLIENT_NAME='BOB Training Intelligence — Rosie MFA staging';
export function approveBootstrapClient({initialAccessToken,clientMetadata}){
 const expected=process.env.ROSIE_OAUTH_REGISTRATION_TOKEN||'';
 if(expected.length<48||typeof initialAccessToken!=='string')return false;
 const actual=createHash('sha256').update(initialAccessToken).digest();
 const wanted=createHash('sha256').update(expected).digest();
 if(!timingSafeEqual(actual,wanted))return false;
 const md=clientMetadata||{};
 if(md.client_name!==BOB_CLIENT_NAME||md.application_type!=='web'||
    md.token_endpoint_auth_method!=='client_secret_basic')return false;
 if(!Array.isArray(md.redirect_uris)||md.redirect_uris.length!==1||
    md.redirect_uris[0]!==BOB_CALLBACK)return false;
 if(md.scope!=='openid email profile')return false;
 if(!Array.isArray(md.grant_types)||md.grant_types.length!==1||
    md.grant_types[0]!=='authorization_code')return false;
 if(md.resources!==undefined && (!Array.isArray(md.resources)||
   md.resources.length!==1||md.resources[0]!==BOB_RESOURCE))return false;
 return {};
}

export function readyForOidc(user){
 return Boolean(user?.emailVerified===true&&user?.twoFactorEnabled===true);
}
export function verifiedMfaClaims(user){
 if(!readyForOidc(user))throw Error('verified_email_and_totp_required');
 return {rosie_mfa_verified:true,rosie_auth_factor:'totp'};
}

export const auth=betterAuth({
 appName:'Rosie AI Customer Identity (Staging)',
 disabledPaths:['/token'],
 socialProviders,
 // Never join two identities solely because their email fields match.
 account:{accountLinking:{disableImplicitLinking:true,trustedProviders:[]}},
 baseURL:ORIGIN,secret,database:pool,
 trustedOrigins:[ORIGIN],
 advanced:{defaultCookieAttributes:{secure:true,httpOnly:true,sameSite:'lax'}},
 session:{expiresIn:3600,updateAge:900},
 emailAndPassword:{enabled:true,disableSignUp:!PUBLIC_SIGNUP_ENABLED,
  requireEmailVerification:true,minPasswordLength:12},
 emailVerification:{sendVerificationEmail,sendOnSignUp:true,sendOnSignIn:false},
 // Credential accounts still require passwords for authenticator enrollment;
 // social-only identities can enroll an authenticator without inventing a password.
 plugins:[
  twoFactor({issuer:'Rosie AI',allowPasswordless:true,
   backupCodeOptions:{storeBackupCodes:'encrypted'},
   totpOptions:{digits:6,period:30}}),
  jwt({disableSettingJwtHeader:true}),
  oauthProvider({
   loginPage:'/login',consentPage:'/consent',
   signup:{page:'/signup'},
   postLogin:{page:'/setup-mfa',consentReferenceId:()=>undefined,
    shouldRedirect:async({user})=>!readyForOidc(user)},
   resources:[BOB_RESOURCE],scopes:['openid','email','profile'],
   clientRegistrationDefaultResources:[BOB_RESOURCE],
   grantTypes:['authorization_code'],idTokenExpiresIn:600,
   accessTokenExpiresIn:600,allowDynamicClientRegistration:true,
   allowUnauthenticatedClientRegistration:false,
   validateInitialAccessToken:approveBootstrapClient,
   // Customer accounts must NEVER administer OAuth client registration.
   clientPrivileges:async()=>false,resourcePrivileges:async()=>false,
   customIdTokenClaims:async({user})=>verifiedMfaClaims(user)
  })
 ]
});
