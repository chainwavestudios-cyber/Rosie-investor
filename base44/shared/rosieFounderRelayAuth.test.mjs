import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../functions/mediaStreamRelay/entry.ts',import.meta.url),'utf8');
test('relay rejects missing bridge authentication configuration before parsing payload',()=>{
  const config=src.indexOf("if (!authToken) {");
  const parse=src.indexOf('const body = await req.json()');
  assert.ok(config>0 && config<parse);
  assert.match(src,/if \(!authToken\) \{\s*return Response\.json\(\{ error: 'bridge_auth_not_configured' \}, \{ status: 503 \}\)/);
});
test('relay rejects invalid bearer before parsing payload',()=>{
  const auth=src.indexOf('if (auth !== `Bearer ${authToken}`)');
  assert.ok(auth>0 && auth<src.indexOf('const body = await req.json()'));
  assert.match(src,/if \(auth !== `Bearer \$\{authToken\}`\) \{\s*return Response\.json\(\{ error: 'unauthorized' \}, \{ status: 401 \}\)/);
});
test('corporate transfer requires second-stage caller context check',()=>{
  assert.match(src,/if \(body\.leadId === ROSIE_PROFILE && event === 'transfer'\)/);
  assert.match(src,/if \(!hasRecentFounderTransferContext\(body\.conversation\)\)/);
});
