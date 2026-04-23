import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACCOUNT_SID   = Deno.env.get('TWILIO_ACCOUNT_SID')  || '';
const API_KEY       = Deno.env.get('TWILIO_API_KEY')       || '';
const API_SECRET    = Deno.env.get('TWILIO_API_SECRET')    || '';
const TWIML_APP_SID = Deno.env.get('TWILIO_TWIML_APP_SID') || '';

/**
 * Issues a Twilio Access Token with VoiceGrant
 * Required for @twilio/voice-sdk v2.x (replaces old ClientCapability token)
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID    — your Twilio account SID
 *   TWILIO_API_KEY        — create at console.twilio.com/user/api-keys
 *   TWILIO_API_SECRET     — shown once when you create the API key
 *   TWILIO_TWIML_APP_SID  — TwiML App SID (create at console.twilio.com/voice/twiml/apps)
 */

Deno.serve(async (req) => {
  // Validate env vars
  if (!ACCOUNT_SID || !API_KEY || !API_SECRET) {
    console.error('[ClientToken] Missing Twilio credentials');
    return Response.json({ error: 'Twilio credentials not configured (need TWILIO_API_KEY and TWILIO_API_SECRET)' }, { status: 500 });
  }

  try {
    const twilio = await import('npm:twilio@5.0.0');
    const AccessToken = twilio.default.jwt.AccessToken;
    const VoiceGrant  = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWIML_APP_SID || undefined,
      incomingAllow: true,
    });

    const token = new AccessToken(
      ACCOUNT_SID,
      API_KEY,
      API_SECRET,
      {
        identity: 'agent',
        ttl: 3600, // 1 hour
      }
    );

    token.addGrant(voiceGrant);
    const jwt = token.toJwt();

    console.log('[ClientToken] Token issued for agent');
    return Response.json({ token: jwt });

  } catch (e) {
    console.error('[ClientToken] Error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});