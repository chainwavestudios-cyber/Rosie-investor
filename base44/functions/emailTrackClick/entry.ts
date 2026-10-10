import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);
  const leadId = url.searchParams.get('leadId') || '';
  const sendId = url.searchParams.get('sendId') || '';
  const targetUrl = url.searchParams.get('url') || '';

  // Log the click event (fire-and-forget)
  if (leadId && targetUrl) {
    try {
      await base44.asServiceRole.entities.EmailTrackingEvent.create({
        leadId,
        sendId,
        eventType: 'click',
        url: decodeURIComponent(targetUrl),
        userAgent: req.headers.get('user-agent') || '',
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
        trackedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[emailTrackClick] Failed to log:', e.message);
    }
  }

  // Redirect to the original URL
  const decodedUrl = targetUrl ? decodeURIComponent(targetUrl) : '/';
  return new Response(null, {
    status: 302,
    headers: {
      Location: decodedUrl,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
});