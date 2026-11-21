import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBlueprint,planBlueprint} from '../agent-factory.mjs';
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
