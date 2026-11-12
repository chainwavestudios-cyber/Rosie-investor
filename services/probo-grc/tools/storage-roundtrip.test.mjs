import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const file=new URL('./storage-roundtrip.mjs',import.meta.url).pathname;
test('no storage operation without presigned URLs',()=>{
 const env={...process.env};delete env.PROBO_TEST_PRESIGNED_PUT;delete env.PROBO_TEST_PRESIGNED_GET;
 const r=spawnSync(process.execPath,[file],{env,encoding:'utf8'});
 assert.equal(r.status,2);assert.match(r.stderr,/Missing presigned PUT\/GET/);
});
test('rejects unsupported signed endpoint prior to request',()=>{
 const r=spawnSync(process.execPath,[file],{env:{...process.env,PROBO_TEST_PRESIGNED_PUT:'https://example.com/upload',PROBO_TEST_PRESIGNED_GET:'https://example.com/download'},encoding:'utf8'});
 assert.equal(r.status,1);assert.match(r.stderr,/Only Neon HTTPS presigned URLs accepted/);
});
