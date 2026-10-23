/**
 * vapiQualify — the widget's backend.
 *
 *  action: 'client'        — resolve the email token, open a session, hand back the
 *                            public Vapi key + assistant id the page needs.
 *  action: 'attachCall'    — tie the live Vapi call id to the session.
 *  action: 'routeCall'     — typed-fallback routing: bridge the prospect to the sales line.
 *  action: 'syncAssistant' — admin: create/update Sarah's assistant in Vapi from this app's config.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import {
  appBaseUrl,
  buildAssistantPayload,
  contactCardForToken,
  findSession,
  finishQualification,
  leadView,
  loadConfig,
  recordQualifyVisit,
  resolveVaultLead,
  routeToSalesLine,
  startSession,
  vapiFetch,
} from '../../shared/videoQualify.ts';

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'client');
    const base = appBaseUrl(req);
    const cfg = await loadConfig(base44);

    if (action === 'client') {
      const lead = await resolveVaultLead(base44, body.token);
      const session = await startSession(base44, lead, body.source);
      // The email's video CTA is untracked by the provider, so the visit to this
      // page is what marks "Qualification Page Visited" on the contact card.
      await recordQualifyVisit(base44, await contactCardForToken(base44, body.token), req);
      const embedUrl = String(cfg.protofaceEmbedUrl || '')
        .replace('{{avatar}}', cfg.protofaceAvatarId || '')
        .replace('{{name}}', encodeURIComponent((lead && lead.firstName) || 'there'));
      return Response.json({
        ok: true,
        enabled: cfg.isActive !== false,
        agentName: cfg.agentName || 'Sarah',
        assistantId: cfg.assistantId || '',
        publicKey: secrets.get('VAPI_PUBLIC_KEY') || '',
        protofaceEmbedUrl: embedUrl,
        protofaceEmbedId: cfg.protofaceEmbedId || '',
        sessionToken: session.sessionToken,
        matched: !!lead,
        lead: leadView(lead),
      });
    }

    if (action === 'attachCall') {
      const session = await findSession(base44, { sessionToken: body.sessionToken });
      if (!session) return Response.json({ ok: false, error: 'Session not found.' }, { status: 404 });
      await base44.asServiceRole.entities.VideoQualifySession.update(session.id, {
        vapiCallId: String(body.vapiCallId || ''),
        mode: 'voice',
        status: 'in_progress',
      });
      return Response.json({ ok: true });
    }

    if (action === 'routeCall') {
      const session = await findSession(base44, { sessionToken: body.sessionToken });
      if (!session) return Response.json({ ok: false, error: 'Session not found.' }, { status: 404 });
      const result = await routeToSalesLine(base44, cfg, session, {
        phone: body.phone,
        debtTier: body.debtTier,
        mode: 'text',
        baseUrl: base,
      });
      return Response.json({ ok: true, ...result });
    }

    if (action === 'finishCall') {
      const session = await findSession(base44, { sessionToken: body.sessionToken });
      if (!session) return Response.json({ ok: false, error: 'Session not found.' }, { status: 404 });
      const result = await finishQualification(base44, session, {
        phone: body.phone,
        debtTier: body.debtTier,
        transcript: body.transcript,
        bridged: !!body.bridged,
        agentName: cfg.agentName || 'Stephani',
        actor: 'stephani-video',
      });
      const tier = String(body.debtTier || '').trim();
      await base44.asServiceRole.entities.VideoQualifySession.update(session.id, {
        ...(result.phone ? { verifiedPhone: result.phone } : {}),
        ...(tier ? { debtTier: tier } : {}),
        status: body.bridged ? 'bridged' : 'completed',
      });
      return Response.json({ ok: true, skipped: !!result.skipped, appointment: result.appointment || null });
    }

    if (action === 'syncAssistant') {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const payload = buildAssistantPayload(cfg, base);
      const assistant = cfg.assistantId
        ? await vapiFetch(`/assistant/${cfg.assistantId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await vapiFetch('/assistant', { method: 'POST', body: JSON.stringify(payload) });
      await base44.asServiceRole.entities.VideoQualifyConfig.update(cfg.id, {
        assistantId: assistant.id,
        updatedBy: user.email,
        updatedAt: new Date().toISOString(),
      });
      return Response.json({ ok: true, assistantId: assistant.id, webhookUrl: `${base}/functions/vapiWebhook` });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}