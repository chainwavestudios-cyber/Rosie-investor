import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

// 1x1 transparent GIF (43 bytes)
const GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);
  const leadId = url.searchParams.get('leadId') || '';
  const sendId = url.searchParams.get('sendId') || '';

  // Log the open event (fire-and-forget)
  if (leadId) {
    try {
      await base44.asServiceRole.entities.EmailTrackingEvent.create({
        leadId,
        sendId,
        eventType: 'open',
        userAgent: req.headers.get('user-agent') || '',
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
        trackedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[emailTrackOpen] Failed to log:', e.message);
    }
  }

  // Return the 1x1 transparent GIF
  const bytes = Uint8Array.from(atob(GIF_BASE64), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
});