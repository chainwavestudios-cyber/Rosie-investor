/**
 * testInboundCall — Rings the admin's own phone as if they had called the
 * business line, so the incoming-call experience can be rehearsed from the
 * AI Agent setup screen.
 *
 * HOW IT STAYS FAITHFUL: Twilio is handed a voice URL whose query parameters
 * present the call as an incoming one (To/Called = the agent's own line,
 * From = the tester). dialerVoiceHandler reads query parameters before
 * Twilio's POST body (see twilioVoiceParams), so it takes its Mode 4 inbound
 * branch verbatim: caller-ID lookup → dynamic intro clips → Adam Media
 * Stream. Nothing in the inbound path is duplicated, stubbed or bypassed —
 * this is the same code a live caller exercises.
 *
 * The 8am-8pm cutoff is intentionally not applied: this rings the admin,
 * never a prospect.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { lineNumber, toE164, twilioFetch } from '../../shared/twilioHelpers.ts';

const FALLBACK_BASE_URL = 'https://rosieai-investorpage.base44.app';

const OWN_LINE_ENV_KEYS = [
  'TWILIO_FROM_NUMBER', 'TWILIO_FROM_NUMBER_2', 'TWILIO_FROM_NUMBER_3',
  'TWILIO_FROM_NUMBER_4', 'TWILIO_FROM_NUMBER_5', 'TWILIO_FROM_NUMBER_6',
];

export default async function (req) {
  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const phone = String(body?.phone || '').trim();
    if (!phone) {
      return Response.json({ error: 'Enter the phone number to ring for the test.' }, { status: 400 });
    }

    const tester = toE164(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(tester)) {
      return Response.json({ error: 'Enter a valid phone number, including the country code for numbers outside the US.' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req).asServiceRole;
    const config = (await base44.entities.AIAgentConfig.filter({ configName: 'default' }))?.[0] || {};

    // Dial FROM the agent's own line so the tester sees the business number.
    const fromNumber = lineNumber(config.twilioLineKey || '');
    if (!fromNumber) {
      return Response.json({
        error: 'No Twilio line is set for the AI agent. Choose the agent line under Agent Configuration first.',
      }, { status: 400 });
    }

    // The spoofed inbound line must be one dialerVoiceHandler recognises as our
    // own, otherwise it would treat the call as a fresh outbound dial and ring
    // the tester a second time.
    const ownNumbers = OWN_LINE_ENV_KEYS.map(k => Deno.env.get(k) || '').filter(Boolean);
    const inboundLine = ownNumbers.includes(fromNumber)
      ? fromNumber
      : (Deno.env.get('TWILIO_FROM_NUMBER') || fromNumber);

    const appUrl = req.headers.get('X-Base44-App-Url') || FALLBACK_BASE_URL;
    const voiceUrl = `${appUrl}/functions/dialerVoiceHandler`
      + `?To=${encodeURIComponent(inboundLine)}`
      + `&Called=${encodeURIComponent(inboundLine)}`
      + `&From=${encodeURIComponent(tester)}`
      + `&Direction=inbound`;

    const call = await twilioFetch('/Calls.json', {
      method: 'POST',
      body: new URLSearchParams({
        To: tester,
        From: fromNumber,
        Url: voiceUrl,
        StatusCallbackMethod: 'POST',
        Timeout: '30',
      }),
    });

    return Response.json({
      ok: true,
      callSid: call?.sid || null,
      from: fromNumber,
      to: tester,
      agentActive: !!config.isActive,
      message: config.isActive
        ? `Ringing ${tester} from ${fromNumber}. Answer to hear the incoming-call experience.`
        : `Ringing ${tester} from ${fromNumber}. The AI agent is switched off, so this will ring a fronter instead of Adam.`,
    });
  } catch (error) {
    console.error('[testInboundCall] Error:', error?.message);
    const status = error?.status >= 400 && error?.status < 500 ? error.status : 500;
    return Response.json({ error: error?.message || 'Test call failed', twilioCode: error?.twilioCode || null }, { status });
  }
}