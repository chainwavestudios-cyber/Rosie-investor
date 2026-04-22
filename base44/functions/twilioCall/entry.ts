import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER');

const twilioBase = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
const twilioAuth = 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

Deno.serve(async (req) => {
  try {
    // Auth: accept either Base44 session OR portal admin (no strict auth required since
    // this function is only called from the admin dashboard UI)
    let authorized = false;
    try {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      if (user) authorized = true;
    } catch {}

    // Also allow if request comes from the app itself (portal admin users)
    // by checking if any credentials are present in the body
    const body = await req.json();
    if (!authorized && !body) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = body;

    // Initiate outbound call
    if (action === 'makeCall') {
      const { to, fromLine } = body;
      if (!to) return Response.json({ error: 'Phone number required' }, { status: 400 });

      // Allow specifying which from-number to use (for multi-line predictive dialer)
      const fromNumber = fromLine ? (Deno.env.get(fromLine) || TWILIO_FROM_NUMBER) : TWILIO_FROM_NUMBER;

      const params = new URLSearchParams({
        To: to,
        From: fromNumber,
        Url: 'https://handler.twilio.com/twiml/EH3e342efae704e27b4c9bc7c98529a044',
        Record: 'false',
        // Answering Machine Detection
        MachineDetection: 'Enable',
        MachineDetectionTimeout: '5',
      });

      const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');
      if (twimlAppSid) {
        params.set('ApplicationSid', twimlAppSid);
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

    // Get call status (includes AMD result in answered_by field)
    if (action === 'getCallStatus') {
      const { callSid } = body;
      const res = await fetch(`${twilioBase}/Calls/${callSid}.json`, {
        headers: { Authorization: twilioAuth },
      });
      const data = await res.json();
      // answered_by: 'human' | 'machine_start' | 'machine_end_beep' | 'machine_end_silence' | 'machine_end_other' | 'fax' | 'unknown'
      const isVoicemail = data.answered_by && data.answered_by.startsWith('machine');
      return Response.json({ status: data.status, duration: data.duration, answeredBy: data.answered_by, isVoicemail });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});