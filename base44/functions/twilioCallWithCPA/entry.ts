import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

/**
 * Make outbound call with Call Progress Analysis (CPA)
 * Replaces old twilioCall — now uses StatusCallback for AMD results
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { toNumber, fromNumber, statusCallbackUrl } = await req.json();

    if (!toNumber || !fromNumber) {
      return Response.json({ error: 'Missing toNumber or fromNumber' }, { status: 400 });
    }

    if (!statusCallbackUrl) {
      return Response.json({ error: 'Missing statusCallbackUrl' }, { status: 400 });
    }

    // Resolve fromNumber if it's a key (e.g., 'TWILIO_FROM_NUMBER')
    let resolvedFromNumber = fromNumber;
    if (fromNumber.startsWith('TWILIO_FROM_NUMBER')) {
      resolvedFromNumber = Deno.env.get(fromNumber);
      if (!resolvedFromNumber) {
        return Response.json({ error: `Environment variable ${fromNumber} not set` }, { status: 500 });
      }
    }

    // Validate phone numbers (basic E.164 format)
    const isValidPhone = (phone) => /^\+?1?\d{10,15}$/.test(phone.replace(/\D/g, ''));
    if (!isValidPhone(toNumber)) {
      return Response.json({ error: `Invalid toNumber format: ${toNumber}` }, { status: 400 });
    }
    if (!isValidPhone(resolvedFromNumber)) {
      return Response.json({ error: `Invalid fromNumber format: ${resolvedFromNumber}` }, { status: 400 });
    }

    const auth = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);

    // Normalize phone numbers to E.164 format for Twilio
    const toE164 = '+1' + toNumber.replace(/\D/g, '').slice(-10);
    const fromE164 = '+1' + resolvedFromNumber.replace(/\D/g, '').slice(-10);

    console.log(`[Twilio Call] To: ${toE164}, From: ${fromE164}`);

    // Make call with StatusCallback for real-time AMD updates
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'To': toE164,
        'From': fromE164,
        'MachineDetection': 'DetectMessageEnd',
        'MachineDetectionTimeout': '5000',
        'MachineDetectionSpeechThreshold': '5000',
        'MachineDetectionSpeechEndThreshold': '1800',
        'StatusCallback': statusCallbackUrl,
        'StatusCallbackEvent': 'initiated ringing answered completed',
        'StatusCallbackMethod': 'POST',
      }).toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[Twilio Error]', res.status, JSON.stringify(data));
      return Response.json({ error: `Twilio error: ${data.message || data.details || 'Unknown'}`, code: data.code, details: data }, { status: 500 });
    }

    return Response.json({
      callSid: data.sid,
      status: data.status,
      to: data.to,
      from: data.from,
    });
  } catch (e) {
    console.error('[Call with CPA] Error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});