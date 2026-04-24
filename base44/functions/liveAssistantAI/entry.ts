import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    const { question, transcript, kbEntries } = await req.json();

    const kbContext = kbEntries?.length > 0
      ? kbEntries.map((e) => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')
      : 'No knowledge base entries yet.';

    const recentTranscript = (transcript || []).slice(-8).map((t) => t.text).join(' ');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `You are a real-time sales assistant helping during a live investor call. Answer questions concisely based on the knowledge base below. If the answer isn't in the KB, give a helpful general response. Keep answers under 3 sentences — the agent needs to speak naturally.\n\nKNOWLEDGE BASE:\n${kbContext}`,
        messages: [{
          role: 'user',
          content: `${recentTranscript ? `Recent conversation: "${recentTranscript}"\n\n` : ''}Question: "${question}"\n\nBrief answer:`
        }],
      }),
    });

    const data = await res.json();
    const answer = data?.content?.[0]?.text || 'No answer found.';
    return Response.json({ answer });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});