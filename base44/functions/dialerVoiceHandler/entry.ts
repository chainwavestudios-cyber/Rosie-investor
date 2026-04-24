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

  if (req.method === 'POST') {
    const body = await req.text();
    const params = new URLSearchParams(body);
    to = params.get('To') || '';
    conferenceName = params.get('ConferenceName') || '';
  } else {
    to = url.searchParams.get('To') || '';
    conferenceName = url.searchParams.get('ConferenceName') || '';
  }

  // Mode 1: Direct dial — agent browser called with a To number
   if (to && !to.startsWith('client:')) {
     const callerId = Deno.env.get('TWILIO_FROM_NUMBER') || '';
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

  // Mode 2: Predictive — agent browser joining a conference
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