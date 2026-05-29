/**
 * voicemailWebhook
 * Called by Twilio when:
 *   1. <Dial action> fires after no-answer → play greeting + record
 *   2. Recording complete → store voicemail in DB
 */

const DEFAULT_VM_GREETING = "Hi, you've reached us. We're unavailable right now. Please leave your message after the beep and we'll call you back shortly.";

Deno.serve(async (req) => {
  try {
    const APP_ID        = Deno.env.get('BASE44_APP_ID')        || '';
    const SERVICE_TOKEN = Deno.env.get('BASE44_SERVICE_TOKEN') || '';
    const vmWebhookBase = `https://run.base44.com/apps/${APP_ID}/functions/voicemailWebhook`;

    const b44Fetch = (path, opts = {}) => fetch(
      `https://api.base44.com/api/apps/${APP_ID}/entities/${path}`,
      { ...opts, headers: { 'Authorization': `Bearer ${SERVICE_TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } }
    );
    const b44Filter = async (entity, filters) => {
      const r = await b44Fetch(`${entity}?filters=${encodeURIComponent(JSON.stringify(filters))}`);
      const d = await r.json();
      return Array.isArray(d) ? d : (d?.items || []);
    };
    const b44Create = (entity, data) => b44Fetch(entity, { method: 'POST', body: JSON.stringify(data) });
    const b44Update = (entity, id, data) => b44Fetch(`${entity}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

    const urlParams = new URL(req.url).searchParams;

    let bodyText = '';
    if (req.method === 'POST') {
      try { bodyText = await req.text(); } catch {}
    }
    const bodyParams = new URLSearchParams(bodyText);

    const noAnswer       = urlParams.get('noAnswer') === 'true' || bodyParams.get('noAnswer') === 'true';
    const dialCallStatus = bodyParams.get('DialCallStatus') || '';
    const callSid        = bodyParams.get('CallSid') || '';
    const recordingUrl   = bodyParams.get('RecordingUrl') || '';

    console.log('[voicemailWebhook] noAnswer:', noAnswer, 'DialCallStatus:', dialCallStatus, 'CallSid:', callSid, 'RecordingUrl:', !!recordingUrl);

    // ── 1. noAnswer: play greeting + start recording ──────────────────────────
    if (noAnswer) {
      // If agent actually answered and then hung up, skip voicemail
      if (dialCallStatus === 'completed') {
        console.log('[voicemailWebhook] Agent answered then hung up — skipping voicemail');
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { 'Content-Type': 'text/xml' }
        });
      }

      // Fetch custom greeting from PortalSettings (with timeout)
      let greetingTwiml = `<Say voice="alice">${DEFAULT_VM_GREETING}</Say>`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const r = await b44Filter('PortalSettings', {});
        clearTimeout(timer);
        const settings = r?.[0];
        if (settings?.vmAudioUrl) {
          greetingTwiml = `<Play>${settings.vmAudioUrl}</Play>`;
        } else if (settings?.vmGreeting) {
          greetingTwiml = `<Say voice="alice">${settings.vmGreeting}</Say>`;
        }
      } catch (e) {
        console.log('[voicemailWebhook] Could not fetch settings, using default:', e.message);
      }

      console.log('[voicemailWebhook] No answer — playing greeting and recording');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingTwiml}
  <Record maxLength="120" playBeep="true" transcribe="true" transcribeCallback="${vmWebhookBase}" action="${vmWebhookBase}" method="POST" />
  <Say voice="alice">We did not receive a recording. Goodbye.</Say>
</Response>`;
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // ── 2. Recording complete: save voicemail to DB ───────────────────────────
    if (recordingUrl) {
      const vmUrl         = recordingUrl.endsWith('.mp3') ? recordingUrl : recordingUrl + '.mp3';
      const transcription = bodyParams.get('TranscriptionText') || '';
      const from          = bodyParams.get('From') || bodyParams.get('Caller') || '';
      const to            = bodyParams.get('To') || bodyParams.get('Called') || '';

      console.log('[voicemailWebhook] Recording received — saving to DB');

      // Match caller to lead/investor
      let callerName = '', leadId = '', investorId = '';
      if (from) {
        const digits = from.replace(/\D/g, '');
        try {
          const investors = await b44Filter('InvestorUser', {});
          const inv = investors.find(u => (u.phone || '').replace(/\D/g, '').slice(-10) === digits.slice(-10));
          if (inv) { callerName = inv.name; investorId = inv.id; }
        } catch {}
        if (!callerName) {
          try {
            const leads = await b44Filter('Lead', {});
            const lead = leads.find(l => (l.phone || '').replace(/\D/g, '').slice(-10) === digits.slice(-10));
            if (lead) { callerName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim(); leadId = lead.id; }
          } catch {}
        }
      }

      const existingLogs = await b44Filter('CallLog', { callSid }).catch(() => []);
      const existing = existingLogs?.[0] || null;
      const now = new Date().toISOString();

      if (existing) {
        await b44Update('CallLog', existing.id, { status: 'voicemail', vmRecordingUrl: vmUrl, vmTranscription: transcription, vmListened: false });
      } else {
        await b44Create('CallLog', { callSid, direction: 'inbound', fromNumber: from, toNumber: to, callerName, leadId, investorId, status: 'voicemail', durationSeconds: 0, calledAt: now, vmRecordingUrl: vmUrl, vmTranscription: transcription, vmListened: false, dismissed: false });
      }

      if (leadId) {
        await b44Create('LeadHistory', { leadId, type: 'voicemail', content: `📩 Voicemail — ${transcription ? '"' + transcription.slice(0, 200) + '"' : 'No transcription'}`, createdBy: 'system' }).catch(() => {});
      }

      return new Response('OK', { status: 200 });
    }

    // ── 3. Anything else (status callback, etc.) — just ack ──────────────────
    console.log('[voicemailWebhook] Unhandled callback — acking');
    return new Response('OK', { status: 200 });

  } catch (e) {
    console.error('[voicemailWebhook] Fatal error:', e.message);
    // Always return valid TwiML so Twilio doesn't show "application error"
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are unable to take your call right now. Goodbye.</Say></Response>', {
      headers: { 'Content-Type': 'text/xml' }, status: 200
    });
  }
});