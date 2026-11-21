const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');

test('Core playback is paced at 160 bytes per 20ms frame',()=>{
  assert.match(code,/const FRAME_BYTES=160, FRAME_MS=20/);
  assert.match(code,/nextFrameAt=Math\.max\(nextFrameAt,Date\.now\(\)\)\+FRAME_MS/);
  assert.match(code,/media:\{payload:frame\.toString\('base64'\)\}/);
});
test('Core-only media pacing respects interruption and websocket lifecycle',()=>{
  assert.match(code,/if \(session\.core\) \{\s*\/\/ Twilio expects raw mono/);
  assert.match(code,/const stopped=\(\)=>session\.stopping\|\|generation!==session\.generation/);
  assert.match(code,/session\.ws\.bufferedAmount>MAX_WS_BUFFER_BYTES/);
  assert.match(code,/if\(!await emitFrame\(pending\.subarray\(0,FRAME_BYTES\)\)\)break/);
});
test('Raw audio contract rejects headers and excessive duration',()=>{
  assert.match(code,/Core Cartesia response contained a file header/);
  assert.match(code,/totalBytes>MAX_AUDIO_BYTES/);
  assert.match(code,/if\(pending\.length&&!stopped\(\)\)await emitFrame\(pending\)/);
});
test('Other products retain the former media delivery path',()=>{
  assert.match(code,/\}else\{\s*while \(true\) \{\s*const \{ done, value \} = await reader\.read\(\)/);
  assert.match(code,/session\.recordingBuffer\.push\(payload\)/);
});
test('Core requires longer sustained caller signal before interrupting speech',()=>{
 assert.match(code,/session\.core \? 420 : BARGE_IN_GRACE_MS/);
});
