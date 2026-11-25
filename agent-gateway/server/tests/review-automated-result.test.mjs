import assert from 'node:assert/strict';
import test from 'node:test';
import {automatedResultId, registerAutomatedResult} from '../review-automated-result.mjs';

const assignment = '0334f121-1d66-8bc7-ae32-bacc3f40c5fb';
const nonce = 'e259b1c6-e8ab-11f1-8708-748e07fa6aef';
const input = {
  org_id: 'rosie-core-internal', agent_id: 'A05', assignment_id: assignment, nonce,
  report: {state:'source_verified', head_tree:'a'.repeat(40), base_tree:'b'.repeat(40),
    changed_files:5, comparison_limited:false, workflow_files:false, authority_files:true,
    test_execution:'not_run', release_authorized:false},
};

test('automated intake cannot carry an approval or fabricated test result', async () => {
  const never = {begin: () => assert.fail('Invalid report reached the ledger')};
  for (const change of [{release_authorized:true},{test_execution:'passed'},{verdict:'accept'}]) {
    const result = await registerAutomatedResult(never,{...input,report:{...input.report,...change}});
    assert.equal(result[0],400);
  }
});

test('an authenticated report is tied to an acknowledged assignment and remains non-gating', async () => {
  const writes=[];
  const tx=async (parts,...values)=>{
    const query=parts.join('?');
    if(query.includes('SELECT e.payload'))return [{payload:{pull_number:41}}];
    if(query.includes('RETURNING event_id')){writes.push(values);return [{event_id:automatedResultId(assignment)}];}
    return [];
  };
  tx.json=value=>value;
  const [code,result]=await registerAutomatedResult({begin:fn=>fn(tx)},input);
  assert.equal(code,201);
  assert.equal(result.release_authorized,false);
  assert.equal(result.report_id,automatedResultId(assignment));
  assert.ok(writes[0].some(value=>value?.report?.test_execution==='not_run'));
  assert.equal((await registerAutomatedResult({begin:fn=>fn(async()=>[])},input))[0],409);
});
