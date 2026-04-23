/**
 * twilioCallWithCPA — Predictive dialer outbound call with AMD
 * Puts the lead into a conference room so agent can join when human detected
 */
const ACCOUNT_SID      = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const AUTH_TOKEN       = Deno.env.get('TWILIO_AUTH_TOKEN')  || '';
const FROM_NUMBER      = Deno.env.get('TWILIO_FROM_NUMBER') || '';
const VOICE_HANDLER_URL = Deno.env.get('DIALER_VOICE_HANDLER_URL') || '';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { toNumber, fromNumber, statusCallbackUrl, conferenceName } = body;

    if (!toNumber) return Response.json({ error: 'Missing toNumber' }, { status: 400 });
    if (!statusCallbackUrl) return Response.json({ error: 'Missing statusCallbackUrl' }, { status: 400 });
    if (!ACCOUNT_SID || !AUTH_TOKEN) return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });

    // Resolve from number
    let resolvedFrom = fromNumber || FROM_NUMBER;
    if (resolvedFrom && resolvedFrom.startsWith('TWILIO_FROM_NUMBER')) {
      resolvedFrom = Deno.env.get(resolvedFrom) || FROM_NUMBER;
    }
    if (!resolvedFrom) return Response.json({ error: 'No from number configured' }, { status: 500 });

    const toE164   = toNumber.startsWith('+') ? toNumber : '+1' + toNumber.replace(/\D/g, '').slice(-10);
    const fromE164 = resolvedFrom.startsWith('+') ? resolvedFrom : '+1' + resolvedFrom.replace(/\D/g, '').slice(-10);

    // Conference name for this call — agent will join this same conference
    const confName = conferenceName || `call_${Date.now()}`;

    // TwiML that puts the lead into the conference when they answer
    const leadTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false" waitUrl="https://twimlets.com/holdmusic?Bucket=com.twilio.music.classical">
      ${confName}
    </Conference>
  </Dial>
</Response>`;

    // Encode it as a TwiML Bin URL or use inline via a data URI approach
    // We'll use a Twilio-hosted TwiML approach via URL encoding
    const twimlUrl = `https://twimlets.com/echo?Twiml=${encodeURIComponent(leadTwiml)}`;

    console.log(`[CPA Call] To: ${toE164}  From: ${fromE164}  Conf: ${confName}`);

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
          'MachineDetection':                    'DetectMessageEnd',
          'MachineDetectionTimeout':             '30',
          'MachineDetectionSpeechThreshold':     '2400',
          'MachineDetectionSpeechEndThreshold':  '1200',
          'MachineDetectionSilenceTimeout':      '5000',
          'StatusCallback':       statusCallbackUrl,
          'StatusCallbackEvent':  'initiated ringing answered completed',
          'StatusCallbackMethod': 'POST',
        }).toString(),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      console.error('[CPA Call] Twilio error:', res.status, JSON.stringify(data));
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
    console.error('[CPA Call] Unexpected error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});