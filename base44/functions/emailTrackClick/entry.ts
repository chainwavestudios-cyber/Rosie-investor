import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { recordTrackedEvent, resolveMessageToken } from '../../shared/emailMessageEngine.ts';

/**
 * emailTrackClick — the click tracker every tracked email link points at.
 *
 * The public URL carries only the message's opaque token (m=...), so nothing
 * about the contact is exposed in it; the message record behind that token holds
 * the contact, template, sender and Gmail account the click belongs to. Sends
 * made before the token existed still pass leadId/sendId and keep working.
 *
 * It records the click, then forwards the visitor to the ORIGINAL destination,
 * byte for byte (query parameters included — the URL parser has already decoded
 * it once).
 *
 * Open-redirect protection: only a plain http(s) address on a real host is
 * forwarded. javascript:, data:, file:, localhost and private-network addresses
 * are refused and sent to the app's own home page instead.
 */
const HOME = 'https://rosieai-investorpage.base44.app/';

function safeDestination(value: string): string {
  if (!value) return '';
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
  const host = parsed.hostname.toLowerCase();
  const isInternal = host === 'localhost'
    || host === '::1'
    || /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
  if (isInternal || !host.includes('.')) return '';
  return value;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);
  // An email client calls this with query parameters; a JSON body is accepted too
  // (the same contract the Debt Call Coach tracker uses), so the endpoint can be
  // exercised directly.
  const body = await req.json().catch(() => ({} as any));
  const pick = (key: string) => url.searchParams.get(key) || (body?.[key] != null ? String(body[key]) : '');
  // Already decoded once by the URL parser — decoding again would corrupt a
  // destination that legitimately contains %2F, %20 or an encoded query value.
  const destination = safeDestination(pick('url'));

  const token = pick('m');
  const message = token ? await resolveMessageToken(base44, token) : null;
  const leadId = message?.contactId || pick('leadId');
  const sendId = message?.sendId || pick('sendId');
  const templateId = message?.templateId || pick('templateId');
  const templateName = message?.templateName || pick('templateName');

  if (destination && (message || leadId)) {
    try {
      await recordTrackedEvent(base44, {
        message,
        leadId,
        sendId,
        templateId,
        templateName,
        eventType: 'click',
        url: destination,
        userAgent: req.headers.get('user-agent') || '',
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
      });
    } catch (e: any) {
      console.error('[emailTrackClick] Failed to log:', e?.message);
    }
  }

  // Appointment and personal-message click stamps on the contact card, unchanged.
  // Only a Debt Call Coach contact carries those fields.
  if (leadId && destination && (!message || message.contactKind === 'debt_lead')) {
    try {
      const lead = await base44.asServiceRole.entities.DebtLead.get(leadId);
      if (lead) {
        const updates: any = {};
        if (destination.includes('trustpilot.com') && !lead.apptTrustpilotClickedAt) {
          updates.apptTrustpilotClickedAt = new Date().toISOString();
        }
        if (destination.includes('bbb.org') && !lead.apptBbbClickedAt) {
          updates.apptBbbClickedAt = new Date().toISOString();
        }
        if (destination.includes('debtadvisorsofamerica.com') && !lead.apptWebsiteClickedAt) {
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
              if (pmHost && destination.includes(pmHost)) {
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

  // Forward to the original destination; anything that fails validation goes home.
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination || HOME,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
});