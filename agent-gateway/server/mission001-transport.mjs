import { createHash, createPublicKey, verify } from 'node:crypto';

const SERVICE = 'srv-dbvkq4utlv9c73e4o5i0';
const AUTHORITY = 'rosie.core.m001.command_authority.v1';
const CANONICAL_TICKET_SEAT_DIGEST = '59d807f5d398cc600fdb6200f60f561eb2a2bcc85070927217711c51dc6fb5ff';
const ORG = 'rosie-core-internal';
const ASSIGNMENT = 'rosie.core.browser_worker_assignment.v1';
export const MISSION_001_JOB = 'rosie.core.m001.staging_job.v1';
const TICKET = /^rwt-[a-f0-9]{32}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ENTITY_ID = /^[a-f0-9]{24}$/;
const AGENT_ID = /^A[0-9]{2,4}$/;
const SEAT_KEY = /^bws-[a-f0-9]{32}$/;
const AUTHORITY_REF = /^base44:[A-Za-z0-9_./:#-]{8,180}$/;
const COMMAND_SEAT = /^[A-Za-z0-9_-]{8,100}$/;
const ROLE_NAMES = ['lieutenant', 'captain', 'private'];
const JOB = '/v1/events';
const SEND = '/v1/agent/send';
const INBOX = '/v1/agent/inbox';
const ACK = '/v1/agent/ack';

const validHttpsEndpoint = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
};

function verifiedAuthority(env, raw) {
  try {
    const issuer = createPublicKey(env.MISSION_001_CORE_AUTHORITY_PUBLIC_KEY ?? '');
    const signature = Buffer.from(env.MISSION_001_CORE_AUTHORITY_SIGNATURE ?? '', 'base64');
    return issuer.asymmetricKeyType === 'ed25519' && signature.length === 64 && verify(null, Buffer.from(raw), issuer, signature);
  } catch {
    return false;
  }
}

export function readMission001Transport(env, renderServiceId, expectedTicketSeatDigest = CANONICAL_TICKET_SEAT_DIGEST) {
  if (!env.MISSION_001_RCIS_SCOPE_JSON) return null;
  const raw = env.MISSION_001_RCIS_SCOPE_JSON;
  const scope = JSON.parse(raw);
  const actors = ROLE_NAMES.map(role => scope?.actors?.[role]);
  const ids = ['attempt_id', 'job_id', 'job_event_id', 'assignment_event_id', 'trace_id'];
  const start = Date.parse(scope?.starts_at);
  const expiry = Date.parse(scope?.expires_at);
  const keys = Object.fromEntries(ROLE_NAMES.map(role => [role, env[`MISSION_001_RCIS_${role.toUpperCase()}_KEY`]]));
  const ticketSeatDigest = createHash('sha256').update(JSON.stringify([
    scope?.parent_ticket_key, scope?.ticket_key, scope?.seat_key,
  ])).digest('hex');
  if (renderServiceId !== SERVICE || scope?.environment !== 'staging' ||
      !verifiedAuthority(env, raw) || scope?.contract !== AUTHORITY || !AUTHORITY_REF.test(scope.authority_ref ?? '') ||
      !ENTITY_ID.test(scope.parent_entity_id ?? '') || !ENTITY_ID.test(scope.child_entity_id ?? '') ||
      scope.parent_entity_id === scope.child_entity_id || ticketSeatDigest !== expectedTicketSeatDigest ||
      !TICKET.test(scope.parent_ticket_key ?? '') || !TICKET.test(scope.ticket_key ?? '') || scope.parent_ticket_key === scope.ticket_key ||
      !SEAT_KEY.test(scope.seat_key ?? '') || !ENTITY_ID.test(scope.authorization_id ?? '') ||
      !ids.every(name => UUID.test(scope[name] ?? '')) || new Set(ids.map(name => scope[name])).size !== ids.length ||
      !/^[a-f0-9]{64}$/.test(scope.assignment_sha256 ?? '') || !(expiry > start && expiry - start <= 60 * 60_000) ||
      actors.some(actor => !AGENT_ID.test(actor?.agent_id ?? '') || !validHttpsEndpoint(actor?.runtime_endpoint) ||
        !COMMAND_SEAT.test(actor?.machine_seat_key ?? '') || !AUTHORITY_REF.test(actor?.registry_ref ?? '') ||
        actor.machine_seat_key === scope.seat_key) ||
      new Set(actors.map(actor => actor.machine_seat_key)).size !== ROLE_NAMES.length ||
      new Set(actors.map(actor => actor.agent_id)).size !== ROLE_NAMES.length || new Set(Object.values(keys)).size !== ROLE_NAMES.length ||
      ROLE_NAMES.some(role => typeof keys[role] !== 'string' || keys[role].length < 40 ||
        createHash('sha256').update(keys[role]).digest('hex') !== scope.actors[role].key_fingerprint)) {
    // A malformed intended configuration must fail closed, including the legacy paths.
    throw new Error('invalid_mission_001_transport_scope');
  }
  return {
    ...scope, start, expiry, keys,
    message: JSON.stringify({ contract: ASSIGNMENT, assignment_sha256: scope.assignment_sha256 }),
    jobPayload: { contract: MISSION_001_JOB, authorization_id: scope.authorization_id,
      ticket_key: scope.ticket_key, attempt_id: scope.attempt_id, seat_key: scope.seat_key },
  };
}

const matchesPayload = (actual, expected) => actual && !Array.isArray(actual) &&
  Object.keys(actual).length === Object.keys(expected).length &&
  Object.entries(expected).every(([name, value]) => actual[name] === value);

// An unscoped request remains on the existing gateway path. A reserved request
// can never fall back to general gateway, worker, or agent credentials.
export function authorizeMission001Transport(scope, path, request, now = Date.now()) {
  const claimsMissionJob = path === JOB && request.payload?.contract === MISSION_001_JOB;
  if (!scope) return claimsMissionJob ? { denied: true } : null;
  const event = request.event_id;
  const recipient = scope.actors.private.agent_id;
  const captain = scope.actors.captain.agent_id;
  const reserved = claimsMissionJob || [scope.assignment_event_id, scope.job_event_id].includes(event) ||
    request.ticket_key === scope.ticket_key;
  if (!reserved) return null;
  if (!(now >= scope.start && now < scope.expiry) || request.org_id !== ORG) return { denied: true };

  if (path === JOB && event === scope.job_event_id && request.ticket_key === scope.ticket_key &&
      request.agent_id === recipient && request.event_type === 'ticket.assigned' &&
      request.sender === 'rosie_core' && matchesPayload(request.payload, scope.jobPayload)) {
    return { key: scope.keys.lieutenant, jobId: scope.job_id };
  }
  if (path === SEND && event === scope.assignment_event_id && request.agent_id === captain &&
      request.recipient_agent_id === recipient && request.kind === 'note' && request.trace_id === scope.trace_id &&
      request.message === scope.message && request.reply_to === undefined) {
    return { key: scope.keys.captain };
  }
  if (request.agent_id === recipient && event === scope.assignment_event_id && (path === INBOX || path === ACK)) {
    return { key: scope.keys.private, exactReceipt: true };
  }
  return { denied: true };
}

export async function mission001ActorsAreCurrent(sql, scope) {
  const actors = ROLE_NAMES.map(role => scope.actors[role]);
  const rows = await sql`SELECT i.agent_id, i.runtime_endpoint, i.desired_state, i.runtime_state,
    EXISTS (SELECT FROM core_agents.agent_team_assignments a WHERE a.org_id=i.org_id AND a.agent_id=i.agent_id
      AND a.captain_id=${scope.actors.captain.agent_id} AND a.assignment_state='assigned') AS assigned_to_captain
    FROM core_agents.identities i WHERE i.org_id=${ORG}
      AND i.agent_id IN (${actors[0].agent_id},${actors[1].agent_id},${actors[2].agent_id})`;
  return rows.length === actors.length && actors.every(actor => rows.some(row =>
    row.agent_id === actor.agent_id && row.runtime_endpoint === actor.runtime_endpoint && row.desired_state === 'ready' &&
    ['available', 'running'].includes(row.runtime_state) && (actor !== scope.actors.private || row.assigned_to_captain === true)));
}
