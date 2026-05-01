/**
 * dialerVoiceHandler — TwiML App Voice URL
 * 
 * Two modes:
 * 1. Direct dial:     Called with ?To=+1xxxxxxxxxx  → dials out to that number
 * 2. Predictive:      Called with ?ConferenceName=x → puts agent into conference
 */
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Read ALL params — log everything so we can see exactly what Twilio sends
  let to = url.searchParams.get('To') || '';
  let conferenceName = url.searchParams.get('ConferenceName') || '';
  let callerIdParam = url.searchParams.get('CallerId') || '';
  let allParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { allParams[k] = v; });

  if (req.method === 'POST') {
    try {
      const body = await req.text();
      const params = new URLSearchParams(body);
      params.forEach((v, k) => { allParams[k] = v; });
      to = to || params.get('To') || '';
      conferenceName = conferenceName || params.get('ConferenceName') || '';
      callerIdParam = callerIdParam || params.get('CallerId') || '';
    } catch {}
  }

  console.log('[dialerVoiceHandler] method:', req.method, 'params:', JSON.stringify(allParams));

  // Mode 2: Lead leg — MUST check this first since it comes via GET with query params
  const isLeadLeg = url.searchParams.get('LeadLeg') === 'true';
  if (conferenceName && isLeadLeg) {
    const statusCallback = url.searchParams.get('StatusCallback') || '';
    const confCallbackAttr = statusCallback
      ? `statusCallbackEvent="start end join leave" statusCallback="${statusCallback}" statusCallbackMethod="POST"`
      : '';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false" ${confCallbackAttr}>
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`;
    console.log('[dialerVoiceHandler] → Mode 2 LeadLeg conference:', conferenceName);
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Mode 3: Agent joining conference — ConferenceName present, no LeadLeg flag
  if (conferenceName) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`;
    console.log('[dialerVoiceHandler] → Mode 3 Agent joining conference:', conferenceName);
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Mode 1: Direct dial — To is a real phone number (not a client: identifier)
  const isClientIdentifier = to.startsWith('client:') || to.startsWith('sip:') || !to;
  if (to && !isClientIdentifier) {
    const callerId = callerIdParam || Deno.env.get('TWILIO_FROM_NUMBER') || '';
    if (!callerId) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Caller ID not configured.</Say><Hangup/></Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" timeout="30">
    <Number>${to}</Number>
  </Dial>
</Response>`;
    console.log('[dialerVoiceHandler] → Mode 1 Direct dial to:', to);
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Fallback
  console.log('[dialerVoiceHandler] → Fallback hangup — no matching mode. to:', to, 'confName:', conferenceName);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  });
});