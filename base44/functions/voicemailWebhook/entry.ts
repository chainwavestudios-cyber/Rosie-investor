/**
 * voicemailWebhook
 * Called by Twilio when:
 *   1. noAnswer=true  — <Dial> action callback, no one answered → play greeting + record
 *   2. RecordingUrl present — recording complete → store voicemail in DB
 *   3. Status callback — call status update → log call record in DB
 */

const DEFAULT_VM_GREETING = "Hi, you've reached us. We're unavailable right now. Please leave your message after the beep and we'll call you back shortly.";

const APP_ID       = Deno.env.get('BASE44_APP_ID')        || '';
const SERVICE_TOKEN = Deno.env.get('BASE44_SERVICE_TOKEN') || '';

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

Deno.serve(async (req) => {
  const urlParams = new URL(req.url).searchParams;

  // Read body once upfront (safe for both GET and POST)
  let bodyText = '';
  if (req.method === 'POST') {
    try { bodyText = await req.text(); } catch {}
  }
  const bodyParams = new URLSearchParams(bodyText);

  console.log('[voicemailWebhook] method:', req.method,
    'noAnswer(url):', urlParams.get('noAnswer'),
    'noAnswer(body):', bodyParams.get('noAnswer'),
    'DialCallStatus:', bodyParams.get('DialCallStatus'),
    'CallStatus:', bodyParams.get('CallStatus'),
    'RecordingUrl:', bodyParams.get('RecordingUrl') ? 'YES' : 'NO');

  const vmWebhookBase = `https://run.base44.com/apps/${APP_ID}/functions/voicemailWebhook`;

  // ── noAnswer branch ────────────────────────────────────────────────────────
  // Triggered by <Dial action="...?noAnswer=true"> when the browser client
  // doesn't answer. Must return TwiML fast (Twilio 8s timeout).
  const isNoAnswer = urlParams.get('noAnswer') === 'true' || bodyParams.get('noAnswer') === 'true';
  const dialCallStatus = bodyParams.get('DialCallStatus') || '';

  if (isNoAnswer) {
    // If the call was actually answered (agent picked up then hung up), skip voicemail
    if (dialCallStatus === 'completed') {
      console.log('[voicemailWebhook] DialCallStatus=completed — call was answered, skipping voicemail');
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
    }

    console.log('[voicemailWebhook] noAnswer branch — DialCallStatus:', dialCallStatus);

    // Try to load custom greeting (with tight timeout to stay under Twilio's 8s limit)
    let greetingTwiml = `<Say voice="alice">${DEFAULT_VM_GREETING}</Say>`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000); // 3s max
      const settingsRes = await fetch(
        `https://api.base44.com/api/apps/${APP_ID}/entities/PortalSettings?filters=${encodeURIComponent(JSON.stringify({ key: 'main' }))}`,
        { headers: { 'Authorization': `Bearer ${SERVICE_TOKEN}` }, signal: ctrl.signal }
      );
      clearTimeout(timer);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const ps = Array.isArray(data) ? data[0] : data?.items?.[0];
        if (ps?.vmAudioUrl) {
          greetingTwiml = `<Play>${ps.vmAudioUrl}</Play>`;
          console.log('[voicemailWebhook] Using custom audio URL');
        } else if (ps?.vmGreeting) {
          greetingTwiml = `<Say voice="alice">${ps.vmGreeting}</Say>`;
          console.log('[voicemailWebhook] Using custom text greeting');
        }
      }
    } catch (e) {
      console.log('[voicemailWebhook] Settings fetch failed/timed out, using default greeting:', e?.message);
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingTwiml}
  <Record maxLength="120" playBeep="true" transcribe="true" transcribeCallback="${vmWebhookBase}" action="${vmWebhookBase}" method="POST" />
  <Say voice="alice">We did not receive a recording. Goodbye.</Say>
</Response>`;

    console.log('[voicemailWebhook] Returning voicemail TwiML');
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // ── Recording complete / status callback ───────────────────────────────────
  try {
    const callSid       = bodyParams.get('CallSid')           || '';
    const callStatus    = bodyParams.get('CallStatus')        || '';
    const direction     = bodyParams.get('Direction')         || 'inbound';
    const from          = bodyParams.get('From')              || bodyParams.get('Caller') || '';
    const to            = bodyParams.get('To')                || bodyParams.get('Called') || '';
    const duration      = parseInt(bodyParams.get('CallDuration') || bodyParams.get('Duration') || '0', 10);
    const recordingUrl  = bodyParams.get('RecordingUrl')      || '';
    const transcription = bodyParams.get('TranscriptionText') || '';

    console.log('[voicemailWebhook] Recording/Status branch — CallSid:', callSid, 'Status:', callStatus, 'RecordingUrl:', recordingUrl ? 'YES' : 'NO');

    // Match caller to a lead or investor
    let callerName = '';
    let leadId = '';
    let investorId = '';

    if (from) {
      const digits  = from.replace(/\D/g, '');
      const plain10 = digits.slice(-10);

      try {
        const investors = await b44Filter('InvestorUser', {});
        const inv = investors.find(u => {
          const p = (u.phone || '').replace(/\D/g, '');
          return p === digits || p.slice(-10) === plain10;
        });
        if (inv) { callerName = inv.name; investorId = inv.id; }
      } catch {}

      if (!callerName) {
        try {
          const leads = await b44Filter('Lead', {});
          const lead = leads.find(l => {
            const p = (l.phone || '').replace(/\D/g, '');
            return p === digits || p.slice(-10) === plain10;
          });
          if (lead) {
            callerName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
            leadId = lead.id;
          }
        } catch {}
      }
    }

    const existingLogs = await b44Filter('CallLog', { callSid }).catch(() => []);
    const existing = existingLogs?.[0] || null;
    const now = new Date().toISOString();

    // Recording callback — store voicemail
    if (recordingUrl) {
      const vmUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : recordingUrl + '.mp3';
      if (existing) {
        await b44Update('CallLog', existing.id, {
          status: 'voicemail',
          vmRecordingUrl: vmUrl,
          vmTranscription: transcription || '',
          vmListened: false,
          durationSeconds: duration || existing.durationSeconds || 0,
        });
      } else {
        await b44Create('CallLog', {
          callSid,
          direction: 'inbound',
          fromNumber: from,
          toNumber: to,
          callerName,
          leadId,
          investorId,
          status: 'voicemail',
          durationSeconds: duration,
          calledAt: now,
          vmRecordingUrl: vmUrl,
          vmTranscription: transcription || '',
          vmListened: false,
          dismissed: false,
        });
      }

      if (leadId) {
        await b44Create('LeadHistory', {
          leadId,
          type: 'voicemail',
          content: `📩 Voicemail left — ${transcription ? '"' + transcription.slice(0, 200) + '"' : 'No transcription available'}`,
          createdBy: 'system',
        }).catch(() => {});
      }

      return new Response('OK', { status: 200 });
    }

    // Status callback — log the call
    const statusMap = {
      'completed': 'completed',
      'no-answer': 'missed',
      'busy':      'missed',
      'failed':    'missed',
      'canceled':  'missed',
    };
    const logStatus = statusMap[callStatus] || 'ringing';

    if (existing) {
      await b44Update('CallLog', existing.id, {
        status: logStatus,
        durationSeconds: duration || existing.durationSeconds || 0,
      });
    } else if (callSid) {
      await b44Create('CallLog', {
        callSid,
        direction: direction.toLowerCase().includes('inbound') ? 'inbound' : 'outbound',
        fromNumber: from,
        toNumber: to,
        callerName,
        leadId,
        investorId,
        status: logStatus,
        durationSeconds: duration,
        calledAt: now,
        dismissed: false,
      });
    }

    return new Response('OK', { status: 200 });

  } catch (e) {
    console.error('[voicemailWebhook] Error:', e.message);
    return new Response('OK', { status: 200 });
  }
});