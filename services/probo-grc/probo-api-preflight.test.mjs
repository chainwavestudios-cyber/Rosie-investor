import test from 'node:test';
import assert from 'node:assert/strict';
import {checkProboIdentity} from './probo-api-preflight.mjs';
const token='test-bearer-token-0123456789012345';
const origin='https://probo-staging.example.test/';
const expectedOrgId='org-00000001';
const response=(data,status=200)=>({status,text:async()=>JSON.stringify({data})});
const cfg={origin,bearerToken:token,expectedOrgId};
test('read-only identity and organization matching succeeds',async()=>{
 const result=await checkProboIdentity({...cfg,send:async(url,opts)=>{
  assert.equal(url,'https://probo-staging.example.test/api/console/v1/graphql');
  assert.equal(opts.headers.Authorization,'Bearer '+token);
  const q=JSON.parse(opts.body).query;
  return q.includes('Viewer')?response({viewer:{id:'user-000001'}}):
    response({organizations:{nodes:[{id:expectedOrgId,name:'Rosie Test'}]}});
 }});
 assert.equal(result.authenticated,true);assert.equal(result.expectedOrgId,expectedOrgId);
});
test('organization missing denies',async()=>{
 await assert.rejects(checkProboIdentity({...cfg,send:async(url,opts)=>{
  const q=JSON.parse(opts.body).query;
  return q.includes('Viewer')?response({viewer:{id:'user-000001'}}):response({organizations:{nodes:[]}});
 }}),/probo_expected_org_not_granted/);
});
test('GraphQL errors and insecure origin denied',async()=>{
 await assert.rejects(checkProboIdentity({...cfg,origin:'http://probo-staging.example.test/'}),/invalid_probo_origin/);
 await assert.rejects(checkProboIdentity({...cfg,send:async()=>({status:200,text:async()=>JSON.stringify({data:{},errors:[{message:'Forbidden'}]})})}),/probo_graphql_rejected/);
});
