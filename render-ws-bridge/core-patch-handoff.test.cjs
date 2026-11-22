const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const {classifyTechnicalIssue,PATCH_SYSTEM}=require('./core-support-routing.cjs');
const source=readFileSync(join(__dirname,'server.js'),'utf8');
const first=source.indexOf('async function coreClaudeTurn(session){');
const last=source.indexOf('// ── Turn response latency',first);
assert.ok(first>0&&last>first,'voice dialogue function must remain present');
const isolatedFunction=source.slice(first,last).trim();
function create(overrides={}){
 const calls=[],requestLog=[];
 const sandbox={
  classifyTechnicalIssue,PATCH_SYSTEM,
  log(){},AbortSignal,Date,JSON,String,Number,Error,
  callRelay:async p=>{calls.push(p);if(p.event==='patch_repair_request')return overrides.repair??{ok:true,queued:true,ticket_key:'rwt-'+'d'.repeat(32)};return overrides.handoff??{
   ok:true,accepted:true,support_role:'captain_patch',
   case_key:'patch-'+'a'.repeat(32)
  }},
  fetch:async(_url,args)=>{
   const body=JSON.parse(args.body);requestLog.push(body);
   return {ok:true,json:async()=>({content:[{type:'text',text:'Here is a short answer.'}]})};
  }
 };
 const invoke=vm.runInNewContext('('+isolatedFunction+')',sandbox);
 const session={core:true,coreRole:'rosie',callSid:'CA'+'b'.repeat(32),
  streamSid:'MZ'+'c'.repeat(32),config:{cartesiaVoiceId:'original'},
  coreProviders:{anthropicKey:'provider-test-key',system:'You are Rosie.\\nAuthenticated caller diagnostic metadata: {}',
   patchVoiceId:'3e39e9a5-585c-4f5f-bac6-5e4905c51095'},
  conversation:[{role:'assistant',content:'Core Help Desk. What seems to be the problem?'},
   {role:'user',content:overrides.transcript||'The Direct D button does nothing'}]};
 return {invoke,session,calls,requestLog};
}
test('Rosie hands off after a single technical issue and stops asking intake questions',async()=>{
 const h=create();const r=await h.invoke(h.session);
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].event,'patch_handoff');
 assert.equal(h.calls[0].issueCode,'button_not_working');
 assert.equal(h.calls[0].transcript,undefined,'no raw transcript sent in receipt');
 assert.equal(h.session.coreRole,'captain_patch');
 assert.equal(h.session.config.cartesiaVoiceId,h.session.coreProviders.patchVoiceId);
 assert.equal(h.requestLog.length,0,'Rosie does not call the LLM to interrogate technical callers');
 assert.match(r.text,/Captain Patch here/);
});
test('Rosie never pretends a transfer occurred if signed receipt is rejected',async()=>{
 const h=create({handoff:{ok:false,accepted:false}});const r=await h.invoke(h.session);
 assert.equal(h.session.coreRole,'rosie');
 assert.equal(h.requestLog.length,0);
 assert.doesNotMatch(r.text,/Captain Patch here/);
 assert.match(r.text,/unavailable/i);
});
test('General questions remain brief and do not generate support cases',async()=>{
 const h=create({transcript:'What is Rosie Core?'});const r=await h.invoke(h.session);
 assert.equal(h.calls.length,0);
 assert.equal(h.requestLog.length,1);
 assert.ok(h.requestLog[0].max_tokens<=70);
 assert.equal(r.text,'Here is a short answer.');
});
test('After confirmed handoff Patch, not Rosie, receives next user turn',async()=>{
 const h=create();await h.invoke(h.session);
 h.session.conversation.push({role:'assistant',content:'Captain Patch here. Go ahead.'});
 h.session.conversation.push({role:'user',content:'The link is not loading.'});
 const r=await h.invoke(h.session);
 assert.equal(h.calls.length,1,'no repeat handoff');
 assert.match(h.requestLog[0].system,/You are Captain Patch/);
 assert.equal(r.llmRuntime.agent_role,'captain_patch');
});
test('Core pacing is distinct from BOB/Fronter and stale replies are invalidated',()=>{
 assert.match(source,/session\.core \? 850 : BARGE_IN_GRACE_MS/);
 assert.match(source,/endpointing: session\.core\?'1250':'200'/);
 assert.match(source,/session\.callerSpeaking\|\|coreTurnSeq!==session\.coreTurnSeq/);
});

test('Verified Captain Patch can open scoped voice repair ticket, never claim live execution',async()=>{
 const h=create();await h.invoke(h.session);
 h.session.conversation.push({role:'assistant',content:'Captain Patch here. Go ahead.'});
 h.session.conversation.push({role:'user',content:'Please fix the problem and send it to engineering.'});
 const result=await h.invoke(h.session);
 assert.equal(h.calls.length,2);
 assert.equal(h.calls[1].event,'patch_repair_request');
 assert.equal(h.calls[1].case_key,'patch-'+'a'.repeat(32));
 assert.match(result.text,/repair request has been saved/);
 assert.match(result.text,/not started/);
 assert.equal(result.llmRuntime.worker_started,false);
 assert.equal(h.requestLog.length,0);
});
test('Patch never invents repair receipt when Core rejects voice repair request',async()=>{
 const h=create({repair:{ok:false,queued:false,error:'blocked'}});await h.invoke(h.session);
 h.session.conversation.push({role:'user',content:'Create an engineering ticket to fix this.'});
 const result=await h.invoke(h.session);
 assert.equal(result.llmRuntime.repair_request_queued,false);
 assert.match(result.text,/could not verify/);
});
