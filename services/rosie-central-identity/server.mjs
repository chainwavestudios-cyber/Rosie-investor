import express from 'express';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {toNodeHandler} from 'better-auth/node';
import {verifyOAuthQueryParams} from '@better-auth/oauth-provider';
import {auth,ORIGIN,PUBLIC_SIGNUP_ENABLED,SOCIAL_SIGNUP_ENABLED,SOCIAL_PROVIDER_CONFIGURED,SOCIAL_PROVIDER_CALLBACKS,pool,BOB_RESOURCE,readyForOidc} from './auth.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
app.use((req,res,next)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
 next();
});
app.get('/health',async(_req,res)=>{
 try{await pool.query('select 1');res.json({ok:true,stage:'isolated',provider:'better-auth-totp',signupEnabled:PUBLIC_SIGNUP_ENABLED});}
 catch{res.status(503).json({ok:false,stage:'isolated'});}
});
app.get('/api/identity/config',(_req,res)=>res.json({
 stage:'staging',signupEnabled:PUBLIC_SIGNUP_ENABLED,
 socialSignupEnabled:SOCIAL_SIGNUP_ENABLED,
 socialProviders:SOCIAL_PROVIDER_CONFIGURED,
 // Callback URIs can be registered without exposing the client IDs/secrets.
 socialCallbacks:SOCIAL_PROVIDER_CALLBACKS,
 requireTotp:true,issuer:ORIGIN+'/api/auth',resource:BOB_RESOURCE
}));
const bAuth=toNodeHandler(auth);
app.all('/api/auth/*',(req,res)=>bAuth(req,res));
function requestHeaders(req){
 const h=new Headers();
 for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')h.set(k,v);
 return h;
}
async function verifiedSignedQuery(req){
 const signedQuery=new URL(req.originalUrl,ORIGIN).search.slice(1);
 // The provider signs *all* parameters, including exp and client_id.
 // Filtering the query invalidates consent and must never be done.
 const params=new URLSearchParams(signedQuery);
 if(params.getAll('sig').length!==1||!params.has('exp')||!params.has('client_id'))return null;
 const {secret}=await auth.$context;
 if(!await verifyOAuthQueryParams(signedQuery,secret))return null;
 return params;
}
// Return metadata only after BOTH a signed, unmodified request and verified
// user session. A browser can never select a client by tampering with query.
app.get('/api/identity/consent-context',async(req,res)=>{
 try{
  const signed=await verifiedSignedQuery(req);
  if(!signed)return res.status(400).json({error:'Invalid or expired signed authorization request'});
  const headers=requestHeaders(req);
  const session=await auth.api.getSession({headers});
  if(!session?.user)return res.status(401).json({error:'Sign in required'});
  if(!readyForOidc(session.user))return res.status(403).json({error:'Verified email and authenticator MFA required'});
  const client=await auth.api.getOAuthClientPublic({query:{client_id:signed.get('client_id')},headers});
  const redirect=signed.get('redirect_uri')||'';
  if(!redirect.startsWith('https://'))return res.status(400).json({error:'Untrusted client redirect'});
  res.json({clientName:String(client?.client_name||'Rosie product').slice(0,120),
   redirectHost:new URL(redirect).host,
   scopes:String(signed.get('scope')||'').split(/\s+/).filter(Boolean).slice(0,10)});
 }catch{res.status(400).json({error:'Authorization request could not be verified'});}
});
app.use(express.static(join(dir,'dist'),{index:false,immutable:false,maxAge:0}));
app.get('/styles.css',(_req,res)=>res.sendFile(join(dir,'public','styles.css')));
const pages=new Set(['/','/login','/signup','/consent','/account','/setup-mfa','/two-factor','/verify-email']);
app.get('*',async(req,res)=>{
 if(!pages.has(req.path))return res.status(404).type('text').send('Not found');
 try{res.type('html').send(await readFile(join(dir,'public','index.html'),'utf8'));}
 catch{res.status(503).type('text').send('Identity UI unavailable');}
});
const port=Number(process.env.PORT||10000);
app.listen(port,'0.0.0.0',()=>console.log('[identity] staging listener ready on port',port,'signup enabled:',PUBLIC_SIGNUP_ENABLED));
