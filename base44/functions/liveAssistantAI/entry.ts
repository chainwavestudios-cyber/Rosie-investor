const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    const { question, transcript, kbEntries, mode } = await req.json();

    const kbContext = kbEntries?.length > 0
      ? kbEntries.map((e: any) => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')
      : 'No knowledge base entries yet.';

    const recentTranscript = (transcript || []).slice(-8).map((t: any) => t.text).join(' ');

    let systemPrompt: string;
    let userContent: string;

    if (mode === 'summary') {
      systemPrompt = `You are a sales call analyst. Summarize the call transcript into 3-5 bullet points covering: key topics discussed, investor questions/concerns, interest level, and recommended next steps. Be concise and actionable.`;
      userContent = question;
    } else if (mode === 'coach') {
      systemPrompt = `You are a real-time sales coach listening to a live investor call. Give ONE brief, actionable coaching tip in 1-2 sentences. Focus on: tone/energy, next best talking point, handling objections, or building rapport. Be direct and conversational — the agent is reading this live.\n\nKNOWLEDGE BASE:\n${kbContext}`;
      userContent = question;
    } else {
      systemPrompt = `You are a real-time sales assistant helping during a live investor call. Answer questions concisely based on the knowledge base below. If the answer isn't in the KB, give a helpful general response. Keep answers under 3 sentences — the agent needs to speak naturally.\n\nKNOWLEDGE BASE:\n${kbContext}`;
      userContent = `${recentTranscript ? `Recent conversation: "${recentTranscript}"\n\n` : ''}Question: "${question}"\n\nBrief answer:`;
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':ANTHROPIC_KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role:'user', content: userContent }],
      }),
    });

    const data = await res.json();
    const answer = data?.content?.[0]?.text || 'No answer found.';
    return Response.json({ answer });
  } catch(e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});