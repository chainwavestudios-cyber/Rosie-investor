/**
 * twilioCallWithCPA — Predictive dialer outbound call
 * Puts the lead into a conference room so agent can join when answered
 */
const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')  || '';
const FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER') || '';

// Public URL of dialerVoiceHandler — Twilio fetches TwiML from here for the lead's call leg
const DIALER_VOICE_URL = 'https://investors.rosieai.tech/api/apps/69cd2741578c9b5ce655395b/functions/dialerVoiceHandler';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { toNumber, fromNumber, statusCallbackUrl, conferenceName } = body;

    if (!toNumber) return Response.json({ error: 'Missing toNumber' }, { status: 400 });
    if (!ACCOUNT_SID || !AUTH_TOKEN) return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });

    let resolvedFrom = fromNumber || FROM_NUMBER;
    if (resolvedFrom && resolvedFrom.startsWith('TWILIO_FROM_NUMBER')) {
      resolvedFrom = Deno.env.get(resolvedFrom) || FROM_NUMBER;
    }
    if (!resolvedFrom) return Response.json({ error: 'No from number configured' }, { status: 500 });

    const toE164   = toNumber.startsWith('+') ? toNumber : '+1' + toNumber.replace(/\D/g, '').slice(-10);
    const fromE164 = resolvedFrom.startsWith('+') ? resolvedFrom : '+1' + resolvedFrom.replace(/\D/g, '').slice(-10);

    const confName = conferenceName || `call_${Date.now()}`;

    // Build the TwiML URL for the lead's call leg — puts them in a holding conference
    const leadTwimlUrl = `${DIALER_VOICE_URL}?ConferenceName=${encodeURIComponent(confName)}&LeadLeg=true${statusCallbackUrl ? `&StatusCallback=${encodeURIComponent(statusCallbackUrl)}` : ''}`;

    console.log(`[Dialer] To: ${toE164}  From: ${fromE164}  Conf: ${confName}`);

    const auth = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json`,
      {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'To':   toE164,
          'From': fromE164,
          'Url':  leadTwimlUrl,
        }).toString(),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      console.error('[Dialer] Twilio error:', res.status, JSON.stringify(data));
      return Response.json({ error: data.message || 'Twilio call failed' }, { status: 500 });
    }

    return Response.json({
      callSid:        data.sid,
      status:         data.status,
      conferenceName: confName,
      to:             data.to,
      from:           data.from,
    });

  } catch (e) {
    console.error('[Dialer] Unexpected error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});