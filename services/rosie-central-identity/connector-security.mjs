import {createHash,randomBytes,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
const h=x=>createHash('sha256').update(x).digest('hex');
export const CONNECTOR_DEFINITIONS=Object.freeze({
 googleworkspace:Object.freeze({authorize:'https://accounts.google.com/o/oauth2/v2/auth',
  token:'https://oauth2.googleapis.com/token',
  scopes:['https://www.googleapis.com/auth/drive.metadata.readonly','https://www.googleapis.com/auth/calendar.events.readonly'],
  clientPrefix:'ROSIE_CONNECTOR_GOOGLE'}),
 dropbox:Object.freeze({authorize:'https://www.dropbox.com/oauth2/authorize',
  token:'https://api.dropboxapi.com/oauth2/token',scopes:['files.metadata.read','account_info.read'],
  clientPrefix:'ROSIE_CONNECTOR_DROPBOX'})
});
export const CONNECTOR_ORIGIN=process.env.ROSIE_IDENTITY_ORIGIN||'https://rosie-central-identity-staging.onrender.com';
export function connectorRedirectUri(provider) {
 if (provider === 'googleworkspace') return 'https://core.rosieai.tech/api/apps/6aeabe88ef37542746e10df3/functions/coreGoogleOAuthCallback';
 return CONNECTOR_ORIGIN + '/api/connectors/callback/' + provider;
}
export const b64url=buf=>Buffer.from(buf).toString('base64url');
export const hashSecret=v=>h(String(v));
export function safeEqualHash(a,b){
 if(!/^[0-9a-f]{64}$/.test(a||'')||!/^[0-9a-f]{64}$/.test(b||''))return false;
 return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
export function loadVaultKey(source=process.env.ROSIE_CONNECTOR_VAULT_KEY){
 if(!source||typeof source!=='string')return null;
 const v=Buffer.from(source,'base64');
 if(v.length!==32||v.toString('base64')!==source.replace(/\s/g,''))return null;
 return v;
}
export function encryptVault(value,key,associatedData){
 if(!Buffer.isBuffer(key)||key.length!==32||typeof value!=='string'||!associatedData)throw Error('vault_configuration_invalid');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(associatedData,'utf8'));
 const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]);
 return {ciphertext,iv};
}
export function decryptVault(box,key,associatedData){
 if(!Buffer.isBuffer(key)||key.length!==32||!box?.ciphertext||!box?.iv||!associatedData)throw Error('vault_configuration_invalid');
 const data=Buffer.from(box.ciphertext),tag=data.subarray(data.length-16);
 if(tag.length!==16)throw Error('vault_ciphertext_invalid');
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv));
 decipher.setAAD(Buffer.from(associatedData,'utf8'));
 decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(data.subarray(0,data.length-16)),decipher.final()]).toString('utf8');
}
export function connectorConfig(provider,env=process.env){
 const def=CONNECTOR_DEFINITIONS[provider];
 if(!def)return null;
 const clientId=env[def.clientPrefix+'_CLIENT_ID']||'';
 const clientSecret=env[def.clientPrefix+'_CLIENT_SECRET']||'';
 const configured=clientId.length>=8&&clientSecret.length>=12;
 return {def,configured,clientId,clientSecret};
}
export function validateConnectorScopes(provider,scopes){
 const def=CONNECTOR_DEFINITIONS[provider];
 return Boolean(def&&Array.isArray(scopes)&&scopes.length>=1&&scopes.length<=def.scopes.length&&
  new Set(scopes).size===scopes.length&&scopes.every(scope=>def.scopes.includes(scope)));
}
export function authorizationPackage({provider,scopes,clientId,redirectUri}){
 if(!validateConnectorScopes(provider,scopes)||!clientId||redirectUri !== connectorRedirectUri(provider))throw Error('oauth_policy_denied');
 const state=b64url(randomBytes(32)),verifier=b64url(randomBytes(32));
 const challenge=b64url(createHash('sha256').update(verifier).digest());
 const def=CONNECTOR_DEFINITIONS[provider],url=new URL(def.authorize);
 url.searchParams.set('client_id',clientId);url.searchParams.set('redirect_uri',redirectUri);
 url.searchParams.set('response_type','code');url.searchParams.set('state',state);
 url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','S256');
 url.searchParams.set('scope',scopes.join(' '));
 if(provider==='googleworkspace'){url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent');url.searchParams.set('include_granted_scopes','false')}
 else url.searchParams.set('token_access_type','offline');
 return {url:url.toString(),state,verifier,stateHash:hashSecret(state)};
}
