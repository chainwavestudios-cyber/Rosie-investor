import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { injectTracking, buildMime } from '../../shared/emailTracking.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { to, subject, html, text, leadId, sentBy, inlineImages } = await req.json();

  if (!to || !subject) {
    return Response.json({ error: 'Recipient and subject are required' }, { status: 400 });
  }

  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Generate a unique send ID for tracking
    const sendId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Inject open-tracking pixel and rewrite links for click tracking
    const trackedHtml = leadId ? injectTracking(html, leadId, sendId) : html;

    // Build RFC 2822 MIME message (with inline images if provided)
    const mimeMessage = buildMime(to, subject, trackedHtml, text, inlineImages);

    // Base64url encode for Gmail API
    const bytes = new TextEncoder().encode(mimeMessage);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Send via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64url }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sendGmailEmail] Gmail API error:', errorText);
      return Response.json({ error: `Gmail API error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();

    // Log to EmailLog if leadId provided
    if (leadId) {
      await base44.asServiceRole.entities.EmailLog.create({
        leadId,
        toEmail: to,
        subject,
        templateId: 'gmail',
        messageId: data.id || '',
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

    return Response.json({ success: true, messageId: data.id, sendId });
  } catch (error) {
    console.error('[sendGmailEmail] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});