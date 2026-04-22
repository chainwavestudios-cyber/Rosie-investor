import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN');

/**
 * Make outbound call with Call Progress Analysis (CPA / AMD)
 * Uses StatusCallback webhook for real-time AMD results
 * REQUIRES: Url param so Twilio knows what TwiML to run on answer
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { toNumber, fromNumber, statusCallbackUrl } = body;

    if (!toNumber || !fromNumber) {
      return Response.json({ error: 'Missing toNumber or fromNumber' }, { status: 400 });
    }

    if (!statusCallbackUrl) {
      return Response.json({ error: 'Missing statusCallbackUrl' }, { status: 400 });
    }

    // Resolve fromNumber env key (e.g. 'TWILIO_FROM_NUMBER') to actual number
    let resolvedFrom = fromNumber;
    if (fromNumber.startsWith('TWILIO_FROM_NUMBER')) {
      resolvedFrom = Deno.env.get(fromNumber) || '';
      if (!resolvedFrom) {
        return Response.json({ error: `Env variable not set: ${fromNumber}` }, { status: 500 });
      }
    }

    // Normalize both numbers to E.164 (+1XXXXXXXXXX)
    const toE164   = '+1' + toNumber.replace(/\D/g, '').slice(-10);
    const fromE164 = '+1' + resolvedFrom.replace(/\D/g, '').slice(-10);

    console.log(`[CPA Call] To: ${toE164}  From: ${fromE164}`);

    if (!ACCOUNT_SID || !AUTH_TOKEN) {
      return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }

    const auth = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'To':   toE164,
          'From': fromE164,
          // Required — TwiML to execute when call is answered (hold music)
          'Url':  'https://handler.twilio.com/twiml/EH3e342efae704e27b4c9bc7c98529a044',
          // AMD — DetectMessageEnd waits for full voicemail greeting before beep
          'MachineDetection':                'DetectMessageEnd',
          'MachineDetectionTimeout':         '30',
          'MachineDetectionSpeechThreshold': '2400',
          'MachineDetectionSpeechEndThreshold': '1200',
          'MachineDetectionSilenceTimeout':  '5000',
          // Status callback — fires on every state change including AMD result
          'StatusCallback':       statusCallbackUrl,
          'StatusCallbackEvent':  'initiated ringing answered completed',
          'StatusCallbackMethod': 'POST',
        }).toString(),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error('[CPA Call] Twilio error:', res.status, JSON.stringify(data));
      return Response.json(
        { error: data.message || 'Twilio call failed', code: data.code, details: data },
        { status: 500 }
      );
    }

    return Response.json({
      callSid: data.sid,
      status:  data.status,
      to:      data.to,
      from:    data.from,
    });

  } catch (e) {
    console.error('[CPA Call] Unexpected error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});