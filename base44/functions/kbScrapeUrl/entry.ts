const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    const { url } = await req.json();
    if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

    // Fetch the page
    const pageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await pageRes.text();
    
    // Strip HTML tags
    const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 6000);

    const prompt = `Extract Q&A knowledge base entries from this webpage content. Return JSON array of {question, answer} pairs. Extract 5-15 of the most useful facts, FAQs, or key information that a salesperson could use. Be concise.\n\nContent:\n${text}\n\nRespond ONLY with a JSON array, no markdown.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':ANTHROPIC_KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role:'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text2 = data?.content?.[0]?.text || '[]';
    let entries;
    try { entries = JSON.parse(text2.replace(/```json|```/g, '').trim()); }
    catch { entries = []; }

    return Response.json({ entries });
  } catch(e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});