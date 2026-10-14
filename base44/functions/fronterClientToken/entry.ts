/**
 * fronterClientToken — Issues a Twilio Voice SDK access token with a custom
 * identity (the fronter/admin username) so calls can be routed to specific
 * people (admin listen/barge calls `client:{username}`).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { createCallCutoffOverride } from '../../shared/callCutoffOverride.ts';

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'authorizeOverride') {
      const base44 = createClientFromRequest(req);
      const session = await base44.functions.invoke('debtCoachAuth', {
        action: 'me', sessionUserId: body.sessionUserId, sessionToken: body.sessionToken,
      });
      if (session.data?.user?.role !== 'super_admin') {
        return Response.json({ error: 'Only Super Admins can override calling hours.' }, { status: 403 });
      }
      if (!body.phone) return Response.json({ error: 'Phone number required.' }, { status: 400 });
      return Response.json({ overrideToken: await createCallCutoffOverride(body.phone) });
    }
    const ACCOUNT_SID = secrets.get('TWILIO_ACCOUNT_SID') || '';
    const API_KEY = secrets.get('TWILIO_API_KEY') || '';
    const API_SECRET = secrets.get('TWILIO_API_SECRET') || '';
    const TWIML_APP_SID = secrets.get('TWILIO_TWIML_APP_SID') || '';
    if (!ACCOUNT_SID || !API_KEY || !API_SECRET) {
      return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }
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
    const status = e.response?.status;
    return Response.json({ error: status === 401 || status === 403 ? 'Only Super Admins can override calling hours.' : e.message }, { status: status === 401 || status === 403 ? 403 : 500 });
  }
}