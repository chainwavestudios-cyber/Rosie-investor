/**
 * voicemailWebhook
 * Called by Twilio when:
 *   1. noAnswer=true  — <Dial> action callback, no one answered → return TwiML instantly
 *   2. RecordingUrl present — recording complete → store voicemail in DB
 *   3. Status callback — call status update → log call record in DB
 *
 * CRITICAL: The noAnswer branch MUST return TwiML in < 8 seconds or Twilio
 * gives up and plays "application error". We do ZERO database work here —
 * just return TwiML immediately. DB logging happens in the recording callback.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_VM_GREETING = "Hi, you've reached us. We're unavailable right now. Please leave your message after the beep and we'll call you back shortly.";

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  const urlParams = new URL(req.url).searchParams;

  // ── noAnswer branch: return TwiML INSTANTLY — no DB calls at all ────────
  // Twilio has an 8–10s timeout. Any DB query here risks a cold-start 502.
  // We use the default greeting only. If you want a custom greeting, put
  // the audio file at a stable CDN URL and hardcode it in vmAudioUrl below.
  if (urlParams.get('noAnswer') === 'true') {
    try {
      const appId = Deno.env.get('BASE44_APP_ID') || '';
      const vmWebhookBase = `https://run.base44.com/apps/${appId}/functions/voicemailWebhook`;

      // Optional: hardcode a custom greeting audio URL here instead of DB lookup
      // e.g. const vmAudioUrl = 'https://your-cdn.com/greeting.mp3';
      const vmAudioUrl = Deno.env.get('VM_AUDIO_URL') || '';

      const greetingTwiml = vmAudioUrl
        ? `<Play>${vmAudioUrl}</Play>`
        : `<Say voice="alice">${DEFAULT_VM_GREETING}</Say>`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingTwiml}
  <Record maxLength="120" playBeep="true" transcribe="true" transcribeCallback="${vmWebhookBase}" action="${vmWebhookBase}" method="POST" />
  <Say voice="alice">We did not receive a recording. Goodbye.</Say>
</Response>`;

      console.log('[voicemailWebhook] noAnswer → returning TwiML immediately');
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });

    } catch (fatalErr) {
      // Absolute last resort — still return valid TwiML, never a 5xx
      console.error('[voicemailWebhook] Fatal error building noAnswer TwiML:', fatalErr?.message);
      const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${DEFAULT_VM_GREETING}</Say>
  <Record maxLength="120" playBeep="true" />
</Response>`;
      return new Response(fallback, { headers: { 'Content-Type': 'text/xml' } });
    }
  }

  // ── Recording complete / status callback — DB work is fine here ─────────
  // Twilio does NOT time out on recording/status callbacks the same way.
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const callSid       = params.get('CallSid')           || '';
    const callStatus    = params.get('CallStatus')        || '';
    const direction     = params.get('Direction')         || 'inbound';
    const from          = params.get('From')              || params.get('Caller') || '';
    const to            = params.get('To')                || params.get('Called') || '';
    const duration      = parseInt(params.get('CallDuration') || params.get('Duration') || '0', 10);
    const recordingUrl  = params.get('RecordingUrl')      || '';
    const transcription = params.get('TranscriptionText') || '';

    console.log('[voicemailWebhook] CallSid:', callSid, 'Status:', callStatus, 'RecordingUrl:', recordingUrl);

    const base44 = createClientFromRequest(req).asServiceRole;

    // Match caller to a lead or investor
    let callerName = '';
    let leadId = '';
    let investorId = '';

    if (from) {
      const digits  = from.replace(/\D/g, '');
      const plain10 = digits.slice(-10);

      try {
        const investors = await base44.entities.InvestorUser.filter({});
        const inv = investors.find(u => {
          const p = (u.phone || '').replace(/\D/g, '');
          return p === digits || p.slice(-10) === plain10;
        });
        if (inv) { callerName = inv.name; investorId = inv.id; }
      } catch {}

      if (!callerName) {
        try {
          const leads = await base44.entities.Lead.filter({});
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

    const existingLogs = await base44.entities.CallLog.filter({ callSid }).catch(() => []);
    const existing = existingLogs?.[0] || null;
    const now = new Date().toISOString();

    // Recording callback — store voicemail
    if (recordingUrl) {
      const vmUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : recordingUrl + '.mp3';
      if (existing) {
        await base44.entities.CallLog.update(existing.id, {
          status: 'voicemail',
          vmRecordingUrl: vmUrl,
          vmTranscription: transcription || '',
          vmListened: false,
          durationSeconds: duration || existing.durationSeconds || 0,
        });
      } else {
        await base44.entities.CallLog.create({
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
        await base44.entities.LeadHistory.create({
          leadId,
          type: 'voicemail',
          content: `📩 Voicemail left — ${transcription ? '"' + transcription.slice(0, 200) + '"' : 'No transcription available'}`,
          createdBy: 'system',
        }).catch(() => {});
      }

      return new Response('OK', { status: 200 });
    }

    // Status callback — log the call
    const statusMap: Record<string, string> = {
      'completed': 'completed',
      'no-answer': 'missed',
      'busy':      'missed',
      'failed':    'missed',
      'canceled':  'missed',
    };
    const logStatus = statusMap[callStatus] || 'ringing';

    if (existing) {
      await base44.entities.CallLog.update(existing.id, {
        status: logStatus,
        durationSeconds: duration || existing.durationSeconds || 0,
      });
    } else {
      await base44.entities.CallLog.create({
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