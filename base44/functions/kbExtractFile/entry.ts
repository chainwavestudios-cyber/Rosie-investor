const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    const { fileName, fileType, base64 } = await req.json();
    if (!base64) return Response.json({ error: 'Missing file data' }, { status: 400 });

    let entries: any[] = [];

    if (fileType === 'application/pdf') {
      // Send PDF to Claude — extract everything, not just 5 entries
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8000,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              {
                type: 'text',
                text: `You are building a comprehensive sales knowledge base. Extract EVERY useful piece of information from this document — every fact, figure, date, process, requirement, benefit, risk, return, term, team member, market stat, legal detail, FAQ, and anything a salesperson could use to answer investor questions.

Be exhaustive. A 56-page document should produce 60-100+ entries. Do NOT summarize or skip sections.

For each piece of information create a Q&A pair with a category.
Categories: financials | product | team | market | legal | process | risk | faq

Return ONLY a JSON array, no markdown, no preamble:
[{"question":"...","answer":"...","category":"..."}]`
              }
            ]
          }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '[]';
      try { entries = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch {}

    } else {
      // Text file — decode and process in chunks
      const decoded = atob(base64);
      const chunkSize = 4000;
      const overlap = 400;
      let i = 0;
      while (i < decoded.length) {
        const chunk = decoded.slice(i, i + chunkSize);
        i += chunkSize - overlap;
        if (chunk.trim().length < 50) continue;
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4000,
            messages: [{
              role: 'user',
              content: `Extract ALL useful information from this document section into Q&A pairs for a sales knowledge base. Be thorough — every fact, figure, process, or detail. Return ONLY a JSON array:\n[{"question":"...","answer":"...","category":"financials|product|team|market|legal|process|risk|faq"}]\n\nSection:\n${chunk}\n\nJSON only:`
            }],
          }),
        });
        const data = await res.json();
        const text = data?.content?.[0]?.text || '[]';
        try {
          const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
          if (Array.isArray(parsed)) entries.push(...parsed);
        } catch {}
      }

      // Store raw text as a searchable fallback
      entries.push({
        question: `[FULL DOCUMENT] ${fileName}`,
        answer: decoded.slice(0, 12000),
        category: 'raw_document',
        source: fileName,
      });
    }

    return Response.json({ entries, count: entries.length });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});