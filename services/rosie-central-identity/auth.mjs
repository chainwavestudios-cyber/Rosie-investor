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

export const ORIGIN=process.env.ROSIE_IDENTITY_ORIGIN||'https://rosie-central-identity-staging.onrender.com';
export const BOB_RESOURCE='https://bob-training-intelligence-8019bf2b.base44.app';
const smtpConfigured=Boolean(
 process.env.ROSIE_SMTP_HOST&&process.env.ROSIE_SMTP_USER&&
 process.env.ROSIE_SMTP_PASSWORD&&process.env.ROSIE_SMTP_FROM
);
export const PUBLIC_SIGNUP_ENABLED=process.env.ROSIE_STAGING_SIGNUP_ENABLED==='true'&&smtpConfigured;
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
 baseURL:ORIGIN,secret,database:pool,
 trustedOrigins:[ORIGIN],
 advanced:{defaultCookieAttributes:{secure:true,httpOnly:true,sameSite:'lax'}},
 session:{expiresIn:3600,updateAge:900},
 emailAndPassword:{enabled:true,disableSignUp:!PUBLIC_SIGNUP_ENABLED,
  requireEmailVerification:true,minPasswordLength:12},
 emailVerification:{sendVerificationEmail,sendOnSignUp:true,sendOnSignIn:false},
 // Password is the only supported initial factor; no passwordless bypass.
 plugins:[
  twoFactor({issuer:'Rosie AI',backupCodeOptions:{storeBackupCodes:'encrypted'},
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
   accessTokenExpiresIn:600,allowDynamicClientRegistration:false,
   allowUnauthenticatedClientRegistration:false,
   // Customer accounts must NEVER administer OAuth client registration.
   clientPrivileges:async()=>false,resourcePrivileges:async()=>false,
   customIdTokenClaims:async({user})=>verifiedMfaClaims(user)
  })
 ]
});
