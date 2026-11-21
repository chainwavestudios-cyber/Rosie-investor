const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');
test('Rosie Core isolates explicit Patch voice handoff to signed Core sessions',()=>{
 assert.ok(src.includes("if(!session.core||!auth)throw Error('Core Claude session unavailable')"));
 assert.ok(src.includes("session.coreAgent='rosie'"));
 assert.ok(src.includes("session.coreAgent='captain_patch'"));
 assert.ok(src.includes('session.coreProviders.captainPatchSystem'));
 assert.ok(src.includes('session.config.cartesiaVoiceId=session.coreProviders.captainPatchVoiceId'));
});
test('Patch handoff never reports an external worker or ticket creation',()=>{
 assert.ok(src.includes('external_worker_ack:false'));
 assert.ok(src.includes('Core provider session bootstrap unavailable'));
 assert.ok(!src.includes('captain_patch_worker_started:true'));
});
