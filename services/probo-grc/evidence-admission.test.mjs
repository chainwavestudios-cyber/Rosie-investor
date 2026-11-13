import test from 'node:test';
import assert from 'node:assert/strict';
import {assessEvidenceAdmission} from './evidence-admission.mjs';
const now = new Date('2026-11-13T01:00:00Z');
const event = Object.freeze({
 contract:'rosie.grc.evidence.v1', app_key:'bob', environment:'staging',
 control_id:'BOB-SEC-001', evidence_kind:'automated-security-test',
 source_event_id:'bob-security-test-00001', occurred_at:now.toISOString(),
 source_sha256:'a'.repeat(64),outcome:'review'
});
const auth=Object.freeze({
 verified:true, issuer:'rosie-central-identity-staging',audience:'probo-grc-staging',
 scopes:['rosie.grc.evidence:write'],app_key:'bob',environment:'staging',
 subject:'service-bob-staging', source_org_id:'source-org-example',
 probo_org_id:'probo-org-example', issued_at:Math.floor(now.getTime()/1000),
 expires_at:Math.floor(now.getTime()/1000)+300
});
const options={now,expectedProboOrg:'probo-org-example',approvedSourceOrganizations:['source-org-example']};
test('accepts strictly scoped synthetic evidence only',()=>{
 const x=assessEvidenceAdmission(event,auth,options);
 assert.equal(x.approvedProboOrg,'probo-org-example');
 assert.match(x.dedupeKey,/bob-security-test-00001/);
});
for (const [name,ev,claims,opts] of [
 ['unsigned identity',event,{...auth,verified:false},options],
 ['wrong issuer',event,{...auth,issuer:'foreign'},options],
 ['wrong audience',event,{...auth,audience:'rosie-core'},options],
 ['no write scope',event,{...auth,scopes:[]},options],
 ['wrong app',event,{...auth,app_key:'core'},options],
 ['wrong environment',event,{...auth,environment:'production'},options],
 ['wrong target organization',event,{...auth,probo_org_id:'probo-other-org'},options],
 ['ungranted source organization',event,auth,{...options,approvedSourceOrganizations:[]}],
 ['stale evidence',{...event,occurred_at:'2026-11-12T23:59:00Z'},auth,options],
 ['future evidence',{...event,occurred_at:'2026-11-13T01:15:00Z'},auth,options],
 ['expired token',event,{...auth,expires_at:Math.floor(now.getTime()/1000)-1},options],
 ['future token',event,{...auth,issued_at:Math.floor(now.getTime()/1000)+60},options],
 ['PII field',{...event,email:'test@example.com'},auth,options],
 ['invalid digest',{...event,source_sha256:'not-a-hash'},auth,options]
]) test('rejects '+name,()=>assert.throws(()=>assessEvidenceAdmission(ev,claims,opts)));
