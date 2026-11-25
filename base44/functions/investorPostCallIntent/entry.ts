import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { authorizeInvestorPilotLead, authorizeInvestorPilotSession } from '../../shared/investorPilotAccess.mjs';
import { makeCorePostCallIntentClient } from '../../shared/corePostCallIntentClient.js';
import { hashHostFinalizedTranscript, normalizeHostFinalTranscript, processFinalizedHostCall } from '../../shared/callIntelligenceHostTranscript.js';

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const id = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_.:-]{8,120}$/.test(value);
const fields = ['leadId', 'sessionUserId', 'sessionToken', 'transcriptRecordId', 'transcriptDigest', 'consent'];
const managers = new Set(['super_admin', 'admin', 'super_manager', 'manager']);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  if (Deno.env.get('INVESTOR_POST_CALL_INTENT_STAGING_ENABLED') !== 'true') {
    return reply({ error: 'post_call_pilot_disabled' }, 403);
  }
  const organizationId = Deno.env.get('INVESTOR_CORE_LIVE_STAGING_TENANT_ID') || '';
  const syntheticLeadId = Deno.env.get('INVESTOR_POST_CALL_INTENT_SYNTHETIC_LEAD_ID') || '';
  if (!id(organizationId) || !id(syntheticLeadId)) return reply({ error: 'post_call_pilot_scope_pending' }, 503);
  let body;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 4096) return reply({ error: 'request_too_large' }, 413);
    body = JSON.parse(raw);
  } catch { return reply({ error: 'invalid_post_call_request' }, 400); }
  if (!body || Object.keys(body).length !== fields.length || !fields.every(field => Object.hasOwn(body, field)) ||
      !id(body.leadId) || !id(body.sessionUserId) || !id(body.transcriptRecordId) ||
      typeof body.sessionToken !== 'string' || body.consent !== true ||
      typeof body.transcriptDigest !== 'string' || !/^[0-9a-f]{64}$/.test(body.transcriptDigest)) {
    return reply({ error: 'invalid_post_call_request' }, 400);
  }
  if (body.leadId !== syntheticLeadId) return reply({ error: 'post_call_pilot_lead_denied' }, 403);
  const db = createClientFromRequest(req).asServiceRole.entities;
  const user = await db.DebtCoachUser.get(body.sessionUserId).catch(() => null);
  const session = authorizeInvestorPilotSession({ user, sessionToken: body.sessionToken, mode: 'intent' });
  if (!session.ok) return reply({ error: 'post_call_pilot_session_denied' }, session.status);
  try {
    const settings = JSON.parse(user.aiSettingsJson || '{}');
    const permissions = JSON.parse(user.permissions || '{}');
    if (settings.sharedPostCallIntentV1 !== true || settings.liveIntent === false ||
        (!managers.has(user.role) && permissions.liveIntent !== true)) {
      return reply({ error: 'post_call_pilot_feature_denied' }, 403);
    }
  } catch { return reply({ error: 'post_call_pilot_feature_denied' }, 403); }
  const lead = await db.DebtLead.get(body.leadId).catch(() => null);
  if (!authorizeInvestorPilotLead({ user, lead }).ok) return reply({ error: 'post_call_pilot_lead_denied' }, 403);
  const record = await db.DebtCallTranscript.get(body.transcriptRecordId).catch(() => null);
  if (!record || record.leadId !== body.leadId ||
      String(record.agentId || '').toLowerCase() !== String(user.username || '').toLowerCase() ||
      !(Number(record.durationSeconds) > 0)) return reply({ error: 'finalized_transcript_unavailable' }, 404);
  let transcript;
  try {
    const lines = JSON.parse(record.transcriptJson || '[]');
    if (!Array.isArray(lines) || lines.length !== record.transcriptLineCount) throw Error('Final record mismatch');
    transcript = normalizeHostFinalTranscript('investor', lines);
  } catch { return reply({ error: 'invalid_finalized_transcript' }, 422); }
  if (await hashHostFinalizedTranscript(transcript) !== body.transcriptDigest) {
    return reply({ error: 'finalized_transcript_version_conflict' }, 409);
  }
  try {
    const request = makeCorePostCallIntentClient({ appKey: 'investor',
      origin: Deno.env.get('ROSIE_LIVE_ASSISTANCE_STAGING_ORIGIN') || '',
      secret: Deno.env.get('CORE_HMAC_INVESTOR_LIVE_STAGING') || '' });
    return reply(await processFinalizedHostCall(request, {
      scope: { organizationId, userId: String(user.id) }, callSessionId: record.id, transcriptVersion: 1, transcript,
    }));
  } catch (error) {
    const code = error instanceof Error && /^[a-z_]{5,80}$/.test(error.message)
      ? error.message : 'core_post_call_unavailable';
    return reply({ error: code }, code === 'approved_knowledge_unavailable' ? 422 : 503);
  }
});
