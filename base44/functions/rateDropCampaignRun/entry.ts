/**
 * rateDropCampaignRun — The Rate Drop mailer engine tick.
 *
 * Runs every 2 minutes (scheduled workflow). Sends every scheduled mailer whose
 * send time has arrived, injecting the digital mailer into the campaign's
 * Mailjet template, and completes a campaign once nothing is left pending.
 *
 * Scheduling itself happens when the campaign is created: each prospect gets a
 * RateDropSend row with a precomputed send time (all at once, in bursts every N
 * minutes, or a daily quota spread inside an 8am–8pm style window), so this tick
 * only has to send what is due — it can never double-send or run past the quota.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  ensureMailers,
  findMailer,
  getRateDropTemplate,
  sendRateDropMailer,
  cardFullName,
} from '../../shared/rateDropMailer.ts';

const MAX_CAMPAIGNS_PER_TICK = 5;
const MAX_SENDS_PER_CAMPAIGN = 25;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const campaignId = body?.campaignId || null;
    const nowIso = new Date().toISOString();

    const campaignQuery = campaignId ? { id: campaignId, status: 'running' } : { status: 'running' };
    const campaignPage = await base44.asServiceRole.entities.RateDropCampaign.filter(campaignQuery, {
      sort: '-created_date',
      limit: MAX_CAMPAIGNS_PER_TICK,
    });
    const campaigns = Array.isArray(campaignPage) ? campaignPage : campaignPage?.items || [];

    const summary: any[] = [];
    // The notice template supplies the plain-text side of each send.
    const template = await getRateDropTemplate(base44);

    for (const campaign of campaigns) {
      const duePage = await base44.asServiceRole.entities.RateDropSend.filter(
        { campaignId: campaign.id, status: 'pending', sendAt: { $lte: nowIso } },
        { sort: 'sendAt', limit: MAX_SENDS_PER_CAMPAIGN }
      );
      const due = Array.isArray(duePage) ? duePage : duePage?.items || [];

      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (const send of due) {
        try {
          const card = await base44.asServiceRole.entities.FronterLead.get(send.leadId).catch(() => null);
          const to = (card?.email || send.email || '').trim();
          if (!card || !to) {
            await base44.asServiceRole.entities.RateDropSend.update(send.id, {
              status: 'skipped',
              error: !card ? 'Contact card no longer exists' : 'No email on the contact card',
            });
            skipped++;
            continue;
          }

          let mailer = await findMailer(base44, send.leadId);
          if (!mailer) {
            await ensureMailers(base44, [send.leadId]);
            mailer = await findMailer(base44, send.leadId);
          }
          if (!mailer?.html) {
            await base44.asServiceRole.entities.RateDropSend.update(send.id, {
              status: 'skipped',
              error: 'Mailer could not be generated',
            });
            skipped++;
            continue;
          }

          const result = await sendRateDropMailer(base44, {
            to,
            toName: cardFullName(card),
            mailjetTemplateId: campaign.mailjetTemplateId,
            mailer,
            card,
            template,
            customId: `rd:${campaign.id}:${send.id}`,
          });

          await base44.asServiceRole.entities.RateDropSend.update(send.id, {
            status: 'sent',
            sentAt: new Date().toISOString(),
            mailerId: mailer.id,
            email: to,
            noticeId: mailer.noticeId || '',
            mailjetMessageId: result.messageId,
          });
          await base44.asServiceRole.entities.RateDropMailer.update(mailer.id, { lastSentAt: new Date().toISOString() });
          sent++;
        } catch (err: any) {
          await base44.asServiceRole.entities.RateDropSend.update(send.id, {
            status: 'failed',
            error: String(err?.message || err).slice(0, 400),
          });
          failed++;
        }
      }

      const remainingPage = await base44.asServiceRole.entities.RateDropSend.filter(
        { campaignId: campaign.id, status: 'pending' },
        { limit: 1 }
      );
      const remaining = Array.isArray(remainingPage) ? remainingPage : remainingPage?.items || [];

      const updates: any = {
        sentCount: (campaign.sentCount || 0) + sent,
        failedCount: (campaign.failedCount || 0) + failed,
        skippedCount: (campaign.skippedCount || 0) + skipped,
        lastRunAt: nowIso,
      };
      if (remaining.length === 0 && due.length === 0) updates.status = 'completed';
      await base44.asServiceRole.entities.RateDropCampaign.update(campaign.id, updates);

      summary.push({ campaign: campaign.name, sent, failed, skipped, completed: updates.status === 'completed' });
    }

    return Response.json({ ranAt: nowIso, campaigns: summary });
  } catch (error: any) {
    console.error('[rateDropCampaignRun] error:', error?.message || String(error));
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}