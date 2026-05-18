import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN');
const FROM_NUMBER        = Deno.env.get('TWILIO_FROM_NUMBER') || '+19495963970';

Deno.serve(async (req) => {
  const { to, body, mediaUrls, leadId, investorId, contactName, sentBy } = await req.json();

  if (!to || (!body && (!mediaUrls || mediaUrls.length === 0))) {
    return Response.json({ error: 'Missing to or body' }, { status: 400 });
  }

  // Send via Twilio
  const params = new URLSearchParams({ From: FROM_NUMBER, To: to, Body: body || '' });
  if (mediaUrls && mediaUrls.length > 0) {
    mediaUrls.forEach((url) => params.append('MediaUrl', url));
  }

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

  const twilioData = await twilioRes.json();

  if (!twilioRes.ok) {
    console.error('[sendSms] Twilio error:', JSON.stringify(twilioData));
    return Response.json({ error: twilioData.message || 'Twilio error' }, { status: 500 });
  }

  // Save to DB — use regular client (no asServiceRole needed, app token in request is sufficient)
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
  } catch (e) {
    console.error('[sendSms] DB write failed:', e?.message);
  }

  return Response.json({ success: true, sid: twilioData.sid, status: twilioData.status });
});