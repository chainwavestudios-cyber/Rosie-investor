import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {STAGING_GATES,summarizeCatalog,filterControls} from './dashboard.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../controls/catalog.v1.json',import.meta.url)));
test('draft status and counts never imply certification',()=>{const x=summarizeCatalog(catalog);assert.equal(x.total,13);assert.equal(x.bob,7);assert.equal(x.core,6);assert.equal(x.verifiedEvidence,0);assert.equal(x.openGates,STAGING_GATES.length)});
test('filter is application scoped',()=>{assert.equal(filterControls(catalog.controls,'bob','').length,7);assert.equal(filterControls(catalog.controls,'core','').length,6)});
test('search matches title, control identifier and evidence kind',()=>{assert.ok(filterControls(catalog.controls,'all','restore').length>0);assert.equal(filterControls(catalog.controls,'bob','CORE-SEC-001').length,0)});
test('duplicate IDs rejected',()=>assert.throws(()=>summarizeCatalog({...catalog,controls:[...catalog.controls,catalog.controls[0]]})));
test('non-draft catalog rejected',()=>assert.throws(()=>summarizeCatalog({...catalog,status:'approved'})));
