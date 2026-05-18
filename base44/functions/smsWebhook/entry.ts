import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER') || '+19495963970';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // createClientFromRequest works for Twilio webhooks — Base44 injects the
  // service token from the app context automatically, no auth header needed.
  const base44 = createClientFromRequest(req);

  const contentType = req.headers.get('content-type') || '';
  let params: Record<string, string> = {};

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    const sp = new URLSearchParams(text);
    sp.forEach((v, k) => { params[k] = v; });
  } else {
    params = await req.json().catch(() => ({}));
  }

  const { MessageSid, From, To, Body, NumMedia, MessageStatus } = params;

  // ── Status callback: update existing message status ───────────────────────
  if (MessageStatus && MessageSid) {
    try {
      const existing = await base44.asServiceRole.entities.SmsMessage.filter({ twilioSid: MessageSid });
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.SmsMessage.update(existing[0].id, { status: MessageStatus });
      }
    } catch (e) {
      console.error('[smsWebhook] status update failed:', e?.message);
    }
    return new Response('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // ── Inbound SMS ───────────────────────────────────────────────────────────
  if (From && Body !== undefined) {
    const mediaUrls: string[] = [];
    const numMedia = parseInt(NumMedia || '0', 10);
    for (let i = 0; i < numMedia; i++) {
      const url = params[`MediaUrl${i}`];
      if (url) mediaUrls.push(url);
    }

    // Normalize phone: strip non-digits, keep last 10
    const normalizePhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
    const fromNorm = normalizePhone(From);

    let leadId:      string | null = null;
    let investorId:  string | null = null;
    let contactName: string | null = null;

    try {
      const [leads, investors] = await Promise.all([
        base44.asServiceRole.entities.Lead.list('-updated_date', 500),
        base44.asServiceRole.entities.InvestorUser.list('-updated_date', 300),
      ]);

      const matchedLead = (leads || []).find((l: any) =>
        normalizePhone(l.phone) === fromNorm || normalizePhone(l.phone2) === fromNorm
      );

      if (matchedLead) {
        leadId      = matchedLead.id;
        contactName = `${matchedLead.firstName || ''} ${matchedLead.lastName || ''}`.trim();
      } else {
        const matchedInvestor = (investors || []).find((u: any) =>
          normalizePhone(u.phone) === fromNorm
        );
        if (matchedInvestor) {
          investorId  = matchedInvestor.id;
          contactName = matchedInvestor.name;
        }
      }
    } catch (e) {
      console.error('[smsWebhook] contact lookup failed:', e?.message);
    }

    try {
      await base44.asServiceRole.entities.SmsMessage.create({
        direction:    'inbound',
        fromNumber:   From,
        toNumber:     To || FROM_NUMBER,
        body:         Body,
        mediaUrls:    mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null,
        status:       'received',
        twilioSid:    MessageSid || null,
        leadId,
        investorId,
        contactName,
        contactPhone: From,
        read:         false,
        sentAt:       new Date().toISOString(),
      });
    } catch (e) {
      console.error('[smsWebhook] SmsMessage create failed:', e?.message);
    }
  }

  // Always return valid TwiML so Twilio doesn't retry
  return new Response('<?xml version="1.0"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  });
});