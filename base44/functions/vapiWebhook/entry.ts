/**
 * vapiWebhook — Vapi calls this when Sarah's `trigger_sales_call` tool fires.
 * Marks the lead as qualified, then bridges the prospect to the primary sales line.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { appBaseUrl, findSession, loadConfig, routeToSalesLine, TRIGGER_TOOL_NAME } from '../../shared/videoQualify.ts';

function readToolCall(body: any) {
  const msg = body?.message || body || {};
  const callList = msg?.toolCallList || msg?.toolCalls || [];
  const first = Array.isArray(callList) ? callList[0] : null;
  const fn = msg?.functionCall || first?.function || {};
  const raw = fn.parameters !== undefined ? fn.parameters : fn.arguments;
  let args = raw;
  if (typeof raw === 'string') {
    try {
      args = JSON.parse(raw);
    } catch {
      args = {};
    }
  }
  return {
    name: String(fn.name || ''),
    args: args && typeof args === 'object' ? args : {},
    toolCallId: String(first?.id || msg?.functionCall?.id || ''),
    isToolList: !!first,
  };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const expected = secrets.get('VAPI_WEBHOOK_SECRET') || '';
    const provided = req.headers.get('x-vapi-secret') || new URL(req.url).searchParams.get('secret') || '';
    if (expected && provided !== expected) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, args, toolCallId, isToolList } = readToolCall(body);
    const reply = (text: string) =>
      Response.json(isToolList ? { results: [{ toolCallId, result: text }] } : { result: text });

    if (name !== TRIGGER_TOOL_NAME) return reply('No action taken.');

    const callInfo = body?.message?.call || body?.call || {};
    const session = await findSession(base44, {
      sessionToken: callInfo?.metadata?.sessionToken,
      vapiCallId: callInfo?.id,
    });
    if (!session) return reply('We could not match this call to a qualification session.');

    const cfg = await loadConfig(base44);
    try {
      const result = await routeToSalesLine(base44, cfg, session, {
        phone: args.verified_phone,
        debtTier: args.debt_tier,
        mode: 'voice',
        baseUrl: appBaseUrl(req),
      });
      return reply(`Call bridging initiated successfully. Transfer ${result.callSid}.`);
    } catch (err) {
      await base44.asServiceRole.entities.VideoQualifySession.update(session.id, {
        status: 'failed',
        error: String(err?.message || err),
      });
      return reply(`The transfer could not start: ${String(err?.message || err)}`);
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}