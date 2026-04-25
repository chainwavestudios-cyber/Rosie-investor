const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    const { fileName, fileType, base64 } = await req.json();
    if (!base64) return Response.json({ error: 'Missing file data' }, { status: 400 });

    let entries = [];

    if (fileType === 'application/pdf') {
      // Send PDF directly to Claude
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':ANTHROPIC_KEY, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              { type:'document', source:{ type:'base64', media_type:'application/pdf', data: base64 } },
              { type:'text', text:'Extract Q&A knowledge base entries from this document. Return ONLY a JSON array of {question, answer} pairs — 5-15 of the most useful facts a salesperson could use. No markdown.' }
            ]
          }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '[]';
      try { entries = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch {}
    } else {
      // Text file - decode base64
      const decoded = atob(base64).slice(0, 6000);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':ANTHROPIC_KEY, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{ role:'user', content:`Extract Q&A knowledge base entries from this document. Return ONLY a JSON array of {question, answer} pairs — 5-15 of the most useful facts. No markdown.\n\n${decoded}` }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '[]';
      try { entries = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch {}
    }

    return Response.json({ entries, count: entries.length });
  } catch(e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});