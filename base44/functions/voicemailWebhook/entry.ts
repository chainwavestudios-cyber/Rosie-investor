/**
 * voicemailWebhook
 * Called by Twilio when:
 *   1. A recording completes (RecordingUrl present) — stores voicemail
 *   2. A call status callback fires (status=no-answer, missed, completed) — logs call record
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_VM_GREETING = "Hi, you've reached us. We're unavailable right now. Please leave your message after the beep and we'll call you back shortly.";

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  // Twilio <Dial> action callback — no-answer → play VM greeting + record
  const urlParams = new URL(req.url).searchParams;
  if (urlParams.get('noAnswer') === 'true') {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const dialStatus = params.get('DialCallStatus') || '';
    const callSid    = params.get('CallSid') || '';
    const from       = params.get('From') || params.get('Caller') || '';
    const to         = params.get('To') || params.get('Called') || '';
    const appId      = Deno.env.get('BASE44_APP_ID') || '';
    const vmWebhookBase = `https://run.base44.com/apps/${appId}/functions/voicemailWebhook`;

    console.log('[voicemailWebhook] noAnswer action — DialCallStatus:', dialStatus, 'CallSid:', callSid);

    // If no-answer or call wasn't picked up, play VM greeting
    if (dialStatus !== 'completed' && dialStatus !== 'answered') {
      // Load custom greeting from PortalSettings if set
      let greeting = DEFAULT_VM_GREETING;
      try {
        const base44 = createClientFromRequest(req).asServiceRole;
        const settings = await base44.entities.PortalSettings.filter({ key: 'main' });
        if (settings?.[0]?.vmGreeting) greeting = settings[0].vmGreeting;
      } catch {}

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${greeting}</Say>
  <Record maxLength="120" playBeep="true" transcribe="true" transcribeCallback="${vmWebhookBase}" action="${vmWebhookBase}" method="POST" />
  <Say voice="alice">We did not receive a recording. Goodbye.</Say>
</Response>`;
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // Call was answered — log it as completed via normal callback flow
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { headers: { 'Content-Type': 'text/xml' } });
  }

  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const callSid        = params.get('CallSid')         || '';
    const callStatus     = params.get('CallStatus')      || '';
    const direction      = params.get('Direction')       || 'inbound';
    const from           = params.get('From')            || params.get('Caller') || '';
    const to             = params.get('To')              || params.get('Called') || '';
    const duration       = parseInt(params.get('CallDuration') || params.get('Duration') || '0', 10);
    const recordingUrl   = params.get('RecordingUrl')    || '';
    const transcription  = params.get('TranscriptionText') || '';

    console.log('[voicemailWebhook] CallSid:', callSid, 'Status:', callStatus, 'From:', from, 'RecordingUrl:', recordingUrl);

    const base44 = createClientFromRequest(req).asServiceRole;

    // Try to match caller to a lead or investor
    let callerName = '';
    let leadId = '';
    let investorId = '';

    if (from) {
      const digits = from.replace(/\D/g, '');
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
          if (lead) { callerName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim(); leadId = lead.id; }
        } catch {}
      }
    }

    // Find existing CallLog record for this CallSid
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

      // Also log in lead history if matched
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
    const statusMap = {
      'completed': 'completed',
      'no-answer': 'missed',
      'busy': 'missed',
      'failed': 'missed',
      'canceled': 'missed',
    };
    const logStatus = statusMap[callStatus] || 'ringing';

    if (existing) {
      await base44.entities.CallLog.update(existing.id, {
        status: logStatus,
        durationSeconds: duration || existing.durationSeconds || 0,
      });
    } else {
      const dirNorm = direction.toLowerCase().includes('inbound') ? 'inbound' : 'outbound';
      await base44.entities.CallLog.create({
        callSid,
        direction: dirNorm,
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