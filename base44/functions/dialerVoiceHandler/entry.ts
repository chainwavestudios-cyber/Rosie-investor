/**
 * dialerVoiceHandler — TwiML App Voice URL
 * 
 * Two modes:
 * 1. Direct dial:     Called with ?To=+1xxxxxxxxxx  → dials out to that number
 * 2. Predictive:      Called with ?ConferenceName=x → puts agent into conference
 */
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Params come as POST form data from Twilio SDK or as query params
  let to = '';
  let conferenceName = '';

  let callerIdParam = '';
  if (req.method === 'POST') {
    const body = await req.text();
    const params = new URLSearchParams(body);
    to = params.get('To') || '';
    conferenceName = params.get('ConferenceName') || '';
    callerIdParam = params.get('CallerId') || '';
  } else {
    to = url.searchParams.get('To') || '';
    conferenceName = url.searchParams.get('ConferenceName') || '';
    callerIdParam = url.searchParams.get('CallerId') || '';
  }

  // Mode 1: Direct dial — agent browser called with a To number
   if (to && !to.startsWith('client:')) {
     // Use caller ID chosen by the agent, falling back to the default number
     const callerId = callerIdParam ||
       Deno.env.get('TWILIO_FROM_NUMBER') || '';
     if (!callerId) {
       console.error('[dialerVoiceHandler] Missing TWILIO_FROM_NUMBER — calls will fail');
       return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Caller ID not configured. Contact your administrator.</Say><Hangup/></Response>`, {
         headers: { 'Content-Type': 'text/xml' },
       });
     }
     const twiml = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
   <Dial callerId="${callerId}" timeout="30">
     <Number>${to}</Number>
   </Dial>
  </Response>`;
     return new Response(twiml, {
       headers: { 'Content-Type': 'text/xml' },
     });
   }

  // Mode 2: Predictive — lead leg holding in conference (waiting for agent)
  // Called by twilioCallWithCPA with ?ConferenceName=x&LeadLeg=true
  if (conferenceName && (url.searchParams.get('LeadLeg') === 'true' || (req.method === 'POST' && new URLSearchParams(await req.clone().text()).get('LeadLeg') === 'true'))) {
    const statusCallback = url.searchParams.get('StatusCallback') || '';
    const confCallbackAttr = statusCallback
      ? `statusCallbackEvent="start end join leave" statusCallback="${statusCallback}" statusCallbackMethod="POST"`
      : '';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false" waitUrl="" ${confCallbackAttr}>
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`;
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Mode 3: Predictive — agent browser joining the conference
  if (conferenceName) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`;
    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Fallback
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  });
});