/**
 * emailCampaignSend — the controlled send queue of the Email Campaign Manager.
 *
 *   mode "accounts" → which Gmail account is connected (best effort: send-only
 *                     permission does not always expose the address)
 *   mode "preview"  → one recipient's finished email, nothing is sent
 *   mode "test"     → the same email to one address the operator typed (untracked)
 *   mode "send"     → one batch of the queue: the next pending recipients, each
 *                     rendered with their OWN values and tracked with their own
 *                     send ID, then logged against their contact card
 *
 * Nothing sends unless the campaign is running AND its recipients were approved,
 * and the batch stops at the daily limit or outside the sending window.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { campaignAssistants, normalizeAddress, recipientVars, renderEmail, sendingWindow, zonedDayStart, clean } from '../../shared/emailCampaign.ts';
import { buildMime } from '../../shared/emailTracking.ts';
import { sendViaGmail } from '../../shared/gmailSend.ts';
import { sendTrackedEmail } from '../../shared/emailMessageEngine.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const mode = ['accounts', 'preview', 'test', 'send'].includes(body.mode) ? body.mode : 'preview';
    const campaignId = clean(body.campaignId);

    // ── Which Gmail account is connected ────────────────────────────────────
    if (mode === 'accounts') {
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(String(res.status));
        const profile = await res.json();
        return Response.json({ ok: true, emailAddress: profile?.emailAddress || '', note: '' });
      } catch {
        return Response.json({
          ok: false,
          emailAddress: '',
          note: 'Gmail is connected, but its address cannot be read with send-only permission. Sends still go out from that account.',
        });
      }
    }

    if (!campaignId) return Response.json({ error: 'A campaign is required.' }, { status: 400 });
    const campaign = await base44.asServiceRole.entities.EmailCampaignJob.get(campaignId).catch(() => null);
    if (!campaign) return Response.json({ error: 'That campaign could not be found.' }, { status: 404 });

    const template = campaign.templateId
      ? await base44.asServiceRole.entities.EmailCampaignTemplate.get(campaign.templateId).catch(() => null)
      : null;
    // A missing template is a normal half-finished state, not an API failure — it
    // comes back as a readable message the wizard can show in place.
    if (!template) return Response.json({ error: 'This campaign has no email template yet — choose one in step 3.' });

    const assistants = await campaignAssistants(base44);
    const subjectOverride = clean(campaign.subject);

    const recipientFor = async (recipientId?: string) => {
      if (recipientId) {
        return await base44.asServiceRole.entities.EmailCampaignRecipient.get(recipientId).catch(() => null);
      }
      const page = await base44.asServiceRole.entities.EmailCampaignRecipient
        .filter({ campaignId, status: 'pending' }, { sort: 'created_date', limit: 1 })
        .catch(() => null);
      return (page?.items || [])[0] || null;
    };

    // ── Preview one recipient's finished email ──────────────────────────────
    if (mode === 'preview') {
      const recipient = await recipientFor(clean(body.recipientId) || undefined);
      if (!recipient) return Response.json({ error: 'There is no recipient to preview yet — import a list first.' });
      const vars = recipientVars(recipient, assistants);
      const rendered = renderEmail({ ...template, subject: subjectOverride || template.subject }, vars);
      return Response.json({
        ok: true,
        recipient: {
          id: recipient.id,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          inviteToken: recipient.inviteToken || '',
          rosieInviteLink: recipient.rosieInviteLink || vars.rosieInviteLink || '',
          chrisInviteLink: recipient.chrisInviteLink || vars.chrisInviteLink || '',
        },
        rendered,
        vars: {
          firstName: vars.firstName,
          lastName: vars.lastName,
          email: vars.email,
          state: vars.state,
          source: vars.source,
          inviteLink: vars.inviteLink,
          rosieInviteLink: vars.rosieInviteLink || '',
          chrisInviteLink: vars.chrisInviteLink || '',
          unsubscribeUrl: vars.unsubscribeUrl || '',
          companyMailingAddress: vars.companyMailingAddress || '',
        },
      });
    }

    // ── A test copy to one address, exactly as it will look (untracked) ─────
    if (mode === 'test') {
      const to = normalizeAddress(body.testEmail);
      if (!to) return Response.json({ error: 'Enter a valid address to send the test to.' });
      const recipient = await recipientFor(clean(body.recipientId) || undefined);
      const vars = recipientVars(recipient || { firstName: 'Friend', email: to }, assistants);
      const rendered = renderEmail({ ...template, subject: subjectOverride || template.subject }, vars);
      await sendViaGmail(base44, to, buildMime(to, `<TEST> ${rendered.subject}`, rendered.html, rendered.text));
      return Response.json({ ok: true, to });
    }

    // ── The queue ───────────────────────────────────────────────────────────
    if (String(campaign.status) !== 'running') {
      return Response.json({ ok: false, waiting: true, reason: `The queue is not running (status: ${campaign.status}).` });
    }
    if (!campaign.approvedAt) {
      return Response.json({ ok: false, waiting: true, reason: 'These recipients have not been approved yet.' });
    }

    const window_ = sendingWindow(campaign);
    if (!window_.open) {
      return Response.json({
        ok: false,
        waiting: true,
        reason: `Outside the sending window — it is ${window_.clock} in ${window_.timezone} (window ${window_.start}–${window_.end}).`,
      });
    }

    const dayStart = zonedDayStart(clean(campaign.timezone) || 'America/New_York').toISOString();
    const sentToday = await base44.asServiceRole.entities.EmailCampaignRecipient
      .count({ campaignId, status: 'sent', sentAt: { $gte: dayStart } })
      .catch(() => 0);
    const dailyLimit = Math.max(1, Number(campaign.dailyLimit || 500));
    if (sentToday >= dailyLimit) {
      return Response.json({
        ok: false,
        waiting: true,
        reason: `Today's limit of ${dailyLimit} emails is reached — the queue resumes after midnight (${campaign.timezone}).`,
      });
    }

    const batchSize = Math.max(1, Math.min(Number(campaign.batchSize || 25), dailyLimit - sentToday, 100));
    const pending = await base44.asServiceRole.entities.EmailCampaignRecipient
      .filter({ campaignId, status: 'pending' }, { sort: 'created_date', limit: batchSize })
      .catch(() => null);
    const queue = pending?.items || [];

    if (!queue.length) {
      await base44.asServiceRole.entities.EmailCampaignJob.update(campaignId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      return Response.json({ ok: true, done: true, sent: 0, failed: 0, remaining: 0 });
    }

    // One opt-out query for the whole batch: whatever the list said at import time,
    // anyone who has unsubscribed since is skipped and marked on their own row.
    const queueAddresses = queue.map((row: any) => normalizeAddress(row.email)).filter(Boolean);
    const optOutPage = queueAddresses.length
      ? await base44.asServiceRole.entities.EmailOptIn.filter({ email: { $in: queueAddresses } }, { limit: 500 }).catch(() => null)
      : null;
    const suppressed = new Set(
      (optOutPage?.items || [])
        .filter((row: any) => String(row?.status || '').toLowerCase() === 'unsubscribed')
        .map((row: any) => clean(row.email).toLowerCase()),
    );

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const recipient of queue) {
      // Re-checked per send: an opt-out can arrive between the import and now.
      const address = normalizeAddress(recipient.email);
      if (!address) {
        await base44.asServiceRole.entities.EmailCampaignRecipient.update(recipient.id, {
          status: 'skipped',
          reason: 'Invalid email address',
        }).catch(() => {});
        skipped += 1;
        continue;
      }

      const vars = recipientVars(recipient, assistants);
      const rendered = renderEmail({ ...template, subject: subjectOverride || template.subject }, vars);
      const sendId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const templateName = clean(campaign.templateName) || clean(template.name);

      try {
        if (String(recipient.unsubscribedAt || '') || suppressed.has(address)) {
          await base44.asServiceRole.entities.EmailCampaignRecipient.update(recipient.id, {
            status: 'skipped',
            reason: 'Unsubscribed — do not email',
            unsubscribedAt: recipient.unsubscribedAt || new Date().toISOString(),
          }).catch(() => {});
          skipped += 1;
          continue;
        }

        // Every campaign email goes through the same tracked-send engine as a
        // contact-card send: its own opaque token, embedded images hosted, one
        // message record, and the duplicate guard. The recipient's card carries the
        // identity, so its opens, clicks and unsubscribes land on that person and on
        // this campaign's own counters.
        const trackedSend = await sendTrackedEmail(base44, {
          to: address,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          contactId: recipient.leadId || '',
          contactKind: 'lead',
          contactName: `${clean(recipient.firstName)} ${clean(recipient.lastName)}`.trim(),
          templateId: template.id,
          templateName,
          senderEmail: clean(campaign.senderEmail),
          senderName: clean(campaign.senderName),
          sentBy: clean(campaign.createdBy) || 'campaign',
          source: 'campaign',
          sendId,
        });
        const messageId = trackedSend.messageId;

        await base44.asServiceRole.entities.EmailCampaignRecipient.update(recipient.id, {
          status: 'sent',
          reason: '',
          subject: rendered.subject,
          sendId,
          messageId: messageId || '',
          sentAt: new Date().toISOString(),
          error: '',
        });
        sent += 1;

        if (recipient.leadId) {
          await base44.asServiceRole.entities.EmailLog.create({
            leadId: recipient.leadId,
            toEmail: address,
            toName: `${clean(recipient.firstName)} ${clean(recipient.lastName)}`.trim(),
            subject: rendered.subject,
            templateId: template.id,
            templateName,
            sendId,
            messageId: messageId || '',
            status: 'sent',
            sentAt: new Date().toISOString(),
            sentBy: clean(campaign.createdBy) || 'campaign',
            isCustomEmail: false,
            fromEmail: 'gmail',
          }).catch(() => {});
        }
      } catch (error) {
        const message = clean((error as Error)?.message) || 'The message could not be sent.';
        failed += 1;
        if (errors.length < 5) errors.push(`${address}: ${message}`);
        await base44.asServiceRole.entities.EmailCampaignRecipient.update(recipient.id, {
          status: 'failed',
          error: message,
          sendId,
        }).catch(() => {});
      }
    }

    const remainingPage = await base44.asServiceRole.entities.EmailCampaignRecipient
      .filter({ campaignId, status: 'pending' }, { limit: 1 })
      .catch(() => null);
    const remaining = (remainingPage?.items || []).length;

    await base44.asServiceRole.entities.EmailCampaignJob.update(campaignId, {
      sentCount: Number(campaign.sentCount || 0) + sent,
      failedCount: Number(campaign.failedCount || 0) + failed,
      skippedCount: Number(campaign.skippedCount || 0) + skipped,
      lastRunAt: new Date().toISOString(),
      ...(remaining ? {} : { status: 'completed', completedAt: new Date().toISOString() }),
    });

    return Response.json({ ok: true, sent, failed, skipped, remaining: remaining ? 1 : 0, errors });
  } catch (error) {
    return Response.json(
      { error: (error && (error as Error).message) || 'The send queue could not run.' },
      { status: 500 },
    );
  }
}