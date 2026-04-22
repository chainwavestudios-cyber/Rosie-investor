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

    const { toNumber, fromNumber, statusCallbackUrl } = await req.json();

    if (!toNumber || !fromNumber) {
      return Response.json({ error: 'Missing toNumber or fromNumber' }, { status: 400 });
    }

    // Resolve fromNumber if it's a key (e.g., 'TWILIO_FROM_NUMBER')
    let resolvedFromNumber = fromNumber;
    if (fromNumber.startsWith('TWILIO_FROM_NUMBER')) {
      resolvedFromNumber = Deno.env.get(fromNumber);
      if (!resolvedFromNumber) {
        return Response.json({ error: `Environment variable ${fromNumber} not set` }, { status: 500 });
      }
    }

    const auth = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);

    // Make call with StatusCallback for real-time AMD updates
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'To': toNumber,
        'From': resolvedFromNumber,
        'Url': 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical',
        'MachineDetection': 'DetectMessageEnd',
        'MachineDetectionTimeout': '5',
        'MachineDetectionSpeechThreshold': '5000',
        'MachineDetectionSpeechEndThreshold': '1800',
        'StatusCallback': statusCallbackUrl,
        'StatusCallbackEvent': 'initiated ringing answered completed',
        'StatusCallbackMethod': 'POST',
      }).toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[Twilio API Error]', data);
      return Response.json({ error: 'Twilio API error', details: data }, { status: 500 });
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