/**
 * deepgramToken2 — Returns a short-lived Deepgram token for BOB training calls.
 * Uses the DEEPGRAM2_API_KEY secret (separate from production deepgramToken).
 * Set the secret named "deepgram2" in your base44 project secrets.
 */
const DEEPGRAM2_API_KEY = Deno.env.get('DEEPGRAM2_API_KEY') || Deno.env.get('deepgram2') || '';

Deno.serve(async (req) => {
  try {
    if (!DEEPGRAM2_API_KEY) {
      return Response.json(
        { error: 'DEEPGRAM2_API_KEY / deepgram2 secret not set. Add it in base44 project secrets.' },
        { status: 500 }
      );
    }

    // Try to create a temporary key (expires in 10 min)
    const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM2_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ time_to_live_in_seconds: 600 }),
    });

    if (!res.ok) {
      // Fallback: return the key directly
      return Response.json({ key: DEEPGRAM2_API_KEY });
    }

    const data = await res.json();
    return Response.json({ key: data.key || DEEPGRAM2_API_KEY });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});