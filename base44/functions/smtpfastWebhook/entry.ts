/**
 * smtpfastWebhook — the SMTPfast tracker feed.
 *
 * SMTPfast POSTs every open, click and delivery result for our outreach email
 * straight here (its Webhooks endpoint points at this function). Each event
 * carries the provider's email id, which is the messageId on the EmailLog row
 * written when that mail went out — so the event lands on the right contact
 * card and fills the same timeline the in-app tracker used to fill.
 *
 * Authenticity: SMTPfast signs every body (X-SMTPfast-Signature, HMAC-SHA256).
 * When the signing secret is configured the signature is verified and a bad one
 * is rejected. Without it the feed stays limited to sends this app actually
 * made: an event whose email id matches no EmailLog row is ignored, so a forged
 * post can never invent engagement.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

const ENGAGEMENT_EVENTS = { 'email.opened': 'open', 'email.clicked': 'click' };
const DELIVERY_STATUS = { 'email.delivered': 'delivered', 'email.bounced': 'bounced', 'email.complained': 'spam', 'email.failed': 'bounced' };

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

/** Writes one provider event onto the send it belongs to. Returns whether it was recorded. */
async function recordEvent(base44: any, event: any) {
  const type = String(event?.type || '');
  const data = event?.data || {};
  const emailId = String(data.email_id || '').trim();
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
  await base44.asServiceRole.entities.EmailLog.update(log.id, { status });
  return true;
}

export default async function (req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });
  try {
    const signature = (req.headers.get('x-smtpfast-signature') || '').trim().toLowerCase();
    if (!signature) return Response.json({ error: 'Unsigned request' }, { status: 401 });

    const raw = await req.text();
    let signingSecret = '';
    try { signingSecret = secrets.get('SMTPFAST_WEBHOOK_SECRET') || ''; } catch { signingSecret = ''; }
    if (signingSecret && !(await signatureIsValid(raw, signature, signingSecret))) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
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