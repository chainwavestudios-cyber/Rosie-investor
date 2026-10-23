/**
 * emailTracking.ts — Shared email tracking and MIME building utilities.
 * Used by sendGmailEmail, debtEmailSender and processEmailTrackingEvent.
 *
 * The sending app is the only place tracking is applied: templates are stored
 * with clean destination URLs, and every send gets its own sendId, its own
 * per-recipient tracking URLs, and the template it came from.
 */
export const TRACKING_BASE = 'https://rosieai-investorpage.base44.app/functions';

/** Matches a tracking URL this app built itself (click tracker or open pixel). */
const OWN_TRACKER_URL = /\/functions\/(?:emailTrackClick|emailTrackOpen|debtMarketingTrack)/i;

/**
 * The real destination of a link. When the markup already carries one of our own
 * tracking URLs (a template saved with tracked links, or a body being re-sent),
 * the destination inside it is returned untouched — its own query parameters
 * included — so it can be re-tracked for the current send rather than left
 * pointing at an older send, a different lead, or nested inside itself.
 */
export function unwrapTrackedUrl(raw: string): string {
  const value = String(raw || '').replace(/&amp;/gi, '&');
  if (!OWN_TRACKER_URL.test(value)) return value;
  try {
    const inner = new URL(value).searchParams.get('url');
    if (inner && /^https?:\/\//i.test(inner)) return inner;
  } catch {
    // Not a URL we can take apart — hand back exactly what we were given.
  }
  return value;
}

export function injectTracking(html: string, leadId: string, sendId: string, templateId?: string, templateName?: string): string {
  if (!html) return html;
  const templateParam = templateId ? `&templateId=${encodeURIComponent(templateId)}` : '';
  // The template's name rides along so every recorded event says WHICH email was
  // opened or clicked (the Super Admin engagement panels read these events).
  const nameParam = templateName ? `&templateName=${encodeURIComponent(templateName)}` : '';
  const trackOpenUrl = `${TRACKING_BASE}/emailTrackOpen?leadId=${encodeURIComponent(leadId)}&sendId=${sendId}${templateParam}${nameParam}`;
  const trackClickBase = `${TRACKING_BASE}/emailTrackClick?leadId=${encodeURIComponent(leadId)}&sendId=${sendId}${templateParam}${nameParam}&url=`;

  // 0. Drop any tracking pixel an earlier send left in this markup, so one email
  //    can never report its opens twice.
  let result = html.replace(/<img\b[^>]*src="[^"]*\/functions\/(?:emailTrackOpen|debtMarketingTrack)[^"]*"[^>]*>/gi, '');

  // 1. Rewrite every http(s) link for THIS send. A link that already points at one
  //    of our trackers is normalized back to its real destination first, so it is
  //    re-tracked for this send (right lead, right send, right template) and can
  //    never nest inside the old one.
  result = result.replace(/(<a\s+[^>]*?href=")([^"]+)"/gi, (match, prefix, href) => {
    const destination = unwrapTrackedUrl(href);
    if (!/^https?:\/\//i.test(destination)) return match; // mailto:, tel:, #anchor stay exactly as they are
    return `${prefix}${trackClickBase}${encodeURIComponent(destination)}"`;
  });

  // 2. Protect <a>...</a> blocks so we don't double-wrap URLs in their display text
  const linkBlocks: string[] = [];
  result = result.replace(/<a\s[^>]*>[\s\S]*?<\/a>/gi, (block) => {
    const idx = linkBlocks.length;
    linkBlocks.push(block);
    return `__PROTECTED_LINK_${idx}__`;
  });

  // 3. Wrap bare URLs (plain-text URLs not inside <a> tags) in tracked links.
  result = result.replace(/(?<!=["'=])https?:\/\/[^\s<"'<>]+/gi, (url) => {
    if (OWN_TRACKER_URL.test(url)) return url;
    return `<a href="${trackClickBase}${encodeURIComponent(url)}" style="color:#3b82f6;text-decoration:underline;">${url}</a>`;
  });

  // 4. Restore protected <a> blocks
  linkBlocks.forEach((block, i) => {
    result = result.replace(`__PROTECTED_LINK_${i}__`, block);
  });

  // 5. Append the 1x1 tracking pixel
  result += `<img src="${trackOpenUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;"/>`;
  return result;
}

export function buildMime(
  to: string,
  subject: string,
  html?: string,
  text?: string,
  inlineImages?: Array<{ contentId: string; base64: string; mimeType: string }>
): string {
  const lines: string[] = [];
  lines.push(`To: ${to}`);
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
    const boundary = `rel_${Math.random().toString(36).slice(2)}`;
    lines.push(`Content-Type: multipart/related; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(html);
    for (const img of inlineImages) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${img.mimeType || 'image/png'}; name="${img.contentId}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('Content-ID: <' + img.contentId + '>');
      lines.push('Content-Disposition: inline; filename="' + img.contentId + '"');
      lines.push('');
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