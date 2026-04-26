const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

// Score KB entries by keyword relevance to the question
function findRelevantKB(question: string, kbEntries: any[], topN = 8): any[] {
  if (!kbEntries?.length) return [];
  const words = question.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3);
  const scored = kbEntries
    .filter((e: any) => e.category !== 'raw_document')
    .map((e: any) => {
      const haystack = `${e.question} ${e.answer}`.toLowerCase();
      const score = words.reduce((s: number, w: string) => s + (haystack.includes(w) ? 1 : 0), 0);
      return { ...e, score };
    })
    .filter((e: any) => e.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, topN);

  // Fall back to raw document chunks if no matches found
  if (scored.length < 2) {
    const rawDocs = kbEntries
      .filter((e: any) => e.category === 'raw_document')
      .map((e: any) => {
        const haystack = (e.answer || '').toLowerCase();
        const score = words.reduce((s: number, w: string) => s + (haystack.includes(w) ? 1 : 0), 0);
        return { ...e, score };
      })
      .filter((e: any) => e.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 2);
    scored.push(...rawDocs);
  }

  return scored;
}

Deno.serve(async (req) => {
  try {
    const { question, transcript, kbEntries, mode, existingProfile, intentRules, coachRules } = await req.json();
    const recentTranscript = (transcript || []).slice(-10).map((t: any) => t.text).join(' ');

    // ── INTENT ENGINE ─────────────────────────────────────────────────
    if (mode === 'intent') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: `You are an expert sales intent analyzer. Classify the prospect based on the recent conversation.

DUCK: ${intentRules?.duckDefinition || 'Argumentative, skeptical, raises objections, tries to prove things wrong, combative.'}
COW: ${intentRules?.cowDefinition || 'Agreeable, curious, open-minded, says things like "that\'s interesting", "really?", asks genuine questions, believes what you say.'}

Respond ONLY with this exact JSON (no markdown, no extra text):
{"animalType":"duck or cow or unknown","animalConfidence":0-100,"buyingIntent":0-100,"questionQuality":0-100,"intentLabel":"hot or warm or cold or uncertain","signals":["signal1","signal2"],"coachTip":"one sentence tip for the salesperson right now"}`,
          messages: [{ role: 'user', content: `Recent conversation:\n"${recentTranscript}"\n\nClassify the prospect's intent.` }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ intent: result });
      } catch {
        return Response.json({ intent: { animalType: 'unknown', buyingIntent: 50, questionQuality: 50, intentLabel: 'uncertain', signals: [], coachTip: '' } });
      }
    }

    // ── COACH MODE ────────────────────────────────────────────────────
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
          max_tokens: 150,
          system: `You are a real-time sales coach on a live investor call. ${coachRules?.style || 'Give ONE actionable tip in 1-2 sentences. Be direct — the agent reads this mid-call.'} Focus on: ${coachRules?.focusAreas || 'next talking point, handling the last objection, building rapport, or timing a close'}.${coachRules?.additionalContext ? `\n\nContext: ${coachRules.additionalContext}` : ''}${kbContext ? `\n\nRelevant knowledge:\n${kbContext}` : ''}`,
          messages: [{ role: 'user', content: `Live conversation:\n"${recentTranscript}"\n\nCoaching tip:` }],
        }),
      });
      const data = await res.json();
      return Response.json({ answer: data?.content?.[0]?.text || '' });
    }

    // ── CLIENT PROFILE MODE ──────────────────────────────────────────
    if (mode === 'profile') {
      const existing = (() => { try { return JSON.parse(existingProfile || '{}'); } catch { return {}; } })();
      const fullTranscript = (transcript || []).map((t: any) => t.text).join(' ');

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `You are analyzing a sales call to build a persistent client profile. Based on the transcript, determine behavioral traits. Merge with any existing profile data.

Return ONLY this exact JSON (no markdown):
{
  "animalType": "duck or cow or unknown",
  "animalConfidence": 0-100,
  "overallIntentLabel": "hot or warm or cold",
  "traits": {
    "asksLotOfQuestions": true/false,
    "quickToInterrupt": true/false,
    "asksBuyingQuestions": true/false,
    "talksALot": true/false,
    "asksTechnicalQuestions": true/false,
    "raisesObjections": true/false,
    "agreeable": true/false,
    "priceConscious": true/false,
    "decisionMaker": true/false
  },
  "keyObservations": ["observation1", "observation2", "observation3"],
  "recommendedApproach": "one sentence on how to handle this prospect next call",
  "callCount": ${(existing.callCount || 0) + 1},
  "lastCallSummary": "2-3 sentence summary of this specific call"
}`,
          messages: [{ role: 'user', content: `Existing profile:
${JSON.stringify(existing, null, 2)}

Call transcript:
"${fullTranscript.slice(0, 4000)}"` }],
        }),
      });
      const data = await res.json();
      const text2 = data?.content?.[0]?.text || '{}';
      try {
        const profile = JSON.parse(text2.replace(/```json|```/g, '').trim());
        return Response.json({ profile });
      } catch {
        return Response.json({ profile: existing });
      }
    }

    // ── SUMMARY MODE ──────────────────────────────────────────────────
    if (mode === 'summary') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `You are a sales call analyst. Summarize in bullet points: key topics discussed, investor questions/concerns, interest level (hot/warm/cold), and recommended next steps.`,
          messages: [{ role: 'user', content: question }],
        }),
      });
      const data = await res.json();
      return Response.json({ answer: data?.content?.[0]?.text || '' });
    }

    // ── Q&A MODE (default) ────────────────────────────────────────────
    const relevantKB = findRelevantKB(question || recentTranscript, kbEntries, 8);
    const kbContext = relevantKB.length > 0
      ? relevantKB.map((e: any) => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')
      : 'No relevant knowledge base entries found.';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: `You are a real-time sales assistant on a live investor call. Answer questions concisely from the knowledge base. Keep answers under 3 sentences — the agent speaks this naturally. Never say "I don't know" — give a confident helpful response.\n\nKNOWLEDGE BASE:\n${kbContext}`,
        messages: [{ role: 'user', content: `${recentTranscript ? `Recent conversation: "${recentTranscript}"\n\n` : ''}Question: "${question}"\n\nBrief answer:` }],
      }),
    });
    const data = await res.json();
    return Response.json({ answer: data?.content?.[0]?.text || 'No answer found.' });

  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});