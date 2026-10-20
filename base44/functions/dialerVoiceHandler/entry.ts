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
import twilioVoiceParams from '../../shared/twilioVoiceParams.ts';
import { checkCallCutoff } from '../../shared/phoneTimeZone.ts';
import { verifyCallCutoffOverride } from '../../shared/callCutoffOverride.ts';
import { getPollyVoice } from '../../shared/aiVoiceMap.ts';
import { lookupInboundLead, resolveInboundClips, clipsToTwiml } from '../../shared/inboundGreeting.ts';

export default async function(req) {
  // ── Always return valid TwiML — never let Twilio see a 5xx ──────────
  try {
    const url = new URL(req.url);

    const params = await twilioVoiceParams(req);
    const to = params.get('To') || '';
    const conferenceName = params.get('ConferenceName') || '';
    const callerIdParam = params.get('CallerId') || '';
    const direction = params.get('Direction') || '';
    const called = params.get('Called') || '';
    const overrideToken = params.get('CallCutoffOverride') || '';

    console.log('[dialerVoiceHandler] method:', req.method, 'to:', to, 'conf:', conferenceName, 'direction:', direction, 'called:', called);

    // ── Mode AI: AI Agent outbound call ──────────────────────────────────
    //   When the AI agent dials a lead (via aiAgentDial), the call connects
    //   here. We read the AIAgentConfig for the greeting, say it, then connect
    //   to a Media Stream for the AI conversation (STT → LLM → TTS loop).
    //
    //   AUTH BOUNDARIES (3 separate trust boundaries — never mix):
    //   1. STREAM_AUTH_TOKEN  — Twilio → Bridge: validated in start.customParameters
    //   2. APP_AUTH_TOKEN     — Bridge → Relay: Bearer header on HTTP forward
    //   3. PLAY_AUTH_TOKEN    — Relay → Bridge /play: Bearer header on playback
    //   The stream token is never forwarded to the app backend or logged.
    //
    //   RETRY: retry counter prevents infinite WebSocket reconnect loops.
    //   Each attempt increments the counter; max 2 retries before hangup.
    //   Retries do NOT redial the lead — they only retry the stream connection.
    const aiMode = params.get('Mode') === 'aiAgent';
    if (aiMode) {
      // NOTE: Call-hours cutoff is enforced by aiAgentDial BEFORE placing the
      // call. This handler runs AFTER the prospect answers — hanging up here
      // would be worse than not calling. The transfer path dials internal
      // advisor numbers, not prospects, so the cutoff doesn't apply there.
      //
      // GREETING OWNERSHIP: When the bridge URL exists, the greeting is NOT
      // spoken by this handler — the bridge generates it via ElevenLabs/Deepgram
      // TTS and plays it through the Media Stream. The greeting loaded below
      // is only used in the no-bridge fallback path.
      const leadId = params.get('LeadId') || '';
      let greeting = 'Hi, may I speak with {{first_name}} please?';
      let leadData: any = null;
      let pollyVoice = 'Polly.Joanna-Neural';
      try {
        const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
        const base44 = createClientFromRequest(req).asServiceRole;
        const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
        if (configs?.[0]?.greeting) {
          greeting = configs[0].greeting;
        }
        pollyVoice = getPollyVoice(configs?.[0]?.ttsVoiceModel || 'aura-2-thalia-en');
        if (leadId) {
          try { leadData = await base44.entities.FronterLead.get(leadId); }
          catch (e) { console.warn('[dialerVoiceHandler] Failed to load lead:', leadId, e?.message); }
        }
      } catch (e) {
        console.warn('[dialerVoiceHandler] Failed to load AI agent config:', e?.message);
      }
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

      // ── Connect to the Render WS Bridge for Media Stream transport ──
      // The bridge relays audio to mediaStreamRelay (Phase 1: transport only).
      // Phase 2: flip AI_PROCESSING_ENABLED in mediaStreamRelay to enable
      // Deepgram STT → LLM → TTS responses back through the bridge.
      let streamUrl = '';
      let streamToken = '';
      try {
        const { secrets } = await import('base44:runtime');
        const bridgeUrl = secrets.get('WS_BRIDGE_URL') || '';
        streamToken = secrets.get('STREAM_AUTH_TOKEN') || '';
        if (bridgeUrl) {
          const wsUrl = new URL(bridgeUrl);
          wsUrl.protocol = 'wss:';
          wsUrl.search = '';
          wsUrl.hash = '';
          wsUrl.pathname = '/ws';
          streamUrl = wsUrl.toString();
        }
      } catch (e) {
        console.warn('[dialerVoiceHandler] Failed to read bridge secrets:', e?.message);
      }

      if (streamUrl) {
        // Retry counter: if the WebSocket fails (bridge cold-start, network blip),
        // Twilio falls through to the fallback. The fallback says a brief message
        // and redirects back to retry the stream (max 2 retries).
        const retryCount = parseInt(url.searchParams.get('retry') || '0', 10);
        const maxRetries = 2;
        const appUrl = req.headers.get('X-Base44-App-Url') || 'https://rosieai-investorpage.base44.app';
        const retryUrl = `${appUrl}/functions/dialerVoiceHandler?Mode=aiAgent&LeadId=${encodeURIComponent(leadId)}&retry=${retryCount + 1}`;

        if (retryCount >= maxRetries) {
          const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${pollyVoice}">I'm sorry, I'm having trouble connecting right now. Please try again shortly. Goodbye.</Say>
  <Hangup/>
</Response>`;
          console.log('[dialerVoiceHandler] → Mode AI Agent — max retries reached, hanging up, leadId:', leadId);
          return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
        }

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${xmlEscape(streamUrl)}" name="rosie-ai-agent">
      <Parameter name="leadId" value="${xmlEscape(leadId)}" />
      ${streamToken ? `<Parameter name="streamToken" value="${xmlEscape(streamToken)}" />` : ''}
    </Stream>
  </Connect>
  <Say voice="${pollyVoice}">Please hold for just a moment.</Say>
  <Redirect method="POST">${xmlEscape(retryUrl)}</Redirect>
</Response>`;
        console.log(`[dialerVoiceHandler] → Mode AI Agent → Media Stream bridge (retry ${retryCount}/${maxRetries}), leadId:`, leadId);
        return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
      }

      // No bridge URL configured — cannot run AI agent without Media Stream
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${pollyVoice}">${xmlEscape(greeting)}</Say>
  <Say voice="${pollyVoice}">I'm sorry, our system is experiencing technical difficulties. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;
      console.log('[dialerVoiceHandler] → Mode AI Agent — NO BRIDGE URL configured, leadId:', leadId);
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // ── Mode AI Transfer: redirect from Media Stream when LLM says TRANSFER ─
    const aiTransferMode = url.searchParams.get('Mode') === 'aiAgentTransfer';
    if (aiTransferMode) {
      const leadId = url.searchParams.get('LeadId') || '';
      let config: any = {};
      let lead: any = null;
      let adamHoldUrl = '';
      try {
        const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
        const base44 = createClientFromRequest(req).asServiceRole;
        const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
        config = configs?.[0] || {};
        if (leadId) {
          try { lead = await base44.entities.FronterLead.get(leadId); } catch {}
        }
        // Load Adam Transfer Queue Hold Message (Prompt 5, Option 2)
        try {
          const holdAudio = await base44.entities.InboundCallAudio.filter(
            { assetType: 'adam_transfer_hold', isActive: true }, '-uploadedAt', 1,
          );
          adamHoldUrl = holdAudio?.[0]?.fileUrl || '';
        } catch {}
      } catch (e) {
        console.warn('[dialerVoiceHandler] Failed to load AI agent config for transfer:', e?.message);
      }
      const pollyVoice = getPollyVoice(config.ttsVoiceModel || 'aura-2-thalia-en');
      const appUrl = req.headers.get('X-Base44-App-Url') || 'https://rosieai-investorpage.base44.app';

      // ── Inbound Adam calls → fronter transfer queue (Prompt 4) ──
      // Place the caller in a conference with the Adam Transfer Queue Hold Message
      // and create a FronterHeadsUp so fronters see the queued call.
      if (lead?.inboundAdamCall || lead?.callStatus === 'inbound_adam') {
        const conferenceName = `adam_queue_${leadId || Date.now()}`;
        const holdWaitUrl = adamHoldUrl
          ? `${appUrl}/functions/dialerVoiceHandler?Mode=inboundHoldMusic`
          : 'https://twimlets.com/holdmusic?Bucket=com.twilio.music.classical';

        // Create FronterHeadsUp so fronter monitor shows the queued call
        try {
          const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
          const base44 = createClientFromRequest(req).asServiceRole;
          await base44.entities.FronterHeadsUp.create({
            fronterUsername: 'queue',
            leadId: leadId,
            leadName: (lead.firstName || '') + ' ' + (lead.lastName || ''),
            leadPhone: lead.phone || '',
            leadEmail: lead.email || '',
            conferenceName,
            customerCallSid: params.get('CallSid') || '',
            status: 'active',
            createdAt: new Date().toISOString(),
          });
          await base44.entities.FronterLead.update(leadId, {
            callStatus: 'queue_hold',
            assignedQueue: 'Incoming Live Call Transfer - AI Agent',
            transferredAt: new Date().toISOString(),
            transferredTo: 'Adam → Fronter Queue',
          });
        } catch (e) { console.warn('[dialerVoiceHandler] Failed to create heads-up:', e?.message); }

        const skipSay = url.searchParams.get('SkipSay') === 'true';
        const sayTag = skipSay ? '' : `<Say voice="${pollyVoice}">I'm transferring you to one of our senior debt advisors. Please hold for just a moment.</Say>`;
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayTag}
  <Dial>
    <Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false"
      waitUrl="${xmlEscape(holdWaitUrl)}" waitMethod="GET">
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`;
        console.log('[dialerVoiceHandler] → Mode AI Transfer (Adam → Queue), leadId:', leadId, 'conf:', conferenceName);
        return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
      }

      // ── Standard transfer: direct dial to primary number (existing path) ──
      const primaryNumber = config.transferPhoneNumber || '+16193530919';
      const callerId = Deno.env.get('TWILIO_FROM_NUMBER') || '';

      if (!/^\+[1-9]\d{7,14}$/.test(primaryNumber)) {
        console.error('[dialerVoiceHandler] Invalid transfer phone number:', primaryNumber);
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${pollyVoice}">I'm sorry, I'm unable to connect you right now. Please try again later.</Say><Hangup/></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      const fallbackUrl = `${appUrl}/functions/aiAgentRespond?transferFallback=1&leadId=${encodeURIComponent(leadId)}`;
      const skipSay = url.searchParams.get('SkipSay') === 'true';
      const sayTag = skipSay ? '' : `<Say voice="${pollyVoice}">Let me connect you with one of our senior debt advisors. Please hold for just a moment.</Say>`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayTag}
  <Dial callerId="${xmlEscape(callerId)}" timeout="30" action="${xmlEscape(fallbackUrl)}" method="POST">
    <Number>${xmlEscape(primaryNumber)}</Number>
  </Dial>
</Response>`;
      console.log('[dialerVoiceHandler] → Mode AI Transfer, leadId:', leadId);
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // ── Mode: Inbound Hold Music loop (Adam Transfer Queue Hold Message) ──
    const inboundHoldMode = url.searchParams.get('Mode') === 'inboundHoldMusic';
    if (inboundHoldMode) {
      let holdUrl = '';
      try {
        const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
        const base44 = createClientFromRequest(req).asServiceRole;
        const holdAudio = await base44.entities.InboundCallAudio.filter(
          { assetType: 'adam_transfer_hold', isActive: true }, '-uploadedAt', 1,
        );
        holdUrl = holdAudio?.[0]?.fileUrl || '';
      } catch {}
      if (holdUrl) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${xmlEscape(holdUrl)}</Play>
  <Redirect>https://rosieai-investorpage.base44.app/functions/dialerVoiceHandler?Mode=inboundHoldMusic</Redirect>
</Response>`;
        return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
      }
      // Fallback to classical hold music
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Play>https://twimlets.com/holdmusic?Bucket=com.twilio.music.classical</Play></Response>`,
        { headers: { 'Content-Type': 'text/xml' } },
      );
    }

    // ── Mode AI End Call: redirect from Media Stream when LLM says ENDCALL ──
    const aiEndCallMode = url.searchParams.get('Mode') === 'aiAgentEndCall';
    if (aiEndCallMode) {
      let config: any = {};
      try {
        const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
        const base44 = createClientFromRequest(req).asServiceRole;
        const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
        config = configs?.[0] || {};
      } catch (e) {
        console.warn('[dialerVoiceHandler] Failed to load AI agent config for end call:', e?.message);
      }
      const pollyVoice = getPollyVoice(config.ttsVoiceModel || 'aura-2-thalia-en');

      const skipSay = url.searchParams.get('SkipSay') === 'true';
      const sayTag = skipSay ? '' : `<Say voice="${pollyVoice}">Thank you for your time. Have a great day. Goodbye.</Say>`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayTag}
  <Hangup/>
</Response>`;
      console.log('[dialerVoiceHandler] → Mode AI End Call');
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

    // vmWebhookBase uses the X-Base44-App-Url header (injected by the platform),
    // not BASE44_APP_ID — the webhook URL is valid regardless of that env var.
    const vmWebhookBase = `${req.headers.get('X-Base44-App-Url') || 'https://rosieai-investorpage.base44.app'}/functions/voicemailWebhook`;

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
  <Dial callerId="${xmlEscape(callerId)}" answerOnBridge="true" timeout="30" action="${xmlEscape(vmWebhookBase + '?noAnswer=true&outbound=true')}" method="POST">
    <Number>${xmlEscape(to)}</Number>
  </Dial>
</Response>`;
      console.log('[dialerVoiceHandler] → Mode 1 Direct dial:', to);
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // ── Mode 4: Inbound call → AI agent (all lines) or browser client fallback ──
    // All incoming calls route to the AI agent Media Stream when the agent is active.
    // Falls back to the assigned fronter's browser client only if the AI agent is off
    // or the bridge is not configured.
    const calledNumber = (called || to || '').replace(/\s/g, '');

    try {
      const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
      const base44 = createClientFromRequest(req).asServiceRole;

      // If the AI agent is active, route ALL inbound calls through the greeting
      // pipeline (Prompt 1-2): lead lookup → dynamic audio clips (name + regional +
      // admin master) → connect Adam AI agent Media Stream.
      const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
      const aiConfig = configs?.[0];
      if (aiConfig?.isActive) {
        let streamUrl = '';
        let streamToken = '';
        try {
          const { secrets } = await import('base44:runtime');
          const bridgeUrl = secrets.get('WS_BRIDGE_URL') || '';
          streamToken = secrets.get('STREAM_AUTH_TOKEN') || '';
          if (bridgeUrl) {
            const wsUrl = new URL(bridgeUrl);
            wsUrl.protocol = 'wss:';
            wsUrl.search = '';
            wsUrl.hash = '';
            wsUrl.pathname = '/ws';
            streamUrl = wsUrl.toString();
          }
        } catch (e) { console.warn('[dialerVoiceHandler] Bridge secret read failed:', e?.message); }

        if (streamUrl) {
          // ── Prompt 1: Lead lookup by caller ID ──
          const callerPhone = params.get('From') || '';
          const { client_name, region, leadId: foundLeadId, lead: foundLead } = await lookupInboundLead(base44, callerPhone);

          // Ensure a FronterLead exists for the inbound caller (Adam will populate it)
          let inboundLeadId = foundLeadId || '';
          if (!inboundLeadId && callerPhone) {
            try {
              const created = await base44.entities.FronterLead.create({
                firstName: 'Inbound',
                lastName: 'Caller',
                phone: callerPhone,
                status: 'prospect',
                callStatus: 'inbound_adam',
                inboundAdamCall: true,
                inboundRegion: region,
                assignedQueue: 'Incoming Live Call Transfer - AI Agent',
                notes: `Inbound call from ${callerPhone} on ${new Date().toISOString()}. Awaiting Adam qualification.`,
              });
              inboundLeadId = created?.id || '';
            } catch (e) { console.warn('[dialerVoiceHandler] Failed to create inbound lead:', e?.message); }
          } else if (foundLeadId && foundLead) {
            // Mark existing lead as an inbound Adam call
            try {
              await base44.entities.FronterLead.update(foundLeadId, {
                callStatus: 'inbound_adam',
                inboundAdamCall: true,
                inboundRegion: region,
                assignedQueue: 'Incoming Live Call Transfer - AI Agent',
              });
            } catch (e) { console.warn('[dialerVoiceHandler] Failed to tag inbound lead:', e?.message); }
          }

          // ── Prompt 2: Resolve dynamic audio clips (A: name, B: regional, C: admin master) ──
          let clipsTwiml = '';
          try {
            const clips = await resolveInboundClips(base44, client_name, region, aiConfig);
            clipsTwiml = clipsToTwiml(clips);
          } catch (e) { console.warn('[dialerVoiceHandler] Clip resolution failed:', e?.message); }

          // Keyword triggers passed to the bridge for early Adam handoff (Prompt 3)
          const keywordTriggers = (aiConfig.inboundKeywordTriggers || '').trim();

          const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${clipsTwiml}
  <Connect>
    <Stream url="${xmlEscape(streamUrl)}" name="rosie-ai-agent">
      <Parameter name="leadId" value="${xmlEscape(inboundLeadId)}" />
      ${streamToken ? `<Parameter name="streamToken" value="${xmlEscape(streamToken)}" />` : ''}
      ${keywordTriggers ? `<Parameter name="keywordTriggers" value="${xmlEscape(keywordTriggers)}" />` : ''}
    </Stream>
  </Connect>
</Response>`;
          console.log('[dialerVoiceHandler] → Mode 4 Inbound → greeting pipeline (name:', client_name, 'region:', region, 'lead:', inboundLeadId, ') → Adam Media Stream');
          return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
        }
        console.warn('[dialerVoiceHandler] AI agent active but no bridge URL — falling back to fronter routing');
      }

      // Fallback: route to the fronter assigned to this line
      let clientIdentity = 'agent';
      const assignments = await base44.entities.FronterLineAssignment.filter({ twilioNumber: calledNumber });
      const assignment = assignments?.items?.[0] || assignments?.[0];
      if (assignment?.username) {
        clientIdentity = assignment.username.replace(/[^a-zA-Z0-9_]/g, '_');
      }

      const statusCallbackUrl =
        `${vmWebhookBase}?statusCb=true` +
        `&StatusCallbackEvent=initiated+ringing+answered+completed`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20"
    action="${vmWebhookBase}?noAnswer=true" method="POST"
    >
    <Client statusCallback="${xmlEscape(statusCallbackUrl)}" statusCallbackMethod="POST"
      statusCallbackEvent="initiated ringing answered completed">${xmlEscape(clientIdentity)}</Client>
  </Dial>
</Response>`;
      console.log('[dialerVoiceHandler] → Mode 4 Inbound → fallback to browser client:', clientIdentity, '(to:', to, 'called:', called, ')');
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    } catch (e) {
      console.warn('[dialerVoiceHandler] Inbound routing failed:', e?.message);
    }

  } catch (fatalErr) {
    console.error('[dialerVoiceHandler] Fatal unhandled error:', fatalErr?.message);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, we are unable to take your call right now. Please try again later.</Say><Hangup/></Response>`,
      { headers: { 'Content-Type': 'text/xml' }, status: 200 }
    );
  }
}