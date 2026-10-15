/**
 * voicemailWebhook
 * 1. noAnswer=true  — <Dial> action callback:
 *      a. dialStatus=completed/answered → agent answered → save CallLog as "answered"
 *      b. dialStatus=no-answer/busy/failed → play greeting, record voicemail
 * 2. RecordingUrl   — recording done: save voicemail to CallLog
 * 3. Status cb      — log call status to CallLog (used by inbound statusCallback)
 *
 * RULE: noAnswer branch must return TwiML quickly. DB work for answered calls
 * is fire-and-forget (no await before returning TwiML).
 */

import twilioVoiceParams from '../../shared/twilioVoiceParams.ts';

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

// Resolve caller name/leadId/investorId from a phone number
async function resolveCallerName(appId, token, from) {
  let callerName = '', leadId = '', investorId = '';
  if (!from) return { callerName, leadId, investorId };
  const digits  = from.replace(/\D/g, '');
  const plain10 = digits.slice(-10);
  try {
    const investors = await b44List(appId, token, 'InvestorUser', {});
    const inv = investors.find(u => {
      const p = (u.phone || '').replace(/\D/g, '');
      return p === digits || p.slice(-10) === plain10;
    });
    if (inv) { callerName = inv.name || ''; investorId = inv.id; }
  } catch {}
  if (!callerName) {
    try {
      const leads = await b44List(appId, token, 'Lead', {});
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
  return { callerName, leadId, investorId };
}

export default async function(req) {
  const APP_ID  = Deno.env.get('BASE44_APP_ID')        || '';
  const TOKEN   = Deno.env.get('BASE44_SERVICE_TOKEN') || '';
  const VM_BASE = `${req.headers.get('X-Base44-App-Url') || 'https://rosieai-investorpage.base44.app'}/functions/voicemailWebhook`;
  let bodyParams;
  try { bodyParams = await twilioVoiceParams(req); }
  catch { return new Response('<Response><Hangup/></Response>', { headers: { 'Content-Type': 'text/xml' } }); }
  const noAnswer = bodyParams.get('noAnswer') === 'true';

  // ── 1. noAnswer: <Dial> action callback ─────────────────────────────────
  if (noAnswer) {

    const dialStatus = bodyParams.get('DialCallStatus') || '';
    const callSid    = bodyParams.get('CallSid')        || '';
    const from       = bodyParams.get('From')           || bodyParams.get('Caller') || '';
    const to         = bodyParams.get('To')             || bodyParams.get('Called') || '';
    const duration   = parseInt(bodyParams.get('DialCallDuration') || bodyParams.get('CallDuration') || '0', 10);

    console.log('[voicemailWebhook] noAnswer, DialCallStatus:', dialStatus, 'CallSid:', callSid);

    // A browser-originated call is outbound even though Twilio labels its
    // parent leg "inbound". Never play our inbound voicemail to the fronter.
    const isOutbound = from.startsWith('client:') || bodyParams.get('outbound') === 'true';
    if (isOutbound && dialStatus !== 'completed' && dialStatus !== 'answered') {
      const message = dialStatus === 'busy'
        ? 'The number you dialed is busy. Please try again later.'
        : dialStatus === 'no-answer'
          ? 'The number you dialed did not answer.'
          : 'The outgoing call could not connect. Please check the destination number and try again.';
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>${message}</Say><Hangup/></Response>`,
        { headers: { 'Content-Type': 'text/xml' } });
    }

    // Fronter hold/merge: the customer leg was moved into fronter_conf_<CallSid>,
    // which ends this <Dial>. Put the fronter into that conference instead of hanging up.
    if (callSid && (dialStatus === 'completed' || dialStatus === 'answered')) {
      const confName = `fronter_conf_${callSid}`;
      const sid = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
      const tok = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
      for (let i = 0; i < 6; i++) {
        try {
          const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Conferences.json?FriendlyName=${encodeURIComponent(confName)}`, {
            headers: { Authorization: 'Basic ' + btoa(`${sid}:${tok}`) },
          });
          const d = await r.json();
          if ((d.conferences || []).some((c: any) => c.status !== 'completed')) {
            console.log('[voicemailWebhook] Fronter joining conference:', confName);
            return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial><Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false">${confName}</Conference></Dial></Response>`,
              { headers: { 'Content-Type': 'text/xml' } });
          }
        } catch {}
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Agent answered — log as "answered" and return empty TwiML immediately.
    // DB write is fire-and-forget so Twilio doesn't time out waiting.
    if (dialStatus === 'completed' || dialStatus === 'answered') {
      if (APP_ID && TOKEN && callSid) {
        (async () => {
          try {
            const now = new Date().toISOString();
            const { callerName, leadId, investorId } = await resolveCallerName(APP_ID, TOKEN, from);
            const existing = (await b44List(APP_ID, TOKEN, 'CallLog', { callSid }).catch(() => []))[0] || null;
            if (existing) {
              // Don't overwrite a more terminal status (completed/voicemail) with "answered"
              const terminalStatuses = ['completed', 'voicemail'];
              const newStatus = terminalStatuses.includes(existing.status) ? existing.status : 'answered';
              await b44Update(APP_ID, TOKEN, 'CallLog', existing.id, {
                status: newStatus,
                durationSeconds: duration || existing.durationSeconds || 0,
                answeredAt: now,
                callerName: callerName || existing.callerName || '',
                leadId:     leadId     || existing.leadId     || '',
                investorId: investorId || existing.investorId || '',
              });
            } else {
              await b44Create(APP_ID, TOKEN, 'CallLog', {
                callSid, direction: 'inbound', fromNumber: from, toNumber: to,
                callerName, leadId, investorId,
                status: 'answered', durationSeconds: duration,
                calledAt: now, answeredAt: now, dismissed: false,
              });
            }
            console.log('[voicemailWebhook] Logged answered inbound call:', callSid);
          } catch (e) {
            console.error('[voicemailWebhook] Failed to log answered call:', e.message);
          }
        })();
      } else if (!APP_ID || !TOKEN) {
        console.error('[voicemailWebhook] Missing BASE44_APP_ID or BASE44_SERVICE_TOKEN — cannot log answered call');
      }
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } });
    }

    // No answer / busy / failed → AI Scheduling Agent conversation
    // Instead of recording a voicemail, the AI agent asks the caller to
    // schedule a 15-minute follow-up call, checks Chris's Google Calendar,
    // and books the appointment — all via Twilio <Gather> speech.
    try {
      const scheduleAgentUrl = VM_BASE.replace('voicemailWebhook', 'aiScheduleAgent');
      const greeting = "Chris is currently on another call with a client. What time today would be a good time to follow up?";

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${greeting}</Say>
  <Gather input="speech" speechTimeout="auto" action="${scheduleAgentUrl}" method="POST" language="en-US" enhanced="true" speechModel="conversational" />
  <Say voice="Polly.Joanna-Neural">I didn't catch that. I'll try again later. Have a great day!</Say>
  <Hangup/>
</Response>`;
      console.log('[voicemailWebhook] → AI Scheduling Agent for no-answer call');
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });

    } catch (e) {
      console.error('[voicemailWebhook] Scheduling agent greeting fatal:', e.message);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${DEFAULT_VM_GREETING}</Say><Record maxLength="120" playBeep="true" /></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }
  }

  // ── 2 & 3. Recording complete or status callback ─────────────────────────
  try {
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
      console.error('[voicemailWebhook] Missing BASE44_APP_ID or BASE44_SERVICE_TOKEN — cannot write CallLog');
      return new Response('OK', { status: 200 });
    }

    const { callerName, leadId, investorId } = await resolveCallerName(APP_ID, TOKEN, from);

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
      console.log('[voicemailWebhook] Saved voicemail for callSid:', callSid);
      return new Response('OK', { status: 200 });
    }

    // ── Status callback — log call (ringing / missed / completed) ────────
    // This fires from the statusCallback on the inbound <Dial> in dialerVoiceHandler.
    const STATUS_MAP: Record<string, string> = {
      completed:   'completed',
      'no-answer': 'missed',
      busy:        'missed',
      failed:      'missed',
      canceled:    'missed',
      ringing:     'ringing',
      initiated:   'ringing',
    };
    const logStatus = STATUS_MAP[callStatus] || 'ringing';

    if (existing) {
      // Don't overwrite a terminal status (answered/voicemail/completed) with ringing
      const terminalStatuses = ['answered', 'voicemail', 'completed', 'missed'];
      if (logStatus === 'ringing' && terminalStatuses.includes(existing.status)) {
        console.log('[voicemailWebhook] Skipping ringing update — call already in terminal status:', existing.status);
        return new Response('OK', { status: 200 });
      }
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

    console.log('[voicemailWebhook] Status callback logged:', callSid, logStatus);
    return new Response('OK', { status: 200 });

  } catch (e) {
    console.error('[voicemailWebhook] error:', e.message);
    return new Response('OK', { status: 200 });
  }
}