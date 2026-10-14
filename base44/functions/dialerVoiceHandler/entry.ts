/**
 * dialerVoiceHandler — TwiML App Voice URL
 *
 * Mode 1: Direct dial     — To=+1xxx → dials out to phone number
 * Mode 2: Lead leg        — ConferenceName=x&LeadLeg=true → holds lead in conference
 * Mode 3: Agent leg       — ConferenceName=x → agent joins conference
 * Mode 4: Inbound         — no To param, Direction=inbound → routes to browser client
 *
 * Mode 4 now includes a statusCallback on the <Dial> so that every inbound
 * call (ringing, missed, no-answer) gets a CallLog entry via voicemailWebhook,
 * not just calls that go to voicemail.
 */
import { xmlEscape } from '../../shared/twilioHelpers.ts';
import { checkCallCutoff } from '../../shared/phoneTimeZone.ts';
import { verifyCallCutoffOverride } from '../../shared/callCutoffOverride.ts';

export default async function(req) {
  // ── Always return valid TwiML — never let Twilio see a 5xx ──────────
  try {
    const url = new URL(req.url);

    let to             = url.searchParams.get('To')             || '';
    let conferenceName = url.searchParams.get('ConferenceName') || '';
    let callerIdParam  = url.searchParams.get('CallerId')       || '';
    let direction      = url.searchParams.get('Direction')      || '';
    let called         = url.searchParams.get('Called')         || '';
    let overrideToken  = url.searchParams.get('CallCutoffOverride') || '';

    if (req.method === 'POST') {
      try {
        const body   = await req.text();
        const params = new URLSearchParams(body);
        to             = to             || params.get('To')             || '';
        conferenceName = conferenceName || params.get('ConferenceName') || '';
        callerIdParam  = callerIdParam  || params.get('CallerId')       || '';
        direction      = direction      || params.get('Direction')      || '';
        called         = called         || params.get('Called')         || '';
        overrideToken  = overrideToken  || params.get('CallCutoffOverride') || '';
      } catch {}
    }

    console.log('[dialerVoiceHandler] method:', req.method, 'to:', to, 'conf:', conferenceName, 'direction:', direction, 'called:', called);

    // ── Mode AI: AI Agent outbound call ──────────────────────────────────
    //   When the AI agent dials a lead (via aiAgentDial), the call connects
    //   here. We read the AIAgentConfig for the greeting, say it, then connect
    //   to a Media Stream for the AI conversation (STT → LLM → TTS loop).
    const aiMode = url.searchParams.get('Mode') === 'aiAgent';
    if (aiMode) {
      const leadId = url.searchParams.get('LeadId') || '';
      let greeting = 'Hi, may I speak with {{first_name}} please?';
      let leadData: any = null;
      try {
        const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
        const base44 = createClientFromRequest(req).asServiceRole;
        const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
        if (configs?.[0]?.greeting) {
          greeting = configs[0].greeting;
        }
        if (leadId) {
          try { leadData = await base44.entities.FronterLead.get(leadId); } catch {}
        }
      } catch {}
      // Substitute all {{...}} variables from the lead record
      if (leadData) {
        const vars: Record<string, string> = {
          first_name: leadData.firstName || '',
          last_name: leadData.lastName || '',
          email: leadData.email || '',
          phone_number: leadData.phone || '',
          address: [leadData.address, leadData.city, leadData.state, leadData.zipCode].filter(Boolean).join(', '),
          hardship_statement: leadData.hardshipQualification || '',
        };
        for (const [key, val] of Object.entries(vars)) {
          greeting = greeting.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
        }
      }

      const streamUrl = `wss://rosieai-investorpage.base44.app/functions/aiAgentStream?leadId=${encodeURIComponent(leadId)}`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${xmlEscape(greeting)}</Say>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
      console.log('[dialerVoiceHandler] → Mode AI Agent outbound, leadId:', leadId);
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // ── Mode 2: Lead leg — hold lead in conference ──────────────────────
    const isLeadLeg = url.searchParams.get('LeadLeg') === 'true';
    if (conferenceName && isLeadLeg) {
      const statusCallback = url.searchParams.get('StatusCallback') || '';
      const statusCbAttr   = statusCallback
        ? ` statusCallback="${statusCallback}" statusCallbackEvent="start end join leave" statusCallbackMethod="POST"`
        : '';
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false"
      waitUrl="https://twimlets.com/holdmusic?Bucket=com.twilio.music.classical"
      waitMethod="GET"${statusCbAttr}>
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

    const appId        = Deno.env.get('BASE44_APP_ID') || '';
    const vmWebhookBase = `https://investors.rosieai.tech/functions/voicemailWebhook`;

    if (!appId) {
      console.error('[dialerVoiceHandler] BASE44_APP_ID env var is not set — voicemail webhook URL will be invalid!');
    }

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

    // ── Mode 1: Direct outbound dial ────────────────────────────────────
    if (to && !isClientIdentifier && !isInboundToOurNumber) {
      const callerId = callerIdParam || Deno.env.get('TWILIO_FROM_NUMBER') || '';
      if (!callerId) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Caller ID not configured.</Say><Hangup/></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }
      const cutoff = checkCallCutoff(to);
      if (cutoff.blocked && !await verifyCallCutoffOverride(overrideToken, to)) {
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Calls are allowed only between 8 AM and 8 PM in the recipient time zone.</Say><Hangup/></Response>', { headers: { 'Content-Type': 'text/xml' } });
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
    // statusCallback fires on ringing/answered/completed so every inbound call
    // gets a CallLog entry regardless of whether the agent picks up.
    // action fires after <Dial> ends: if agent answered → log as "answered",
    // if no answer → play greeting and record voicemail.
    const statusCallbackUrl =
      `${vmWebhookBase}?statusCb=true` +
      `&StatusCallbackEvent=initiated+ringing+answered+completed`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20"
    action="${vmWebhookBase}?noAnswer=true" method="POST"
    >
    <Client statusCallback="${xmlEscape(statusCallbackUrl)}" statusCallbackMethod="POST"
      statusCallbackEvent="initiated ringing answered completed">agent</Client>
  </Dial>
</Response>`;
    console.log('[dialerVoiceHandler] → Mode 4 Inbound → routing to browser client (to:', to, 'called:', called, ')');
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });

  } catch (fatalErr) {
    console.error('[dialerVoiceHandler] Fatal unhandled error:', fatalErr?.message);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, we are unable to take your call right now. Please try again later.</Say><Hangup/></Response>`,
      { headers: { 'Content-Type': 'text/xml' }, status: 200 }
    );
  }
}