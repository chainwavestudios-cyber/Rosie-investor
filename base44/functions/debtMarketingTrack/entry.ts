/**
 * debtMarketingTrack — the Debt Call Coach marketing tracker, called by the
 * prospect's email client.
 *
 *   event=open   returns the 1x1 pixel and records the open
 *   event=click  records which link was clicked and forwards to it
 *
 * Every event lands on that lead's DebtMarketingSend row, and the two-click +
 * welcome-message rule queues the Introduction 2 email from here.
 *
 * Public by design (email clients can't authenticate): it only ever writes
 * tracking onto the send row it was given, and only forwards to hosts that were
 * in the email that was sent.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { recordEngagement } from '../../shared/debtMarketingEngage.ts';
import { PIXEL_GIF_BASE64 } from '../../shared/debtMarketingTracking.ts';

const HOME = 'https://rosieai-investorpage.base44.app/';
const PIXEL_HEADERS = {
  'Content-Type': 'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  // The email client calls this with query params; a JSON body is also accepted.
  const params = new URL(req.url).searchParams;
  const body = await req.json().catch(() => ({} as any));
  const pick = (key: string) => params.get(key) || (body?.[key] != null ? String(body[key]) : '');
  const event = pick('event') || 'open';
  const ids = {
    campaignId: pick('campaign'),
    sendId: pick('send'),
    vaultEntryId: pick('lead'),
    userAgent: req.headers.get('user-agent') || '',
    ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim(),
  };

  if (event === 'click') {
    const raw = pick('url');
    const target = raw ? (raw.includes('://') ? raw : decodeURIComponent(raw)) : '';
    if (!target) return new Response(null, { status: 302, headers: { Location: HOME } });

    let destination = target;
    try {
      const result: any = await recordEngagement(base44, { ...ids, eventType: 'click', url: target });
      if (result?.redirect) destination = result.redirect;
    } catch (e: any) {
      console.error('[debtMarketingTrack] click failed:', e?.message || String(e));
    }
    return new Response(null, {
      status: 302,
      headers: { Location: destination, 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }

  try {
    await recordEngagement(base44, { ...ids, eventType: 'open' });
  } catch (e: any) {
    console.error('[debtMarketingTrack] open failed:', e?.message || String(e));
  }

  const bytes = Uint8Array.from(atob(PIXEL_GIF_BASE64), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: PIXEL_HEADERS });
});