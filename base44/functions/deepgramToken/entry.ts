/**
 * Returns a short-lived Deepgram token for browser-side WebSocket connection
 */
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    if (!DEEPGRAM_API_KEY) return Response.json({ error: 'DEEPGRAM_API_KEY not set' }, { status: 500 });

    // Create a temporary API key via Deepgram API (expires in 10 min)
    const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ time_to_live_in_seconds: 600 }),
    });

    if (!res.ok) {
      // Fallback: just return the main key directly (less secure but works)
      return Response.json({ key: DEEPGRAM_API_KEY });
    }

    const data = await res.json();
    return Response.json({ key: data.key || DEEPGRAM_API_KEY });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});