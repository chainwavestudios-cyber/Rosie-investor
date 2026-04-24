import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Twilio conference callback
 * Fires: participant-join, participant-leave, conference-start, conference-end
 * participant-join = lead answered → write in-progress to CallStatus
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  try {
    const formData = await req.text();
    const params = new URLSearchParams(formData);

    const statusCallbackEvent = params.get('StatusCallbackEvent') || '';
    const callSid      = params.get('CallSid') || '';
    const confSid      = params.get('ConferenceSid') || '';
    const friendlyName = params.get('FriendlyName') || '';
    const callStatus   = params.get('CallStatus') || '';

    console.log(`[Callback] Event=${statusCallbackEvent} CallSid=${callSid} ConfSid=${confSid} FriendlyName=${friendlyName} Status=${callStatus}`);

    const base44 = createClientFromRequest(req).asServiceRole;

    if (statusCallbackEvent === 'participant-join' && friendlyName) {
      const existing = await base44.entities.CallStatus.filter({ callSid: friendlyName });
      if (existing?.length > 0) {
        await base44.entities.CallStatus.update(existing[0].id, {
          status: 'in-progress', answeredBy: 'human', updatedAt: new Date().toISOString(),
        });
      } else {
        await base44.entities.CallStatus.create({
          callSid: friendlyName, status: 'in-progress',
          answeredBy: 'human', duration: 0, updatedAt: new Date().toISOString(),
        });
      }
      console.log(`[Callback] Participant joined conference ${friendlyName} — marked in-progress`);
    }

    if (statusCallbackEvent === 'conference-end' && friendlyName) {
      const existing = await base44.entities.CallStatus.filter({ callSid: friendlyName });
      if (existing?.length > 0) {
        await base44.entities.CallStatus.update(existing[0].id, {
          status: 'completed', updatedAt: new Date().toISOString(),
        });
      }
    }

    return new Response('OK', { status: 200 });
  } catch (e) {
    console.error('[Callback] Error:', e.message);
    return new Response('OK', { status: 200 });
  }
});