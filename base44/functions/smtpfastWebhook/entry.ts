/**
 * smtpfastWebhook — the SMTPfast tracker feed.
 *
 * SMTPfast POSTs every open, click and delivery result for our outreach email
 * straight here (its Webhooks endpoint points at this function). Each event
 * carries the provider's email id, which is the messageId on the EmailLog row
 * written when that mail went out — so the event lands on the right contact
 * card and fills the same timeline the in-app tracker used to fill.
 *
 * A bounce is the one event that must never be dropped: a dead address that is
 * not suppressed gets mailed again in the next campaign and drags the sending
 * domain down with it. So a bounce does three things — records the reason on the
 * send, marks the campaign row that carried it, and writes the address onto the
 * do-not-mail list (EmailOptIn status "bounced") that every send path checks.
 *
 * Authenticity: SMTPfast signs every body (X-SMTPfast-Signature, HMAC-SHA256).
 * When the signing secret is configured the signature is required and verified.
 * Until it is configured deliveries are accepted unsigned — a bounce that never
 * lands is worse than an unsigned one — and a forged post still cannot invent
 * engagement, because an email id that matches no EmailLog row is ignored.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

const ENGAGEMENT_EVENTS = { 'email.opened': 'open', 'email.clicked': 'click' };
const DELIVERY_STATUS = { 'email.delivered': 'delivered', 'email.bounced': 'bounced', 'email.complained': 'spam', 'email.failed': 'bounced' };

function str(value: unknown): string {
  return String(value ?? '').trim();
}

async function signatureIsValid(body: string, header: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  if (header.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i += 1) difference |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

/** The rejection text the receiving server gave, whatever shape SMTPfast sends it in. */
function bounceReason(event: any): string {
  const data = event?.data || {};
  const bounce = data.bounce || data.bounced || {};
  const candidates = [
    bounce.reason, bounce.message, bounce.diagnostic_code, bounce.diagnosticCode, bounce.status,
    data.reason, data.message, data.error, data.detail, data.smtp_response, data.response, data.status,
  ];
  const first = candidates.map(str).find((value) => value.length > 2);
  return first || '';
}

/** Puts the address on the do-not-mail list, and marks the campaign row that carried it. */
async function suppress(base44: any, address: string, emailId: string, reason: string) {
  const email = str(address).toLowerCase();
  const detail = reason || 'The receiving server rejected mail to this address.';
  const now = new Date().toISOString();

  if (email) {
    const found = await base44.asServiceRole.entities.EmailOptIn.filter({ email }, { limit: 5 }).catch(() => null);
    const rows = found?.items || [];
    const current = rows[0];
    if (current) {
      // An unsubscribe stays an unsubscribe; the bounce is recorded alongside it.
      const patch: any = { bounceReason: detail };
      if (String(current.status || '').toLowerCase() !== 'unsubscribed') {
        patch.status = 'bounced';
        patch.bouncedAt = now;
      }
      await base44.asServiceRole.entities.EmailOptIn.update(current.id, patch).catch(() => {});
    } else {
      await base44.asServiceRole.entities.EmailOptIn.create({
        email,
        source: 'bounce',
        status: 'bounced',
        bouncedAt: now,
        bounceReason: detail,
        recordedBy: 'smtpfastWebhook',
        consentText: 'Suppressed automatically: the receiving mail server rejected mail to this address.',
      }).catch(() => {});
    }
  }

  // The exact campaign row this send carried — matched on the provider's own id.
  const page = await base44.asServiceRole.entities.EmailCampaignRecipient.filter({ messageId: emailId }, { limit: 5 }).catch(() => null);
  for (const row of page?.items || []) {
    await base44.asServiceRole.entities.EmailCampaignRecipient.update(row.id, {
      status: 'failed',
      reason: `Bounced — ${detail}`,
      error: detail,
    }).catch(() => {});
  }
}

/** Writes one provider event onto the send it belongs to. Returns whether it was recorded. */
async function recordEvent(base44: any, event: any) {
  const type = str(event?.type);
  const data = event?.data || {};
  const emailId = str(data.email_id || data.emailId || data.message_id);
  if (!emailId) return false;

  const page = await base44.asServiceRole.entities.EmailLog.filter({ messageId: emailId }, { limit: 1 });
  const log = (page?.items || page || [])[0];
  if (!log) return false;

  const trackedAt = event?.timestamp || new Date().toISOString();
  const engagement = ENGAGEMENT_EVENTS[type];

  if (engagement) {
    const detail = engagement === 'open' ? (data.open || {}) : (data.click || {});
    const url = detail.link || detail.url || data.url || '';
    if (engagement === 'click' && !url) return false;
    await base44.asServiceRole.entities.EmailTrackingEvent.create({
      leadId: log.leadId,
      sendId: emailId,
      templateId: log.templateId || undefined,
      eventType: engagement,
      url: url || undefined,
      userAgent: detail.userAgent || data.userAgent || '',
      ipAddress: detail.ipAddress || data.ipAddress || '',
      trackedAt,
    });
    await base44.asServiceRole.entities.EmailLog.update(log.id, engagement === 'open'
      ? { status: 'opened', openedAt: log.openedAt || trackedAt }
      : { status: 'clicked', clickedAt: trackedAt, clickedUrl: url });
    return true;
  }

  const status = DELIVERY_STATUS[type];
  if (!status) return false;
  if (status === 'delivered' && log.status !== 'sent') return false; // delivery news never walks engagement back

  if (status === 'bounced') {
    const reason = bounceReason(event);
    await base44.asServiceRole.entities.EmailLog.update(log.id, {
      status: 'bounced',
      bouncedAt: trackedAt,
      bounceReason: reason || 'The receiving server rejected this address.',
    });
    await suppress(base44, log.toEmail, emailId, reason);
    return true;
  }

  await base44.asServiceRole.entities.EmailLog.update(log.id, { status });
  return true;
}

export default async function (req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });
  try {
    const raw = await req.text();
    const signature = (req.headers.get('x-smtpfast-signature') || '').trim().toLowerCase();

    let signingSecret = '';
    try { signingSecret = secrets.get('SMTPFAST_WEBHOOK_SECRET') || ''; } catch { signingSecret = ''; }

    if (signingSecret) {
      if (!signature) return Response.json({ error: 'Unsigned request' }, { status: 401 });
      if (!(await signatureIsValid(raw, signature, signingSecret))) {
        return Response.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    let payload: any = null;
    try { payload = JSON.parse(raw); } catch { return new Response('OK', { status: 200 }); }
    const events = Array.isArray(payload) ? payload : [payload];
    const base44 = createClientFromRequest(req);

    let recorded = 0;
    for (const event of events.slice(0, 25)) {
      try { if (await recordEvent(base44, event)) recorded += 1; }
      catch (error) { console.error('[smtpfastWebhook] event failed:', (error as Error).message); }
    }
    return Response.json({ received: events.length, recorded });
  } catch (error) {
    console.error('[smtpfastWebhook]', (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}