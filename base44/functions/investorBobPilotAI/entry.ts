import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  validateInvestorPilotPayload, authorizeInvestorPilotSession, authorizeInvestorPilotLead,
} from '../../shared/investorPilotAccess.mjs';
import { requestCoreLiveAssistance } from '../../shared/coreLiveAssistanceClient.js';

const deny = (status: number, error: string) =>
  Response.json({ error, blocked: true }, { status, headers: { 'Cache-Control': 'no-store' } });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return deny(405, 'PILOT_METHOD_NOT_ALLOWED');
  let body: any;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 28000) return deny(413, 'PILOT_REQUEST_TOO_LARGE');
    body = JSON.parse(raw);
  } catch { return deny(400, 'PILOT_INVALID_JSON'); }
  const shape = validateInvestorPilotPayload(body);
  if (!shape.ok) return deny(shape.status, shape.code);
  if (!body.sessionId || !body.requestId || !body.action) return deny(400, 'PILOT_REQUEST_SCOPE_REQUIRED');

  const db = createClientFromRequest(req).asServiceRole.entities;
  const user = await db.DebtCoachUser.get(body.sessionUserId).catch(() => null);
  const session = authorizeInvestorPilotSession({ user, sessionToken: body.sessionToken, mode: body.mode });
  if (!session.ok) return deny(session.status, session.code);
  const lead = await db.DebtLead.get(body.leadId).catch(() => null);
  const leadAccess = authorizeInvestorPilotLead({ user, lead });
  if (!leadAccess.ok) return deny(leadAccess.status, leadAccess.code);

  const organizationId = Deno.env.get('INVESTOR_CORE_LIVE_STAGING_TENANT_ID') || '';
  if (!/^[a-zA-Z0-9_.:-]{8,120}$/.test(organizationId)) return deny(503, 'PILOT_TENANT_LINK_PENDING');
  const transcript = (body.transcript || []).filter((line: any) =>
      !line.interim && line.final !== false &&
      (body.mode === 'coach' ? [0, 1].includes(line.speaker) : line.speaker === 1))
    .slice(-12).map((line: any) =>
      (line.speaker === 1 ? 'Customer: ' : 'Agent: ') + line.text.trim()).join('\n').slice(-8400);
  try {
    const result = await requestCoreLiveAssistance({
      appKey: 'investor', coreOrigin: Deno.env.get('ROSIE_LIVE_ASSISTANCE_STAGING_ORIGIN') || '',
      secret: Deno.env.get('CORE_HMAC_INVESTOR_LIVE_STAGING') || '',
      organizationId, userId: String(user.id), sessionId: body.sessionId, requestId: body.requestId,
      service: body.mode === 'qa' ? 'live_qa' : 'call_coach', mode: body.action,
      question: body.mode === 'qa' ? body.question.trim() : '', transcript,
    });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error && /^[a-z_]{5,80}$/.test(error.message)
      ? error.message : 'core_live_service_unavailable';
    return deny(code === 'request_already_reserved' ? 409 : 503, code);
  }
});
