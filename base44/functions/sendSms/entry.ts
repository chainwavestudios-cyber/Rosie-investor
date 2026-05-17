import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN');
const FROM_NUMBER        = '+19495963970';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { to, body, mediaUrls, leadId, investorId, contactName } = await req.json();

  if (!to || !body) return Response.json({ error: 'Missing to or body' }, { status: 400 });

  const params = new URLSearchParams({ From: FROM_NUMBER, To: to, Body: body });
  if (mediaUrls && mediaUrls.length > 0) {
    mediaUrls.forEach(url => params.append('MediaUrl', url));
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
    return Response.json({ error: twilioData.message || 'Twilio error' }, { status: 500 });
  }

  // Save to SmsMessage entity
  await base44.asServiceRole.entities.SmsMessage.create({
    direction: 'outbound',
    fromNumber: FROM_NUMBER,
    toNumber: to,
    body,
    mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : null,
    status: twilioData.status || 'queued',
    twilioSid: twilioData.sid,
    leadId: leadId || null,
    investorId: investorId || null,
    contactName: contactName || null,
    contactPhone: to,
    read: true,
    sentBy: user.email || user.full_name || 'admin',
    sentAt: new Date().toISOString(),
  });

  return Response.json({ success: true, sid: twilioData.sid, status: twilioData.status });
});