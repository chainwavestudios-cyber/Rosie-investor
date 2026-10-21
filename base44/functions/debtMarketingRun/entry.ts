/**
 * debtMarketingRun — engine tick for the Debt Call Coach marketing campaigns.
 *
 * Sends every queued email whose scheduled time has arrived, using the saved
 * Debt Call Coach email the campaign was built from. Scheduling itself happens
 * when the campaign is created (each lead gets its own DebtMarketingSend row with
 * a precomputed send time), so this tick can never double-send.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { MAILJET_FROM_NAME } from '../../shared/mailjetSender.ts';

const MAX_CAMPAIGNS_PER_TICK = 5;
const MAX_SENDS_PER_CAMPAIGN = 25;

function render(text: string, vars: Record<string, string>) {
  let out = String(text || '');
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const key = Deno.env.get('MAILJET_2_API_KEY');
    const secret = Deno.env.get('MAILJET_2_API_SECRET');
    const fromEmail = Deno.env.get('MAILJET_2_FROM_EMAIL');
    if (!key || !secret || !fromEmail) {
      throw new Error('Mailjet credentials not configured (MAILJET_2_API_KEY, MAILJET_2_API_SECRET, MAILJET_2_FROM_EMAIL)');
    }
    const auth = btoa(`${key}:${secret}`);

    const body = await req.json().catch(() => ({}));
    const campaignId = body?.campaignId || null;
    const nowIso = new Date().toISOString();

    const page = await base44.asServiceRole.entities.DebtMarketingCampaign.filter(
      campaignId ? { id: campaignId, status: 'running' } : { status: 'running' },
      { sort: '-created_date', limit: MAX_CAMPAIGNS_PER_TICK },
    );
    const campaigns = page?.items || page || [];
    const summary: any[] = [];

    for (const campaign of campaigns) {
      const duePage = await base44.asServiceRole.entities.DebtMarketingSend.filter(
        { campaignId: campaign.id, status: 'pending', sendAt: { $lte: nowIso } },
        { sort: 'sendAt', limit: MAX_SENDS_PER_CAMPAIGN },
      );
      const due = duePage?.items || duePage || [];

      const template = campaign.emailTemplateId
        ? await base44.asServiceRole.entities.DebtEmailTemplate.get(campaign.emailTemplateId).catch(() => null)
        : null;

      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (const send of due) {
        try {
          if (!template?.bodyHtml) {
            await base44.asServiceRole.entities.DebtMarketingSend.update(send.id, {
              status: 'skipped',
              error: 'The saved email for this campaign is missing',
            });
            skipped++;
            continue;
          }

          const lead = send.vaultEntryId
            ? await base44.asServiceRole.entities.LeadVaultEntry.get(send.vaultEntryId).catch(() => null)
            : null;
          const to = (lead?.email || send.email || '').trim();
          if (!to) {
            await base44.asServiceRole.entities.DebtMarketingSend.update(send.id, {
              status: 'skipped',
              error: lead ? 'No email on the vault lead' : 'Vault lead no longer exists',
            });
            skipped++;
            continue;
          }

          const fullName = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim();
          const vars: Record<string, string> = {
            firstName: lead?.firstName || '',
            lastName: lead?.lastName || '',
            name: fullName,
            email: to,
            phone: lead?.phone || '',
            state: lead?.state || '',
            appointmentDate: '',
            debtAmount: lead?.debtAmount ? `$${Number(lead.debtAmount).toLocaleString()}` : '',
            personalMessageUrl: '',
          };
          const subject = render(campaign.subject || template.subject || 'Debt Solutions', vars);
          const html = render(template.bodyHtml, vars);
          const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

          const res = await fetch('https://api.mailjet.com/v3.1/send', {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              Messages: [{
                From: { Email: fromEmail, Name: MAILJET_FROM_NAME },
                To: [{ Email: to, Name: fullName || to }],
                Subject: subject,
                HTMLPart: html,
                TextPart: text,
                CustomID: `dm:${campaign.id}:${send.id}`,
              }],
            }),
            signal: AbortSignal.timeout(25000),
          });
          const payload = await res.json().catch(() => ({}));
          const status = payload?.Messages?.[0]?.Status;
          if (!res.ok || status !== 'success') {
            const detail = JSON.stringify(payload?.Messages?.[0]?.Errors || payload?.ErrorMessages || payload || {}).slice(0, 300);
            throw new Error(`Mailjet rejected the send (${res.status}): ${detail}`);
          }

          await base44.asServiceRole.entities.DebtMarketingSend.update(send.id, {
            status: 'sent',
            sentAt: new Date().toISOString(),
            email: to,
            mailjetMessageId: String(payload?.Messages?.[0]?.To?.[0]?.MessageID || ''),
          });
          sent++;
        } catch (err: any) {
          await base44.asServiceRole.entities.DebtMarketingSend.update(send.id, {
            status: 'failed',
            error: String(err?.message || err).slice(0, 400),
          });
          failed++;
        }
      }

      const remainingPage = await base44.asServiceRole.entities.DebtMarketingSend.filter(
        { campaignId: campaign.id, status: 'pending' },
        { limit: 1 },
      );
      const remaining = remainingPage?.items || remainingPage || [];

      const updates: any = {
        sentCount: (campaign.sentCount || 0) + sent,
        failedCount: (campaign.failedCount || 0) + failed,
        skippedCount: (campaign.skippedCount || 0) + skipped,
        lastRunAt: nowIso,
      };
      if (remaining.length === 0 && due.length === 0) updates.status = 'completed';
      await base44.asServiceRole.entities.DebtMarketingCampaign.update(campaign.id, updates);

      summary.push({ campaign: campaign.name, sent, failed, skipped, completed: updates.status === 'completed' });
    }

    return Response.json({ ranAt: nowIso, campaigns: summary });
  } catch (error: any) {
    console.error('[debtMarketingRun] error:', error?.message || String(error));
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}