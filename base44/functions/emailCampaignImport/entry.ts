/**
 * emailCampaignImport — one chunk of a CSV, turned into approved-ready recipients.
 *
 * mode "dry_run" answers the question the mapping screen asks: how many rows are
 * eligible, and exactly why the rest are not. mode "commit" does the same checks
 * and then writes: a contact card for anyone new, the missing fields on a card
 * that already exists (never overwriting what is on it), and one recipient row
 * carrying that person's own invitation token and links.
 *
 * Nothing here sends an email. Sending only ever starts after the campaign is
 * explicitly approved.
 *
 *  body: { campaignId, mode, listName, rows: [{ email, firstName, … , custom }] }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  cardForRow,
  cardPatchFor,
  campaignAssistants,
  newToken,
  existingToken,
  inviteLinks,
  isEmailUnsubscribed,
  normalizeAddress,
  clean,
} from '../../shared/emailCampaign.ts';

const CHUNK_LIMIT = 500;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const campaignId = clean(body.campaignId);
    const mode = body.mode === 'commit' ? 'commit' : 'dry_run';
    const listName = clean(body.listName);
    const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, CHUNK_LIMIT);

    if (!campaignId) return Response.json({ error: 'A campaign is required.' }, { status: 400 });
    const campaign = await base44.asServiceRole.entities.EmailCampaignJob.get(campaignId).catch(() => null);
    if (!campaign) return Response.json({ error: 'That campaign could not be found.' }, { status: 404 });
    if (!rows.length) {
      return Response.json({ mode, processed: 0, eligible: 0, excluded: [], createdCards: 0, updatedCards: 0, matchedCards: 0 });
    }

    // 1. Shape the chunk: normalize addresses, drop the unusable ones out loud.
    const excluded: Array<{ email: string; firstName: string; lastName: string; reason: string }> = [];
    const candidates: any[] = [];
    const seen = new Set<string>();

    for (const raw of rows) {
      const email = normalizeAddress(raw?.email);
      const label = { email: clean(raw?.email) || email, firstName: clean(raw?.firstName), lastName: clean(raw?.lastName) };
      if (!email) { excluded.push({ ...label, reason: 'Invalid or missing email address' }); continue; }
      if (seen.has(email)) { excluded.push({ ...label, reason: 'Duplicate inside this file' }); continue; }
      seen.add(email);
      candidates.push({
        email,
        firstName: clean(raw?.firstName),
        lastName: clean(raw?.lastName),
        phone: clean(raw?.phone),
        company: clean(raw?.company),
        city: clean(raw?.city),
        state: clean(raw?.state),
        source: clean(raw?.source),
        customJson: raw?.custom && typeof raw.custom === 'object' ? JSON.stringify(raw.custom) : '{}',
      });
    }

    // 2. Opt-outs and rows already imported into this campaign.
    //    One query per concern for the whole chunk, filtered in code: a combined
    //    filter can quietly miss the row that matters.
    const emails = candidates.map((row) => row.email);
    const optOutRows = await base44.asServiceRole.entities.EmailOptIn.filter({ email: { $in: emails } }, { limit: CHUNK_LIMIT }).catch(() => null);
    const optedOut = new Set(
      (optOutRows?.items || []).filter((row: any) => String(row?.status || '').toLowerCase() === 'unsubscribed').map((row: any) => clean(row.email).toLowerCase()),
    );
    const alreadyRows = await base44.asServiceRole.entities.EmailCampaignRecipient.filter({ email: { $in: emails } }, { limit: CHUNK_LIMIT }).catch(() => null);
    const already = new Set(
      (alreadyRows?.items || []).filter((row: any) => row.campaignId === campaignId).map((row: any) => clean(row.email).toLowerCase()),
    );

    const eligible: any[] = [];
    for (const row of candidates) {
      if (optedOut.has(row.email)) { excluded.push({ ...row, reason: 'Unsubscribed — do not email' }); continue; }
      if (already.has(row.email)) { excluded.push({ ...row, reason: 'Already imported into this campaign' }); continue; }
      eligible.push(row);
    }

    // 3. Which of these people already have a contact card? Matched by email only —
    //    a shared phone number or name is never treated as the same person.
    const cardRows = await base44.asServiceRole.entities.DebtLead.filter({ email: { $in: emails } }, { limit: CHUNK_LIMIT }).catch(() => null);
    const cardByEmail = new Map<string, any>();
    for (const card of cardRows?.items || []) {
      const key = clean(card?.email).toLowerCase();
      if (key && !cardByEmail.has(key)) cardByEmail.set(key, card);
    }

    const report = {
      mode,
      processed: rows.length,
      eligible: eligible.length,
      excluded,
      createdCards: 0,
      updatedCards: 0,
      matchedCards: 0,
      tokenReused: 0,
    };

    if (mode === 'dry_run' || !eligible.length) return Response.json(report);

    const assistants = await campaignAssistants(base44);

    // 4. Cards: create the missing ones, complete the empty fields on the rest.
    const creates: any[] = [];
    const updates: any[] = [];
    const tokenFor = new Map<string, string>();

    for (const row of eligible) {
      const card = cardByEmail.get(row.email);
      if (!card) {
        const token = newToken();
        creates.push({ ...cardForRow(row, listName), protofaceId: token });
        tokenFor.set(row.email, token);
        continue;
      }
      report.matchedCards += 1;
      const patch = cardPatchFor(card, row);
      const kept = existingToken(card);
      if (kept) {
        tokenFor.set(row.email, kept);
        report.tokenReused += 1;
      } else {
        const token = newToken();
        patch.protofaceId = token;
        tokenFor.set(row.email, token);
      }
      if (Object.keys(patch).length) updates.push({ id: card.id, ...patch });
    }

    const createdCards = creates.length
      ? await base44.asServiceRole.entities.DebtLead.bulkCreate(creates).catch(() => null)
      : [];
    if (updates.length) await base44.asServiceRole.entities.DebtLead.bulkUpdate(updates).catch(() => null);
    report.createdCards = (createdCards || []).length;
    report.updatedCards = updates.length;

    const cardIdFor = new Map<string, string>();
    for (const card of cardRows?.items || []) {
      const key = clean(card?.email).toLowerCase();
      if (key && !cardIdFor.has(key)) cardIdFor.set(key, card.id);
    }
    for (const card of createdCards || []) {
      const key = clean(card?.email).toLowerCase();
      if (key) cardIdFor.set(key, card.id);
    }

    // 5. One recipient row each, with that person's own token and links.
    const recipients = eligible.map((row) => {
      const token = tokenFor.get(row.email) || '';
      const links = inviteLinks(token, assistants);
      return {
        campaignId,
        campaignName: clean(campaign.name),
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        company: row.company,
        city: row.city,
        state: row.state,
        source: row.source,
        customJson: row.customJson,
        status: 'pending',
        leadId: cardIdFor.get(row.email) || '',
        cardMatched: !!cardByEmail.get(row.email),
        inviteToken: token,
        rosieInviteLink: links.rosieInviteLink || '',
        chrisInviteLink: links.chrisInviteLink || '',
      };
    });

    await base44.asServiceRole.entities.EmailCampaignRecipient.bulkCreate(recipients);

    // 6. Campaign tallies.
    await base44.asServiceRole.entities.EmailCampaignJob.update(campaignId, {
      importedCount: Number(campaign.importedCount || 0) + rows.length,
      eligibleCount: Number(campaign.eligibleCount || 0) + eligible.length,
      excludedCount: Number(campaign.excludedCount || 0) + excluded.length,
      contactCreatedCount: Number(campaign.contactCreatedCount || 0) + report.createdCards,
      contactUpdatedCount: Number(campaign.contactUpdatedCount || 0) + report.updatedCards,
    });

    return Response.json(report);
  } catch (error) {
    return Response.json(
      { error: (error && (error as Error).message) || 'The import could not be checked.' },
      { status: 500 },
    );
  }
}