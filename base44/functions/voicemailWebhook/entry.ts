/**
 * voicemailWebhook
 * 1. noAnswer=true  — <Dial> action: return TwiML INSTANTLY (no DB calls)
 * 2. RecordingUrl   — recording done: save voicemail to CallLog
 * 3. Status cb      — log call status to CallLog
 *
 * RULE: noAnswer branch does ZERO async work. Twilio times out in 8-10s.
 * Custom greeting lives in BASE44_VM_AUDIO_URL env var OR BASE44_VM_GREETING.
 * Dashboard writes to PortalSettings — a separate sync job (or manual env update)
 * can mirror that, but the webhook itself reads from env for speed.
 */

const DEFAULT_VM_GREETING = "Hi, you've reached Newport Beach Tech Acquisitions. We're unavailable right now. Please leave your message after the beep and we'll call you back shortly.";

// Direct Base44 REST helpers — no SDK cold-start overhead
const b44Fetch = (appId, token, path, opts = {}) =>
  fetch(`https://api.base44.com/api/apps/${appId}/entities/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });

const b44List = async (appId, token, entity, filters = {}) => {
  const qs = Object.keys(filters).length ? `?filters=${encodeURIComponent(JSON.stringify(filters))}` : '';
  const r = await b44Fetch(appId, token, `${entity}${qs}`);
  const t = await r.text();
  try { const d = JSON.parse(t); return Array.isArray(d) ? d : (d?.items || []); } catch { return []; }
};
const b44Create = (appId, token, entity, data) =>
  b44Fetch(appId, token, entity, { method: 'POST', body: JSON.stringify(data) });
const b44Update = (appId, token, entity, id, data) =>
  b44Fetch(appId, token, `${entity}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

Deno.serve(async (req) => {
  const APP_ID  = Deno.env.get('BASE44_APP_ID')        || '';
  const TOKEN   = Deno.env.get('BASE44_SERVICE_TOKEN') || '';
  const VM_BASE = `https://investors.rosieai.tech/functions/voicemailWebhook`;

  const urlParams = new URL(req.url).searchParams;
  const noAnswer  = urlParams.get('noAnswer') === 'true';

  // ── 1. noAnswer: return TwiML INSTANTLY ─────────────────────────────────
  if (noAnswer) {
    try {
      let bodyParams = new URLSearchParams();
      try { bodyParams = new URLSearchParams(await req.text()); } catch {}

      const dialStatus = bodyParams.get('DialCallStatus') || '';
      console.log('[voicemailWebhook] noAnswer, DialCallStatus:', dialStatus);

      // Agent actually answered — just ack, no voicemail
      if (dialStatus === 'completed' || dialStatus === 'answered') {
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { headers: { 'Content-Type': 'text/xml' } });
      }

      // Read greeting from env vars (set once from dashboard, or manually)
      // VM_AUDIO_URL takes priority over VM_GREETING_TEXT
      const vmAudioUrl  = Deno.env.get('VM_AUDIO_URL')     || '';
      const vmGreeting  = Deno.env.get('VM_GREETING_TEXT') || DEFAULT_VM_GREETING;
      const greetingTwiml = vmAudioUrl
        ? `<Play>${vmAudioUrl}</Play>`
        : `<Say voice="alice">${vmGreeting}</Say>`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingTwiml}
  <Record maxLength="120" playBeep="true" transcribe="true"
    transcribeCallback="${VM_BASE}"
    action="${VM_BASE}" method="POST" />
  <Say voice="alice">We did not receive a recording. Goodbye.</Say>
</Response>`;
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });

    } catch (e) {
      console.error('[voicemailWebhook] noAnswer fatal:', e.message);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${DEFAULT_VM_GREETING}</Say><Record maxLength="120" playBeep="true" /></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }
  }

  // ── 2 & 3. Recording complete or status callback ─────────────────────────
  try {
    let bodyParams = new URLSearchParams();
    try { bodyParams = new URLSearchParams(await req.text()); } catch {}

    const callSid       = bodyParams.get('CallSid')           || '';
    const callStatus    = bodyParams.get('CallStatus')        || '';
    const direction     = bodyParams.get('Direction')         || 'inbound';
    const from          = bodyParams.get('From')              || bodyParams.get('Caller') || '';
    const to            = bodyParams.get('To')                || bodyParams.get('Called') || '';
    const duration      = parseInt(bodyParams.get('CallDuration') || bodyParams.get('Duration') || '0', 10);
    const recordingUrl  = bodyParams.get('RecordingUrl')      || '';
    const transcription = bodyParams.get('TranscriptionText') || '';

    console.log('[voicemailWebhook] callSid:', callSid, 'status:', callStatus, 'recording:', !!recordingUrl);

    if (!APP_ID || !TOKEN) {
      console.error('[voicemailWebhook] Missing BASE44_APP_ID or BASE44_SERVICE_TOKEN');
      return new Response('OK', { status: 200 });
    }

    // Match caller to lead or investor
    let callerName = '', leadId = '', investorId = '';
    if (from) {
      const digits  = from.replace(/\D/g, '');
      const plain10 = digits.slice(-10);
      try {
        const investors = await b44List(APP_ID, TOKEN, 'InvestorUser', {});
        const inv = investors.find(u => {
          const p = (u.phone || '').replace(/\D/g, '');
          return p === digits || p.slice(-10) === plain10;
        });
        if (inv) { callerName = inv.name || ''; investorId = inv.id; }
      } catch {}
      if (!callerName) {
        try {
          const leads = await b44List(APP_ID, TOKEN, 'Lead', {});
          const lead  = leads.find(l => {
            const p = (l.phone || '').replace(/\D/g, '');
            return p === digits || p.slice(-10) === plain10;
          });
          if (lead) {
            callerName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
            leadId     = lead.id;
          }
        } catch {}
      }
    }

    // Find existing CallLog for this CallSid
    const existing = callSid
      ? ((await b44List(APP_ID, TOKEN, 'CallLog', { callSid }).catch(() => []))[0] || null)
      : null;
    const now = new Date().toISOString();

    // ── Recording complete — save voicemail ──────────────────────────────
    if (recordingUrl) {
      const vmUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : recordingUrl + '.mp3';
      if (existing) {
        await b44Update(APP_ID, TOKEN, 'CallLog', existing.id, {
          status: 'voicemail',
          vmRecordingUrl: vmUrl,
          vmTranscription: transcription || '',
          vmListened: false,
          dismissed: false,
          callerName: callerName || existing.callerName || '',
          leadId:     leadId     || existing.leadId     || '',
          investorId: investorId || existing.investorId || '',
        });
      } else {
        await b44Create(APP_ID, TOKEN, 'CallLog', {
          callSid, direction: 'inbound', fromNumber: from, toNumber: to,
          callerName, leadId, investorId,
          status: 'voicemail', durationSeconds: duration,
          calledAt: now, vmRecordingUrl: vmUrl,
          vmTranscription: transcription || '',
          vmListened: false, dismissed: false,
        });
      }
      if (leadId) {
        await b44Create(APP_ID, TOKEN, 'LeadHistory', {
          leadId, type: 'voicemail',
          content: `📩 Voicemail — ${transcription ? '"' + transcription.slice(0, 200) + '"' : 'No transcription'}`,
          createdBy: 'system',
        }).catch(() => {});
      }
      return new Response('OK', { status: 200 });
    }

    // ── Status callback — log call ───────────────────────────────────────
    const STATUS_MAP: Record<string, string> = {
      completed: 'completed', 'no-answer': 'missed',
      busy: 'missed', failed: 'missed', canceled: 'missed',
    };
    const logStatus = STATUS_MAP[callStatus] || 'ringing';

    if (existing) {
      await b44Update(APP_ID, TOKEN, 'CallLog', existing.id, {
        status: logStatus,
        durationSeconds: duration || existing.durationSeconds || 0,
        callerName: callerName || existing.callerName || '',
        leadId:     leadId     || existing.leadId     || '',
        investorId: investorId || existing.investorId || '',
      });
    } else if (callSid) {
      await b44Create(APP_ID, TOKEN, 'CallLog', {
        callSid, direction: direction.toLowerCase().includes('inbound') ? 'inbound' : 'outbound',
        fromNumber: from, toNumber: to,
        callerName, leadId, investorId,
        status: logStatus, durationSeconds: duration,
        calledAt: now, dismissed: false,
      });
    }

    return new Response('OK', { status: 200 });

  } catch (e) {
    console.error('[voicemailWebhook] error:', e.message);
    return new Response('OK', { status: 200 });
  }
});