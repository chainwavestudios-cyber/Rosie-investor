import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateRosieEvidenceV1} from '../rosie-evidence-v1.mjs';
const catalog = JSON.parse(fs.readFileSync(new URL('./catalog.v1.json', import.meta.url)));
test('catalog is explicitly draft, never certified',()=>assert.equal(catalog.status,'draft_not_audited'));
test('controls are unique and scoped to Core or BOB',()=>{
  const ids=catalog.controls.map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.length>=12);
  ids.forEach(x=>assert.match(x,/^(CORE|BOB)-SEC-\d{3}$/));
});
test('catalog evidence kinds are accepted by strict validator',()=>{
  for(const c of catalog.controls){
    const event={contract:'rosie.grc.evidence.v1',app_key:c.id.startsWith('BOB')?'bob':'core',environment:'staging',control_id:c.id,evidence_kind:c.evidence_kind,source_event_id:'synthetic-control-0001',occurred_at:'2026-11-11T20:00:00Z',source_sha256:'a'.repeat(64),outcome:'review'};
    assert.equal(validateRosieEvidenceV1(event).control_id,c.id);
  }
});
test('every control has framework hints and acceptance criterion',()=>{
  catalog.controls.forEach(x=>{assert.ok(x.framework_hints.length);assert.ok(x.acceptance.length>30);});
});
