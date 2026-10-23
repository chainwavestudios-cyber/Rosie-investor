/**
 * stephaniLink — the video link for one Debt Call Coach contact card.
 *
 * A rep clicks the button on the card and gets a link they can text or email the
 * client. The card's own Protoface ID is minted the first time (the same "pf_"
 * token the distributed leads carry) and stamped on the card, so the link stays
 * stable for that client; opening it starts a fresh qualification call with
 * Stephani, who already knows who is on the page.
 *
 *  body: { leadId }
 *  → { ok, protofaceId, url }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { PROTOFACE_ID_RE, formatProtofaceId, qualifyLink } from '../../shared/protofaceId.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const leadId = String(body.leadId || '').trim();
    if (!leadId) return Response.json({ error: 'A contact card is required.' }, { status: 400 });

    const card = await base44.asServiceRole.entities.DebtLead.get(leadId).catch(() => null);
    if (!card) return Response.json({ error: 'That contact card could not be found.' }, { status: 404 });

    const existing = String(card.protofaceId || '').trim();
    const protofaceId = PROTOFACE_ID_RE.test(existing) ? existing : formatProtofaceId();
    if (protofaceId !== existing) {
      await base44.asServiceRole.entities.DebtLead.update(card.id, { protofaceId });
    }

    return Response.json({ ok: true, protofaceId, url: qualifyLink(protofaceId) });
  } catch (error) {
    return Response.json({ error: (error && (error as Error).message) || 'The video link could not be created.' }, { status: 500 });
  }
}