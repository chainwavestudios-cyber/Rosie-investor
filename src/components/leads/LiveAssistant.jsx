const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

// ── Smart KB search ─────────────────────────────────────────────────────────
function scoreEntry(qLower: string, words: string[], e: any): number {
  const haystack = `${e.question||''} ${e.answer||''} ${e.keywords||''}`.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (haystack.includes(w)) score += 1;
    if ((e.question||'').toLowerCase().includes(w)) score += 0.8;
    if ((e.keywords||'').toLowerCase().includes(w)) score += 0.5;
  }
  const phrases = qLower.match(/\b\w{4,}\s+\w{4,}\b/g) || [];
  for (const phrase of phrases) {
    if (haystack.includes(phrase)) score += 3;
  }
  return score;
}

function findDirectHit(question: string, kbEntries: any[]): any | null {
  const qLower = question.toLowerCase().trim();
  const words  = qLower.split(/\W+/).filter((w: string) => w.length >= 4);
  if (words.length < 2) return null;
  const candidates = kbEntries
    .filter((e: any) => e.category !== 'raw_chunk' && e.category !== 'raw_document')
    .map((e: any) => {
      const qHaystack = (e.question||'').toLowerCase();
      const matches   = words.filter(w => qHaystack.includes(w)).length;
      const coverage  = matches / words.length;
      const aScore    = scoreEntry(qLower, words, e);
      return { ...e, coverage, aScore };
    })
    .filter((e: any) => e.coverage >= 0.65 && e.aScore >= 2)
    .sort((a: any, b: any) => b.coverage - a.coverage || b.aScore - a.aScore);
  return candidates.length > 0 ? candidates[0] : null;
}

function findRelevantKB(question: string, kbEntries: any[], topN = 15): any[] {
  if (!kbEntries?.length) return [];
  const qLower = question.toLowerCase();
  const words  = qLower.split(/\W+/).filter((w: string) => w.length >= 3);

  const qaScored = kbEntries
    .filter((e: any) => e.category !== 'raw_document' && e.category !== 'raw_chunk')
    .map((e: any) => ({ ...e, score: scoreEntry(qLower, words, e) }))
    .filter((e: any) => e.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, topN);

  const chunkScored = kbEntries
    .filter((e: any) => e.category === 'raw_chunk' || e.category === 'raw_document')
    .map((e: any) => ({ ...e, score: scoreEntry(qLower, words, e) }))
    .filter((e: any) => e.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 4);

  const seen = new Set(qaScored.map((e: any) => e.id));
  const combined = [...qaScored];
  for (const c of chunkScored) { if (!seen.has(c.id)) { combined.push(c); seen.add(c.id); } }
  return combined;
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
            intentRules, coachRules, qaHistory, engagementScore,
            kbName, previousAnswer, internetQuery } = body;

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
      // Compute rich sentiment data from Deepgram utterances
      const utterances = (transcript || []).filter((t: any) => t.sentiment);
      const posCount = utterances.filter((t: any) => t.sentiment === 'positive').length;
      const negCount = utterances.filter((t: any) => t.sentiment === 'negative').length;
      const neuCount = utterances.filter((t: any) => t.sentiment === 'neutral').length;
      const total    = utterances.length;

      // Speaker-separated sentiment (Speaker 0 = agent, Speaker 1 = prospect)
      const prospectUtterances = utterances.filter((t: any) => t.speaker === 1 || t.speaker === null);
      const agentUtterances    = utterances.filter((t: any) => t.speaker === 0);
      const prospectPos = prospectUtterances.filter((t: any) => t.sentiment === 'positive').length;
      const prospectNeg = prospectUtterances.filter((t: any) => t.sentiment === 'negative').length;

      // Sentiment arc — compare first third vs last third of call
      const firstThird = utterances.slice(0, Math.floor(total / 3));
      const lastThird  = utterances.slice(Math.floor(total * 2 / 3));
      const firstPosRatio = firstThird.length ? firstThird.filter((t: any) => t.sentiment === 'positive').length / firstThird.length : 0;
      const lastPosRatio  = lastThird.length  ? lastThird.filter((t: any) => t.sentiment === 'positive').length  / lastThird.length  : 0;
      const arcTrend = total < 3 ? 'insufficient data'
        : lastPosRatio > firstPosRatio + 0.15 ? 'warming'
        : lastPosRatio < firstPosRatio - 0.15 ? 'cooling'
        : Math.abs(lastPosRatio - firstPosRatio) < 0.05 ? 'flat'
        : 'volatile';

      // Consecutive negative streak detection
      let maxNegStreak = 0; let curStreak = 0;
      for (const t of utterances) {
        if (t.sentiment === 'negative') { curStreak++; maxNegStreak = Math.max(maxNegStreak, curStreak); }
        else curStreak = 0;
      }

      const sentimentSummary = total > 0
        ? `${total} utterances with sentiment data. Overall: ${posCount} positive, ${negCount} negative, ${neuCount} neutral. Prospect specifically: ${prospectPos} positive, ${prospectNeg} negative. Sentiment arc: ${arcTrend} (first third: ${Math.round(firstPosRatio*100)}% positive → last third: ${Math.round(lastPosRatio*100)}% positive). Max consecutive negative streak: ${maxNegStreak}. ${maxNegStreak >= 3 ? 'RESISTANCE SPIKE DETECTED.' : ''}`
        : 'No Deepgram sentiment data available for this call.';

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1200,
          system: `You are an expert sales call analyst measuring prospect intent, tonality, and interest. Also extract key facts from the conversation to auto-populate the CRM.
DEEPGRAM SENTIMENT ANALYSIS: ${sentimentSummary}
${intentRules?.sentimentRules ? 'SENTIMENT BEHAVIOR RULES:\n' + (() => { try { return JSON.parse(intentRules.sentimentRules).map((r: any) => '- When ' + r.condition + ': ' + r.effect).join('\n'); } catch { return String(intentRules.sentimentRules); } })() + '\n' : ''}
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

      let reportPrompt = `Generate a structured sales call report.\n${kbName ? `Knowledge Base Used: ${kbName}\n` : ''}\nTranscript:\n"${fullTranscript.slice(0, 5000)}"\n\nInclude these sections:\n## Call Summary\n## Prospect Interest Level\n## Key Questions Asked\n## Objections & Concerns\n## Highlights\n## Recommended Next Steps\n${kbName ? `## Knowledge Base: ${kbName}\n` : ''}## Clean Transcript\n`;
      if (usedQA && qaLog?.length) {
        const kbLabel = kbName ? ` [KB: ${kbName}]` : '';
        reportPrompt += `\n## Q&A During Call${kbLabel}\n` + qaLog.map((qa: any) => {
          const src = qa.source === 'kb_direct' ? ' ⚡ Direct KB' : qa.source === 'internet' ? ' 🌐 Internet' : qa.source === 'kb_expand' ? ' + More KB' : ' KB+AI';
          const kb  = qa.kbName ? ` [${qa.kbName}]` : kbLabel;
          return `Q: ${qa.question}\nA${src}${kb}: ${qa.answer || '[Not answered]'}`;
        }).join('\n\n');
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

    // ── Internet search ───────────────────────────────────────────────
    if (mode === 'internet_search') {
      const searchQ = internetQuery || question || '';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          system: 'You are a sales assistant helping an agent on a live investor call. Search the web for current, accurate information to answer the question. Provide a concise, factual answer in 2-4 sentences that the agent can speak naturally.',
          messages: [{ role: 'user', content: `Search for current information to answer this question for an investor call:\n\n${searchQ}` }],
        }),
      });
      const data = await res.json();
      const answer = data?.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ') || 'Could not find information.';
      return Response.json({ answer, source: 'internet' });
    }

    // ── Q&A expand (additional information) ───────────────────────────
    if (mode === 'qa_expand') {
      // Search KB first for more detail, then supplement with AI synthesis
      const relevantKB = findRelevantKB(question || '', kbEntries || [], 12);
      const kbContext  = relevantKB.length > 0
        ? relevantKB.map((e: any) => e.category === 'raw_chunk'
            ? `[Document excerpt]: ${e.answer}`
            : `Q: ${e.question}\nA: ${e.answer}`
          ).join('\n\n')
        : 'No additional KB entries found.';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `You are a sales assistant providing expanded information from a knowledge base. The agent already gave an initial answer and needs more detail. Search the KB context and provide additional relevant facts, numbers, or context not already covered.\n\nKNOWLEDGE BASE:\n${kbContext}`,
          messages: [{ role: 'user', content: `Question: "${question}"\n\nInitial answer already given: "${previousAnswer || ''}"\n\nProvide ADDITIONAL specific details, numbers, or context from the KB that wasn't in the initial answer:` }],
        }),
      });
      const data = await res.json();
      return Response.json({ answer: data?.content?.[0]?.text || 'No additional information found.', source: 'kb' });
    }

    // ── Q&A (default) — try direct hit first, AI only if needed ──────
    const q = question || recentTranscript;

    // 1. Try direct KB hit — return pre-written answer with zero AI tokens
    if (question) {
      const directHit = findDirectHit(question, kbEntries || []);
      if (directHit) {
        console.log(`[liveAssistantAI] Direct KB hit: "${directHit.question}" (coverage high)`);
        return Response.json({ answer: directHit.answer, source: 'kb_direct', kbEntry: directHit.question });
      }
    }

    // 2. No direct hit — use AI with relevant KB context
    const relevantKB = findRelevantKB(q, kbEntries || [], 12);
    const kbContext  = relevantKB.length > 0
      ? relevantKB.map((e: any) => e.category === 'raw_chunk'
          ? `[Document excerpt]: ${e.answer}`
          : `Q: ${e.question}\nA: ${e.answer}`
        ).join('\n\n')
      : 'No relevant knowledge base entries found.';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `You are a real-time sales assistant on a live investor call. Answer questions from the knowledge base. Be concise — 2-4 sentences the agent can speak naturally. If the exact answer is in the KB, use it verbatim. If it requires synthesis, combine the relevant entries.\n\nKNOWLEDGE BASE${kbName ? ` (${kbName})` : ''}:\n${kbContext}`,
        messages: [{ role: 'user', content: `${recentTranscript ? `Recent conversation:\n${recentTranscript}\n\n` : ''}Question: "${question}"\n\nAnswer from KB:` }],
      }),
    });
    const data = await res.json();
    return Response.json({ answer: data?.content?.[0]?.text || 'No answer found.', source: 'kb_ai' });

  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});