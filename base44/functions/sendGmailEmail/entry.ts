import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { injectTracking, buildMime } from '../../shared/emailTracking.ts';
import { sendViaGmail } from '../../shared/gmailSend.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { to, subject, html, text, leadId, sentBy, inlineImages } = await req.json();

  if (!to || !subject) {
    return Response.json({ error: 'Recipient and subject are required' }, { status: 400 });
  }

  try {
    // Generate a unique send ID for tracking
    const sendId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Inject open-tracking pixel and rewrite links for click tracking
    const trackedHtml = leadId ? injectTracking(html, leadId, sendId) : html;

    // Build RFC 2822 MIME message (with inline images if provided)
    const mimeMessage = buildMime(to, subject, trackedHtml, text, inlineImages);

    // Send via Gmail (shared implementation: validates the recipient, times out
    // at 20s, and returns a plain-language error for every provider failure)
    const { messageId } = await sendViaGmail(base44, to, mimeMessage);

    // Log to EmailLog if leadId provided
    if (leadId) {
      await base44.asServiceRole.entities.EmailLog.create({
        leadId,
        toEmail: to,
        subject,
        templateId: 'gmail',
        messageId: messageId || '',
        status: 'sent',
        sentAt: new Date().toISOString(),
        sentBy: sentBy || 'admin',
        isCustomEmail: true,
        fromEmail: 'gmail',
      }).catch(() => {});

      await base44.asServiceRole.entities.LeadHistory.create({
        leadId,
        type: 'note',
        content: `✉️ Gmail sent by ${sentBy || 'admin'} to ${to} — Subject: "${subject}"`,
        createdBy: sentBy || 'admin',
      }).catch(() => {});
    }

    return Response.json({ success: true, messageId, sendId });
  } catch (error) {
    console.error('[sendGmailEmail] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});