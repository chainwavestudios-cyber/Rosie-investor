import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import test from 'node:test';
import { makeServer, signature } from '../server.mjs';
import { authorizeMission001Transport, mission001ActorsAreCurrent, readMission001Transport } from '../mission001-transport.mjs';
import { acknowledgeMission001Assignment } from '../transport.mjs';

const service = 'srv-dbvkq4utlv9c73e4o5i0';
const org = 'rosie-core-internal';
const legacyKey = 'g'.repeat(64);
const keys = { lieutenant: 'l'.repeat(64), captain: 'c'.repeat(64), private: 'p'.repeat(64) };

function fixture({ neonRefs = false, captainRef } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const machine = (role, agent_id) => ({ agent_id, runtime_endpoint: `https://${role}.example/staging`,
    machine_seat_key: `machine_${role}`, registry_ref: `base44:staging/agent/${agent_id}`,
    key_fingerprint: createHash('sha256').update(keys[role]).digest('hex') });
  const config = {
    contract: 'rosie.core.m001.command_authority.v1', environment: 'staging',
    authority_ref: 'base44:staging/command-authority/fixture', parent_entity_id: '1'.repeat(24), child_entity_id: '2'.repeat(24),
    parent_ticket_key: `rwt-${'a'.repeat(32)}`, ticket_key: `rwt-${'b'.repeat(32)}`,
    seat_key: `bws-${'c'.repeat(32)}`, authorization_id: 'd'.repeat(24), attempt_id: randomUUID(),
    job_id: randomUUID(), job_event_id: randomUUID(), assignment_event_id: randomUUID(), trace_id: randomUUID(),
    assignment_sha256: 'e'.repeat(64), starts_at: new Date(Date.now() - 1000).toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(), actors: {
      lieutenant: machine('lieutenant','A90'), captain: machine('captain','A91'), private: machine('private','A92'),
    },
  };
  const allocation = randomUUID();
  if (neonRefs) {
    config.actors.lieutenant.registry_ref = 'neon:agent_gateway/core_agents.identities/A90';
    config.actors.captain.registry_ref = captainRef ?? 'neon:agent_gateway/core_agents.identities/A91';
    config.actors.private.registry_ref = 'neon:agent_gateway/core_agents.agent_generation_requests/' + allocation;
  }
  const raw = JSON.stringify(config);
  const env = {
    MISSION_001_RCIS_LIEUTENANT_KEY: keys.lieutenant,
    MISSION_001_RCIS_CAPTAIN_KEY: keys.captain,
    MISSION_001_RCIS_PRIVATE_KEY: keys.private,
    MISSION_001_RCIS_SCOPE_JSON: raw,
    MISSION_001_CORE_AUTHORITY_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }),
    MISSION_001_CORE_AUTHORITY_SIGNATURE: sign(null, Buffer.from(raw), privateKey).toString('base64'),
  };
  const fixtureDigest = createHash('sha256').update(JSON.stringify([config.parent_ticket_key, config.ticket_key, config.seat_key])).digest('hex');
  const scope = readMission001Transport(env, service, fixtureDigest);
  const assign = { org_id: org, event_id: scope.job_event_id, agent_id: 'A92', nonce: randomUUID(),
    sender: 'rosie_core', payload: scope.jobPayload, ticket_key: scope.ticket_key, event_type: 'ticket.assigned' };
  const note = { org_id: org, event_id: scope.assignment_event_id, recipient_agent_id: 'A92',
    agent_id: 'A91', nonce: randomUUID(), kind: 'note', trace_id: scope.trace_id, message: scope.message };
  const ack = { org_id: org, event_id: scope.assignment_event_id, agent_id: 'A92', nonce: randomUUID() };
  return { config, env, fixtureDigest, scope, assign, note, ack, allocation };
}

test('a Neon Private reference must resolve to the approved allocation, actor, seat and Captain', async () => {
  assert.throws(() => fixture({neonRefs:true,captainRef:'neon:agent_gateway/core_agents.identities/A90'}),
    /invalid_mission_001_transport_scope/);
  const {scope,allocation}=fixture({neonRefs:true});
  let hasExactAllocation=false;
  const query=async (parts,...parameters)=>{
    if(parts.join('').includes('assigned_to_captain')) return Object.values(scope.actors).map(actor=>({
      ...actor,desired_state:'ready',runtime_state:'available',assigned_to_captain:true,
    }));
    assert.ok(parts.join('').includes('core_agents.agent_generation_requests'));
    assert.deepEqual(parameters.slice(1),[allocation,'A92','A91',scope.seat_key]);
    return hasExactAllocation?[{request_id:allocation}]:[];
  };
  assert.equal(await mission001ActorsAreCurrent(query,scope),false);
  hasExactAllocation=true;
  assert.equal(await mission001ActorsAreCurrent(query,scope),true);
});

test('only the isolated staging deployment can use an enrolled scope', () => {
  const { config, env, fixtureDigest } = fixture();
  assert.equal(readMission001Transport({}, service), null);
  assert.throws(() => readMission001Transport(env, service), /invalid_mission_001_transport_scope/);
  assert.throws(() => readMission001Transport(env, 'srv-wrong', fixtureDigest), /invalid_mission_001_transport_scope/);
  assert.throws(() => readMission001Transport({ ...env, MISSION_001_RCIS_PRIVATE_KEY: keys.captain }, service, fixtureDigest),
    /invalid_mission_001_transport_scope/);
  assert.throws(() => readMission001Transport({ ...env,
    MISSION_001_RCIS_SCOPE_JSON: JSON.stringify({ ...config, environment: 'production' }),
  }, service, fixtureDigest), /invalid_mission_001_transport_scope/);
  assert.throws(() => readMission001Transport({ ...env,
    MISSION_001_RCIS_SCOPE_JSON: JSON.stringify({ ...config, trace_id: randomUUID() }),
  }, service, fixtureDigest), /invalid_mission_001_transport_scope/);
});

test('reserves the exact job and assignment without changing unrelated requests', () => {
  const { scope, assign, note, ack } = fixture();
  assert.deepEqual(authorizeMission001Transport(scope, '/v1/events', assign), { key: keys.lieutenant, jobId: scope.job_id });
  assert.deepEqual(authorizeMission001Transport(scope, '/v1/agent/send', note), { key: keys.captain });
  assert.deepEqual(authorizeMission001Transport(scope, '/v1/agent/ack', ack), { key: keys.private, exactReceipt: true });
  assert.deepEqual(authorizeMission001Transport(scope, '/v1/agent/inbox', ack), { key: keys.private, exactReceipt: true });
  assert.deepEqual(authorizeMission001Transport(scope, '/v1/agent/send', { ...note, message: 'tampered' }), { denied: true });
  assert.deepEqual(authorizeMission001Transport(scope, '/v1/agent/send', { ...note, trace_id: randomUUID() }), { denied: true });
  assert.deepEqual(authorizeMission001Transport(scope, '/v1/agent/ack', { ...ack, org_id: 'foreign' }), { denied: true });
  assert.deepEqual(authorizeMission001Transport(scope, '/v1/agent/ack', ack, scope.expiry), { denied: true });
  assert.deepEqual(authorizeMission001Transport(scope, '/v1/events', { ...assign, event_id: randomUUID() }), { denied: true });
  assert.deepEqual(authorizeMission001Transport(null, '/v1/events', assign), { denied: true });
  assert.equal(authorizeMission001Transport(scope, '/v1/agent/inbox', { org_id: org, agent_id: 'A92' }), null);
});

test('the Private runtime acknowledges only an exact signed assignment from its scoped inbox', async () => {
  const { scope } = fixture();
  const endpoint = 'https://rosie-core-agent-gateway-staging.onrender.com';
  const recipient = { endpoint, agent: 'A92', key: keys.private };
  const instruction = { eventId: scope.assignment_event_id, captainId: 'A91', traceId: scope.trace_id,
    assignmentSha256: scope.assignment_sha256 };
  const message = { event_id: scope.assignment_event_id, sender: 'A91', payload: {
    contract: 'rosie.core.rcis.transport.v1', kind: 'note', trace_id: scope.trace_id, reply_to: null, message: scope.message,
  } };
  const calls = [];
  const timestamp = new Date().toISOString();
  const transport = async (url, options) => {
    const path = new URL(url).pathname;
    const sent = JSON.parse(options.body);
    assert.equal(sent.agent_id, 'A92');
    assert.equal(sent.event_id, instruction.eventId);
    assert.equal(options.headers['x-rosie-signature'], signature(keys.private, 'POST', path,
      options.headers['x-rosie-timestamp'], options.body));
    calls.push([path, sent.nonce]);
    return new Response(JSON.stringify(path.endsWith('/inbox') ? { messages: [message] } : {
      accepted: true, durable_commit: true, event_id: instruction.eventId, recipient_agent_id: 'A92', received_at: timestamp,
    }));
  };
  assert.deepEqual(await acknowledgeMission001Assignment(recipient, instruction, transport), {
    accepted: true, event_id: instruction.eventId, recipient_agent_id: 'A92', received_at: timestamp,
  });
  assert.deepEqual(calls.map(([path]) => path), ['/v1/agent/inbox', '/v1/agent/ack']);
  assert.notEqual(calls[0][1], calls[1][1]);
  calls.length = 0;
  message.sender = 'A03';
  await assert.rejects(acknowledgeMission001Assignment(recipient, instruction, transport), /assignment_binding_mismatch/);
  assert.deepEqual(calls.map(([path]) => path), ['/v1/agent/inbox']);
});

test('signed staging commands enforce role, runtime, and exact job before writing a receipt', async t => {
  const { scope, assign, note, ack } = fixture();
  let verifiedRuntime = true;
  let jobExists = false;
  let persistedNote;
  let committedDelivery = true;
  let acknowledged = false;
  const sql = async (strings, ...params) => {
    const statement = strings.join('?');
    if (statement.includes('assigned_to_captain')) {
      return Object.values(scope.actors).map(actor => ({ ...actor, desired_state: 'ready',
        runtime_state: verifiedRuntime ? 'available' : 'unverified', assigned_to_captain: actor.agent_id === 'A92' }));
    }
    if (statement.includes('SELECT agent_id,desired_state')) return [{ agent_id: params.at(-1), desired_state: 'ready' }];
    if (statement.includes('SELECT agent_id FROM core_agents.identities')) return [{ agent_id: params.at(-1) }];
    if (statement.includes('SELECT j.job_id')) return jobExists ? [{ job_id: scope.job_id }] : [];
    if (statement.includes('SET LOCAL') || statement.includes('core_agents.worker_nonces')) return [];
    if (statement.includes('INSERT INTO core_agents.events')) {
      if (params[0] === scope.assignment_event_id) {
        if (persistedNote) return [];
        persistedNote = params.find(p => p?.kind === 'note' && p?.message === scope.message);
      }
      return [{ event_id: params[0] }];
    }
    if (statement.includes('INSERT INTO core_agents.jobs')) {
      assert.equal(params[0], scope.job_id);
      jobExists = true;
      return [{ job_id: params[0] }];
    }
    if (statement.includes('INSERT INTO core_agents.acks')) return [{ ack_id: 'test-persisted-event' }];
    if (statement.includes('SELECT a.ack_id FROM core_agents.events')) {
      assert.ok(params.includes(scope.assignment_event_id));
      assert.ok(params.includes('A91') && params.includes('A92'));
      assert.deepEqual(params.find(p=>p?.kind==='note'),persistedNote);
      return committedDelivery?[{ack_id:'test-persisted-event'}]:[];
    }
    if (statement.includes('LEFT JOIN core_agents.agent_message_receipts')) {
      assert.ok(params.includes(scope.assignment_event_id));
      assert.ok(params.includes(scope.message));
      return persistedNote ? [{ event_id: scope.assignment_event_id, payload: persistedNote }] : [];
    }
    if (statement.includes('INSERT INTO core_agents.agent_message_receipts')) {
      assert.ok(params.includes(scope.assignment_event_id));
      assert.ok(params.includes(scope.message));
      if (!persistedNote) return [];
      acknowledged = true;
      return [{ event_id: scope.assignment_event_id, received_at: 'receipt-time' }];
    }
    assert.fail(`Unexpected SQL: ${statement}`);
  };
  sql.begin = work => work(sql);
  sql.json = value => value;
  const server = makeServer({ sql, ingestKey: legacyKey, agentKeys: { A91: legacyKey, A92: legacyKey }, mission001Scope: scope });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function post(path, payload, key) {
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    return fetch(base + path, { method: 'POST', body, headers: { 'content-type': 'application/json',
      'x-rosie-timestamp': timestamp, 'x-rosie-signature': signature(key, 'POST', path, timestamp, body) } });
  }

  assert.equal((await post('/v1/events', assign, legacyKey)).status, 401);
  assert.equal((await post('/v1/agent/send', note, keys.captain)).status, 409);
  verifiedRuntime = false;
  assert.equal((await post('/v1/events', assign, keys.lieutenant)).status, 403);
  assert.equal(jobExists, false);
  verifiedRuntime = true;
  const job = await post('/v1/events', assign, keys.lieutenant);
  assert.equal(job.status, 202);
  const result = await job.json();
  assert.equal(result.job_id, scope.job_id);
  assert.equal(result.worker_started, false);
  assert.equal((await post('/v1/agent/send', note, keys.captain)).status, 202);
  const recovered = await post('/v1/agent/send', { ...note, nonce: randomUUID() }, keys.captain);
  assert.equal(recovered.status,200);
  assert.equal((await recovered.json()).delivery_ack,'test-persisted-event');
  committedDelivery=false;
  assert.equal((await post('/v1/agent/send', { ...note, nonce: randomUUID() }, keys.captain)).status,409);
  committedDelivery=true;
  assert.equal(acknowledged, false);
  assert.equal((await post('/v1/agent/ack', ack, keys.captain)).status, 401);
  assert.equal((await post('/v1/agent/ack', ack, legacyKey)).status, 401);
  const inbox = await post('/v1/agent/inbox', { ...ack, nonce: randomUUID() }, keys.private);
  assert.equal(inbox.status, 200);
  assert.equal((await inbox.json()).messages[0].event_id, scope.assignment_event_id);
  assert.equal((await post('/v1/agent/ack', ack, keys.private)).status, 200);
  assert.equal(acknowledged, true);
  assert.equal((await post('/v1/agent/inbox', { ...ack, nonce: randomUUID() }, keys.private)).status, 200);
  assert.equal((await post('/v1/agent/ack', { ...ack, nonce: randomUUID() }, keys.private)).status, 200);
});
