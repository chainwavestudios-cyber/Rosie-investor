import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

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

const TRACKING_BASE = 'https://rosieai-investorpage.base44.app/functions';

function injectTracking(html: string, leadId: string, sendId: string): string {
  if (!html) return html;
  const trackOpenUrl = `${TRACKING_BASE}/emailTrackOpen?leadId=${encodeURIComponent(leadId)}&sendId=${sendId}`;
  const trackClickBase = `${TRACKING_BASE}/emailTrackClick?leadId=${encodeURIComponent(leadId)}&sendId=${sendId}&url=`;

  // Rewrite all http/https links in <a href="..."> to go through the click tracker
  let result = html.replace(/(<a\s+[^>]*?href=")(https?:\/\/[^"]+)"/gi, (match, prefix, url) => {
    return `${prefix}${trackClickBase}${encodeURIComponent(url)}"`;
  });

  // Append the 1x1 tracking pixel
  result += `<img src="${trackOpenUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;"/>`;
  return result;
}

function buildMime(to: string, subject: string, html?: string, text?: string, inlineImages?: Array<{contentId: string; base64: string; mimeType: string}>): string {
  const lines: string[] = [];
  lines.push(`To: ${to}`);
  // RFC 2047 encode subject if non-ASCII
  if (/^[\x20-\x7e]*$/.test(subject)) {
    lines.push(`Subject: ${subject}`);
  } else {
    const bytes = new TextEncoder().encode(subject);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    lines.push(`Subject: =?UTF-8?B?${btoa(binary)}?=`);
  }
  lines.push('MIME-Version: 1.0');

  const hasImages = Array.isArray(inlineImages) && inlineImages.length > 0;

  if (html && hasImages) {
    // Multipart/related: HTML part + inline image attachments
    const boundary = `rel_${Math.random().toString(36).slice(2)}`;
    lines.push(`Content-Type: multipart/related; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(html);
    // Inline image attachments
    for (const img of inlineImages) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${img.mimeType || 'image/png'}; name="${img.contentId}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('Content-ID: <' + img.contentId + '>');
      lines.push('Content-Disposition: inline; filename="' + img.contentId + '"');
      lines.push('');
      // Chunk base64 into 76-char lines per RFC 2045
      const b64 = img.base64.replace(/^data:[^;]+;base64,/, '');
      for (let i = 0; i < b64.length; i += 76) {
        lines.push(b64.slice(i, i + 76));
      }
    }
    lines.push(`--${boundary}--`);
  } else if (html) {
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(html);
  } else {
    lines.push('Content-Type: text/plain; charset=utf-8');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(text || '');
  }

  return lines.join('\r\n');
}