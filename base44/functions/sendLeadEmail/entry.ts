import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET = Deno.env.get('MAILJET_API_SECRET');
const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const MJ_FROM_NAME = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';
const TEMPLATE_ID = 7949342;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { leadId, toEmail, toName, firstName } = await req.json();
  if (!toEmail || !leadId) return Response.json({ error: 'Missing toEmail or leadId' }, { status: 400 });

  const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);

  const payload = {
    Messages: [{
      From: { Email: MJ_FROM_EMAIL, Name: MJ_FROM_NAME },
      To: [{ Email: toEmail, Name: toName || firstName || '' }],
      TemplateID: TEMPLATE_ID,
      TemplateLanguage: true,
      Variables: {
        firstname: firstName || ''
      },
      CustomID: leadId,
    }]
  };

  const res = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || data.Messages?.[0]?.Status !== 'success') {
    return Response.json({ error: 'Mailjet send failed', details: data }, { status: 500 });
  }

  const msgInfo = data.Messages[0];
  const messageId = String(msgInfo.To?.[0]?.MessageID || '');
  const messageUUID = msgInfo.To?.[0]?.MessageUUID || '';

  // Log to EmailLog entity
  const logEntry = await base44.asServiceRole.entities.EmailLog.create({
    leadId,
    toEmail,
    toName: toName || firstName || '',
    templateId: String(TEMPLATE_ID),
    messageId,
    messageUUID,
    status: 'sent',
    sentAt: new Date().toISOString(),
    sentBy: 'admin',
    pointsAwarded: false,
  });

  // Award initial 5 points to the lead
  try {
    const lead = await base44.asServiceRole.entities.Lead.get(leadId);
    if (lead) {
      await base44.asServiceRole.entities.Lead.update(leadId, {
        engagementScore: (lead.engagementScore || 0) + 5,
      });
      await base44.asServiceRole.entities.LeadHistory.create({
        leadId,
        type: 'note',
        content: `📧 Email sent via Mailjet template. +5 engagement points.`,
      });
    }
  } catch (e) {
    console.warn('[sendLeadEmail] Could not update lead score:', e.message);
  }

  return Response.json({ success: true, messageId, messageUUID, logId: logEntry.id });
});