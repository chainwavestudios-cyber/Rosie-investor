import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Twilio Call Status Callback Webhook
 * Receives AMD results and call events in real-time
 * Configured as StatusCallback when making outbound calls
 */

Deno.serve(async (req) => {
  if (req.method === 'POST') {
    try {
      const formData = await req.text();
      const params = new URLSearchParams(formData);
      
      const callSid = params.get('CallSid');
      const callStatus = params.get('CallStatus');
      const machineDetection = params.get('AnsweredBy');

      console.log(`[Twilio Callback] CallSid: ${callSid}, Status: ${callStatus}, AnsweredBy: ${machineDetection}`);

      // Build response to store call metadata (this is polled by the frontend)
      // Twilio just needs a 200 OK to acknowledge receipt
      return new Response('OK', { status: 200 });
    } catch (e) {
      console.error('[Twilio Callback] Error:', e.message);
      return new Response('Error', { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});