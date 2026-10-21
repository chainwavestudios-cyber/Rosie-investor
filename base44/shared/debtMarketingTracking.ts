/**
 * debtMarketingTracking.ts — open/click tracking for the Debt Call Coach
 * marketing emails.
 *
 * Same proven pattern the fronter credential emails use: our own 1x1 pixel for
 * opens, and every http(s) link in the email rewired through our click tracker
 * so the exact URL a prospect clicked (including the welcome / personal message
 * link) comes back to us.
 */
import { TRACKING_BASE } from './emailTracking.ts';

// 1x1 transparent GIF
export const PIXEL_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Every host the email links to — the tracker only forwards to these. */
export function linkHostsFromHtml(html: string): string[] {
  const hosts = new Set<string>();
  for (const match of String(html || '').matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
    try { hosts.add(new URL(match[1]).hostname.toLowerCase()); } catch {}
  }
  return [...hosts].slice(0, 40);
}

/** Adds the tracking pixel and rewires the links of one marketing email. */
export function injectDccTracking(
  html: string,
  ids: { campaignId: string; sendId: string; vaultEntryId: string },
): string {
  if (!html) return html;
  const base = `${TRACKING_BASE}/debtMarketingTrack`
    + `?campaign=${encodeURIComponent(ids.campaignId)}`
    + `&send=${encodeURIComponent(ids.sendId)}`
    + `&lead=${encodeURIComponent(ids.vaultEntryId)}`;
  const openUrl = `${base}&event=open`;
  const clickBase = `${base}&event=click&url=`;

  const result = html.replace(/(<a\s+[^>]*?href=")(https?:\/\/[^"]+)"/gi, (match, prefix, url) => {
    if (url.includes('debtMarketingTrack')) return match;
    return `${prefix}${clickBase}${encodeURIComponent(url)}"`;
  });

  return `${result}<img src="${openUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;"/>`;
}