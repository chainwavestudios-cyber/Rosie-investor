import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Twilio callback — handles both conference participant events and call status events
 * Conference fires: participant-join, participant-leave, conference-start, conference-end
 * We use participant-join to detect when the lead answers
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  try {
    const formData = await req.text();
    const params = new URLSearchParams(formData);

    const statusCallbackEvent = params.get('StatusCallbackEvent') || '';
    const callSid     = params.get('CallSid')      || params.get('ConferenceSid') || '';
    const callStatus  = params.get('CallStatus')   || '';
    const confSid     = params.get('ConferenceSid') || '';
    const friendlyName = params.get('FriendlyName') || ''; // this is the conferenceName

    console.log(`[Callback] Event=${statusCallbackEvent} CallSid=${callSid} ConfSid=${confSid} FriendlyName=${friendlyName} Status=${callStatus}`);

    // Conference participant joined = lead answered
    if (statusCallbackEvent === 'participant-join' && friendlyName) {
      try {
        const base44 = createClientFromRequest(req);
        // Store by conference name so frontend can look it up
        const existing = await base44.asServiceRole.entities.CallStatus.filter({ callSid: friendlyName });
        if (existing?.length > 0) {
          await base44.asServiceRole.entities.CallStatus.update(existing[0].id, {
            status: 'in-progress',
            answeredBy: 'human',
            updatedAt: new Date().toISOString(),
          });
        } else {
          await base44.asServiceRole.entities.CallStatus.create({
            callSid: friendlyName, // use conference name as key
            status: 'in-progress',
            answeredBy: 'human',
            duration: 0,
            updatedAt: new Date().toISOString(),
          });
        }
        console.log(`[Callback] Participant joined conference ${friendlyName} — marked in-progress`);
      } catch (dbErr) {
        console.error('[Callback] DB error:', dbErr.message);
      }
    }

    // Conference ended
    if (statusCallbackEvent === 'conference-end' && friendlyName) {
      try {
        const base44 = createClientFromRequest(req);
        const existing = await base44.asServiceRole.entities.CallStatus.filter({ callSid: friendlyName });
        if (existing?.length > 0) {
          await base44.asServiceRole.entities.CallStatus.update(existing[0].id, {
            status: 'completed',
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {}
    }

    return new Response('OK', { status: 200 });

  } catch (e) {
    console.error('[Callback] Error:', e.message);
    return new Response('OK', { status: 200 });
  }
});