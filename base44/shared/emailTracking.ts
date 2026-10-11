/**
 * emailTracking.ts — Shared email tracking and MIME building utilities.
 * Used by sendGmailEmail and processEmailTrackingEvent.
 */
export const TRACKING_BASE = 'https://rosieai-investorpage.base44.app/functions';

export function injectTracking(html: string, leadId: string, sendId: string): string {
  if (!html) return html;
  const trackOpenUrl = `${TRACKING_BASE}/emailTrackOpen?leadId=${encodeURIComponent(leadId)}&sendId=${sendId}`;
  const trackClickBase = `${TRACKING_BASE}/emailTrackClick?leadId=${encodeURIComponent(leadId)}&sendId=${sendId}&url=`;

  // 1. Rewrite existing <a href="..."> links to go through the click tracker
  let result = html.replace(/(<a\s+[^>]*?href=")(https?:\/\/[^"]+)"/gi, (match, prefix, url) => {
    if (url.includes('emailTrackClick')) return match;
    return `${prefix}${trackClickBase}${encodeURIComponent(url)}"`;
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
    if (url.includes('emailTrackClick') || url.includes('emailTrackOpen')) return url;
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