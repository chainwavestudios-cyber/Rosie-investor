const FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER') || '+19495963970';
const APP_ID      = '69cd2741578c9b5ce655395b';
const APP_BASE    = 'https://investors.rosieai.tech';

async function dbCreate(entity, data) {
  const res = await fetch(`${APP_BASE}/api/apps/${APP_ID}/entities/${entity}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`${entity} create failed: ${res.status}`);
  return res.json();
}

async function dbFilter(entity, filters) {
  const qs = Object.entries(filters).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const res = await fetch(`${APP_BASE}/api/apps/${APP_ID}/entities/${entity}?${qs}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${entity} filter failed: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.items || json.results || []);
}

async function dbUpdate(entity, id, data) {
  const res = await fetch(`${APP_BASE}/api/apps/${APP_ID}/entities/${entity}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`${entity} update failed: ${res.status}`);
  return res.json();
}

const normalizePhone = (p) => (p || '').replace(/\D/g, '').slice(-10);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const contentType = req.headers.get('content-type') || '';
  let params = {};
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    new URLSearchParams(text).forEach((v, k) => { params[k] = v; });
  } else {
    params = await req.json().catch(() => ({}));
  }

  const { MessageSid, From, To, Body, NumMedia, MessageStatus } = params;

  // Status callback — update existing message
  if (MessageStatus && MessageSid) {
    try {
      const existing = await dbFilter('SmsMessage', { twilioSid: MessageSid });
      if (existing && existing.length > 0) {
        await dbUpdate('SmsMessage', existing[0].id, { status: MessageStatus });
        console.log('[smsWebhook] Status updated:', MessageSid, '->', MessageStatus);
      }
    } catch (e) {
      console.error('[smsWebhook] Status update failed:', e?.message);
    }
    return new Response('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Inbound SMS
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
      const investors = await dbFilter('InvestorUser', {});
      const matched = (investors || []).find((u) => normalizePhone(u.phone) === fromNorm);
      if (matched) { investorId = matched.id; contactName = matched.name; }
    } catch (e) {
      console.error('[smsWebhook] Investor lookup failed:', e?.message);
    }

    if (!investorId) {
      try {
        const leads = await dbFilter('Lead', {});
        const matched = (leads || []).find((l) =>
          normalizePhone(l.phone) === fromNorm || normalizePhone(l.phone2) === fromNorm
        );
        if (matched) {
          leadId = matched.id;
          contactName = ((matched.firstName || '') + ' ' + (matched.lastName || '')).trim();
        }
      } catch (e) {
        console.error('[smsWebhook] Lead lookup failed:', e?.message);
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
        leadId,
        investorId,
        contactName,
        contactPhone: From,
        read:         false,
        sentAt:       new Date().toISOString(),
      });
      console.log('[smsWebhook] Inbound message saved from:', From, 'lead:', leadId, 'investor:', investorId);
    } catch (e) {
      console.error('[smsWebhook] Save failed:', e?.message);
    }
  }

  return new Response('<?xml version="1.0"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  });
});