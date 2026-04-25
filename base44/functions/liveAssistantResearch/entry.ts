const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    const { name, email, phone, location, notes } = await req.json();

    const prompt = `Research this potential investor and provide a JSON response with the following fields:
- summary: 2-3 sentence overview of what you know about this person/area (be helpful, use location context)
- businessOwner: if they might be a business owner based on email domain or notes, describe it briefly (or null)
- nearbyBusinesses: array of 4-6 well-known businesses/employers in "${location}" area
- universities: array of universities near "${location}"
- talkingPoints: array of 3 personalized conversation talking points based on their location and context
- localEconomy: one sentence about the local economy in "${location}"

Person: ${name}
Email: ${email}
Phone: ${phone}
Location: ${location}
Notes: ${notes || 'none'}

Respond ONLY with valid JSON, no markdown.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':ANTHROPIC_KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role:'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text || '{}';
    
    let parsed;
    try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()); }
    catch { parsed = { summary: text, nearbyBusinesses:[], universities:[], talkingPoints:[] }; }

    return Response.json(parsed);
  } catch(e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});