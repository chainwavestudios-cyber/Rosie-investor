import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY        = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET     = Deno.env.get('MAILJET_API_SECRET');
const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const MJ_FROM_NAME  = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const {
    leadId,       // string | null
    investorId,   // string | null
    toEmail,
    toName,
    subject,
    bodyHtml,     // HTML body
    bodyText,     // plain text fallback
    sentBy,       // admin username
    fromEmail,    // optional sender override
    fromName,     // optional sender name override
    attachments,  // optional [{name, base64, mime}]
  } = await req.json();

  if (!toEmail || !subject || !bodyHtml) {
    return Response.json({ error: 'Missing toEmail, subject, or bodyHtml' }, { status: 400 });
  }
  if (!MJ_KEY || !MJ_SECRET || !MJ_FROM_EMAIL) {
    return Response.json({ error: 'Mailjet credentials not configured' }, { status: 500 });
  }

  const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);

  // CustomID lets the webhook route opens/clicks back to the right record
  const customId = leadId ? `${leadId}:custom` : investorId ? `inv:${investorId}:custom` : '';

  // Resolve sender — allow override, fall back to env defaults
  const senderEmail = fromEmail || MJ_FROM_EMAIL;
  const senderName  = fromName  || MJ_FROM_NAME;

  const message = {
    From: { Email: senderEmail, Name: senderName },
    To:   [{ Email: toEmail, Name: toName || '' }],
    Subject: subject,
    HTMLPart: bodyHtml,
    TextPart: bodyText || bodyHtml.replace(/<[^>]+>/g, ''),
    ...(customId ? { CustomID: customId } : {}),
    TrackOpens: 1,
    TrackClicks: 'account',
  };

  // Attach files if provided
  if (attachments && attachments.length > 0) {
    message.Attachments = attachments.map(a => ({
      ContentType: a.mime || 'application/octet-stream',
      Filename: a.name,
      Base64Content: a.base64,
    }));
  }

  const payload = { Messages: [message] };

  const res  = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || data.Messages?.[0]?.Status !== 'success') {
    console.error('[sendCustomEmail] Mailjet error:', JSON.stringify(data));
    return Response.json({ error: 'Mailjet send failed', details: data }, { status: 500 });
  }

  const msgInfo     = data.Messages[0];
  const messageId   = String(msgInfo.To?.[0]?.MessageID || '');
  const messageUUID = msgInfo.To?.[0]?.MessageUUID || '';

  // ── Log to EmailLog ────────────────────────────────────────────────────
  await base44.asServiceRole.entities.EmailLog.create({
    leadId:      leadId     || '',
    investorId:  investorId || '',
    toEmail,
    toName:      toName || '',
    subject,
    templateId:  'custom',
    messageId,
    messageUUID,
    status:      'sent',
    sentAt:      new Date().toISOString(),
    sentBy:      sentBy || 'admin',
    isCustomEmail: true,
    fromEmail:   senderEmail,
  }).catch(() => {});

  // ── Log to LeadHistory (if lead) ───────────────────────────────────────
  if (leadId) {
    await base44.asServiceRole.entities.LeadHistory.create({
      leadId,
      type:      'note',
      content:   `✉️ Custom email sent by ${sentBy || 'admin'} via ${senderEmail} — Subject: "${subject}"`,
      createdBy: sentBy || 'admin',
    }).catch(() => {});
  }

  // ── Log to ContactNote (if investor) ──────────────────────────────────
  if (investorId) {
    await base44.asServiceRole.entities.ContactNote.create({
      investorId,
      investorEmail: toEmail,
      type:      'email',
      content:   `✉️ Custom email sent by ${sentBy || 'admin'} via ${senderEmail} — Subject: "${subject}"`,
      createdAt: new Date().toISOString(),
      createdBy: sentBy || 'admin',
    }).catch(() => {});
  }

  return Response.json({ success: true, messageId, messageUUID });
});