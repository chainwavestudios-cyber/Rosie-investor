import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { sendTrackedEmail } from '../../shared/emailMessageEngine.ts';

/**
 * sendGmailEmail — the contact card's own Gmail send (compose box, template buttons).
 *
 * Every send goes through the shared tracked-send engine: one EmailMessage record
 * per email, its own opaque tracking token, embedded images hosted, and every open
 * and click filed back against the contact, the template and the sending account.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { to, subject, html, text, leadId, sentBy, inlineImages, templateId, templateName, contactKind, organization } = await req.json();

  if (!to || !subject) {
    return Response.json({ error: 'Recipient and subject are required' }, { status: 400 });
  }

  try {
    const emailName = templateName || 'Custom Gmail email';

    const result = await sendTrackedEmail(base44, {
      to,
      subject,
      html,
      text,
      inlineImages,
      contactId: leadId || '',
      contactKind: contactKind || 'other',
      templateId,
      templateName: emailName,
      sentBy: sentBy || 'admin',
      organization: organization || '',
      source: 'contact_card',
    });

    if (result.duplicate) {
      // The same email went out moments ago — the first send's record is handed back.
      return Response.json({ success: true, duplicate: true, messageId: result.messageId, sendId: result.sendId, token: result.token });
    }

    // Log to EmailLog if leadId provided
    if (leadId) {
      await base44.asServiceRole.entities.EmailLog.create({
        leadId,
        toEmail: to,
        subject,
        templateId: templateId || 'gmail',
        templateName: emailName,
        sendId: result.sendId,
        messageId: result.messageId || '',
        status: 'sent',
        sentAt: new Date().toISOString(),
        sentBy: sentBy || 'admin',
        isCustomEmail: true,
        fromEmail: result.senderEmail || 'gmail',
      }).catch(() => {});

      await base44.asServiceRole.entities.LeadHistory.create({
        leadId,
        type: 'note',
        content: `✉️ Gmail sent by ${sentBy || 'admin'} to ${to} — Subject: "${subject}"`,
        createdBy: sentBy || 'admin',
      }).catch(() => {});
    }

    return Response.json({ success: true, messageId: result.messageId, sendId: result.sendId, token: result.token });
  } catch (error) {
    console.error('[sendGmailEmail] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});