const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

function chunkText(text: string, chunkSize = 3000, overlap = 300): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

Deno.serve(async (req) => {
  try {
    const { url } = await req.json();
    if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

    // Fetch the page
    const pageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RosieAI/1.0)' } });
    const html = await pageRes.text();

    // Strip HTML thoroughly
    const fullText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const chunks = chunkText(fullText);
    const allEntries: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.trim().length < 100) continue; // skip near-empty chunks

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Extract ALL useful information from this webpage section into Q&A pairs for a sales knowledge base. Be thorough — capture every fact, feature, benefit, price, process, or detail. Don't skip anything.

Return ONLY a JSON array:
[{"question": "...", "answer": "...", "category": "product|pricing|process|faq|company|market"}]

Webpage section ${i + 1} of ${chunks.length} from ${url}:
${chunk}

Respond with only the JSON array.`
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

    // Store raw content too
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