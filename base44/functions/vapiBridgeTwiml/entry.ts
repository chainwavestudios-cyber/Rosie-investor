/**
 * vapiBridgeTwiml — Twilio fetches this for the sales-line leg of a video qualification
 * (and posts the outcome back to it as a status callback).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { toE164 } from '../../shared/twilioHelpers.ts';
import {
  bridgeTwiml,
  findSessionById,
  loadConfig,
  sessionStatusForCallStatus,
} from '../../shared/videoQualify.ts';

const XML_HEADERS = { 'Content-Type': 'text/xml' };
const EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session') || '';
    if (!sessionId) return new Response(EMPTY, { headers: XML_HEADERS });

    const session = await findSessionById(base44, sessionId);
    if (!session) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This transfer is no longer available.</Say></Response>',
        { headers: XML_HEADERS },
      );
    }

    // Twilio posts form params here too — read both so the outcome is recorded either way.
    const params = new URLSearchParams(url.search);
    if (req.method === 'POST') {
      const form = new URLSearchParams(await req.text().catch(() => ''));
      form.forEach((value, key) => params.set(key, value));
    }

    if (url.searchParams.get('status') === '1') {
      const callStatus = params.get('CallStatus') || '';
      const status = sessionStatusForCallStatus(callStatus);
      await base44.asServiceRole.entities.VideoQualifySession.update(session.id, {
        status,
        bridgedAt: status === 'bridged' ? new Date().toISOString() : session.bridgedAt,
        error: status === 'failed' ? `Twilio call status: ${callStatus}` : session.error,
      });
      return new Response(EMPTY, { headers: XML_HEADERS });
    }

    const cfg = await loadConfig(base44);
    const from = toE164(Deno.env.get('TWILIO_FROM_NUMBER') || '');
    return new Response(bridgeTwiml(cfg, session, from), { headers: XML_HEADERS });
  } catch (error) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We could not complete this transfer.</Say></Response>`,
      { status: 200, headers: XML_HEADERS },
    );
  }
}