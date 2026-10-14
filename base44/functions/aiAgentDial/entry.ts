/**
 * aiAgentDial — Outbound dialing for the AI Fronting Agent.
 *
 * Actions:
 *   startDial   — Initiate an outbound call to a lead. Creates a prospect
 *                 FronterLead record if one doesn't exist, then makes a Twilio
 *                 call that connects the lead to the AI agent voice handler.
 *   callStatus  — Twilio status callback handler (logs call result, updates
 *                 the FronterLead disposition).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { lineNumber, toE164, xmlEscape, twilioFetch } from '../../shared/twilioHelpers.ts';
import { checkCallCutoff, getTzLabel } from '../../shared/phoneTimeZone.ts';

const BASE_URL = 'https://rosieai-investorpage.base44.app';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const contentType = req.headers.get('content-type') || '';
    let body: any;

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    }

    const { action } = body;

    // ── startDial: initiate outbound call to a lead ──
    if (action === 'startDial') {
      const { phone, firstName, lastName, city, state, debtAmount, leadId, adminUsername, overrideCutoff } = body;
      if (!phone) return Response.json({ error: 'phone required' }, { status: 400 });
      if (!/^\+[1-9]\d{7,14}$/.test(toE164(String(phone)))) {
        return Response.json({ error: 'Enter a valid phone number, including the country code for numbers outside the US.' }, { status: 400 });
      }

      // ── 8pm local-time cutoff: no calls past 7:59pm in the recipient's tz ──
      // overrideCutoff lets admins bypass for test calls to their own number
      const cutoff = checkCallCutoff(phone);
      if (cutoff.blocked && !overrideCutoff) {
        const reason = cutoff.localHour >= 20
          ? `It is ${cutoff.localTime} ${cutoff.tzLabel} — past the 8pm cutoff for this number's time zone.`
          : `It is ${cutoff.localTime} ${cutoff.tzLabel} — before the 8am calling window.`;
        return Response.json({
          error: 'CALL_TIME_BLOCKED',
          message: reason,
          localTime: cutoff.localTime,
          tzLabel: cutoff.tzLabel,
          tz: cutoff.tz,
        }, { status: 403 });
      }

      // Get AI agent config for the line
      let lineKey = '';
      let configData: any = null;
      try {
        const configs = await base44.asServiceRole.entities.AIAgentConfig.filter({ configName: 'default' });
        configData = configs?.[0];
        lineKey = configData?.twilioLineKey || '';
      } catch {}

      const fromNumber = lineNumber(lineKey);
      if (!fromNumber) return Response.json({ error: 'No Twilio line configured' }, { status: 400 });

      // Create or update a FronterLead prospect card
      let leadRecord = null;
      if (leadId) {
        try { leadRecord = await base44.asServiceRole.entities.FronterLead.get(leadId); } catch {}
      }
      if (!leadRecord) {
        try {
          const count = await base44.asServiceRole.entities.FronterLead.list('-created_date', 1);
          const num = count?.[0]?.leadNumber ? parseInt(count[0].leadNumber.replace(/\D/g, '')) + 1 : 1;
          leadRecord = await base44.asServiceRole.entities.FronterLead.create({
            leadNumber: `#F${String(num).padStart(4, '0')}`,
            firstName: firstName || 'Unknown',
            lastName: lastName || '',
            phone: phone,
            city: city || '',
            state: state || '',
            debtAmount: debtAmount ? Number(debtAmount) : undefined,
            status: 'prospect',
            assignedTo: 'ai_agent',
            assignedAt: new Date().toISOString(),
            assignedBy: adminUsername || 'ai_agent',
            uploadedBy: adminUsername || 'ai_agent',
            notes: 'Dialed by AI Fronting Agent',
          });
        } catch (e) { console.warn('Failed to create lead:', e.message); }
      }

      // Build the voice URL for when the call connects
      // This connects the call to the AI agent's voice handler
      const voiceUrl = `${BASE_URL}/functions/dialerVoiceHandler?Mode=aiAgent&LeadId=${encodeURIComponent(leadRecord?.id || '')}`;
      const statusCallbackUrl = `${BASE_URL}/functions/aiAgentDial?callStatus=1&leadId=${encodeURIComponent(leadRecord?.id || '')}`;

      const call = await twilioFetch(`/Calls.json`, {
        method: 'POST',
        body: new URLSearchParams({
          To: toE164(phone),
          From: fromNumber,
          Url: voiceUrl,
          StatusCallback: statusCallbackUrl,
          StatusCallbackEvent: 'initiated ringing answered completed',
          StatusCallbackMethod: 'POST',
          Timeout: '30',
        }),
      });

      // Update lead with call info
      if (leadRecord) {
        try {
          await base44.asServiceRole.entities.FronterLead.update(leadRecord.id, {
            lastCalledAt: new Date().toISOString(),
            callCount: (leadRecord.callCount || 0) + 1,
          });
        } catch {}
      }

      return Response.json({
        ok: true,
        callSid: call.sid,
        leadId: leadRecord?.id || null,
        leadNumber: leadRecord?.leadNumber || null,
      });
    }

    // ── callStatus: Twilio status callback ──
    const url = new URL(req.url);
    if (url.searchParams.get('callStatus') === '1') {
      const leadId = url.searchParams.get('leadId') || '';
      const callStatus = body.CallStatus || '';
      const callDuration = body.CallDuration || '0';

      if (leadId) {
        try {
          const updates: any = {};
          if (callStatus === 'completed') {
            updates.lastCallResult = 'connected';
            updates.lastCallDurationSeconds = parseInt(callDuration) || 0;
          } else if (callStatus === 'no-answer' || callStatus === 'failed') {
            updates.lastCallResult = 'no_answer';
          } else if (callStatus === 'busy') {
            updates.lastCallResult = 'no_answer';
          }
          if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.FronterLead.update(leadId, updates);
          }
        } catch {}
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[aiAgentDial] Error:', error.message);
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    return Response.json({ error: error.message, twilioCode: error.twilioCode || null }, { status });
  }
}