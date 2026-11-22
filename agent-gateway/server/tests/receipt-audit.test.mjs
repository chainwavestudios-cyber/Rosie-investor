import test from 'node:test';
import assert from 'node:assert/strict';
import {auditScope,auditOnce,receiptAudit,summarizeDelivery} from '../receipt-audit.mjs';

const ticket='rwt-'+'a'.repeat(32);
const trace='c7dc4541-c32a-4a80-9d00-1f47e0a4aded';
const scope={ticket,trace};
const rows=[
  {id:'origin',sender:'A05',recipient:'A02',parent:null,delivered:'2026-11-21T18:12:39.618Z',received:'2026-11-21T18:12:41.498Z'},
  {id:'reply',sender:'A02',recipient:'A05',parent:'origin',delivered:'2026-11-21T18:12:41.456Z',received:'2026-11-21T18:12:41.896Z'}
];
const report={messages:2,receipts:2,elapsed_ms:2278};
const sql={begin(){throw Error('unexpected database access');}};
const req={org_id:'rosie-core-internal',agent_id:'A02',ticket_key:ticket,nonce:trace};
test('scope requires an explicit canonical ticket and trace',()=>{
  assert.equal(auditScope({}),null);
  assert.deepEqual(auditScope({RACP_AUDIT_TICKET:ticket,RACP_AUDIT_TRACE:trace}),scope);
});
test('an unscoped agent, ticket, organization or request never obtains a lease',async()=>{
  for (const bad of [{agent_id:'A03'},{ticket_key:ticket+'1'},{org_id:'other'},{evidence:[]}]) {
    assert.equal((await receiptAudit(sql,'/v1/receipt-audit/claim',{...req,...bad},scope)).status,403);
  }
  assert.equal((await receiptAudit(sql,'/v1/receipt-audit/claim',req,null)).status,403);
});
test('auditor checks direction, reply linkage, evidence completeness and latency',()=>{
  assert.deepEqual(summarizeDelivery(rows),report);
  for(const bad of [{parent:'wrong'},{sender:'A05'},{received:null},{delivered:'invalid'}])
    assert.throws(()=>summarizeDelivery([rows[0],{...rows[1],...bad}]));
});
test('a distinct reviewer re-reads records and withholds completion for a wrong result',async()=>{
  const job={claimed:true,step:'review',job_id:trace,fencing_token:3,rows,submitted:{...report,elapsed_ms:9}};
  const post=async(_config,path)=>{assert.equal(path,'/v1/receipt-audit/claim');return job;};
  await assert.rejects(auditOnce({agent:'A05'},scope,post),/qa_rejected_report/);
  await assert.rejects(auditOnce({agent:'A02'},scope,post),/unexpected_audit_step/);
});
test('review carries its own computed report and lease into the signed completion request',async()=>{
  const job={claimed:true,step:'review',job_id:trace,fencing_token:4,rows,submitted:report};
  const post=async(_config,path,body)=>{
    if(path.endsWith('/claim')) return job;
    assert.deepEqual(body.report,report);
    assert.equal(body.fencing_token,4);
    assert.equal(body.agent_id,'A05');
    return {accepted:true,execution_receipt:trace};
  };
  assert.equal(await auditOnce({agent:'A05'},scope,post),true);
});

test('database Date values and serialized wire values retain millisecond precision',()=>{
  const postgresRows=rows.map(row=>({...row,delivered:new Date(row.delivered),received:new Date(row.received)}));
  assert.deepEqual(summarizeDelivery(postgresRows),report);
});
