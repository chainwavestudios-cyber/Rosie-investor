const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

function findRelevantKB(question: string, kbEntries: any[], topN = 3): any[] {
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
      .slice(0, 1);
    scored.push(...rawDocs);
  }
  return scored;
}

function buildTranscriptString(transcript: any[], limit = 20): string {
  return (transcript || []).slice(-limit).map((t: any) => {
    const speaker = t.speaker !== null && t.speaker !== undefined ? `[S${t.speaker}]` : '';
    const sent    = t.sentiment ? `[${t.sentiment}]` : '';
    return `${speaker}${sent} ${t.text}`.trim();
  }).join('\n');
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { question, transcript, kbEntries, mode, existingProfile,
            intentRules, coachRules, qaHistory, engagementScore } = body;

    const recentTranscript = buildTranscriptString(transcript, 15);

    // ── STREAMING COACH ───────────────────────────────────────────────
    if (mode === 'coach_stream') {
      const relevantKB = findRelevantKB(recentTranscript, kbEntries || [], 3);
      const kbContext  = relevantKB.map((e: any) => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'messages-2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          stream: true,
          system: `You are a real-time sales coach whispering to an agent on a live investor call. ${coachRules?.style || 'Give ONE actionable tip in 1-2 sentences. Be direct and specific — agent reads this mid-call.'}\nFocus: ${coachRules?.focusAreas || 'handling objections, building rapport, next talking point, timing a close'}.${coachRules?.additionalContext ? `\nContext: ${coachRules.additionalContext}` : ''}${kbContext ? `\n\nRelevant KB:\n${kbContext}` : ''}`,
          messages: [{ role: 'user', content: `Live conversation:\n${recentTranscript}\n\nCoaching tip now:` }],
        }),
      });
      // Stream the response directly back
      return new Response(res.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // ── POST-CALL INTENT ANALYSIS ─────────────────────────────────────
    if (mode === 'intent_final') {
      const fullTranscript = buildTranscriptString(transcript, 999);
      // Compute sentiment arc from Deepgram data
      const sentiments = (transcript || [])
        .filter((t: any) => t.sentiment)
        .map((t: any) => ({ s: t.sentiment, sc: t.sentScore || 0 }));
      const posCount = sentiments.filter((s: any) => s.s === 'positive').length;
      const negCount = sentiments.filter((s: any) => s.s === 'negative').length;
      const sentimentSummary = sentiments.length
        ? `${posCount} positive, ${negCount} negative, ${sentiments.length - posCount - negCount} neutral segments`
        : 'No sentiment data';

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1200,
          system: `You are an expert sales call analyst measuring prospect intent, tonality, and interest. Also extract key facts from the conversation to auto-populate the CRM.
Deepgram sentiment summary: ${sentimentSummary}
DUCK: ${intentRules?.duckDefinition || 'Skeptical, argumentative, raises objections, combative, negative tone'}
COW: ${intentRules?.cowDefinition || 'Curious, agreeable, asks genuine buying questions, positive tone'}
POSITIVE SIGNALS TO DETECT: ${intentRules?.positiveSignals || 'that sounds amazing, I love that, so what would I need to do, how do I sign up, I\'m ready, let\'s do it, what\'s the minimum again, send me the portal, I want to move forward, is this a good investment, that makes sense, I like the sound of that, I\'ve had money sitting, I\'m in, tell me more, really?, wow'}
NEGATIVE SIGNALS TO DETECT: ${intentRules?.negativeSignals || 'not interested, call me later, I need to think about it, talk to my spouse, too risky, too expensive, I need more time, I\'ve been burned before, sounds like a pitch, I\'ll let you know, I\'m going to pass, what\'s the guarantee, I doubt that, prove it, that won\'t work, sounds too good to be true, what\'s the catch'}
Respond ONLY with this exact JSON (no markdown):
{
  "intentScore": 0-100,
  "tonality": "positive|neutral|negative|mixed",
  "tonalityNotes": "1-2 sentences on how they spoke and engaged",
  "interestLevel": "high|medium|low",
  "interestReason": "1-2 sentences explaining why",
  "animalType": "duck|cow|unknown",
  "animalConfidence": 0-100,
  "sentimentArc": "warming|cooling|flat|volatile",
  "sentimentArcNotes": "how their tone shifted during the call",
  "keyMoments": ["moment1","moment2","moment3"],
  "buyingSignals": ["signal1","signal2"],
  "objections": ["objection1","objection2"],
  "recommendedNextStep": "specific actionable next step",
  "extractedData": {
    "mentionedAmount": "number only if they mentioned a dollar amount e.g. 50000, else null",
    "accountType": "cash or ira if mentioned, else null",
    "iraDetails": "IRA custodian or account details if mentioned, else null",
    "bestTimeToCall": "preferred callback time if mentioned e.g. mornings, after 3pm, else null",
    "positiveSignals": ["exact phrases they said showing genuine interest or buying intent"],
    "negativeSignals": ["exact phrases they said showing hesitation, objection, or disinterest"],
    "extractedNotes": "1-2 sentence summary of key facts worth noting on the contact card, or null"
  }
}`,
          messages: [{ role: 'user', content: `Full call transcript:\n${fullTranscript.slice(0, 6000)}` }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        // Blend with engagement score (max 25% influence)
        const engNorm = Math.min(100, Math.max(0, engagementScore || 0));
        const blended = Math.round(result.intentScore * 0.75 + engNorm * 0.25);
        return Response.json({ intent: { ...result, intentScore: blended, rawAiScore: result.intentScore, engagementContribution: Math.round(engNorm * 0.25) } });
      } catch {
        return Response.json({ intent: null, error: 'Parse failed' });
      }
    }

    // ── POST-CALL FULL REPORT ─────────────────────────────────────────
    if (mode === 'full_report') {
      const { usedCoach, usedQA, usedIntent, coachTips, qaLog, intentResult } = body;
      const fullTranscript = (transcript || []).map((t: any) => t.text).join(' ');

      let reportPrompt = `Generate a structured sales call report.\n\nTranscript:\n"${fullTranscript.slice(0, 5000)}"\n\nInclude these sections:\n## Call Summary\n## Prospect Interest Level\n## Key Questions Asked\n## Objections & Concerns\n## Highlights\n## Recommended Next Steps\n## Clean Transcript\n`;
      if (usedQA && qaLog?.length) {
        reportPrompt += `\n## Q&A During Call\n${qaLog.map((qa: any) => `Q: ${qa.question}\n${qa.answered ? `A: ${qa.answer}` : 'A: [Not answered via AI]'}`).join('\n\n')}`;
      }
      if (usedCoach && coachTips?.length) {
        reportPrompt += `\n## Coach Tips During Call\n${coachTips.map((t: any, i: number) => `${i+1}. ${t}`).join('\n')}`;
      }
      if (usedIntent && intentResult) {
        reportPrompt += `\n## Intent Analysis\nIntent Score: ${intentResult.intentScore}/100\nInterest Level: ${intentResult.interestLevel}\nTonality: ${intentResult.tonality}\nSentiment Arc: ${intentResult.sentimentArc}\n${intentResult.intentReason || ''}`;
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          system: 'You are a sales call analyst. Generate a detailed, structured post-call report.',
          messages: [{ role: 'user', content: reportPrompt }],
        }),
      });
      const data = await res.json();
      return Response.json({ report: data?.content?.[0]?.text || '' });
    }

    // ── CLIENT PROFILE ────────────────────────────────────────────────
    if (mode === 'profile') {
      const existing = (() => { try { return JSON.parse(existingProfile || '{}'); } catch { return {}; } })();
      const fullTranscript = (transcript || []).map((t: any) => t.text).join(' ');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `You are analyzing a sales call to build a persistent client profile. Return ONLY this exact JSON (no markdown):
{"animalType":"duck or cow or unknown","animalConfidence":0-100,"overallIntentLabel":"hot or warm or cold","traits":{"asksLotOfQuestions":true/false,"quickToInterrupt":true/false,"asksBuyingQuestions":true/false,"talksALot":true/false,"asksTechnicalQuestions":true/false,"raisesObjections":true/false,"agreeable":true/false,"priceConscious":true/false,"decisionMaker":true/false},"keyObservations":["obs1","obs2"],"recommendedApproach":"one sentence","callCount":${(existing.callCount || 0) + 1},"lastCallSummary":"2-3 sentence summary"}`,
          messages: [{ role: 'user', content: `Existing profile:\n${JSON.stringify(existing)}\n\nTranscript:\n"${fullTranscript.slice(0, 4000)}"` }],
        }),
      });
      const data = await res.json();
      const text2 = data?.content?.[0]?.text || '{}';
      try { return Response.json({ profile: JSON.parse(text2.replace(/```json|```/g, '').trim()) }); }
      catch { return Response.json({ profile: existing }); }
    }

    // ── Q&A (default) ─────────────────────────────────────────────────
    const relevantKB = findRelevantKB(question || recentTranscript, kbEntries || [], 3);
    const kbContext  = relevantKB.length > 0
      ? relevantKB.map((e: any) => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')
      : 'No relevant knowledge base entries found.';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: `You are a real-time sales assistant on a live investor call. Answer questions accurately and completely from the knowledge base. Give the full answer — do not truncate or summarize unless the KB answer itself is brief.\n\nKNOWLEDGE BASE:\n${kbContext}`,
        messages: [{ role: 'user', content: `${recentTranscript ? `Recent conversation:\n${recentTranscript}\n\n` : ''}Question: "${question}"\n\nAnswer:` }],
      }),
    });
    const data = await res.json();
    return Response.json({ answer: data?.content?.[0]?.text || 'No answer found.' });

  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});