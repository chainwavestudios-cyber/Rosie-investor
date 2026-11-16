import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateInvestorPilotPayload, authorizeInvestorPilotSession,
  authorizeInvestorPilotLead, requireInvestorPilotAuthority,
} from './investorPilotAccess.mjs';

const base={mode:'qa',question:'What is the investor minimum?',leadId:'owned-lead',sessionUserId:'agent-1',sessionToken:'private-token',transcript:[{speaker:1,text:'What is the minimum?'}]};
const user={id:'agent-1',username:'test-agent',isActive:true,mustResetPassword:false,sessionToken:'private-token',role:'dialer',aiSettingsJson:JSON.stringify({sharedConversationV1:true,liveAIEnabled:true,liveQA:true,liveCoach:true}),permissions:JSON.stringify({liveAIAssistant:true,liveQA:true,liveCoach:true})};
const lead={id:'owned-lead',debtCoachOwner:'test-agent'};

test('valid Q&A and Coach request shapes permit preflight only',()=>{
  assert.equal(validateInvestorPilotPayload(base).ok,true);
  assert.equal(validateInvestorPilotPayload({...base,mode:'coach',question:undefined}).ok,true);
});
test('invalid modes, unsupported bodies and missing sessions denied before database',()=>{
  for(const bad of [null,[],{...base,mode:'admin'},{...base,sessionToken:''},
    {...base,sessionUserId:''},{...base,leadId:''},{...base,question:'   '},
    {...base,question:'A'.repeat(1201)}]){
      assert.equal(validateInvestorPilotPayload(bad).ok,false);
    }
});
test('browser authority assertions, client KB, billing details are rejected',()=>{
  for(const key of ['kbEntries','kbName','_ctx','organization_id','organizationId','tenantId','priceId','costUsd','stripeCustomerId','model','approvedKb']){
    assert.equal(validateInvestorPilotPayload({...base,[key]:null}).code,'PILOT_CLIENT_AUTHORITY_FORBIDDEN',key);
  }
});
test('oversize and malformed transcript fails closed',()=>{
  for(const transcript of [Array(31).fill({speaker:1,text:'x'}),[{speaker:'1',text:'x'}],
    [{speaker:4,text:'x'}],[{speaker:1,text:'x'.repeat(1501)}],{text:'x'}]){
    assert.equal(validateInvestorPilotPayload({...base,transcript}).code,'PILOT_TRANSCRIPT_INVALID');
  }
});
test('valid authenticated session with per-user flag and service permissions passes only session stage',()=>{
  assert.equal(authorizeInvestorPilotSession({user,sessionToken:user.sessionToken,mode:'qa'}).ok,true);
  assert.equal(authorizeInvestorPilotSession({user,sessionToken:user.sessionToken,mode:'coach'}).ok,true);
});
test('invalid, revoked, inactive, reset-required, or missing sessions fail',()=>{
  for(const candidate of [null,{...user,isActive:false},{...user,mustResetPassword:true},
    {...user,sessionToken:''},{...user,role:'fronter'}]){
    assert.equal(authorizeInvestorPilotSession({user:candidate,sessionToken:'private-token',mode:'qa'}).ok,false);
  }
  assert.equal(authorizeInvestorPilotSession({user,sessionToken:'forged',mode:'qa'}).code,'PILOT_UNAUTHORIZED');
});
test('missing or malformed pilot feature flag and disabled agent services are denied',()=>{
  for(const settings of ['{}','not-json','{"sharedConversationV1":"true"}',
      '{"sharedConversationV1":false}','{"sharedConversationV1":true,"liveQA":false}',
      '{"sharedConversationV1":true,"liveAIEnabled":false}']){
    assert.equal(authorizeInvestorPilotSession({user:{...user,aiSettingsJson:settings},sessionToken:user.sessionToken,mode:'qa'}).ok,false);
  }
});
test('dialer Q&A and Coach need their own server-rechecked permissions',()=>{
  for(const permissions of [
    '{"liveQA":true,"liveCoach":true}',
    '{"liveAIAssistant":true,"liveQA":false,"liveCoach":true}',
    'invalid',
  ]){
    assert.equal(authorizeInvestorPilotSession({
      user:{...user,permissions},sessionToken:user.sessionToken,mode:'qa',
    }).code,'PILOT_FEATURE_DENIED');
  }
  assert.equal(authorizeInvestorPilotSession({
    user:{...user,permissions:'{"liveAIAssistant":true,"liveQA":true,"liveCoach":false}'},
    sessionToken:user.sessionToken,mode:'coach',
  }).code,'PILOT_FEATURE_DENIED');
});
test('lead ownership matches authenticated user only, including case-folding',()=>{
  assert.equal(authorizeInvestorPilotLead({user,lead}).ok,true);
  assert.equal(authorizeInvestorPilotLead({user,lead:{...lead,debtCoachOwner:'TEST-AGENT'}}).ok,true);
});
test('other agent, unassigned, deleted and missing leads are denied',()=>{
  for(const bad of [null,{...lead,debtCoachOwner:'other-agent'},
    {...lead,debtCoachOwner:''},{...lead,deletedAt:'2026-11-15T00:00:00Z'},
    {...lead,id:undefined}]){
    assert.equal(authorizeInvestorPilotLead({user,lead:bad}).code,'PILOT_LEAD_DENIED');
  }
});
test('even managers cannot use app-wide privilege to bypass unverified tenant assignment',()=>{
  const manager={...user,role:'admin'};
  assert.equal(authorizeInvestorPilotLead({user:manager,lead:{...lead,debtCoachOwner:'someone-else'}}).ok,false);
});
test('verified session and contact do not confer tenant authority',()=>{
  assert.equal(requireInvestorPilotAuthority().code,'PILOT_TENANT_LINK_PENDING');
  assert.equal(requireInvestorPilotAuthority({tenantLink:{source:'rosie_core',verification_status:'pending'}}).code,'PILOT_TENANT_LINK_PENDING');
});
test('tenant alone cannot authorize unapproved KB or unverified ledger',()=>{
  const tenantLink={source:'rosie_core',verification_status:'verified'};
  assert.equal(requireInvestorPilotAuthority({tenantLink}).code,'PILOT_APPROVED_KB_PENDING');
  const kbApproval={source:'server_verified',status:'approved',version:'v1'};
  assert.equal(requireInvestorPilotAuthority({tenantLink,kbApproval}).code,'PILOT_METERING_PENDING');
  assert.equal(requireInvestorPilotAuthority({tenantLink,kbApproval,meteringAuthority:{status:'pending'}}).ok,false);
});
test('future independent server-only authority must satisfy all three explicit gates',()=>{
  const value=requireInvestorPilotAuthority({
    tenantLink:{source:'rosie_core',verification_status:'verified'},
    kbApproval:{source:'server_verified',status:'approved',version:'v1'},
    meteringAuthority:{source:'rosie_core',status:'verified',ledger_id:'verified-ledger'},
  });
  assert.equal(value.ok,true,'policy allows future verified evidence, not current gateway');
});
test('staging gateway never calls a paid model or falls back to the legacy endpoint',()=>{
  const source=readFileSync(new URL('../functions/investorBobPilotAI/entry.ts',import.meta.url),'utf8');
  assert.match(source,/requireInvestorPilotAuthority\(\)/);
  assert.match(source,/PILOT_PROVIDER_NOT_ENABLED/);
  const executable=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
  assert.doesNotMatch(executable,/InvokeLLM|anthropic\.com|liveAssistantAI|functions\.invoke\(/i);
});
test('pilot UI never sends client KB or usage metadata to new authenticated gateway',()=>{
  const source=readFileSync(new URL('../../src/components/debt/DebtLiveCall.jsx',import.meta.url),'utf8');
  assert.match(source,/base44\.functions\.invoke\('investorBobPilotAI'/);
  const calls=source.match(/base44\.functions\.invoke\('investorBobPilotAI',[\s\S]*?\}\)/g)||[];
  assert.equal(calls.length,2,'both pilot QA and Coach use the dedicated gateway');
  for(const request of calls){
    assert.match(request,/sessionUserId, sessionToken/);
    assert.match(request,/leadId: leadRef\.current\?\.id/);
    assert.doesNotMatch(request,/kbEntries|kbName|_ctx|organization_id/);
  }
  assert.match(source,/if \(!sharedPolicyEnabled\) logAI\('qa'\);/);
  assert.match(source,/if \(!sharedPolicyEnabled\) logAI\('coach'\);/);
});
