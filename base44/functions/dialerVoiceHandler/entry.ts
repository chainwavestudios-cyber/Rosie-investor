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
import { xmlEscape, lineNumber, toE164, twilioFetch, FRONTER_DIRECT_NUMBERS, pickTransferLineKey } from '../../shared/twilioHelpers.ts';
import twilioVoiceParams from '../../shared/twilioVoiceParams.ts';
import { checkCallCutoff } from '../../shared/phoneTimeZone.ts';
import { verifyCallCutoffOverride } from '../../shared/callCutoffOverride.ts';
import { getPollyVoice } from '../../shared/aiVoiceMap.ts';
import { lookupInboundLead, resolveInboundClips, clipsToTwiml } from '../../shared/inboundGreeting.ts';
import { assignNoticeIds } from '../../shared/noticeId.ts';
import { preserveUnansweredAiCaller } from '../../shared/aiQueueProspect.ts';

// Incoming calls ring twice before the AI picks up: Twilio holds the caller on
// ringback while this handler is still working, so the caller hears two rings and
// the agent answers on the third.
const INBOUND_RING_DELAY_MS = 6000;

// ── Advisor brief (spoken to the advisor before the caller is merged in) ──
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'Washington DC', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii',
  ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
};

function stateName(raw: string): string {
  const s = String(raw || '').trim();
  return s.length === 2 ? (STATE_NAMES[s.toUpperCase()] || s) : s;
}

function debtTypePhrase(lead: any): string {
  let types: string[] = [];
  try {
    const parsed = JSON.parse(lead?.debtTypesJson || '[]');
    if (Array.isArray(parsed)) types = parsed.map(t => String(t || '').trim()).filter(Boolean);
  } catch {}
  if (types.length <= 1) return types[0] || '';
  if (types.length === 2) return `${types[0]} and ${types[1]}`;
  return `${types.slice(0, -1).join(', ')} and ${types[types.length - 1]}`;
}

function buildMergeBrief(lead: any): string {
  const first = String(lead?.firstName || '').trim() || 'a new caller';
  const where = [String(lead?.city || '').trim(), stateName(lead?.state)].filter(Boolean).join(', ');
  const types = debtTypePhrase(lead);
  const amount = Number(lead?.debtAmount || 0);
  const amountPhrase = amount > 0 ? ` about ${amount.toLocaleString('en-US')} dollars` : '';
  let load = '';
  if (types && amountPhrase) load = ` with a total debt load of mostly ${types},${amountPhrase}`;
  else if (amountPhrase) load = ` with a total debt load of${amountPhrase}`;
  else if (types) load = ` with a debt load of mostly ${types}`;
  return `${where ? `You have ${first} from ${where}` : `You have ${first}`}${load}. I am going to merge him in now.`;
}

function queueWaitPhrase(seconds: number): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 8) return 'just a few seconds';
  if (s < 45) return `${s} seconds`;
  if (s < 90) return 'about a minute';
  const mins = Math.round(s / 60);
  return `about ${mins} minutes`;
}

// Spoken to the closer when he answers the transfer call: who is waiting, their
// debt load, how long they have been on hold — then the approval question.
function buildQueueBrief(lead: any, secondsInQueue: number): string {
  const name = [String(lead?.firstName || '').trim(), String(lead?.lastName || '').trim()]
    .filter(Boolean).join(' ') || 'a new caller';
  const amount = Number(lead?.debtAmount || 0);
  const debtBrief = amount > 0 ? `They reported approximately ${amount.toLocaleString('en-US')} dollars in debt.` : 'Their debt amount has not yet been confirmed.';
  return `Chris, the AI agent has ${name} waiting in your queue. ${debtBrief} ` +
    `They have been waiting ${queueWaitPhrase(secondsInQueue)}. ` +
    `Say "patch them through", or press 1, to merge the call. Otherwise press 2.`;
}

// The closer's leg joins the queue conference; his join starts it, so the
// caller comes off hold and the two are connected.
function queueMergeTwiml(conf: string, mergeStatusUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false"
      statusCallback="${xmlEscape(mergeStatusUrl)}" statusCallbackEvent="start join">
      ${xmlEscape(conf)}
    </Conference>
  </Dial>
</Response>`;
}


async function startAiAdvisorAttempt(service: any, config: any, leadId: string, conf: string, callerCallSid: string, queuedAt: string, attempt: number, appUrl: string): Promise<boolean> {
  const number = toE164(String(attempt === 1 ? config.transferPhoneNumber || '' : config.transferPhoneNumber2 || ''));
  if (!/^\+[1-9]\d{7,14}$/.test(number)) {
    console.warn('[AI Queue] Invalid/missing advisor number for attempt', attempt);
    return false;
  }
  const from = await pickTransferLineKey(service, config.twilioLineKey || 'TWILIO_FROM_NUMBER');
  if (!from) { console.warn('[AI Queue] No available outbound transfer line'); return false; }
  const args = `&LeadId=${encodeURIComponent(leadId)}&Conf=${encodeURIComponent(conf)}&QueuedAt=${encodeURIComponent(queuedAt)}&CallerCallSid=${encodeURIComponent(callerCallSid)}`;
  const briefUrl = `${appUrl}/functions/dialerVoiceHandler?Mode=aiQueueBrief&Attempt=${attempt}${args}`;
  const fallbackUrl = `${appUrl}/functions/dialerVoiceHandler?Mode=aiQueueFallback&Attempt=${attempt}${args}`;
  const timeoutSeconds = Math.max(12, Math.min(28, Math.floor(Number(config.queueTimeoutSeconds || 90) / 2)));
  try {
    const result = await twilioFetch('/Calls.json', {
      method: 'POST',
      body: new URLSearchParams({
        To: number, From: from, Url: briefUrl, Method: 'GET',
        Timeout: String(timeoutSeconds), MachineDetection: 'Enable',
        MachineDetectionTimeout: '6',
        StatusCallback: fallbackUrl, StatusCallbackEvent: 'completed',
        StatusCallbackMethod: 'POST',
      }),
    });
    const rows = await service.entities.FronterHeadsUp.filter({ conferenceName: conf, status: 'active' });
    if (rows?.[0]) await service.entities.FronterHeadsUp.update(rows[0].id, {
      advisorAttempt: attempt,
      advisorCallSid: result?.sid || '',
      routeState: attempt === 1 ? 'calling_chris_primary' : 'calling_chris_cell',
    });
    console.log('[AI Queue] Started advisor attempt', attempt, 'for conference', conf, 'sid', result?.sid);
    return true;
  } catch (e) {
    console.warn('[AI Queue] Advisor dial error:', e?.message);
    return false;
  }
}

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

    // Office-line bridge monitoring: a Twilio SDK client joins the existing
    // conference muted. The call's remote WebRTC track lets the Live Call
    // workspace transcribe the office and client without sending a computer
    // microphone into the conversation. Distinct from autonomous AI streaming.
    if (params.get('Mode') === 'officeMonitor') {
      const token = String(params.get('OfficeToken') || '');
      const [payload, signature] = token.split('.');
      if (!payload || !signature || !Deno.env.get('TWILIO_AUTH_TOKEN')) {
        return new Response('<Response><Hangup/></Response>', {headers:{'Content-Type':'text/xml'}});
      }
      let conferenceName = '';
      try {
        const mac = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('TWILIO_AUTH_TOKEN')!), 'HMAC', {hash:'SHA-256'}, false, ['verify']);
        const signatureRaw = atob(signature.replace(/-/g,'+').replace(/_/g,'/'));
        const bytes = Uint8Array.from(signatureRaw,c=>c.charCodeAt(0));
        const verified = await crypto.subtle.verify('HMAC', mac, bytes, new TextEncoder().encode(payload));
        const decoded = JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
        if (verified && decoded.v===1 && decoded.monitor===true &&
            typeof decoded.createdAt==='number' && Date.now()-decoded.createdAt<7200000 &&
            /^office_[a-f0-9]{32}$/.test(decoded.bridgeId)) conferenceName = decoded.bridgeId;
      } catch {}
      if (!conferenceName) {
        return new Response('<Response><Hangup/></Response>', {headers:{'Content-Type':'text/xml'}});
      }
      // Hold-free, one-way monitor. Browser SDK local microphone is also
      // muted from the client immediately on call acceptance.
      const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Dial>'+
        '<Conference beep="false" muted="true" startConferenceOnEnter="false" endConferenceOnExit="false">'+
        xmlEscape(conferenceName)+'</Conference></Dial></Response>';
      return new Response(twiml, {headers:{'Content-Type':'text/xml'}});
    }

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
    const aiTransferMode = params.get('Mode') === 'aiAgentTransfer';
    if (aiTransferMode) {
      const leadId = params.get('LeadId') || '';
      let config: any = {};
      let lead: any = null;
      let service: any = null;
      try {
        const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
        service = createClientFromRequest(req).asServiceRole;
        const configs = await service.entities.AIAgentConfig.filter({ configName: 'default' });
        config = configs?.[0] || {};
        if (leadId) {
          try { lead = await service.entities.FronterLead.get(leadId); } catch {}
        }
      } catch (e) {
        console.warn('[dialerVoiceHandler] Failed to load AI agent config for transfer:', e?.message);
      }
      const pollyVoice = getPollyVoice(config.ttsVoiceModel || 'aura-2-thalia-en');
      const appUrl = req.headers.get('X-Base44-App-Url') || 'https://rosieai-investorpage.base44.app';

      // ── AI calls (inbound + outbound) → transfer queue + merge to the advisor ──
      // The same handoff the transfer popup drives: the caller waits in the queue
      // conference on the queue hold recording, the advisor is dialed on the merge
      // number, hears who is waiting, says "patch him through", and his join starts
      // the conference — the caller comes off hold and the two are connected.
      if (leadId) {
        const customerCallSid = params.get('CallSid') || '';
        const conferenceName = `adam_queue_${customerCallSid || leadId}`;
        const queuedAtIso = new Date().toISOString();
        const holdWaitUrl = `${appUrl}/functions/dialerVoiceHandler?Mode=inboundHoldMusic`;

        // Create FronterHeadsUp so fronter monitor shows the queued call
        try {
          await service.entities.FronterHeadsUp.create({
            fronterUsername: 'AI Agent',
            leadId: leadId,
            leadName: [lead?.firstName, lead?.lastName].filter(Boolean).join(' '),
            leadPhone: lead?.phone || '',
            leadEmail: lead?.email || '',
            debtAmount: Number(lead?.debtAmount) || 0,
            conferenceName,
            customerCallSid,
            routeType: 'ai_agent',
            routeState: 'caller_queued',
            advisorAttempt: 0,
            queueStartedAt: queuedAtIso,
            lineKey: config.twilioLineKey || '',
            status: 'active',
            createdAt: queuedAtIso,
          });
          await service.entities.FronterLead.update(leadId, {
            callStatus: 'queue_hold',
            assignedQueue: 'Incoming AI - validated through process',
            // The caller is waiting, not transferred until a specialist joins.
            transferredTo: 'Awaiting advisor in AI transfer queue',
          });
        } catch (e) { console.warn('[dialerVoiceHandler] Failed to create heads-up:', e?.message); }

        // Return the hold conference immediately. Dialing Chris happens on
        // customer JOIN callback, after Twilio has begun the recorded waitUrl.
        // Never block the customer's audio waiting on outbound Call creation.

        const skipSay = url.searchParams.get('SkipSay') === 'true';
        const sayTag = skipSay ? '' : `<Say voice="${pollyVoice}">I'm going to place you in Chris's queue. There may be a few seconds of silence while I connect you.</Say>`;
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayTag}
  <Dial>
    <Conference startConferenceOnEnter="false" endConferenceOnExit="false" beep="false"
      waitUrl="${xmlEscape(holdWaitUrl)}" waitMethod="GET"
      statusCallback="${xmlEscape(`${appUrl}/functions/dialerVoiceHandler?Mode=aiQueueMerged&LeadId=${encodeURIComponent(leadId)}&Conf=${encodeURIComponent(conferenceName)}&CallerCallSid=${encodeURIComponent(customerCallSid)}`)}"
      statusCallbackEvent="start join leave end" statusCallbackMethod="POST">
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

    // ── Advisor leg ended: attempt Chris's second number, then offer a
    // speech-enabled appointment hold if neither line can merge. This callback
    // does not end the caller's call or close the in-app transfer card.
    if (params.get('Mode') === 'aiQueueFallback') {
      const conf = params.get('Conf') || '';
      const leadId = params.get('LeadId') || '';
      const callerSid = params.get('CallerCallSid') || '';
      const attempt = Number(params.get('Attempt') || 1);
      const queuedAt = params.get('QueuedAt') || new Date().toISOString();
      if (conf && leadId) {
        try {
          const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
          const service = createClientFromRequest(req).asServiceRole;
          const alerts = await service.entities.FronterHeadsUp.filter({ conferenceName: conf, status: 'active' });
          const alert = alerts?.[0];
          // A completed advisor conversation or late Twilio retry must never
          // call Chris again after the prospect has already been merged.
          if (alert && alert.routeType === 'ai_agent' && !['merged', 'appointment_booked', 'recording_queue'].includes(alert.routeState)) {
            const configRows = await service.entities.AIAgentConfig.filter({ configName: 'default' });
            const config = configRows?.[0] || {};
            const appUrl = req.headers.get('X-Base44-App-Url') || 'https://rosieai-investorpage.base44.app';
            if (attempt === 1 && Number(alert.advisorAttempt || 0) === 1) {
              // Lock attempt 1 before starting attempt 2. A repeated status
              // webhook must never start two calls to Chris's cell.
              await service.entities.FronterHeadsUp.update(alert.id, {
                advisorAttempt: -2, routeState: 'dialing_secondary',
              });
              const started = await startAiAdvisorAttempt(service, config, leadId, conf, callerSid, queuedAt, 2, appUrl);
              if (!started) await preserveUnansweredAiCaller(service, leadId, conf, alert);
            } else if (attempt === 2 && Number(alert.advisorAttempt || 0) === 2) {
              // Both numbers failed or reached voicemail. Keep the customer's
              // conference alive with the custom recording, migrate to Debt
              // Call Coach, raise the popup and free Alex for the next lead.
              await preserveUnansweredAiCaller(service, leadId, conf, alert);
            }
          }
        } catch (e) { console.warn('[AI Queue] Advisor fallback failed:', e?.message); }
      }
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', { headers: { 'Content-Type': 'text/xml' } });
    }

    // ── Mode: AI Queue Brief — the advisor's leg when the AI hands a caller over ──
    // Twilio fetches this the moment the merge number answers: the advisor hears
    // who is waiting on the line, then joins the queue conference. His join starts
    // the conference, so the caller comes off hold and the two are connected — the
    // same merge the transfer popup performs, driven by the AI instead of a fronter.
    if (params.get('Mode') === 'aiQueueBrief') {
      const briefLeadId = params.get('LeadId') || '';
      const conf = params.get('Conf') || '';
      const answeredBy = (params.get('AnsweredBy') || '').toLowerCase();
      const attemptType = (params.get('Attempt') || '1').toLowerCase();
      // AMD distinguishes Chris from voicemail. An unknown result is not an
      // affirmative human answer and should fall through to his next number.
      if (attemptType !== 'browser' && (answeredBy.startsWith('machine') || answeredBy === 'fax')) {
        console.log('[AI Queue] Advisor leg went to machine/unknown:', answeredBy);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>', { headers: { 'Content-Type': 'text/xml' } });
      }
      let briefConfig: any = {};
      let lead: any = null;
      try {
        const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
        const base44 = createClientFromRequest(req).asServiceRole;
        const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
        briefConfig = configs?.[0] || {};
        if (briefLeadId) {
          try { lead = await base44.entities.FronterLead.get(briefLeadId); } catch {}
        }
      } catch (e) { console.warn('[dialerVoiceHandler] Brief load failed:', e?.message); }

      const queuedAt = params.get('QueuedAt') || '';
      const queuedAtMs = queuedAt ? new Date(queuedAt).getTime() : 0;
      const queuedSeconds = queuedAtMs ? Math.max(0, (Date.now() - queuedAtMs) / 1000) : 0;
      const callerCallSid = params.get('CallerCallSid') || '';
      const pollyVoice = getPollyVoice(briefConfig.ttsVoiceModel || 'aura-2-thalia-en');
      const baseUrl = req.headers.get('X-Base44-App-Url') || 'https://rosieai-investorpage.base44.app';
      const mergeStatusUrl = `${baseUrl}/functions/dialerVoiceHandler?Mode=aiQueueMerged` +
        `&LeadId=${encodeURIComponent(briefLeadId)}&Conf=${encodeURIComponent(conf)}`;
      const approveUrl = `${baseUrl}/functions/dialerVoiceHandler?Mode=aiQueueApprove` +
        `&LeadId=${encodeURIComponent(briefLeadId)}&Conf=${encodeURIComponent(conf)}` +
        (callerCallSid ? `&CallerCallSid=${encodeURIComponent(callerCallSid)}` : '');
      // Brief Chris, then listen for his approval before merging anything.
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" numDigits="1" timeout="6" speechTimeout="auto" action="${xmlEscape(approveUrl)}" method="GET">
    <Say voice="${pollyVoice}">${xmlEscape(buildQueueBrief(lead, queuedSeconds))}</Say>
  </Gather>
  <Redirect method="GET">${xmlEscape(approveUrl)}</Redirect>
</Response>`;
      console.log('[dialerVoiceHandler] → AI Queue Brief to advisor, conf:', conf);
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // ── Mode: AI Queue Approve — the closer answered the transfer call ──────
    // He heard the brief and either said "patch him through" / pressed 1, or
    // asked to hold off. Approve → his leg joins the queue conference (the merge).
    // Anything else → his leg ends and the caller stays queued for a fronter.
    if (params.get('Mode') === 'aiQueueApprove') {
      const okLeadId = params.get('LeadId') || '';
      const okConf = params.get('Conf') || '';
      let okConfig: any = {};
      try {
        const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
        const base44 = createClientFromRequest(req).asServiceRole;
        const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
        okConfig = configs?.[0] || {};
      } catch (e) { console.warn('[dialerVoiceHandler] Approve config load failed:', e?.message); }

      const speech = (params.get('SpeechResult') || '').toLowerCase();
      const digits = (params.get('Digits') || '').trim();
      const APPROVE = /(patch|through|connect|go ahead|bring (him|her|them) in|send (him|her|them|it)|yes|yeah|yep|sure|sounds good|okay|ok\b|do it|i got (him|her|them))/;
      const DECLINE = /(not now|not yet|can'?t|cannot|no thanks|no thank|busy|hold on|hold up|\bwait\b|call back|later|\bno\b)/;
      // No input or ambiguous speech must never silently merge the caller.
      // A spoken decline takes precedence even if the sentence also contains 'yes'.
      const approved = digits ? digits === '1'
        : (DECLINE.test(speech) ? false : APPROVE.test(speech));

      const okVoice = getPollyVoice(okConfig.ttsVoiceModel || 'aura-2-thalia-en');
      if (!approved) {
        console.log('[dialerVoiceHandler] → Closer declined the merge:', speech || digits || 'no input');
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${okVoice}">No problem. They will stay in the queue for the next available specialist. Thanks.</Say><Hangup/></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      const okBase = req.headers.get('X-Base44-App-Url') || 'https://rosieai-investorpage.base44.app';
      const okStatusUrl = `${okBase}/functions/dialerVoiceHandler?Mode=aiQueueMerged` +
        `&LeadId=${encodeURIComponent(okLeadId)}&Conf=${encodeURIComponent(okConf)}`;
      // Only an active queue can be merged. A caller in the appointment
      // speech-hold can be reclaimed into the *same* conference at pickup.
      try {
        const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
        const service = createClientFromRequest(req).asServiceRole;
        const matching = await service.entities.FronterHeadsUp.filter({ conferenceName: okConf, status: 'active' });
        const alert = matching?.[0];
        if (!alert || ['advisor_accepted', 'merged', 'appointment_booked'].includes(alert.routeState)) {
          return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>This caller is no longer waiting in the queue.</Say><Hangup/></Response>', { headers: { 'Content-Type': 'text/xml' } });
        }
        const callerSid = alert.customerCallSid || params.get('CallerCallSid') || '';
        if (!callerSid) throw new Error('Missing customer call SID');
        let alreadyWaiting = false;
        try {
          const confSid = await (async () => {
            const found = await twilioFetch(`/Conferences.json?FriendlyName=${encodeURIComponent(okConf)}&Status=in-progress`);
            return found.conferences?.[0]?.sid || '';
          })();
          if (confSid) {
            const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
            alreadyWaiting = (participants.participants || []).some((p: any) => p.call_sid === callerSid);
          }
        } catch {}
        if (!alreadyWaiting) {
          const holdUrl = `${okBase}/functions/dialerVoiceHandler?Mode=inboundHoldMusic`;
          const callerTwiml = `<Response><Dial><Conference startConferenceOnEnter="false" endConferenceOnExit="false" beep="false" waitUrl="${xmlEscape(holdUrl)}" waitMethod="GET">${xmlEscape(okConf)}</Conference></Dial></Response>`;
          await twilioFetch(`/Calls/${callerSid}.json`, {
            method: 'POST', body: new URLSearchParams({ Twiml: callerTwiml }),
          });
        }
        await service.entities.FronterHeadsUp.update(alert.id, { routeState: 'advisor_accepted' });
      } catch (e) {
        console.warn('[AI Queue] Cannot reclaim customer for merge:', e?.message);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>The caller is no longer available. The queue will stay open if they reconnect.</Say><Hangup/></Response>', { headers: { 'Content-Type': 'text/xml' } });
      }
      console.log('[dialerVoiceHandler] → Closer approved the merge:', speech || digits || 'no input');
      return new Response(queueMergeTwiml(okConf, okStatusUrl), { headers: { 'Content-Type': 'text/xml' } });
    }

    // ── Mode: AI Queue Merged — advisor + caller are now connected ──
    // Fired by the conference's start event: close the queue alert and mark the
    // lead transferred so fronters no longer see it as waiting.
    if (params.get('Mode') === 'aiQueueMerged') {
      const mergedLeadId = params.get('LeadId') || '';
      const conf = params.get('Conf') || '';
      if (mergedLeadId && conf) {
        try {
          const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
          const base44 = createClientFromRequest(req).asServiceRole;
          const headsUps = await base44.entities.FronterHeadsUp.filter({ conferenceName: conf, status: 'active' });
          const active = headsUps?.[0];
          if (active) {
            const joiningSid = params.get('ParticipantCallSid') || params.get('CallSid') || '';
            const customerSid = active.customerCallSid || params.get('CallerCallSid') || '';
            const event = String(params.get('StatusCallbackEvent') || '').toLowerCase();
            // The customer joining an empty conference is not a completed
            // transfer. Only advisor-side start/join confirms a live handoff.
            const isCustomerJoin = event.includes('join') && customerSid && joiningSid === customerSid;
            const isCustomerLeave = event.includes('leave') && customerSid && joiningSid === customerSid;
            if (isCustomerLeave && !['merged', 'appointment_booked'].includes(active.routeState)) {
              // The prospect has hung up; don't show a stale active queue card,
              // and cancel an orphan advisor call if one is still ringing.
              await base44.entities.FronterHeadsUp.update(active.id, {
                routeState:'queue_abandoned',status:'closed',
              });
              if (active.advisorCallSid) {
                try { await twilioFetch(`/Calls/${active.advisorCallSid}.json`, {
                  method:'POST',body:new URLSearchParams({Status:'completed'}),
                }); } catch {}
              }
            }
            if (isCustomerJoin && active.routeState === 'caller_queued' && Number(active.advisorAttempt || 0) === 0) {
              // Queue audio is already playing. Only now ring the primary
              // physical advisor line, then automatically the secondary.
              await base44.entities.FronterHeadsUp.update(active.id, {
                advisorAttempt:-1,routeState:'advisor_dialing',
              });
              const configRows = await base44.entities.AIAgentConfig.filter({configName:'default'});
              const config = configRows?.[0] || {};
              const appUrl = req.headers.get('X-Base44-App-Url') || 'https://rosieai-investorpage.base44.app';
              const started = await startAiAdvisorAttempt(base44, config, mergedLeadId, conf,
                customerSid, active.queueStartedAt || new Date().toISOString(), 1, appUrl);
              if (!started) {
                const second = await startAiAdvisorAttempt(base44, config, mergedLeadId, conf,
                  customerSid, active.queueStartedAt || new Date().toISOString(), 2, appUrl);
                if (!second) await preserveUnansweredAiCaller(base44, mergedLeadId, conf, active);
              }
            }
            // Only a confirmed ADVISOR conference join completes the merge.
            // A conference-start event or the waiting caller joining must
            // never mark the lead transferred.
            const isApprovedAdvisorJoin = event.includes('join') && !isCustomerJoin &&
              joiningSid && customerSid && joiningSid !== customerSid &&
              !isCustomerLeave && ['advisor_accepted','browser_ringing'].includes(active.routeState);
            if (isApprovedAdvisorJoin && !['merged', 'appointment_booked'].includes(active.routeState)) {
              await base44.entities.FronterHeadsUp.update(active.id, { routeState: 'merged', status: 'closed' });
              await base44.entities.FronterLead.update(mergedLeadId, {
                status: 'transferred', lastCallResult: 'transferred',
                callStatus: 'transferred', transferredAt: new Date().toISOString(),
                transferredTo: 'AI Agent → Senior Advisor',
              });
              // Browser pickup may win while Chris's phone is still ringing.
              // Cancel that orphan leg so he doesn't get a second transfer call.
              if (active.advisorCallSid && active.browserCallSid && joiningSid === active.browserCallSid) {
                try {
                  await twilioFetch(`/Calls/${active.advisorCallSid}.json`, {
                    method: 'POST', body: new URLSearchParams({ Status: 'completed' }),
                  });
                } catch (e) { console.warn('[AI Queue] Could not stop unused advisor leg:', e?.message); }
              }
            }
          }
        } catch (e) { console.warn('[dialerVoiceHandler] Merge status update failed:', e?.message); }
      }
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', { headers: { 'Content-Type': 'text/xml' } });
    }

    // ── Mode: Queue Hold Music loop ──────────────────────────────────────────
    // Plays the AI queue hold message, falling back to the standard queue hold
    // recording (the same one the merge popup plays) when nothing is uploaded.
    const inboundHoldMode = params.get('Mode') === 'inboundHoldMusic';
    if (inboundHoldMode) {
      let holdUrl = '';
      try {
        const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
        const base44 = createClientFromRequest(req).asServiceRole;
        const holdAudio = await base44.entities.InboundCallAudio.filter(
          { assetType: 'adam_transfer_hold', isActive: true }, '-uploadedAt', 1,
        );
        holdUrl = holdAudio?.[0]?.fileUrl || '';
        if (!holdUrl) {
          const queueHold = await base44.entities.FronterHoldAudio.filter({ isActive: true }, '-uploadedAt', 1);
          const fileUri = queueHold?.[0]?.fileUri || '';
          if (fileUri) {
            const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 3600 });
            holdUrl = signed?.signed_url || '';
          }
        }
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
      ...FRONTER_DIRECT_NUMBERS,
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
    // Only the selected AI line routes to the Media Stream when enabled.
    // All other numbers keep their standard browser-dialer routing.
    const calledNumber = (called || to || '').replace(/\s/g, '');
    // Lines that must ring the /fronter dialer instead of being answered by the AI agent
    const ringFronterDialer = FRONTER_DIRECT_NUMBERS.includes(calledNumber);

    try {
      const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.52');
      const base44 = createClientFromRequest(req).asServiceRole;

      // If the AI agent is active, route ALL inbound calls through the greeting
      // pipeline (Prompt 1-2): lead lookup → dynamic audio clips (name + regional +
      // admin master) → connect Adam AI agent Media Stream.
      const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
      const aiConfig = configs?.[0];
      // Do not use lineNumber() here: that helper falls back to the default
      // line if a configured environment key is missing, taking the wrong line.
      const aiLineKey = String(aiConfig?.twilioLineKey || '');
      const configuredAiNumber = aiLineKey.startsWith('+') ? aiLineKey : (aiLineKey ? Deno.env.get(aiLineKey) || '' : '');
      const normalizeLine = (number: string) => String(number || '').replace(/\D/g, '');
      const agentOwnsLine = !!(aiConfig?.isActive && configuredAiNumber &&
        normalizeLine(configuredAiNumber) === normalizeLine(calledNumber));

      // ── First ring: the super admin's own phone ─────────────────────────
      // A call to a fronter-direct line rings the admin's browser handset and
      // keeps the caller on ringback for two rings. If nobody answers, the Dial
      // action re-enters this handler in takeover mode and the AI agent answers
      // on the third ring.
      const aiTakeover = params.get('Mode') === 'inboundAiTakeover';
      if (agentOwnsLine && ringFronterDialer && !aiTakeover) {
        let firstRingIds: string[] = [];
        try {
          const assignments = await base44.entities.FronterLineAssignment.filter({ twilioNumber: calledNumber });
          const assignment = assignments?.items?.[0] || assignments?.[0];
          if (assignment?.username) {
            firstRingIds = [assignment.username];
          } else {
            const admins = await base44.entities.DebtCoachUser.filter({ role: 'super_admin', isActive: true });
            firstRingIds = (admins || []).map((a: any) => `${a.username}_inbound`);
          }
        } catch (e) { console.warn('[dialerVoiceHandler] First-ring lookup failed:', e?.message); }
        firstRingIds = [...new Set(firstRingIds
          .filter(Boolean)
          .map((u: string) => u.replace(/[^a-zA-Z0-9_]/g, '_')))].slice(0, 10);

        if (firstRingIds.length) {
          const takeoverUrl =
            `${req.headers.get('X-Base44-App-Url') || 'https://rosieai-investorpage.base44.app'}` +
            `/functions/dialerVoiceHandler?Mode=inboundAiTakeover`;
          const ringStatusUrl = `${vmWebhookBase}?statusCb=true&StatusCallbackEvent=initiated+ringing+answered+completed`;
          const ringNouns = firstRingIds
            .map((id: string) => `<Client statusCallback="${xmlEscape(ringStatusUrl)}" statusCallbackMethod="POST"
      statusCallbackEvent="initiated ringing answered completed">${xmlEscape(id)}</Client>`)
            .join('\n    ');
          const ringTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="12" answerOnBridge="true" action="${xmlEscape(takeoverUrl)}" method="POST">
    ${ringNouns}
  </Dial>
</Response>`;
          console.log('[dialerVoiceHandler] → Mode 4 Inbound → super-admin first ring:', firstRingIds.join(', '), '— AI agent takes the call on the third ring');
          return new Response(ringTwiml, { headers: { 'Content-Type': 'text/xml' } });
        }
      }

      // If the AI agent is active, route ALL inbound calls through the greeting
      // pipeline (Prompt 1-2): lead lookup → dynamic audio clips (name + regional +
      // admin master) → connect Adam AI agent Media Stream. Takeover mode is the
      // third-ring fallback after the admin's phone rang twice.
      if (agentOwnsLine && (!ringFronterDialer || aiTakeover)) {
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
          const ringStartedAt = Date.now();

          // ── Prompt 1: Lead lookup by caller ID ──
          const callerPhone = params.get('From') || '';
          const { client_name, region, leadId: foundLeadId, lead: foundLead, leadType } = await lookupInboundLead(base44, callerPhone);

          // Ensure a FronterLead exists for the inbound caller (Adam will populate it).
          // Only a FronterLead match may be reused: a Debt Call Coach (or no) match gets
          // a fresh card, otherwise the agent has no inbound card to work from and
          // falls back to the outbound language.
          let inboundLeadId = leadType === 'fronter' && foundLeadId ? foundLeadId : '';
          if (!inboundLeadId && callerPhone) {
            try {
              const [inboundNoticeId] = await assignNoticeIds(base44, 1);
              const created = await base44.entities.FronterLead.create({
                noticeId: inboundNoticeId,
                firstName: 'Inbound',
                lastName: 'Caller',
                phone: callerPhone,
                status: 'prospect',
                callStatus: 'inbound_adam',
                inboundAdamCall: true,
                inboundRegion: region,
                assignedQueue: 'Incoming AI - validated through process',
                notes: `Inbound call from ${callerPhone} on ${new Date().toISOString()}. Awaiting AI agent qualification.`,
              });
              inboundLeadId = created?.id || '';
            } catch (e) { console.warn('[dialerVoiceHandler] Failed to create inbound lead:', e?.message); }
          } else if (inboundLeadId && foundLead) {
            // Mark existing lead as an inbound Adam call
            try {
              await base44.entities.FronterLead.update(inboundLeadId, {
                callStatus: 'inbound_adam',
                inboundAdamCall: true,
                inboundRegion: region,
                assignedQueue: 'Incoming AI - validated through process',
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

          // Ring twice, then the agent answers on the third ring: Twilio keeps the
          // caller on ringback while this response is pending, so it is held for the
          // two rings — never longer, whatever the greeting work above already took
          // counts toward them.
          const ringRemaining = aiTakeover ? 0 : INBOUND_RING_DELAY_MS - (Date.now() - ringStartedAt);
          if (ringRemaining > 0) {
            await new Promise(r => setTimeout(r, ringRemaining));
          }

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

      // Fallback: ring the browser dialer(s) in /fronter.
      // An assigned line rings that fronter's own dialer; a direct-ring line that
      // is not assigned yet rings the inbound dialer the super admins keep on screen.
      let clientIdentities: string[] = [];
      const assignments = await base44.entities.FronterLineAssignment.filter({ twilioNumber: calledNumber });
      const assignment = assignments?.items?.[0] || assignments?.[0];
      if (assignment?.username) {
        clientIdentities = [assignment.username];
      } else if (ringFronterDialer) {
        const admins = await base44.entities.DebtCoachUser.filter({ role: 'super_admin', isActive: true });
        clientIdentities = (admins || []).map((a: any) => `${a.username}_inbound`);
      }
      clientIdentities = [...new Set(clientIdentities
        .filter(Boolean)
        .map((u: string) => u.replace(/[^a-zA-Z0-9_]/g, '_')))].slice(0, 10);
      if (!clientIdentities.length) clientIdentities = ['agent'];

      const statusCallbackUrl =
        `${vmWebhookBase}?statusCb=true` +
        `&StatusCallbackEvent=initiated+ringing+answered+completed`;
      const clientNouns = clientIdentities
        .map((id: string) => `<Client statusCallback="${xmlEscape(statusCallbackUrl)}" statusCallbackMethod="POST"
      statusCallbackEvent="initiated ringing answered completed">${xmlEscape(id)}</Client>`)
        .join('\n    ');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20"
    action="${vmWebhookBase}?noAnswer=true" method="POST"
    >
    ${clientNouns}
  </Dial>
</Response>`;
      console.log('[dialerVoiceHandler] → Mode 4 Inbound → ringing browser dialers:', clientIdentities.join(', '), '(to:', to, 'called:', called, ')');
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