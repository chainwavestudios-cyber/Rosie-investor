import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

/**
 * Issues a Twilio Client capability token
 * Allows the agent's browser to receive/make calls
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Import Twilio JWT utilities
    const { Jwt } = await import('npm:twilio@5.0.0');
    
    // Create capability token (valid for 1 hour)
    const token = Jwt.ClientCapability({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
    })
      .addIncomingFifo('default')
      .addOutgoingFifo('default')
      .toJwt();

    return Response.json({ token });
  } catch (e) {
    console.error('[Client Token] Error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});