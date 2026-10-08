/**
 * fronterClientToken — Issues a Twilio Voice SDK access token with a custom
 * identity (the fronter/admin username) so calls can be routed to specific
 * people (admin listen/barge calls `client:{username}`).
 */
const ACCOUNT_SID   = Deno.env.get('TWILIO_ACCOUNT_SID')  || '';
const API_KEY       = Deno.env.get('TWILIO_API_KEY')       || '';
const API_SECRET    = Deno.env.get('TWILIO_API_SECRET')    || '';
const TWIML_APP_SID = Deno.env.get('TWILIO_TWIML_APP_SID') || '';

Deno.serve(async (req) => {
  if (!ACCOUNT_SID || !API_KEY || !API_SECRET) {
    return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const identity = (body.username || 'fronter').replace(/[^a-zA-Z0-9_]/g, '_');

    const twilio = await import('npm:twilio@5.0.0');
    const AccessToken = twilio.default.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWIML_APP_SID || undefined,
      incomingAllow: true,
    });

    const token = new AccessToken(ACCOUNT_SID, API_KEY, API_SECRET, {
      identity,
      ttl: 3600,
    });
    token.addGrant(voiceGrant);
    return Response.json({ token: token.toJwt(), identity });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});