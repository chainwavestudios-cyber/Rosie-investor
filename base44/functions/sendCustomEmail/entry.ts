import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

import { smtpfastSend, toSmtpfastAttachments } from '../../shared/smtpfastSender.ts';

const DEFAULT_FROM_EMAIL = Deno.env.get('SMTPFAST_FROM_EMAIL') || '';

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
  // CustomID rides along as a provider tag so a send can be traced to its record
  const customId = leadId ? `${leadId}:custom` : investorId ? `inv:${investorId}:custom` : '';

  // Resolve sender — allow override, fall back to the configured sender
  const senderEmail = fromEmail || DEFAULT_FROM_EMAIL;
  const senderName  = fromName  || '';

  let sent;
  try {
    sent = await smtpfastSend({
      to: toEmail,
      subject,
      html: bodyHtml,
      text: bodyText || bodyHtml.replace(/<[^>]+>/g, ''),
      from: senderEmail,
      ...(senderName ? { fromName: senderName } : {}),
      customId,
      attachments: attachments && attachments.length ? toSmtpfastAttachments(attachments) : undefined,
    });
  } catch (error: any) {
    console.error('[sendCustomEmail] send failed:', error?.message || String(error));
    return Response.json({ error: 'Email send failed', details: error?.message || String(error) }, { status: 500 });
  }

  const messageId   = sent.id;
  const messageUUID = '';

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