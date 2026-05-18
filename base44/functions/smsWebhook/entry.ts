import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER') || '+19495963970';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const base44 = createClientFromRequest(req).asServiceRole;

  const contentType = req.headers.get('content-type') || '';
  let params = {};

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    const sp = new URLSearchParams(text);
    sp.forEach((v, k) => { params[k] = v; });
  } else {
    params = await req.json().catch(() => ({}));
  }

  const { MessageSid, From, To, Body, NumMedia, MessageStatus } = params;

  if (MessageStatus && MessageSid) {
    try {
      const existing = await base44.entities.SmsMessage.filter({ twilioSid: MessageSid });
      if (existing && existing.length > 0) {
        await base44.entities.SmsMessage.update(existing[0].id, { status: MessageStatus });
      }
    } catch (e) {
      console.error('[smsWebhook] status update failed:', e?.message);
    }
    return new Response('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  if (From && Body !== undefined) {
    const mediaUrls = [];
    const numMedia = parseInt(NumMedia || '0', 10);
    for (let i = 0; i < numMedia; i++) {
      const url = params['MediaUrl' + i];
      if (url) mediaUrls.push(url);
    }

    const normalizePhone = (p) => (p || '').replace(/\D/g, '').slice(-10);
    const fromNorm = normalizePhone(From);

    let leadId = null;
    let investorId = null;
    let contactName = null;

    try {
      const investors = await base44.entities.InvestorUser.filter({});
      const matched = (investors || []).find((u) =>
        normalizePhone(u.phone) === fromNorm
      );
      if (matched) {
        investorId = matched.id;
        contactName = matched.name;
      }
    } catch (e) {
      console.error('[smsWebhook] investor lookup failed:', e?.message);
    }

    if (!investorId) {
      try {
        const leads = await base44.entities.Lead.filter({});
        const matched = (leads || []).find((l) =>
          normalizePhone(l.phone) === fromNorm || normalizePhone(l.phone2) === fromNorm
        );
        if (matched) {
          leadId = matched.id;
          contactName = ((matched.firstName || '') + ' ' + (matched.lastName || '')).trim();
        }
      } catch (e) {
        console.error('[smsWebhook] lead lookup failed:', e?.message);
      }
    }

    try {
      await base44.entities.SmsMessage.create({
        direction: 'inbound',
        fromNumber: From,
        toNumber: To || FROM_NUMBER,
        body: Body,
        mediaUrls: mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null,
        status: 'received',
        twilioSid: MessageSid || null,
        leadId: leadId,
        investorId: investorId,
        contactName: contactName,
        contactPhone: From,
        read: false,
        sentAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[smsWebhook] SmsMessage create failed:', e?.message);
    }
  }

  return new Response('<?xml version="1.0"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  });
});