/**
 * emailMessageEngine.ts — The universal tracked-send pipeline.
 *
 * Every individual email this app sends through Gmail goes through here, so all of
 * them behave the same: embedded images are hosted, the body gets its own opaque
 * tracking token, one EmailMessage record is written per send, and every open,
 * click and unsubscribe afterwards is filed against that record and the contact,
 * template, sender and Gmail account it belongs to.
 *
 * Used by sendGmailEmail, shared/debtEmailSender.ts, shared/aiAgentHelpers.ts and
 * the appointment/follow-up automations. The tracker endpoints use
 * resolveMessageToken + recordTrackedEvent to file the activity back.
 */
import { buildMime, injectTracking, mintToken } from './emailTracking.ts';
import { getGmailIdentity, normalizeEmail, sendViaGmail } from './gmailSend.ts';

const IMAGE_DATA_RE = /data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)/g;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeArray(json: any): any[] {
  try {
    const parsed = JSON.parse(String(json || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isRecent(stamp: any, windowMs: number): boolean {
  if (!stamp) return false;
  const at = new Date(stamp).getTime();
  return !Number.isNaN(at) && Date.now() - at < windowMs;
}

/**
 * Gmail (and most inboxes) refuse or strip base64 `data:` images. Every embedded
 * image is lifted out into the app's public file storage the first time it is
 * seen and the same URL is reused after that, so a send stays small and the
 * mailer renders exactly as designed.
 */
export async function hostEmbeddedImages(base44: any, html: string): Promise<string> {
  if (!html || !/data:image\//i.test(html)) return html;
  let output = html;

  for (const match of [...html.matchAll(IMAGE_DATA_RE)]) {
    const [full, subtype, rawBase64] = match;
    try {
      const bytes = Uint8Array.from(atob(rawBase64.replace(/\s+/g, '')), (c) => c.charCodeAt(0));
      const hash = await sha256Hex(bytes);
      const cached = (await base44.asServiceRole.entities.EmailImageAsset.filter({ hash }, { limit: 1 }))?.items?.[0];
      let fileUrl = cached?.fileUrl || '';

      if (!fileUrl) {
        const ext = subtype === 'jpeg' ? 'jpg' : subtype;
        const file = new File([bytes], `email-image-${hash.slice(0, 12)}.${ext}`, { type: `image/${subtype}` });
        const uploaded = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
        fileUrl = uploaded?.file_url || uploaded?.url || '';
        if (fileUrl) {
          await base44.asServiceRole.entities.EmailImageAsset.create({ hash, fileUrl, mimeType: `image/${subtype}`, byteSize: bytes.length }).catch(() => {});
        }
      }

      if (fileUrl) output = output.split(full).join(fileUrl);
    } catch (e: any) {
      console.error('[emailMessageEngine] Could not host an embedded image:', e?.message || String(e));
    }
  }

  return output;
}

export interface TrackedSend {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  inlineImages?: Array<{ contentId: string; base64: string; mimeType: string }>;
  contactId?: string;
  contactKind?: string;
  contactName?: string;
  organization?: string;
  templateId?: string;
  templateName?: string;
  senderEmail?: string;
  senderName?: string;
  sentBy?: string;
  source?: string;
  sendId?: string;
  track?: boolean;
  allowDuplicate?: boolean;
}

export interface TrackedSendResult {
  token: string;
  sendId: string;
  messageId: string;
  subject: string;
  messageRecordId: string;
  senderEmail: string;
  duplicate?: boolean;
  skipped?: boolean;
  reason?: string;
}

/**
 * Sends one tracked email. Duplicate sends are refused: the same contact, same
 * template and same subject inside two minutes is an accidental re-click, not a
 * second email, so the first send's record is handed back instead.
 */
export async function sendTrackedEmail(base44: any, opts: TrackedSend): Promise<TrackedSendResult> {
  const recipient = normalizeEmail(opts.to);
  const subject = String(opts.subject || '');
  const contactId = String(opts.contactId || '');
  const templateId = String(opts.templateId || '');
  const templateName = String(opts.templateName || '');
  const dedupeKey = [contactId || recipient, templateId || 'custom', subject].join('|');

  if (!opts.allowDuplicate && opts.track !== false) {
    const recent = (await base44.asServiceRole.entities.EmailMessage.filter({ dedupeKey }, { sort: '-created_date', limit: 1 }))?.items?.[0];
    if (recent && recent.status === 'sent' && isRecent(recent.sentAt || recent.created_date, 120000)) {
      console.log(`[emailMessageEngine] Duplicate send blocked for ${recipient} — "${subject}"`);
      return {
        duplicate: true,
        token: recent.token || '',
        sendId: recent.sendId || '',
        messageId: recent.messageId || '',
        subject: recent.subject || subject,
        messageRecordId: recent.id,
        senderEmail: recent.senderEmail || '',
      };
    }
  }

  const sendId = opts.sendId || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const token = mintToken();
  let html = await hostEmbeddedImages(base44, opts.html || '');
  // Every personal welcome link gets the token belonging to THIS Gmail send.
  // This migration is Coach-only: campaign/Fronter links are never rewritten.
  if (opts.contactKind === 'debt_lead' && opts.source !== 'campaign' && token) {
    const welcome = `https://rosieai-investorpage.base44.app/welcome?m=${encodeURIComponent(token)}`;
    html = html.replace(/https?:\/\/abitaboutme\.base44\.app\/?(?=["'<>\s]|&|$)/gi, welcome)
      .replace(/https:\/\/rosieai-investorpage\.base44\.app\/welcome(?:\?m=[A-Za-z0-9_-]+)?\/?(?=["'<>\s]|&|$)/gi, welcome);
  }

  const record = await base44.asServiceRole.entities.EmailMessage.create({
    token,
    dedupeKey,
    sendId,
    contactId,
    contactKind: opts.contactKind || 'other',
    contactName: opts.contactName || '',
    contactEmail: recipient,
    organization: opts.organization || '',
    subject,
    templateId,
    templateName,
    senderEmail: opts.senderEmail || (await getGmailIdentity(base44)),
    senderName: opts.senderName || '',
    sentBy: opts.sentBy || '',
    source: opts.source || 'contact_card',
    status: 'sending',
  });

  const body = opts.track === false ? html : injectTracking(html, contactId, sendId, templateId, templateName, token);
  const mimeMessage = buildMime(recipient, subject, body, opts.text, opts.inlineImages);

  try {
    const { messageId } = await sendViaGmail(base44, recipient, mimeMessage);
    await base44.asServiceRole.entities.EmailMessage.update(record.id, {
      status: 'sent',
      messageId: messageId || '',
      sentAt: new Date().toISOString(),
    });
    return { token, sendId, messageId: messageId || '', subject, messageRecordId: record.id, senderEmail: record.senderEmail || '' };
  } catch (e: any) {
    await base44.asServiceRole.entities.EmailMessage.update(record.id, {
      status: 'failed',
      error: String(e?.message || e).slice(0, 500),
    }).catch(() => {});
    throw e;
  }
}

/** The message record behind a public tracking token; null for an unknown token. */
export async function resolveMessageToken(base44: any, token: string): Promise<any> {
  const value = String(token || '').trim();
  if (!value) return null;
  const found = (await base44.asServiceRole.entities.EmailMessage.filter({ token: value }, { limit: 1 }))?.items?.[0];
  return found || null;
}

/**
 * A campaign send has a row per recipient as well as a message record, and the
 * campaign monitor counts the emails opened, clicked and unsubscribed. They all
 * roll up from the same event, so one open shows on the recipient, on the campaign
 * and on the contact card at once.
 */
async function rollUpCampaignActivity(base44: any, message: any, ev: any, stamp: string) {
  if (String(message?.source || '') !== 'campaign') return;
  const found = message.sendId
    ? await base44.asServiceRole.entities.EmailCampaignRecipient.filter({ sendId: message.sendId }, { limit: 1 }).catch(() => null)
    : null;
  const recipient = (found?.items || [])[0];
  if (!recipient) return;

  const patch: any = {};
  if (ev.eventType === 'open') {
    patch.openedAt = recipient.openedAt || stamp;
    patch.openCount = Number(recipient.openCount || 0) + 1;
  } else if (ev.eventType === 'click') {
    const clicks = safeArray(recipient.clickedUrlsJson);
    clicks.push({ url: ev.url, at: stamp });
    patch.clickedAt = recipient.clickedAt || stamp;
    patch.clickedUrlsJson = JSON.stringify(clicks);
  } else if (ev.eventType === 'unsubscribe') {
    patch.unsubscribedAt = stamp;
  }
  if (!Object.keys(patch).length) return;

  await base44.asServiceRole.entities.EmailCampaignRecipient.update(recipient.id, patch)
    .catch((e: any) => console.error('[emailMessageEngine] campaign recipient update failed:', e?.message));

  // The monitor counts emails, not events: only a recipient's first open, first
  // click and first unsubscribe move its numbers.
  const first = (ev.eventType === 'open' && !recipient.openedAt)
    || (ev.eventType === 'click' && !recipient.clickedAt)
    || (ev.eventType === 'unsubscribe' && !recipient.unsubscribedAt);
  if (!first || !recipient.campaignId) return;

  const campaign = await base44.asServiceRole.entities.EmailCampaignJob.get(recipient.campaignId).catch(() => null);
  if (!campaign) return;
  await base44.asServiceRole.entities.EmailCampaignJob.update(recipient.campaignId, {
    openCount: Number(campaign.openCount || 0) + (ev.eventType === 'open' ? 1 : 0),
    clickCount: Number(campaign.clickCount || 0) + (ev.eventType === 'click' ? 1 : 0),
    unsubscribedCount: Number(campaign.unsubscribedCount || 0) + (ev.eventType === 'unsubscribe' ? 1 : 0),
  }).catch((e: any) => console.error('[emailMessageEngine] campaign update failed:', e?.message));
}

/**
 * Files one piece of activity against its message and contact. Existing reports
 * keep reading EmailTrackingEvent, so that record is still written; the message
 * record carries the rollups the contact card's Email Activity timeline shows.
 * Repeats are ignored: an inbox that re-fetches the pixel, or a double-tap on a
 * link, must not turn one open into five.
 */
export async function recordTrackedEvent(base44: any, ev: any): Promise<{ recorded: boolean; duplicate?: boolean }> {
  const message = ev.message || null;
  const now = new Date();
  const stamp = now.toISOString();

  if (message) {
    if (ev.eventType === 'open' && isRecent(message.lastOpenedAt, 60000)) return { recorded: false, duplicate: true };
    if (ev.eventType === 'click') {
      const sameLink = safeArray(message.clickedUrlsJson).filter((c: any) => c?.url === ev.url).pop();
      if (sameLink && isRecent(sameLink.at, 10000)) return { recorded: false, duplicate: true };
    }
    if (ev.eventType === 'unsubscribe' && isRecent(message.unsubscribedAt, 60000)) return { recorded: false, duplicate: true };
  }

  const leadId = ev.leadId || message?.contactId || '';

  // The existing engagement reports and campaign counters read these events.
  if (leadId) {
    await base44.asServiceRole.entities.EmailTrackingEvent.create({
      leadId,
      sendId: ev.sendId || message?.sendId || '',
      templateId: (ev.templateId || message?.templateId) || undefined,
      templateName: (ev.templateName || message?.templateName) || undefined,
      eventType: ev.eventType,
      url: ev.url || undefined,
      userAgent: ev.userAgent || '',
      ipAddress: ev.ipAddress || '',
      trackedAt: stamp,
    }).catch((e: any) => console.error('[emailMessageEngine] event log failed:', e?.message));
  }

  if (!message) return { recorded: Boolean(leadId) };

  const patch: any = {};
  if (ev.eventType === 'open') {
    patch.openedAt = message.openedAt || stamp;
    patch.lastOpenedAt = stamp;
    patch.openCount = Number(message.openCount || 0) + 1;
    if (message.status === 'sending') patch.status = 'sent';
  } else if (ev.eventType === 'click') {
    const clicks = safeArray(message.clickedUrlsJson);
    clicks.push({ url: ev.url, at: stamp });
    patch.clickedAt = message.clickedAt || stamp;
    patch.lastClickedAt = stamp;
    patch.clickCount = clicks.length;
    patch.clickedUrlsJson = JSON.stringify(clicks);
    if (message.status === 'sending') patch.status = 'sent';
  } else if (ev.eventType === 'unsubscribe') {
    patch.unsubscribedAt = stamp;
  }

  if (Object.keys(patch).length > 0) {
    await base44.asServiceRole.entities.EmailMessage.update(message.id, patch)
      .catch((e: any) => console.error('[emailMessageEngine] message update failed:', e?.message));
  }

  if (ev.eventType !== 'unsubscribe') await rollUpCampaignActivity(base44, message, ev, stamp);

  return { recorded: true };
}