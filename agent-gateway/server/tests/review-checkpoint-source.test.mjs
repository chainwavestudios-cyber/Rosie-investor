import assert from 'node:assert/strict';
import test from 'node:test';
import {base44ReviewSource, checkpointManifest, checkpointRegistry, checkpointScope, createCheckpointSource} from '../review-checkpoint-source.mjs';

const pin = (app, branch, checkpoint, commit) => ({
  app_id: app.repeat(24), branch_id: branch.repeat(24), checkpoint_id: checkpoint.repeat(24), commit_sha: commit.repeat(40),
});
const core = pin('a', 'b', 'c', 'd');
const voice = pin('1', '2', '3', '4');
const scope = {source_kind:'base44_checkpoint', product_key:'voiceiq', checkpoints:[core, voice]};
const registryJson = JSON.stringify({voiceiq:[core, voice].map(({app_id, branch_id}) => ({app_id, branch_id}))});
const registry = checkpointRegistry(registryJson);
const metadata = ({checkpoint_id, commit_sha}) => [{id:checkpoint_id, git_commit_hash:commit_sha, preview_status:'ready'}];

test('checks each app, branch, checkpoint and commit and returns digests without private source', async () => {
  const files = {'functions/authGate':'confidential source', 'entities/Widget':{b:2,a:1}};
  const source = createCheckpointSource(registry, {list:metadata, files:async () => files});
  const result = await source.inspect(scope);
  assert.equal(result.state,'source_verified');
  assert.equal(result.release_authorized,false);
  assert.equal(result.test_execution,'not_run');
  assert.deepEqual(result.checkpoints.map(row => row.app_id),[voice.app_id,core.app_id]);
  assert.equal(result.checkpoints[0].file_count,2);
  assert.equal(result.checkpoints[0].authority_files_present,true);
  assert.equal(JSON.stringify(result).includes('confidential source'),false);
  assert.deepEqual(checkpointManifest({'entities/Widget':{a:1,b:2},'functions/authGate':'confidential source'}),checkpointManifest(files));
});

test('denies a foreign branch, unapproved scope, duplicates and stale checkpoint commits before source fetch', async () => {
  let reads = 0;
  const source = createCheckpointSource(registry, {list:metadata, files:async () => { reads++; }});
  assert.equal(await source.resolve({...scope,checkpoints:[core]}),null);
  assert.equal(await source.resolve({...scope,checkpoints:[core,{...voice,branch_id:'f'.repeat(24)}]}),null);
  assert.equal(await source.resolve({...scope,product_key:'directd'}),null);
  assert.equal(checkpointScope({...scope,checkpoints:[core,core]}),null);
  const stale = createCheckpointSource(registry, {list: p => metadata({...p,commit_sha:'e'.repeat(40)}), files:async () => { reads++; }});
  assert.deepEqual(await stale.inspect(scope),{state:'superseded',test_execution:'not_run',release_authorized:false});
  assert.equal(reads,0);
  assert.throws(() => checkpointManifest({'../file':'data'}),/checkpoint_source_invalid/);
});

test('uses only documented Base44 endpoints with an exact branch and checkpoint', async () => {
  const paths = [];
  const source = base44ReviewSource({BASE44_REVIEW_SOURCE_READ_TOKEN:'unit-test-token',
    BASE44_REVIEW_PRODUCT_SOURCES_JSON:registryJson}, async (address, request) => {
    const url = new URL(address);
    paths.push(url);
    assert.equal(url.origin,'https://app.base44.com');
    assert.equal(request.redirect,'error');
    assert.equal(request.headers.authorization,'Bearer unit-test-token');
    const item = [core,voice].find(pin => pin.branch_id === url.searchParams.get('branch_id'));
    assert.ok(item);
    const prefix = '/api/apps/' + item.app_id + '/app-checkpoints';
    if (url.pathname === prefix) return Response.json(metadata(item));
    assert.equal(url.pathname,prefix+'/'+item.checkpoint_id+'/file-tree');
    return Response.json({files:{'pages/Home':'source'}});
  });
  assert.equal((await source.inspect(scope)).state,'source_verified');
  assert.equal(paths.length,4);
});
