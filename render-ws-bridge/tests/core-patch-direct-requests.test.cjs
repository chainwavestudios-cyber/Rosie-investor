'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyTechnicalIssue,isExplicitPatchRequest}=require('../core-support-routing.cjs');
test('Explicit Captain Patch and technical support requests immediately trigger handoff',()=>{
 for(const text of ['Captain Patch please','Captain Path please','Can you transfer me to Captain Patch?',
  'Let me speak with Captain Patch','I need tech support','Technical support please','Tier 1 please',
  'Connect me to tech support','Help desk please']){
  assert.equal(isExplicitPatchRequest(text),true,text);
  assert.equal(classifyTechnicalIssue(text),'general_technical',text);
 }
});
test('Casual queries and general chatter do not trigger a transfer',()=>{
 for(const text of ['What is Rosie AI?','Thanks for your help','How much does this cost?']){
  assert.equal(isExplicitPatchRequest(text),false,text);
  assert.equal(classifyTechnicalIssue(text),null,text);
 }
});
test('Technical failures route to Patch without a Rosie troubleshooting round',()=>{
 for(const text of ['Login fails','The link is broken','The button does nothing','My audio is not working']){
  assert.ok(classifyTechnicalIssue(text),text);
 }
});
