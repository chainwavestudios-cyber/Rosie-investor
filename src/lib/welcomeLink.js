/** Finds the email's welcome / personal message link — where "listen to my welcome message" points. */
export function detectWelcomeLink(html) {
  const anchors = [...String(html || '').matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]{0,220}?)<\/a>/gi)];
  for (const m of anchors) {
    const href = m[1] || '';
    const text = String(m[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    if (!/welcome|about me|personal message/i.test(text)) continue;
    const clean = href.replace(/\{\{\s*personalMessageUrl\s*\}\}/i, '').trim();
    if (/^https?:\/\//i.test(clean)) return clean;
  }
  return '';
}