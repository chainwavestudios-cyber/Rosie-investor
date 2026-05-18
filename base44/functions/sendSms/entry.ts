import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN');
const FROM_NUMBER        = Deno.env.get('TWILIO_FROM_NUMBER') || '+19495963970';

Deno.serve(async (req) => {
  console.log('[sendSms] Function invoked — method:', req.method);

  let payload;
  try {
    payload = await req.json();
    console.log('[sendSms] Payload received:', JSON.stringify({
      to: payload.to,
      bodyLength: (payload.body || '').length,
      hasMedia: !!(payload.mediaUrls && payload.mediaUrls.length),
      leadId: payload.leadId,
      investorId: payload.investorId,
      sentBy: payload.sentBy,
    }));
  } catch (e) {
    console.error('[sendSms] Failed to parse request body:', e?.message);
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { to, body, mediaUrls, leadId, investorId, contactName, sentBy } = payload;

  if (!to || (!body && (!mediaUrls || mediaUrls.length === 0))) {
    console.error('[sendSms] Validation failed — missing to or body');
    return Response.json({ error: 'Missing to or body' }, { status: 400 });
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('[sendSms] Missing Twilio credentials — TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set');
    return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });
  }

  console.log('[sendSms] Sending via Twilio from', FROM_NUMBER, 'to', to);

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
    console.log('[sendSms] Twilio response status:', twilioRes.status, '— SID:', twilioData.sid, '— status:', twilioData.status, '— error:', twilioData.message || 'none');

    if (!twilioRes.ok) {
      console.error('[sendSms] Twilio rejected the message:', JSON.stringify(twilioData));
      return Response.json({ error: twilioData.message || 'Twilio error' }, { status: 500 });
    }
  } catch (e) {
    console.error('[sendSms] Twilio fetch threw an exception:', e?.message);
    return Response.json({ error: 'Twilio request failed: ' + e?.message }, { status: 500 });
  }

  console.log('[sendSms] Message sent — now saving to DB');

  try {
    const base44 = createClientFromRequest(req);
    await base44.entities.SmsMessage.create({
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

  console.log('[sendSms] Done — returning success');
  return Response.json({ success: true, sid: twilioData.sid, status: twilioData.status });
});