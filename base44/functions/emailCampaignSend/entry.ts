/**
 * emailCampaignSend — the controlled send queue of the Email Campaign Manager.
 *
 *   mode "accounts" → which Gmail account is connected (best effort: send-only
 *                     permission does not always expose the address)
 *   mode "preview"  → one recipient's finished email, nothing is sent
 *   mode "test"     → the same email to one address the operator typed (untracked)
 *   mode "send"     → one send of the queue: the next pending recipients, each
 *                     rendered with their OWN values and tracked with their own
 *                     send ID, then logged against their contact card
 *   mode "tick"     → the scheduler's entry point: every running campaign whose
 *                     random wait has passed gets one send
 *
 * A campaign may send from several queues. Each queue carries its own number of
 * emails per send and its own random wait range, and one queue is drawn at random
 * for every send — so neither the amount nor the rhythm stays regular. After each
 * send the campaign records when the next one may go out (nextSendAt), which is
 * what the scheduler and the monitor pace themselves against; a person clicking
 * "Run next batch" overrides that and sends straight away.
 *
 * Nothing sends unless the campaign is running AND its recipients were approved,
 * and the send stops at the daily limit or outside the sending window.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { automationGate } from '../../shared/automationRules.ts';
import { campaignAssistants, normalizeAddress, recipientVars, renderEmail, sendingWindow, zonedDayStart, clean } from '../../shared/emailCampaign.ts';
import { buildMime } from '../../shared/emailTracking.ts';
import { sendViaGmail } from '../../shared/gmailSend.ts';
import { sendTrackedEmail } from '../../shared/emailMessageEngine.ts';

/** One queue of a campaign: how many emails it sends, and how long it then waits. */
interface CampaignQueue {
  label: string;
  perBurst: number;
  gapMinSeconds: number;
  gapMaxSeconds: number;
}

/**
 * The queues this campaign sends from — always at least one. A campaign saved
 * before queues existed has none stored, so the single queue its batch settings
 * describe stands in for it and its behaviour is unchanged.
 */
export function resolveQueues(campaign: any): CampaignQueue[] {
  let parsed: any = [];
  try {
    parsed = JSON.parse(clean(campaign?.queuesJson) || '[]');
  } catch {
    parsed = [];
  }

  const queues: CampaignQueue[] = (Array.isArray(parsed) ? parsed : [])
    .filter((row: any) => row && typeof row === 'object' && row.enabled !== false)
    .map((row: any, index: number) => {
      const min = Math.max(5, Number(row.gapMinSeconds) > 0 ? Number(row.gapMinSeconds) : Number(campaign?.intervalSeconds) || 60);
      const max = Math.max(min, Number(row.gapMaxSeconds) > 0 ? Number(row.gapMaxSeconds) : min);
      return {
        label: clean(row.label) || `Queue ${index + 1}`,
        perBurst: Math.max(1, Math.min(Number(row.perBurst) > 0 ? Number(row.perBurst) : 1, 100)),
        gapMinSeconds: min,
        gapMaxSeconds: max,
      };
    });

  if (queues.length) return queues;

  const min = Math.max(5, Number(campaign?.intervalSeconds) > 0 ? Number(campaign.intervalSeconds) : 60);
  return [{
    label: 'Main queue',
    perBurst: Math.max(1, Math.min(Number(campaign?.batchSize) > 0 ? Number(campaign.batchSize) : 1, 100)),
    gapMinSeconds: min,
    gapMaxSeconds: Math.max(min, Number(campaign?.intervalMaxSeconds) > 0 ? Number(campaign.intervalMaxSeconds) : min),
  }];
}

/** A fresh wait for one queue: anywhere between its shortest and its longest. */
export function randomGapSeconds(queue: CampaignQueue): number {
  const { gapMinSeconds: min, gapMaxSeconds: max } = queue;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** One queue of the campaign's list, drawn at random. */
function pickQueue(queues: CampaignQueue[]): CampaignQueue {
  return queues[Math.floor(Math.random() * queues.length)];
}

/**
 * One send of one campaign: draws a queue, sends that queue's number of emails,
 * then writes when the next send may go out. Every path returns a readable result
 * rather than throwing, so the monitor and the scheduler can both report why
 * nothing went out.
 */
async function runQueue(base44: any, campaign: any, options: { respectDue?: boolean; assistants?: any[] } = {}) {
  const campaignId = campaign.id;

  const template = campaign.templateId
    ? await base44.asServiceRole.entities.EmailCampaignTemplate.get(campaign.templateId).catch(() => null)
    : null;
  // A missing template is a normal half-finished state, not an API failure — it
  // comes back as a readable message the wizard can show in place.
  if (!template) return { error: 'This campaign has no email template yet — choose one in step 3.' };

  const assistants = options.assistants || await campaignAssistants(base44);
  const subjectOverride = clean(campaign.subject);

  if (String(campaign.status) !== 'running') {
    return { ok: false, waiting: true, reason: `The queue is not running (status: ${campaign.status}).` };
  }
  if (!campaign.approvedAt) {
    return { ok: false, waiting: true, reason: 'These recipients have not been approved yet.' };
  }

  // The queue for this send, and the wait it draws — both decided before anything
  // else, so the campaign is paced even when the send itself is held back.
  const lane = pickQueue(resolveQueues(campaign));
  const gapSeconds = randomGapSeconds(lane);

  const dueAt = campaign.nextSendAt ? new Date(campaign.nextSendAt).getTime() : 0;
  const nowMs = Date.now();
  if (options.respectDue && dueAt > nowMs) {
    return {
      ok: false,
      pacing: true,
      queue: lane.label,
      nextInSeconds: Math.ceil((dueAt - nowMs) / 1000),
      reason: 'Waiting for the random wait this queue drew — the next send is not due yet.',
    };
  }

  const window_ = sendingWindow(campaign);
  if (!window_.open) {
    return {
      ok: false,
      waiting: true,
      reason: `Outside the sending window — it is ${window_.clock} in ${window_.timezone} (window ${window_.start}–${window_.end}).`,
    };
  }

  const dayStart = zonedDayStart(clean(campaign.timezone) || 'America/New_York').toISOString();
  const sentToday = await base44.asServiceRole.entities.EmailCampaignRecipient
    .count({ campaignId, status: 'sent', sentAt: { $gte: dayStart } })
    .catch(() => 0);
  const dailyLimit = Math.max(1, Number(campaign.dailyLimit || 500));
  if (sentToday >= dailyLimit) {
    return {
      ok: false,
      waiting: true,
      reason: `Today's limit of ${dailyLimit} emails is reached — the queue resumes after midnight (${campaign.timezone}).`,
    };
  }

  const batchSize = Math.max(1, Math.min(lane.perBurst, dailyLimit - sentToday, 100));
  const pending = await base44.asServiceRole.entities.EmailCampaignRecipient
    .filter({ campaignId, status: 'pending' }, { sort: 'created_date', limit: batchSize })
    .catch(() => null);
  const queue = pending?.items || [];

  if (!queue.length) {
    await base44.asServiceRole.entities.EmailCampaignJob.update(campaignId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    return { ok: true, done: true, sent: 0, failed: 0, skipped: 0, remaining: 0, queue: lane.label };
  }

  // One opt-out query for the whole send: whatever the list said at import time,
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

  // The wait this queue drew starts now — that is what paces the next send.
  const nextSendAt = new Date(Date.now() + gapSeconds * 1000).toISOString();

  await base44.asServiceRole.entities.EmailCampaignJob.update(campaignId, {
    sentCount: Number(campaign.sentCount || 0) + sent,
    failedCount: Number(campaign.failedCount || 0) + failed,
    skippedCount: Number(campaign.skippedCount || 0) + skipped,
    lastRunAt: new Date().toISOString(),
    lastQueueName: lane.label,
    nextSendAt,
    ...(remaining ? {} : { status: 'completed', completedAt: new Date().toISOString() }),
  });

  return {
    ok: true,
    sent,
    failed,
    skipped,
    remaining: remaining ? 1 : 0,
    errors,
    queue: lane.label,
    gapSeconds,
    nextSendAt,
    nextInSeconds: gapSeconds,
  };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const mode = ['accounts', 'preview', 'test', 'send', 'tick'].includes(body.mode) ? body.mode : 'preview';
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

    // ── The scheduler: one send for every campaign whose wait has passed ─────
    if (mode === 'tick') {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

      const gate = await automationGate(base44, 'campaign_queue');
      if (!gate.run) return Response.json({ skipped: true, automation: 'campaign_queue', reason: gate.reason });

      const page = await base44.asServiceRole.entities.EmailCampaignJob
        .filter({ status: 'running' }, { limit: 20 })
        .catch(() => null);
      const campaigns = page?.items || [];
      const assistants = await campaignAssistants(base44);

      const results: any[] = [];
      for (const campaign of campaigns) {
        const result = await runQueue(base44, campaign, { respectDue: true, assistants });
        // Only campaigns that did something (or are waiting on their own pace) are reported.
        if (result?.sent || result?.failed || result?.skipped || result?.error || result?.pacing) {
          results.push({ campaign: clean(campaign.name), ...result });
        }
      }

      return Response.json({ ok: true, checked: campaigns.length, results });
    }

    if (!campaignId) return Response.json({ error: 'A campaign is required.' }, { status: 400 });
    const campaign = await base44.asServiceRole.entities.EmailCampaignJob.get(campaignId).catch(() => null);
    if (!campaign) return Response.json({ error: 'That campaign could not be found.' }, { status: 404 });

    const template = campaign.templateId
      ? await base44.asServiceRole.entities.EmailCampaignTemplate.get(campaign.templateId).catch(() => null)
      : null;
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
          debtAmount: vars.debtAmount || '',
          leadDate: vars.leadDate || '',
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
    // A click on "Run next batch" sends straight away; the automatic pace is what
    // holds a send back until its own wait has passed.
    return Response.json(await runQueue(base44, campaign, { respectDue: body.force !== true, assistants }));
  } catch (error) {
    return Response.json(
      { error: (error && (error as Error).message) || 'The send queue could not run.' },
      { status: 500 },
    );
  }
}