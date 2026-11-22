import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {CONNECTOR_DEFINITIONS,authorizationPackage,validateConnectorScopes,hashSecret,safeEqualHash,encryptVault,decryptVault,loadVaultKey,connectorConfig} from '../connector-security.mjs';

test('only minimal configured scope lists pass',()=>{
 assert.equal(validateConnectorScopes('googleworkspace',['https://www.googleapis.com/auth/drive.metadata.readonly']),true);
 assert.equal(validateConnectorScopes('googleworkspace',['https://mail.google.com/']),false);
 assert.equal(validateConnectorScopes('googleworkspace',['https://www.googleapis.com/auth/drive.metadata.readonly','https://www.googleapis.com/auth/drive.metadata.readonly']),false);
 assert.equal(validateConnectorScopes('dropbox',['files.metadata.read']),true);
 assert.equal(validateConnectorScopes('zoom',['files.metadata.read']),false);
});
test('OAuth authorization enforces fixed redirect and S256 code challenge',()=>{
 const x=authorizationPackage({provider:'googleworkspace',scopes:[CONNECTOR_DEFINITIONS.googleworkspace.scopes[0]],
  clientId:'client_id_abc',redirectUri:'https://core.rosieai.tech/api/apps/6aeabe88ef37542746e10df3/functions/coreGoogleOAuthCallback'});
 const u=new URL(x.url);
 assert.equal(u.searchParams.get('redirect_uri'),'https://core.rosieai.tech/api/apps/6aeabe88ef37542746e10df3/functions/coreGoogleOAuthCallback');
 assert.equal(u.searchParams.get('code_challenge_method'),'S256');
 assert.equal(u.searchParams.get('state'),x.state);
 assert.equal(u.searchParams.get('access_type'),'offline');
 assert.equal(x.stateHash,hashSecret(x.state));
 assert.equal(safeEqualHash(x.stateHash,hashSecret(x.state)),true);
 assert.equal(safeEqualHash(x.stateHash,hashSecret('wrong')),false);
 assert.throws(()=>authorizationPackage({provider:'dropbox',scopes:['files.metadata.read'],clientId:'abc',redirectUri:'https://attacker.example/callback'}));
});
test('AES-GCM vault requires correct associated context',()=>{
 const key=randomBytes(32),aad='org:product:provider';
 const box=encryptVault('secret-token',key,aad);
 assert.equal(decryptVault(box,key,aad),'secret-token');
 assert.throws(()=>decryptVault(box,key,'another-org:product:provider'));
 assert.throws(()=>decryptVault(box,randomBytes(32),aad));
 assert.equal(box.iv.length,12);
});
test('invalid encryption configuration always fails closed',()=>{
 assert.equal(loadVaultKey('not-a-base64-key'),null);
 assert.equal(loadVaultKey(randomBytes(32).toString('base64'))?.length,32);
 assert.throws(()=>encryptVault('t',Buffer.alloc(16),'a'));
});
test('missing provider keys do not authorize installation',()=>{
 assert.equal(connectorConfig('googleworkspace',{}).configured,false);
 assert.equal(connectorConfig('dropbox',{ROSIE_CONNECTOR_DROPBOX_CLIENT_ID:'abcdefgh',ROSIE_CONNECTOR_DROPBOX_CLIENT_SECRET:'secret-secret-secret'}).configured,true);
});
