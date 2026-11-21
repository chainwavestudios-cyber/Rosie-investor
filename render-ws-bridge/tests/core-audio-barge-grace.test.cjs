const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
test('Core barge-in requires sustained caller activity and never clears on transient sound',()=>{
 assert.match(source,/if \(session\.state !== 'speaking' \|\| !session\.callerSpeaking\) return/);
 assert.match(source,/session\.core \? 420 : BARGE_IN_GRACE_MS/);
 assert.match(source,/sendToTwilio\(session\.ws, \{ event: 'clear', streamSid \}\)/);
});
