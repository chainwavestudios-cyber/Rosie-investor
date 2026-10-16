import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);
  const leadId = url.searchParams.get('leadId') || '';
  const sendId = url.searchParams.get('sendId') || '';
  const templateId = url.searchParams.get('templateId') || '';
  const templateName = url.searchParams.get('templateName') || '';
  const targetUrl = url.searchParams.get('url') || '';

  // Log the click event (fire-and-forget)
  if (leadId && targetUrl) {
    try {
      await base44.asServiceRole.entities.EmailTrackingEvent.create({
        leadId,
        sendId,
        templateId: templateId || undefined,
        templateName: templateName || undefined,
        eventType: 'click',
        url: decodeURIComponent(targetUrl),
        userAgent: req.headers.get('user-agent') || '',
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
        trackedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[emailTrackClick] Failed to log:', e.message);
    }

    // Update DebtLead appointment tracking fields based on clicked URL
    try {
      const lead = await base44.asServiceRole.entities.DebtLead.get(leadId);
      if (lead) {
        const decodedUrl = decodeURIComponent(targetUrl);
        const updates: any = {};
        if (decodedUrl.includes('trustpilot.com') && !lead.apptTrustpilotClickedAt) {
          updates.apptTrustpilotClickedAt = new Date().toISOString();
        }
        if (decodedUrl.includes('bbb.org') && !lead.apptBbbClickedAt) {
          updates.apptBbbClickedAt = new Date().toISOString();
        }
        if (decodedUrl.includes('debtadvisorsofamerica.com') && !lead.apptWebsiteClickedAt) {
          updates.apptWebsiteClickedAt = new Date().toISOString();
        }

        // Personal Message audio link tracking — check if the clicked URL matches
        // the template's personalMessageUrl pattern (domain match)
        if (!lead.personalMessageClickedAt && templateId) {
          try {
            const tpl = await base44.asServiceRole.entities.DebtEmailTemplate.get(templateId);
            if (tpl?.personalMessageUrl) {
              // Extract hostname from the template's personalMessageUrl for matching
              let pmHost = '';
              try { pmHost = new URL(tpl.personalMessageUrl).hostname; } catch {}
              if (pmHost && decodedUrl.includes(pmHost)) {
                updates.personalMessageClickedAt = new Date().toISOString();
              }
            }
          } catch {}
        }

        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.DebtLead.update(leadId, updates);
        }
      }
    } catch {}
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