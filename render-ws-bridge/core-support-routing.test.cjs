const test=require('node:test'),assert=require('node:assert/strict');
const {classifyTechnicalIssue,PATCH_SYSTEM}=require('./core-support-routing.cjs');
for(const [spoken,code] of [
 ['The Direct D button does nothing','button_not_working'],
 ['I cannot log in to my account','login_access'],
 ['I am getting an application error','app_error'],
 ['The microphone is not working','voice_failure'],
 ['I need technical support','general_technical'],
 ['Please connect me to Patch','general_technical'],
 ['My billing error needs fixing','billing_support'],
 ['The dashboard is frozen','app_error']
])test('routes technical issue immediately: '+spoken,()=>assert.equal(classifyTechnicalIssue(spoken),code));
for(const spoken of ['What is Rosie AI?','Can you tell me about your apps?','I would like to know your hours'])
 test('keeps nontechnical question with Rosie: '+spoken,()=>assert.equal(classifyTechnicalIssue(spoken),null));
test('Patch persona is Tier 1, not a claimed engineering transfer',()=>{
 assert.match(PATCH_SYSTEM,/Tier 1/);
 assert.match(PATCH_SYSTEM,/not a canonical repair ticket/i);
});
