import {createHash} from 'node:crypto';

const appsApi = 'https://app.base44.com/api/apps/';
const id = /^[a-f0-9]{24}$/;
const sha = /^[a-f0-9]{40}$/;
const product = /^[a-z][a-z0-9_-]{1,49}$/;
const codePath = /^[a-zA-Z0-9_.@+/ -]{1,300}$/;
const authority = /auth|identity|wallet|billing|entitlement|release|security|rls|tenant|ticket|grant|acceptance|provision/i;
const sourceLimit = 24 * 1024 * 1024;

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const pinFields = ['app_id', 'branch_id', 'checkpoint_id', 'commit_sha'];
const scopeKey = pin => `${pin.app_id}:${pin.branch_id}`;
const sha256 = input => createHash('sha256').update(input).digest('hex');

export function checkpointScope(value) {
  if (!plain(value) || value.source_kind !== 'base44_checkpoint' ||
      typeof value.product_key !== 'string' || !product.test(value.product_key) ||
      !Array.isArray(value.checkpoints) || !value.checkpoints.length || value.checkpoints.length > 6) return null;
  const pins = value.checkpoints;
  if (pins.some(pin => !plain(pin) || Object.keys(pin).length !== pinFields.length ||
      !pinFields.every(key => typeof pin[key] === 'string') ||
      !['app_id','branch_id','checkpoint_id'].every(key => id.test(pin[key])) || !sha.test(pin.commit_sha))) return null;
  if (new Set(pins.map(scopeKey)).size !== pins.length) return null;
  return {
    source_kind: 'base44_checkpoint',
    product_key: value.product_key,
    checkpoints: pins.map(pin => Object.fromEntries(pinFields.map(key => [key, pin[key]])))
      .sort((first, second) => scopeKey(first).localeCompare(scopeKey(second))),
  };
}

export function checkpointRegistry(raw) {
  const values = JSON.parse(raw);
  if (!plain(values)) throw Error('checkpoint_registry_invalid');
  const registry = new Map();
  for (const [name, pairs] of Object.entries(values)) {
    if (!product.test(name) || !Array.isArray(pairs) || !pairs.length || pairs.length > 6 ||
        pairs.some(pair => !plain(pair) || Object.keys(pair).length !== 2 ||
          typeof pair.app_id !== 'string' || !id.test(pair.app_id) ||
          typeof pair.branch_id !== 'string' || !id.test(pair.branch_id))) throw Error('checkpoint_registry_invalid');
    const keys = new Set(pairs.map(scopeKey));
    if (keys.size !== pairs.length) throw Error('checkpoint_registry_invalid');
    registry.set(name, keys);
  }
  if (!registry.size) throw Error('checkpoint_registry_invalid');
  return registry;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!plain(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

export function checkpointManifest(files) {
  if (!plain(files)) throw Error('checkpoint_source_invalid');
  const paths = Object.keys(files).sort();
  if (!paths.length || paths.length > 20000 || paths.some(path => !codePath.test(path) || !path.split('/').every(
    part => part && part !== '.' && part !== '..'))) throw Error('checkpoint_source_invalid');
  const records = paths.map(path => {
    const value = files[path];
    if (typeof value !== 'string' && !plain(value)) throw Error('checkpoint_source_invalid');
    return [path, sha256(typeof value === 'string' ? value : JSON.stringify(canonical(value)))];
  });
  return {
    manifest_sha256: sha256(JSON.stringify(records)),
    file_count: records.length,
    authority_files_present: paths.some(path => authority.test(path)),
  };
}

export function createCheckpointSource(registry, {list, files}) {
  async function resolve(input) {
    const scope = checkpointScope(input);
    if (!scope) return null;
    const allowed = registry.get(scope.product_key);
    if (!allowed || allowed.size !== scope.checkpoints.length ||
        scope.checkpoints.some(pin => !allowed.has(scopeKey(pin)))) return null;
    for (const pin of scope.checkpoints) {
      const rows = await list(pin);
      if (!Array.isArray(rows)) throw Error('checkpoint_list_invalid');
      const candidates = rows.filter(row => row.id === pin.checkpoint_id);
      if (candidates.length !== 1 || candidates[0].git_commit_hash !== pin.commit_sha ||
          candidates[0].preview_status !== 'ready') return null;
    }
    return scope;
  }
  return {
    resolve,
    async inspect(input) {
      const scope = await resolve(input);
      if (!scope) return {state: 'superseded', test_execution: 'not_run', release_authorized: false};
      const inspected = [];
      for (const pin of scope.checkpoints) {
        inspected.push({...pin, ...checkpointManifest(await files(pin))});
      }
      return {
        state: 'source_verified', source_kind: scope.source_kind, product_key: scope.product_key,
        checkpoints: inspected, test_execution: 'not_run', release_authorized: false,
      };
    },
  };
}

async function responseJson(response, maxBytes) {
  if (!response.ok || !response.body) throw Error('checkpoint_source_http_' + response.status);
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw Error('checkpoint_source_too_large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function base44ReviewSource(env, transport = fetch) {
  const key = env.BASE44_REVIEW_SOURCE_READ_TOKEN;
  if (!key || !env.BASE44_REVIEW_PRODUCT_SOURCES_JSON) return null;
  let registry;
  try {
    registry = checkpointRegistry(env.BASE44_REVIEW_PRODUCT_SOURCES_JSON);
  } catch {
    return null;
  }
  async function read(pin, suffix, size, queries) {
    const url = new URL(appsApi + pin.app_id + '/app-checkpoints' + suffix);
    url.search = new URLSearchParams({branch_id: pin.branch_id, ...queries});
    const response = await transport(url.href, {
      redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: {authorization: 'Bearer ' + key, accept: 'application/json'},
    });
    return responseJson(response, size);
  }
  return createCheckpointSource(registry, {
    async list(pin) {
      const limit = 100;
      for (let skip = 0; skip < 1000; skip += limit) {
        const data = await read(pin, '', 1024 * 1024, {limit, skip});
        if (!Array.isArray(data)) throw Error('checkpoint_list_invalid');
        const matches = data.filter(row => row.id === pin.checkpoint_id);
        if (matches.length || data.length < limit) return matches;
      }
      return [];
    },
    async files(pin) {
      const source = await read(pin, '/' + pin.checkpoint_id + '/file-tree', sourceLimit);
      return source.files;
    },
  });
}
