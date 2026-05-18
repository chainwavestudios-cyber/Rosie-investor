import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FROM_NUMBER    = Deno.env.get('TWILIO_FROM_NUMBER') || '+19495963970';
const APP_ID         = Deno.env.get('BASE44_APP_ID');
const SERVICE_TOKEN  = Deno.env.get('BASE44_SERVICE_TOKEN');

async function dbCreate(entityName, data) {
  const res = await fetch(
    'https://api.base44.com/api/apps/' + APP_ID + '/entities/' + entityName,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SERVICE_TOKEN,
      },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Base44 create error: ' + await res.text());
  return res.json();
}

async function dbUpdate(entityName, id, data) {
  const res = await fetch(
    'https://api.base44.com/api/apps/' + APP_ID + '/entities/' + entityName + '/' + id,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SERVICE_TOKEN,
      },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Base44 update error: ' + await res.text());
  return res.json();
}

async function dbFilter(entityName, filters) {
  const qs = Object.entries(filters).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const res = await fetch(
    'https://api.base44.com/api/apps/' + APP_ID + '/entities/' + entityName + '?' + qs,
    {
      headers: { 'Authorization': 'Bearer ' + SERVICE_TOKEN },
    }
  );
  if (!res.ok) throw new Error('Base44 filter error: ' + await res.text());
  const json = await res.json();
  return Array.isArray(json) ? json : (json.items || json.results || []);
}

async function dbList(entityName) {
  const res = await fetch(
    'https://api.base44.com/api/apps/' + APP_ID + '/entities/' + entityName,
    {
      headers: { 'Authorization': 'Bearer ' + SERVICE_TOKEN },
    }
  );
  if (!res.ok) throw new Error('Base44 list error: ' + await res.text());
  const json = await res.json();
  return Array.isArray(json) ? json : (json.items || json.results || []);
}

const normalizePhone = (p) => (p || '').replace(/\D/g, '').slice(-10);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

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
      const existing = await dbFilter('SmsMessage', { twilioSid: MessageSid });
      if (existing && existing.length > 0) {
        await dbUpdate('SmsMessage', existing[0].id, { status: MessageStatus });
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

    const fromNorm = normalizePhone(From);
    let leadId = null;
    let investorId = null;
    let contactName = null;

    try {
      const investors = await dbList('InvestorUser');
      const matched = (investors || []).find((u) => normalizePhone(u.phone) === fromNorm);
      if (matched) {
        investorId  = matched.id;
        contactName = matched.name;
      }
    } catch (e) {
      console.error('[smsWebhook] investor lookup failed:', e?.message);
    }

    if (!investorId) {
      try {
        const leads = await dbList('Lead');
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
      await dbCreate('SmsMessage', {
        direction:    'inbound',
        fromNumber:   From,
        toNumber:     To || FROM_NUMBER,
        body:         Body,
        mediaUrls:    mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null,
        status:       'received',
        twilioSid:    MessageSid || null,
        leadId:       leadId,
        investorId:   investorId,
        contactName:  contactName,
        contactPhone: From,
        read:         false,
        sentAt:       new Date().toISOString(),
      });
    } catch (e) {
      console.error('[smsWebhook] SmsMessage create failed:', e?.message);
    }
  }

  return new Response('<?xml version="1.0"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  });
});