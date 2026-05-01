/**
 * dialerVoiceHandler — TwiML App Voice URL
 *
 * Mode 1: Direct dial     — To=+1xxx → dials out
 * Mode 2: Lead leg        — ConferenceName=x&LeadLeg=true → holds lead in conference
 * Mode 3: Agent leg       — ConferenceName=x → agent joins conference
 */
Deno.serve(async (req) => {
  const url = new URL(req.url);

  let to             = url.searchParams.get('To') || '';
  let conferenceName = url.searchParams.get('ConferenceName') || '';
  let callerIdParam  = url.searchParams.get('CallerId') || '';

  if (req.method === 'POST') {
    try {
      const body   = await req.text();
      const params = new URLSearchParams(body);
      to             = to             || params.get('To')             || '';
      conferenceName = conferenceName || params.get('ConferenceName') || '';
      callerIdParam  = callerIdParam  || params.get('CallerId')       || '';
    } catch {}
  }

  console.log('[dialerVoiceHandler] method:', req.method, 'to:', to, 'conf:', conferenceName, 'leadLeg:', url.searchParams.get('LeadLeg'));

  // Mode 2: Lead leg — hold lead in conference, agent joins shortly after
  // startConferenceOnEnter="false" keeps the conference un-started until agent joins
  // No waitUrl = Twilio default silence (no hold music)
  const isLeadLeg = url.searchParams.get('LeadLeg') === 'true';
  if (conferenceName && isLeadLeg) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false">
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`;
    console.log('[dialerVoiceHandler] → Mode 2 LeadLeg:', conferenceName);
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Mode 3: Agent joins conference
  if (conferenceName) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`;
    console.log('[dialerVoiceHandler] → Mode 3 Agent joining:', conferenceName);
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Mode 1: Direct dial
  const isClientIdentifier = !to || to.startsWith('client:') || to.startsWith('sip:');
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
    console.log('[dialerVoiceHandler] → Mode 1 Direct dial:', to);
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  console.log('[dialerVoiceHandler] → Fallback hangup');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  });
});