import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Twilio Call Status Callback Webhook
 * Receives AMD results and call events in real-time from Twilio
 * Saves results to CallStatus entity so frontend can poll instantly
 */

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.text();
    const params = new URLSearchParams(formData);

    const callSid     = params.get('CallSid')     || '';
    const callStatus  = params.get('CallStatus')  || '';
    const answeredBy  = params.get('AnsweredBy')  || '';
    const duration    = params.get('CallDuration') || '0';

    console.log(`[Twilio Callback] SID=${callSid} Status=${callStatus} AnsweredBy=${answeredBy}`);

    if (!callSid) {
      return new Response('Missing CallSid', { status: 400 });
    }

    // Save to CallStatus entity so the frontend poll picks it up instantly
    try {
      const base44 = createClientFromRequest(req);

      // Try to find existing record first
      const existing = await base44.asServiceRole.entities.CallStatus.filter({ callSid });

      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.CallStatus.update(existing[0].id, {
          status: callStatus,
          answeredBy: answeredBy || existing[0].answeredBy,
          duration: parseInt(duration),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.CallStatus.create({
          callSid,
          status: callStatus,
          answeredBy,
          duration: parseInt(duration),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (dbErr) {
      // Don't fail the webhook if DB write fails — Twilio needs 200
      console.error('[Twilio Callback] DB error:', dbErr.message);
    }

    // Always return 200 to Twilio immediately
    return new Response('OK', { status: 200 });

  } catch (e) {
    console.error('[Twilio Callback] Error:', e.message);
    // Still return 200 so Twilio doesn't retry flood
    return new Response('OK', { status: 200 });
  }
});