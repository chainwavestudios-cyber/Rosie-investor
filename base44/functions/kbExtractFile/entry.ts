const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

// Split text into chunks of ~3000 chars with overlap
function chunkText(text: string, chunkSize = 3000, overlap = 300): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

async function extractFromText(text: string, source: string): Promise<any[]> {
  const chunks = chunkText(text);
  const allEntries: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are building a sales knowledge base. Extract EVERY useful piece of information from this document section that a salesperson could use to answer investor questions.

For each piece of information, create a Q&A pair. Be thorough — extract ALL facts, figures, dates, processes, requirements, benefits, risks, returns, terms, and any other details. Do NOT summarize or skip anything. A 56-page document should produce 50-100+ entries.

Return ONLY a JSON array of objects with this exact format:
[{"question": "...", "answer": "...", "category": "..."}]

Categories: financials | product | team | market | legal | process | risk | faq

Document section ${i + 1} of ${chunks.length} from "${source}":
${chunk}

Respond ONLY with the JSON array, no markdown, no preamble.`
        }],
      }),
    });
    const data = await res.json();
    const text2 = data?.content?.[0]?.text || '[]';
    try {
      const parsed = JSON.parse(text2.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed)) allEntries.push(...parsed);
    } catch {}
  }

  // Also store the raw full text as a single searchable chunk entry
  allEntries.push({
    question: `[FULL DOCUMENT] ${source}`,
    answer: text.slice(0, 12000), // store up to 12k chars of raw text
    category: 'raw_document',
    source,
  });

  return allEntries;
}

Deno.serve(async (req) => {
  try {
    const { fileName, fileType, base64 } = await req.json();
    if (!base64) return Response.json({ error: 'Missing file data' }, { status: 400 });

    let entries: any[] = [];

    if (fileType === 'application/pdf') {
      // For PDFs: send to Claude with vision, then also extract text for chunking
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
                text: `You are building a comprehensive sales knowledge base from this document. Extract EVERY useful piece of information — facts, figures, processes, requirements, returns, risks, timelines, team info, market data, legal details, FAQs, anything a salesperson could use.

Be exhaustive. A 56-page document should produce 60-100+ Q&A pairs. Do NOT summarize — extract everything.

Return ONLY a JSON array:
[{"question": "...", "answer": "...", "category": "financials|product|team|market|legal|process|risk|faq"}]

No markdown, no preamble. Just the JSON array.`
              }
            ]
          }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '[]';
      try {
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        if (Array.isArray(parsed)) entries = parsed;
      } catch {}
    } else {
      // Text/other files — decode and chunk
      const decoded = atob(base64);
      entries = await extractFromText(decoded, fileName);
    }

    return Response.json({ entries, count: entries.length });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});