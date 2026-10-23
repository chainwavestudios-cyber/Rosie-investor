/**
 * aiInviteLinks — the AI invitation links for one contact card.
 *
 * The card's own Protoface ID is minted on first use and stamped on the card, and
 * the links a rep can text or email come back with it: one for each assistant the
 * video page offers (Rosie, Digital Chris), each carrying ?assistant=<key> so the
 * call opens with the face the client picked. Same link shape as the mailed ones.
 *
 *  body: { leadId }
 *  → { ok, protofaceId, url, links: [{ key, name, url }] }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { PROTOFACE_ID_RE, formatProtofaceId, qualifyLink } from '../../shared/protofaceId.ts';
import { assistantList, loadConfig } from '../../shared/videoQualify.ts';

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

    const cfg = await loadConfig(base44);
    const links = assistantList(cfg).map((a: any) => ({
      key: a.key,
      name: a.name,
      url: qualifyLink(protofaceId, a.key),
    }));

    return Response.json({ ok: true, protofaceId, url: qualifyLink(protofaceId), links });
  } catch (error) {
    return Response.json(
      { error: (error && (error as Error).message) || 'The invitation links could not be created.' },
      { status: 500 },
    );
  }
}