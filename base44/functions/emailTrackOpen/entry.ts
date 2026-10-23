import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { recordTrackedEvent, resolveMessageToken } from '../../shared/emailMessageEngine.ts';

// 1x1 transparent GIF (43 bytes)
const GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);

  // Query parameters are how a mail client calls this; a JSON body is accepted too
  // (the same contract the click tracker uses), so the endpoint can be exercised
  // directly.
  const body = await req.json().catch(() => ({} as any));
  const pick = (key: string) => url.searchParams.get(key) || (body?.[key] != null ? String(body[key]) : '');
  // The opaque per-message token is the public identity; legacy sends that have
  // no token yet still pass leadId/sendId and keep working exactly as before.
  const token = pick('m');
  const message = token ? await resolveMessageToken(base44, token) : null;
  const leadId = message?.contactId || pick('leadId');
  const sendId = message?.sendId || pick('sendId');
  const templateId = message?.templateId || pick('templateId');
  const templateName = message?.templateName || pick('templateName');

  try {
    await recordTrackedEvent(base44, {
      message,
      leadId,
      sendId,
      templateId,
      templateName,
      eventType: 'open',
      userAgent: req.headers.get('user-agent') || '',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
    });
  } catch (e: any) {
    console.error('[emailTrackOpen] Failed to log:', e?.message);
  }

  // Appointment reminder opens still stamp the contact card the way they always did.
  // Only a Debt Call Coach contact carries those fields.
  if (leadId && (!message || message.contactKind === 'debt_lead')) {
    try {
      const lead = await base44.asServiceRole.entities.DebtLead.get(leadId);
      if (lead) {
        const updates: any = {};
        if (sendId && sendId === lead.apptNightBeforeSendId && !lead.apptEmailOpenedAt) {
          updates.apptEmailOpenedAt = new Date().toISOString();
        }
        if (sendId && sendId === lead.apptHourBeforeSendId && !lead.apptHourReminderOpenedAt) {
          updates.apptHourReminderOpenedAt = new Date().toISOString();
        }
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.DebtLead.update(leadId, updates);
        }
      }
    } catch {}
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