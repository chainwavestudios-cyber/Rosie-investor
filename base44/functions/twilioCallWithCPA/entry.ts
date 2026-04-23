/**
 * twilioCallWithCPA — Predictive dialer outbound call
 * Puts the lead into a conference room so agent can join when answered
 */
const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')  || '';
const FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER') || '';

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

    // Conference status callback fires when participant joins/leaves
    // This is reliable — unlike per-call StatusCallback which Twilio ignores on conference calls
    const confCallbackParam = statusCallbackUrl
      ? `statusCallbackEvent="start end join leave" statusCallback="${statusCallbackUrl}" statusCallbackMethod="POST"`
      : '';

    const leadTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false" waitUrl="" ${confCallbackParam}>
      ${confName}
    </Conference>
  </Dial>
</Response>`;

    const twimlUrl = `https://twimlets.com/echo?Twiml=${encodeURIComponent(leadTwiml)}`;

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
          'Url':  twimlUrl,
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