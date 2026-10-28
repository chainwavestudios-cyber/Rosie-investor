/**
 * Signed SMSGate webhook: inbound STOP/START and outbound delivery updates.
 * Configure the webhook's Signing Key in the Android app, set the same
 * ANDROID_SMS_WEBHOOK_SIGNING_KEY in Base44 Secrets, then register HTTPS URL.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
const key = Deno.env.get('ANDROID_SMS_WEBHOOK_SIGNING_KEY') || '';
const number = (v: any) => {
  const d = String(v || '').replace(/\D/g, '');
  return d.length === 10 ? '+1' + d : d.length === 11 && d.startsWith('1') ? '+' + d : '';
};
const rows = (x: any): any[] => Array.isArray(x) ? x : (x?.items || x?.results || []);
async function validHmac(raw: string, timestamp: string, signature: string) {
  if (!key || !/^\d{10}$/.test(timestamp) || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const hkey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', hkey, new TextEncoder().encode(raw + timestamp)));
  const sig = Uint8Array.from(signature.match(/.{2}/g)!.map((x: string) => parseInt(x, 16)));
  if (digest.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < digest.length; i++) mismatch |= digest[i] ^ sig[i];
  return mismatch === 0;
}
export default async function (req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  if (!(await validHmac(raw, req.headers.get('X-Timestamp') || '', req.headers.get('X-Signature') || ''))) {
    return new Response('Unauthorized', { status: 401 });
  }
  let event: any;
  try { event = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }
  const sdk = createClientFromRequest(req);
  const p = event.payload || {};
  try {
    if (event.event === 'sms:received') {
      const from = number(p.sender);
      if (!from) return Response.json({ success: true });
      const content = String(p.message || '');
      const optOut = /^\s*(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)\s*[.!]?\s*$/i.test(content);
      const optIn = /^\s*(START|UNSTOP)\s*[.!]?\s*$/i.test(content);
      const variations = [from, from.slice(-10), from.slice(1)];
      const matches = await Promise.all(variations.map(phone =>
        sdk.asServiceRole.entities.SmsOptIn.filter({ phone }, { limit: 50 }).catch(() => [])
      ));
      const existing = matches.flatMap(rows);
      if (optOut) {
        for (const r of existing) await sdk.asServiceRole.entities.SmsOptIn.update(r.id, { active: false });
        if (!existing.length) await sdk.asServiceRole.entities.SmsOptIn.create({ phone: from, active: false });
      } else if (optIn) {
        for (const r of existing) await sdk.asServiceRole.entities.SmsOptIn.update(r.id, { active: true, optedInAt: new Date().toISOString() });
      }
      const known = rows(await sdk.asServiceRole.entities.DebtLead.filter({ phone: from }, { limit: 1 }))[0];
      const inboundId = String(p.messageId || '');
      const alreadyLogged = inboundId && rows(await sdk.asServiceRole.entities.SmsMessage.filter(
        { gatewayMessageId: inboundId, provider: 'android_smsgate' }, { limit: 1 }
      )).length > 0;
      if (alreadyLogged) return Response.json({ success: true, duplicate: true });
      await sdk.asServiceRole.entities.SmsMessage.create({
        direction: 'inbound', provider: 'android_smsgate',
        fromNumber: from, toNumber: number(p.recipient),
        body: content.slice(0, 2000), status: 'received', gatewayMessageId: String(p.messageId || ''),
        leadId: known?.id || undefined,
        contactName: known ? [known.firstName, known.lastName].filter(Boolean).join(' ') : undefined,
        contactPhone: from, read: false, sentAt: new Date().toISOString(),
      });
    } else if (/^sms:(sent|delivered|failed|cancelled)$/.test(event.event || '')) {
      const id = String(p.messageId || p.id || '');
      if (id) {
        const matching = rows(await sdk.asServiceRole.entities.SmsMessage.filter({ gatewayMessageId: id }, { limit: 5 }));
        const status = event.event === 'sms:delivered' ? 'delivered' : event.event === 'sms:sent' ? 'sent' : 'failed';
        for (const m of matching) {
          if (m.provider === 'android_smsgate' && !(m.status === 'delivered' && status === 'sent')) {
            await sdk.asServiceRole.entities.SmsMessage.update(m.id, { status });
          }
        }
      }
    }
    return Response.json({ success: true });
  } catch (e) {
    console.error('[scriptAndroidSmsWebhook]', (e as Error)?.message);
    return new Response('Webhook could not be processed', { status: 500 });
  }
}
