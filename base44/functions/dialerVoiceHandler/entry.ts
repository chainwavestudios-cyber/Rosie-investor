/**
 * dialerVoiceHandler — TwiML App Voice URL
 *
 * Mode 1: Direct dial     — To=+1xxx → dials out to phone number
 * Mode 2: Lead leg        — ConferenceName=x&LeadLeg=true → holds lead in conference
 * Mode 3: Agent leg       — ConferenceName=x → agent joins conference
 * Mode 4: Inbound         — no To param, Direction=inbound → routes to browser client
 */
Deno.serve(async (req) => {
  // ── Always return valid TwiML — never let Twilio see a 5xx ──────────
  try {
    const url = new URL(req.url);

    let to             = url.searchParams.get('To')             || '';
    let conferenceName = url.searchParams.get('ConferenceName') || '';
    let callerIdParam  = url.searchParams.get('CallerId')       || '';
    let direction      = url.searchParams.get('Direction')      || '';
    let called         = url.searchParams.get('Called')         || '';

    if (req.method === 'POST') {
      try {
        const body   = await req.text();
        const params = new URLSearchParams(body);
        to             = to             || params.get('To')             || '';
        conferenceName = conferenceName || params.get('ConferenceName') || '';
        callerIdParam  = callerIdParam  || params.get('CallerId')       || '';
        direction      = direction      || params.get('Direction')      || '';
        called         = called         || params.get('Called')         || '';
      } catch {}
    }

    console.log('[dialerVoiceHandler] method:', req.method, 'to:', to, 'conf:', conferenceName, 'direction:', direction, 'called:', called);

    // ── Mode 2: Lead leg — hold lead in conference ──────────────────────
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

    // ── Mode 3: Agent joins conference ──────────────────────────────────
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

    // ── Mode 1: Direct outbound dial ────────────────────────────────────
    const appId = Deno.env.get('BASE44_APP_ID') || '';
    const vmWebhookBase = `https://run.base44.com/apps/${appId}/functions/voicemailWebhook`;

    // Detect inbound: To matches our own Twilio number (not a dial target)
    const ownNumbers = [
      Deno.env.get('TWILIO_FROM_NUMBER')   || '',
      Deno.env.get('TWILIO_FROM_NUMBER_2') || '',
      Deno.env.get('TWILIO_FROM_NUMBER_3') || '',
      Deno.env.get('TWILIO_FROM_NUMBER_4') || '',
      Deno.env.get('TWILIO_FROM_NUMBER_5') || '',
      Deno.env.get('TWILIO_FROM_NUMBER_6') || '',
    ].filter(Boolean);
    const toNormalized = to.replace(/\s/g, '');
    const isInboundToOurNumber = ownNumbers.includes(toNormalized) || (called && ownNumbers.includes(called.replace(/\s/g, '')));
    const isClientIdentifier = !to || to.startsWith('client:') || to.startsWith('sip:');

    if (to && !isClientIdentifier && !isInboundToOurNumber) {
      const callerId = callerIdParam || Deno.env.get('TWILIO_FROM_NUMBER') || '';
      if (!callerId) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Caller ID not configured.</Say><Hangup/></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" timeout="30" action="${vmWebhookBase}?noAnswer=true" method="POST">
    <Number>${to}</Number>
  </Dial>
</Response>`;
      console.log('[dialerVoiceHandler] → Mode 1 Direct dial:', to);
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // ── Mode 4: Inbound call → route to browser client, then voicemail ──
    // Ring the browser client (timeout=20s). If no answer, Twilio POSTs to
    // voicemailWebhook?noAnswer=true which plays greeting and records VM.
    // NOTE: BASE44_APP_ID must be set in env or vmWebhookBase will be broken.
    if (!appId) {
      console.error('[dialerVoiceHandler] BASE44_APP_ID env var is not set — voicemail webhook URL will be invalid!');
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20" action="${vmWebhookBase}?noAnswer=true" method="POST">
    <Client>agent</Client>
  </Dial>
</Response>`;
    console.log('[dialerVoiceHandler] → Mode 4 Inbound → routing to browser client (to:', to, 'called:', called, ')');
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });

  } catch (fatalErr) {
    // Last-resort fallback — should never happen but guarantees Twilio always
    // gets a valid TwiML response instead of a 502 "application error"
    console.error('[dialerVoiceHandler] Fatal unhandled error:', fatalErr?.message);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, we are unable to take your call right now. Please try again later.</Say><Hangup/></Response>`,
      { headers: { 'Content-Type': 'text/xml' }, status: 200 }
    );
  }
});