const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

// Find most relevant KB entries using keyword overlap scoring
function findRelevantKB(question: string, kbEntries: any[], topN = 8): any[] {
  if (!kbEntries?.length) return [];
  const words = question.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const scored = kbEntries
    .filter(e => e.category !== 'raw_document') // skip raw chunks for Q&A lookup
    .map(e => {
      const haystack = `${e.question} ${e.answer}`.toLowerCase();
      const score = words.reduce((s, w) => s + (haystack.includes(w) ? 1 : 0), 0);
      return { ...e, score };
    })
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  // Also include raw document chunks if available and score is low
  if (scored.length < 3) {
    const rawDocs = kbEntries
      .filter(e => e.category === 'raw_document')
      .map(e => {
        const haystack = (e.answer || '').toLowerCase();
        const score = words.reduce((s, w) => s + (haystack.includes(w) ? 1 : 0), 0);
        return { ...e, score };
      })
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    scored.push(...rawDocs);
  }

  return scored;
}

Deno.serve(async (req) => {
  try {
    const { question, transcript, kbEntries, mode, leadId } = await req.json();

    const recentTranscript = (transcript || []).slice(-10).map((t: any) => t.text).join(' ');

    // ── INTENT ENGINE (duck/cow + buying signals) ──────────────────────
    if (mode === 'intent') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: `You are an expert sales intent analyzer. Classify the prospect's behavior based on recent conversation.

DUCK: Argumentative, skeptical, tries to prove things wrong, raises objections, questions everything, combative tone.
COW: Agreeable, curious, mooing along ("that's interesting", "wow", "really?"), asks genuine questions, open-minded.

Also score buying intent and question quality.

Respond ONLY with this exact JSON (no markdown):
{
  "animalType": "duck" | "cow" | "unknown",
  "animalConfidence": 0-100,
  "buyingIntent": 0-100,
  "questionQuality": 0-100,
  "intentLabel": "hot" | "warm" | "cold" | "uncertain",
  "signals": ["signal1", "signal2"],
  "coachTip": "one sentence tip for the salesperson"
}`,
          messages: [{ role: 'user', content: `Recent conversation (last 60 seconds):\n"${recentTranscript}"\n\nClassify the prospect's intent.` }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ intent: result });
      } catch {
        return Response.json({ intent: { animalType: 'unknown', buyingIntent: 50, questionQuality: 50, intentLabel: 'uncertain' } });
      }
    }

    // ── COACH MODE ─────────────────────────────────────────────────────
    if (mode === 'coach') {
      const relevantKB = findRelevantKB(recentTranscript, kbEntries, 5);
      const kbContext = relevantKB.length > 0
        ? relevantKB.map((e: any) => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')
        : '';

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: `You are a real-time sales coach on a live investor call. Give ONE actionable tip in 1-2 sentences. Be direct — the agent reads this live.

Focus on: next talking point, handling the objection just raised, building rapport, or timing a close.
${kbContext ? `\nRelevant knowledge:\n${kbContext}` : ''}`,
          messages: [{ role: 'user', content: `Live conversation:\n"${recentTranscript}"\n\nCoaching tip:` }],
        }),
      });
      const data = await res.json();
      const answer = data?.content?.[0]?.text || '';
      return Response.json({ answer });
    }

    // ── SUMMARY MODE ───────────────────────────────────────────────────
    if (mode === 'summary') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `You are a sales call analyst. Summarize in bullet points: key topics, investor questions/concerns, interest level (hot/warm/cold), and recommended next steps.`,
          messages: [{ role: 'user', content: question }],
        }),
      });
      const data = await res.json();
      return Response.json({ answer: data?.content?.[0]?.text || '' });
    }

    // ── Q&A MODE (default) ─────────────────────────────────────────────
    const relevantKB = findRelevantKB(question, kbEntries, 8);
    const kbContext = relevantKB.length > 0
      ? relevantKB.map((e: any) => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')
      : 'No relevant knowledge base entries found.';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: `You are a real-time sales assistant on a live investor call. Answer questions concisely from the knowledge base. Keep answers under 3 sentences — the agent speaks this naturally.

If the answer isn't in the KB, give a confident, helpful general response. Never say "I don't know."

KNOWLEDGE BASE:
${kbContext}`,
        messages: [{
          role: 'user',
          content: `${recentTranscript ? `Recent conversation: "${recentTranscript}"\n\n` : ''}Question: "${question}"\n\nBrief answer:`
        }],
      }),
    });
    const data = await res.json();
    return Response.json({ answer: data?.content?.[0]?.text || 'No answer found.' });

  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});