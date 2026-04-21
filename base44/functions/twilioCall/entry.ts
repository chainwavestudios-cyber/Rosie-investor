import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER');
const TWILIO_TWIML_APP_SID = Deno.env.get('TWILIO_TWIML_APP_SID');

const twilioBase = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
const twilioAuth = 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // Initiate outbound call
    if (action === 'makeCall') {
      const { to } = body;
      if (!to) return Response.json({ error: 'Phone number required' }, { status: 400 });

      const params = new URLSearchParams({
        To: to,
        From: TWILIO_FROM_NUMBER,
        Url: 'https://handler.twilio.com/twiml/EH3e342efae704e27b4c9bc7c98529a044',
        StatusCallback: '',
        Record: 'false',
      });

      // Use TwiML App if configured, otherwise direct call
      if (TWILIO_TWIML_APP_SID) {
        params.set('ApplicationSid', TWILIO_TWIML_APP_SID);
        params.delete('Url');
      }

      const res = await fetch(`${twilioBase}/Calls.json`, {
        method: 'POST',
        headers: { Authorization: twilioAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Call failed');
      return Response.json({ callSid: data.sid, status: data.status });
    }

    // Hang up a call
    if (action === 'hangupCall') {
      const { callSid } = body;
      const res = await fetch(`${twilioBase}/Calls/${callSid}.json`, {
        method: 'POST',
        headers: { Authorization: twilioAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ Status: 'completed' }),
      });
      const data = await res.json();
      return Response.json({ status: data.status });
    }

    // Get call status
    if (action === 'getCallStatus') {
      const { callSid } = body;
      const res = await fetch(`${twilioBase}/Calls/${callSid}.json`, {
        headers: { Authorization: twilioAuth },
      });
      const data = await res.json();
      return Response.json({ status: data.status, duration: data.duration });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});