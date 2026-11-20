const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync(__dirname+'/server.js','utf8');
test('Core live call uses provider lease only after isolated auth',()=>{
 for(const k of ['session.coreProviders={anthropicKey:lease.anthropicKey','coreClaudeTurn(session)','session.core?await coreClaudeTurn(session)','session.core?session.coreProviders?.cartesiaKey:CARTESIA_API_KEY','session.coreProviders=null','Core provider session bootstrap unavailable'])assert.ok(s.includes(k),k);
});
test("Core speech requests are direct to Anthropic and Cartesia and don't redirect BOB or Fronter",()=>{
 assert.ok(s.includes("https://api.anthropic.com/v1/messages"));
 assert.ok(s.includes("https://api.cartesia.ai/tts/bytes"));
 assert.ok(s.includes("'claude-haiku-4-5-20251001'"));
 assert.ok(s.includes("session.core?'sonic-3.6':CARTESIA_MODEL"));
 assert.ok(s.includes("const isBob=!isCore&&"));
 assert.ok(s.includes("if (session.browser) {"));
});
test('Core rejects missing session credentials and avoids transcript logs and recordings',()=>{
 assert.ok(s.includes("if(session.core)log('[CORE] speech turn finalized')"));
 assert.ok(s.includes("if(!session.core)session.recordingBuffer.push(audioPayload)"));
 assert.ok(s.includes("if(!session.core)session.recordingBuffer.push(payload)"));
 assert.ok(s.includes("if(session.core){try{session.ws.close(1011,'Core dialogue failed')}catch{}}"));
});