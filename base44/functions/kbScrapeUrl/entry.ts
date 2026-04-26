const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    const { url } = await req.json();
    if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

    const pageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RosieAI/1.0)' } });
    const html = await pageRes.text();

    // Strip noise
    const fullText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const allEntries: any[] = [];
    const chunkSize = 4000;
    const overlap = 400;
    let i = 0;

    while (i < fullText.length) {
      const chunk = fullText.slice(i, i + chunkSize);
      i += chunkSize - overlap;
      if (chunk.trim().length < 100) continue;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Extract ALL useful information from this webpage section into Q&A pairs for a sales knowledge base. Capture every fact, feature, benefit, price, process, or detail. Return ONLY a JSON array:\n[{"question":"...","answer":"...","category":"product|pricing|process|faq|company|market"}]\n\nFrom ${url}:\n${chunk}\n\nJSON only:`
          }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '[]';
      try {
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        if (Array.isArray(parsed)) allEntries.push(...parsed);
      } catch {}
    }

    // Store raw as fallback
    allEntries.push({
      question: `[FULL PAGE] ${url}`,
      answer: fullText.slice(0, 12000),
      category: 'raw_document',
      source: url,
    });

    return Response.json({ entries: allEntries, count: allEntries.length });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});