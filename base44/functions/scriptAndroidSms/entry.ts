/**
 * Send a one-to-one, agent-initiated text from the Debt Call Coach script.
 * Android transport: SMS Gateway for Android (sms-gate.app) Cloud/Private REST API.
 * Secrets are backend-only, never returned to the browser.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const API_ROOT = (Deno.env.get('ANDROID_SMS_GATEWAY_URL') || 'https://api.sms-gate.app')
  .replace(/\/+$/, '');
const USER = Deno.env.get('ANDROID_SMS_GATEWAY_USERNAME');
const PASS = Deno.env.get('ANDROID_SMS_GATEWAY_PASSWORD');
const DEVICE_ID = Deno.env.get('ANDROID_SMS_GATEWAY_DEVICE_ID');
const FROM_NUMBER = Deno.env.get('ANDROID_SMS_FROM_NUMBER') || '';
const norm = (value: unknown): string | null => {
  const d = String(value || '').replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  return null;
};
const stateOf = (state: unknown) => {
  const s = String(state || '').toLowerCase();
  if (s === 'failed' || s === 'cancelled') return 'failed';
  if (s === 'delivered') return 'delivered';
  if (s === 'sent') return 'sent';
  return 'queued';
};
const listRows = (res: any): any[] => Array.isArray(res) ? res : (res?.items || res?.results || []);
async function authCoach(sdk: any, userId: string, token: string) {
  if (!userId || !token) return null;
  const user = await sdk.asServiceRole.entities.DebtCoachUser.get(userId).catch(() => null);
  return user?.isActive && !user?.mustResetPassword && user.sessionToken === token ? user : null;
}
function gatewayAuth() { return 'Basic ' + btoa(USER + ':' + PASS); }
export default async function (req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const body = await req.json();
    const sdk = createClientFromRequest(req);
    const coach = await authCoach(sdk, body.sessionUserId, body.sessionToken);
    if (!coach) return Response.json({ error: 'Login required' }, { status: 401 });

    if (!USER || !PASS || !DEVICE_ID || !FROM_NUMBER) {
      return Response.json({ error: 'Android SMS gateway is not connected. Configure the gateway credentials, device ID and sending number in Base44 Secrets.' }, { status: 503 });
    }
    if (!norm(FROM_NUMBER)) return Response.json({ error: 'Android sending number is invalid' }, { status: 503 });

    if (body.action === 'status') {
      const id = String(body.messageId || '');
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) return Response.json({ error: 'Invalid message ID' }, { status: 400 });
      const messages = listRows(await sdk.asServiceRole.entities.SmsMessage.filter({ gatewayMessageId: id }, { limit: 1 }));
      const record = messages[0];
      if (!record || record.provider !== 'android_smsgate') return Response.json({ error: 'Message not found' }, { status: 404 });
      const upstream = await fetch(API_ROOT + '/3rdparty/v1/messages/' + encodeURIComponent(id), {
        headers: { Authorization: gatewayAuth() },
      });
      if (!upstream.ok) return Response.json({ error: 'Could not check Android delivery status' }, { status: 502 });
      const result = await upstream.json();
      const status = stateOf(result.state);
      await sdk.asServiceRole.entities.SmsMessage.update(record.id, { status });
      return Response.json({ success: true, status, messageId: id });
    }

    if (body.action !== 'send') return Response.json({ error: 'Unknown action' }, { status: 400 });
    const leadId = String(body.leadId || '');
    if (!leadId) return Response.json({ error: 'Select a contact first' }, { status: 400 });
    const lead = await sdk.asServiceRole.entities.DebtLead.get(leadId).catch(() => null);
    if (!lead) return Response.json({ error: 'Contact not found' }, { status: 404 });
    // Always use the just-saved number on the contact card, never a caller-supplied destination.
    const to = norm(lead.phone);
    if (!to) return Response.json({ error: 'Save a valid US phone number on the contact card first' }, { status: 400 });
    const message = String(body.message || '').trim();
    if (!message || message.length > 480) return Response.json({ error: 'Message must be 1–480 characters' }, { status: 400 });
    if (!body.consentConfirmed) return Response.json({ error: 'Confirm permission to text this contact' }, { status: 403 });

    // Honor opt-outs across records for this phone, even if a different lead card is opened.
    const phoneFormats = [to, to.slice(-10), to.slice(1)];
    const phoneRows = await Promise.all(phoneFormats.map(phone =>
      sdk.asServiceRole.entities.SmsOptIn.filter({ phone }, { limit: 50 }).catch(() => [])
    ));
    const optRecords = phoneRows.flatMap(listRows);
    const otherFormat = listRows(await sdk.asServiceRole.entities.SmsOptIn.filter({ leadId }, { limit: 50 }));
    if ([...optRecords, ...otherFormat].some((o: any) => o.active === false && norm(o.phone) === to)) {
      return Response.json({ error: 'This phone has opted out of texts. Do not send.' }, { status: 403 });
    }
    if (!/\b(?:reply\s+)?STOP\b/i.test(message)) {
      return Response.json({ error: 'Include "Reply STOP to opt out." in the message' }, { status: 400 });
    }
    // Require an active record or write an audit record of explicit verbal permission,
    // as affirmed by the agent at send time.
    if (!optRecords.some((o: any) => o.active === true && norm(o.phone) === to)) {
      await sdk.asServiceRole.entities.SmsOptIn.create({
        phone: to, firstName: lead.firstName || '', leadId,
        optedInAt: new Date().toISOString(), active: true,
        consentSource: 'agent_attested_verbal', consentBy: coach.username,
      });
    }
    const requestId = String(body.requestId || '');
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) return Response.json({ error: 'Invalid request ID' }, { status: 400 });
    const previously = listRows(await sdk.asServiceRole.entities.SmsMessage.filter({ requestId }, { limit: 1 }));
    if (previously.length) {
      return Response.json({ success: true, status: previously[0].status, messageId: previously[0].gatewayMessageId, duplicate: true });
    }
    // Prevent a double-click or browser retry with a new ID from issuing the
    // same message twice within a short window.
    const recent = listRows(await sdk.asServiceRole.entities.SmsMessage.filter(
      { leadId, direction: 'outbound', provider: 'android_smsgate' },
      { sort: '-sentAt', limit: 10 }
    ));
    if (recent.some((sms: any) => norm(sms.toNumber) === to && sms.body === message
      && Date.now() - Date.parse(sms.sentAt || '') < 45000)) {
      return Response.json({ error: 'This same text was just sent. Check its status instead of sending twice.' }, { status: 409 });
    }
    const payload = { id: requestId, phoneNumbers: [to], deviceId: DEVICE_ID, textMessage: { text: message }, ttl: 3600, withDeliveryReport: true };
    const upstream = await fetch(API_ROOT + '/3rdparty/v1/messages', {
      method: 'POST',
      headers: { Authorization: gatewayAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('[scriptAndroidSms] Gateway rejected', upstream.status);
      return Response.json({ error: 'Android SMS gateway rejected this message (' + upstream.status + ')' }, { status: 502 });
    }
    const messageId = String(result.id || requestId);
    const status = stateOf(result.state);
    await sdk.asServiceRole.entities.SmsMessage.create({
      direction: 'outbound', provider: 'android_smsgate',
      fromNumber: norm(FROM_NUMBER), toNumber: to, body: message,
      status, gatewayMessageId: messageId, requestId, gatewayDeviceId: DEVICE_ID,
      leadId, contactName: [lead.firstName, lead.lastName].filter(Boolean).join(' '),
      contactPhone: to, read: true, sentBy: coach.username, sentAt: new Date().toISOString(),
    });
    await sdk.asServiceRole.entities.DebtLeadActivity.create({
      leadId, leadName: [lead.firstName, lead.lastName].filter(Boolean).join(' '),
      activityType: 'note', activityText: 'SMS queued from Scripts via Android gateway',
      createdBy: coach.username, metadataJson: JSON.stringify({ provider: 'android_smsgate', messageId, status }),
    }).catch(() => {});
    return Response.json({ success: true, status, messageId, to });
  } catch (error) {
    console.error('[scriptAndroidSms]', (error as Error)?.message);
    return Response.json({ error: 'Could not process Android SMS request' }, { status: 500 });
  }
}
