import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBlueprint,planBlueprint,validateFactoryStatus,inspectFactory} from '../agent-factory.mjs';
const good={
 org_id:'rosie-core-internal',
 request_id:'88888888-8888-4888-8888-888888888888',
 nonce:'99999999-9999-4999-8999-999999999999',
 mode:'register',display_name:'Agent Engine Trial',
 role:'engineer',team:'alpha',captain_id:'A01',
 mission:'Implement and test scoped engineering changes through approved Core tickets.',
 capabilities:['code_read','messaging','tests'],model:'core_default',
 monthly_budget_usd:10
};
test('valid draft and registration blueprints follow Core contract',()=>{
 assert.equal(validateBlueprint(good),null);
 assert.equal(validateBlueprint({...good,mode:'draft'}),null);
});
test('existing identities A01..A18 are never requested as new agent IDs',()=>{
 assert.equal(Object.hasOwn(good,'agent_id'),false);
 assert.equal(validateBlueprint({...good,agent_id:'A17'}),'unsupported_blueprint_field');
});
test('role, team and captain cannot be user-defined arbitrary values',()=>{
 assert.equal(validateBlueprint({...good,team:'outside'}),'invalid_team_or_role');
 assert.equal(validateBlueprint({...good,captain_id:'owner'}),'invalid_captain');
 assert.equal(validateBlueprint({...good,role:'root_admin'}),'invalid_team_or_role');
});
test('strict tool and budget allowlists enforce least-privilege request shape',()=>{
 assert.equal(validateBlueprint({...good,capabilities:['shell_exec']}),'invalid_capabilities');
 assert.equal(validateBlueprint({...good,capabilities:['tests','tests']}),'invalid_capabilities');
 assert.equal(validateBlueprint({...good,monthly_budget_usd:1001}),'invalid_budget');
});
test('blueprint creation grants zero runtime permissions and fails closed',()=>{
 const plan=planBlueprint(good);
 assert.deepEqual(plan.requested_capabilities,good.capabilities);
 assert.deepEqual(plan.granted_capabilities,[]);
 assert.equal(plan.execution_authorized,false);
 assert.equal(plan.message_runtime_attested,false);
 assert.equal(plan.qa_attested,false);
 assert.equal(plan.provisioning_state,'pending');
});
test('malformed request and cross-tenant input are rejected',()=>{
 assert.equal(validateBlueprint(null),'invalid_blueprint');
 assert.equal(validateBlueprint({...good,org_id:'another-tenant'}),'invalid_identity_or_nonce');
 assert.equal(validateBlueprint({...good,nonce:'reused-text'}),'invalid_identity_or_nonce');
 assert.equal(validateBlueprint({...good,mission:'short'}),'invalid_mission');
});

test('factory status only accepts signed Core-shaped minimal request',()=>{
 const allowed={org_id:'rosie-core-internal',
  nonce:'99999999-9999-4999-8999-999999999999',action:'status'};
 assert.equal(validateFactoryStatus(allowed),null);
 assert.equal(validateFactoryStatus({...allowed,agent_id:'A19'}),null);
 assert.equal(validateFactoryStatus({...allowed,agent_id:'A17',is_admin:true}),'invalid_status_request');
 assert.equal(validateFactoryStatus({...allowed,org_id:'other'}),'invalid_status_request');
 assert.equal(validateFactoryStatus({...allowed,action:'grant'}),'invalid_status_request');
});
test('factory inspection gives counts, no secrets, no activation',async()=>{
 const fake=(strings)=>{const stmt=strings.join('?');
  if(stmt.includes('registered_identities'))return [{registered_identities:18,generated_registrations:0,drafts:0,runnable_identities:0}];
  if(stmt.includes('reserved_slots'))return [];
  if(stmt.includes('g.agent_id'))return [];
  throw Error('unexpected query');
 };
 const out=await inspectFactory(fake,{org_id:'rosie-core-internal',
  nonce:'99999999-9999-4999-8999-999999999999',action:'status'});
 assert.equal(out.ok,true);assert.equal(out.registered_identities,18);
 assert.equal(out.execution_enabled,false);assert.deepEqual(out.recent,[]);
});
test('only Core-approved model aliases are accepted',()=>{
 assert.equal(validateBlueprint({...good,model:'core_default'}),null);
 assert.equal(validateBlueprint({...good,model:'gpt-6-luna'}),null);
 assert.equal(validateBlueprint({...good,model:'arbitrary-unknown-provider'}),'invalid_model');
});
