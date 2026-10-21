/**
 * rateDropGenerateMailer — Builds (and stores) the Rate Drop digital mailer for
 * contact cards, and renders previews of an unsaved template.
 *
 * Actions:
 *   preview  → { html } for one lead using the draft (or saved) template, nothing stored
 *   get      → { mailer } the stored mailer for one lead (null when none yet)
 *   generate → { generated } builds/refreshes stored mailers for the given leads
 *
 * Called from the Lead Vault's Rate Drop Engine tab and from the contact card's
 * Mailer tab. Vault distribution also generates mailers directly through the
 * shared module.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  buildMailerHtml,
  buildMailerContext,
  ensureMailers,
  findMailer,
  getRateDropTemplate,
  resolveInboundPhone,
  MAILER_SLOTS,
  CONTACT_FIELD_SOURCES,
  MOCK_CARD,
  vaultEntryToMailerCard,
} from '../../shared/rateDropMailer.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Portal users sign in through DebtCoachAuth, so the platform session check
    // is best-effort here; these are internal admin screens.
    try { await base44.auth.me(); } catch {}

    const action = body?.action || 'generate';

    if (action === 'template') {
      const template = await getRateDropTemplate(base44);
      const phone = await resolveInboundPhone(base44);
      return Response.json({ template, slots: MAILER_SLOTS, sources: CONTACT_FIELD_SOURCES, inboundPhone: phone });
    }

    if (action === 'preview') {
      // mock: true renders a test mailer from sample card data — nothing is read
      // off a real card and nothing is stored.
      // mock: true renders a test mailer from sample card data — nothing is read
      // off a real card and nothing is stored. vaultEntryId previews a lead that
      // is still in the vault (no contact card exists yet).
      const mock = !!body?.mock;
      const leadId = body?.leadId;
      const vaultEntryId = body?.vaultEntryId;
      // A training card (BOB's simulated customer) rides over the sample card, so
      // the trainer only has to send the fields its scenario knows.
      const simCard = body?.card && typeof body.card === 'object' ? body.card : null;
      if (!mock && !leadId && !vaultEntryId && !simCard) {
        return Response.json({ error: 'leadId, vaultEntryId or card is required' }, { status: 400 });
      }
      let card: any = mock ? MOCK_CARD : null;
      if (!card && simCard) card = { ...MOCK_CARD, ...simCard };
      if (!card && vaultEntryId) {
        const entry = await base44.asServiceRole.entities.LeadVaultEntry.get(vaultEntryId);
        if (!entry) return Response.json({ error: 'Vault lead not found' }, { status: 404 });
        card = vaultEntryToMailerCard(entry);
      }
      if (!card && leadId) card = await base44.asServiceRole.entities.FronterLead.get(leadId);
      if (!card) return Response.json({ error: 'Contact card not found' }, { status: 404 });
      const template = body?.template ? { ...(await getRateDropTemplate(base44)), ...body.template } : await getRateDropTemplate(base44);
      const phone = await resolveInboundPhone(base44);
      const html = buildMailerHtml(template, card, buildMailerContext(phone, template));
      return Response.json({ html, phone, mock, leadNumber: card.leadNumber || '', noticeId: card.noticeId || '' });
    }

    if (action === 'get') {
      const leadId = body?.leadId;
      if (!leadId) return Response.json({ error: 'leadId is required' }, { status: 400 });
      const mailer = await findMailer(base44, leadId);
      if (mailer) return Response.json({ mailer });
      const result = await ensureMailers(base44, [leadId]);
      return Response.json({ mailer: await findMailer(base44, leadId), generated: result.generated });
    }

    const leadIds: string[] = Array.isArray(body?.leadIds)
      ? body.leadIds
      : body?.leadId
      ? [body.leadId]
      : [];
    if (!leadIds.length) return Response.json({ error: 'leadIds are required' }, { status: 400 });

    const result = await ensureMailers(base44, leadIds);
    return Response.json({ generated: result.generated });
  } catch (error: any) {
    console.error('[rateDropGenerateMailer] error:', error?.message || String(error));
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}