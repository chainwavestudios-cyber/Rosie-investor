import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN');
const FROM_NUMBER        = Deno.env.get('TWILIO_FROM_NUMBER') || '+19495963970';
const APP_ID             = '69cd2741578c9b5ce655395b';
const APP_BASE           = 'https://investors.rosieai.tech';

// Write directly to the entity REST endpoint using the app's own URL
// This bypasses the SDK auth entirely — same pattern as how Twilio callbacks work
async function saveToDb(data) {
  const res = await fetch(
    `${APP_BASE}/api/apps/${APP_ID}/entities/SmsMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB error ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  console.log('[sendSms] Function invoked');

  let payload;
  try {
    payload = await req.json();
    console.log('[sendSms] Payload:', JSON.stringify({
      to: payload.to,
      bodyLength: (payload.body || '').length,
      leadId: payload.leadId,
      sentBy: payload.sentBy,
    }));
  } catch (e) {
    console.error('[sendSms] Bad JSON:', e?.message);
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { to, body, mediaUrls, leadId, investorId, contactName, sentBy } = payload;

  if (!to || (!body && (!mediaUrls || mediaUrls.length === 0))) {
    return Response.json({ error: 'Missing to or body' }, { status: 400 });
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('[sendSms] Missing Twilio credentials');
    return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });
  }

  // Send via Twilio
  const params = new URLSearchParams({ From: FROM_NUMBER, To: to, Body: body || '' });
  if (mediaUrls && mediaUrls.length > 0) {
    mediaUrls.forEach((url) => params.append('MediaUrl', url));
  }

  let twilioData;
  try {
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );
    twilioData = await twilioRes.json();
    console.log('[sendSms] Twilio status:', twilioRes.status, 'SID:', twilioData.sid);
    if (!twilioRes.ok) {
      console.error('[sendSms] Twilio error:', twilioData.message);
      return Response.json({ error: twilioData.message || 'Twilio error' }, { status: 500 });
    }
  } catch (e) {
    console.error('[sendSms] Twilio fetch failed:', e?.message);
    return Response.json({ error: 'Twilio request failed: ' + e?.message }, { status: 500 });
  }

  // Save to DB via direct REST — no SDK auth needed
  try {
    await saveToDb({
      direction:    'outbound',
      fromNumber:   FROM_NUMBER,
      toNumber:     to,
      body:         body || '',
      mediaUrls:    (mediaUrls && mediaUrls.length > 0) ? JSON.stringify(mediaUrls) : null,
      status:       twilioData.status || 'queued',
      twilioSid:    twilioData.sid,
      leadId:       leadId     || null,
      investorId:   investorId || null,
      contactName:  contactName || null,
      contactPhone: to,
      read:         true,
      sentBy:       sentBy || 'admin',
      sentAt:       new Date().toISOString(),
    });
    console.log('[sendSms] DB write success');
  } catch (e) {
    console.error('[sendSms] DB write failed:', e?.message);
  }

  return Response.json({ success: true, sid: twilioData.sid, status: twilioData.status });
});