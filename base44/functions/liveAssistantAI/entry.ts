import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

// ── Multi-answer helper ─────────────────────────────────────────────────────
// Returns all answers for an entry: parses answersJson (array) if present,
// otherwise falls back to the single `answer` field.
function getAnswers(e: any): string[] {
  const out: string[] = [];
  if (e?.answersJson) {
    try {
      const arr = JSON.parse(e.answersJson);
      if (Array.isArray(arr)) {
        for (const a of arr) { if (typeof a === 'string' && a.trim()) out.push(a); }
      }
    } catch {}
  }
  if (out.length === 0 && e?.answer && String(e.answer).trim()) out.push(String(e.answer));
  return out;
}

// Formats all answers for an entry as a numbered list (for AI context / display)
function formatAnswers(e: any): string {
  const answers = getAnswers(e);
  if (answers.length <= 1) return answers[0] || '';
  return answers.map((a, i) => `${i + 1}. ${a}`).join('\n');
}

// ── Smart KB search ─────────────────────────────────────────────────────────
function scoreEntry(qLower: string, words: string[], e: any): number {
  const haystack = `${e.question||''} ${e.answer||''} ${e.answersJson||''} ${e.keywords||''} ${e.variations||''}`.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (haystack.includes(w)) score += 1;
    if ((e.question||'').toLowerCase().includes(w)) score += 0.8;
    if ((e.keywords||'').toLowerCase().includes(w)) score += 0.5;
    if ((e.variations||'').toLowerCase().includes(w)) score += 0.6;
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
            kbName, previousAnswer, internetQuery,
            callAttemptNumber } = body;

    const recentTranscript = buildTranscriptString(transcript, 15);

    // ── LIVE COACH (non-streaming, hotpoint-aware) ──────────────────
    if (mode === 'coach') {
      const relevantKB = findRelevantKB(recentTranscript, kbEntries || [], 3);
      const kbContext  = relevantKB.filter((e: any) => e.category !== 'debt_hotpoints').map((e: any) => `Q: ${e.question}\nA: ${formatAnswers(e)}`).join('\n\n');
      const hotpoints = (kbEntries || []).filter((e: any) => e.category === 'debt_hotpoints');
      const hotpointContext = hotpoints.length > 0
        ? hotpoints.map((e: any) => `TRIGGER: ${e.question}\nTYPE: ${e.tags || 'general'}\nGUIDANCE: ${e.answer}`).join('\n---\n')
        : '';
      const objections = (kbEntries || []).filter((e: any) => e.category === 'debt_objections');
      const objectionContext = objections.length > 0
        ? objections.map((e: any) => `OBJECTION: "${e.question}"\nHOW TO HANDLE: ${e.answer}`).join('\n---\n')
        : '';
      const memories = body.memories || [];
      const memoryContext = memories.length > 0
        ? memories.map((m: any) => `- [${m.factType || 'personal'}${m.importance === 'high' ? ' ★ HIGH' : ''}] ${m.factText}${m.context ? ` (context: ${m.context})` : ''}${m.followUpDate ? ` — FOLLOW UP BY ${new Date(m.followUpDate).toLocaleDateString()}` : ''}`).join('\n')
        : '';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: `You are a real-time sales coach whispering to an agent on a live debt settlement call. Give ONE actionable coaching tip, then provide a specific script of EXACTLY what to say next — ready for the agent to read aloud word-for-word.
Format your response EXACTLY like this:
TIP: <1-2 sentence coaching recommendation — what to do and why>
SAY: "<exact words the agent should say to the customer right now, in quotes, conversational and natural>"
Be direct and specific — agent reads this mid-call and may read the SAY line aloud verbatim.
Focus: handling objections, building rapport, next talking point, timing a close.
${memoryContext ? `\n━━━ KEY FACTS ABOUT THIS PROSPECT — Remember these from previous calls. Weave them in naturally to build rapport (e.g., ask about their wife by name, mention their kid's birthday, reference their job change). These are GOLD for building trust: ━━━\n${memoryContext}` : ''}
${hotpointContext ? `\n━━━ COACHING HOTPOINTS — Watch for these triggers in the live conversation. If the customer or agent says something matching a trigger, immediately coach the agent using the guidance and strategy below: ━━━\n${hotpointContext}` : ''}
${objectionContext ? `\n━━━ OBJECTION HANDLING CATALOG — When the customer raises any of these objections (or something close), coach the agent on how to handle them using the guidance below. Match the customer's words to the closest objection: ━━━\n${objectionContext}` : ''}
${kbContext ? `\n\nRelevant KB:\n${kbContext}` : ''}`,
          messages: [{ role: 'user', content: `Live conversation:\n${recentTranscript}\n\nCoaching tip now:` }],
        }),
      });
      const data = await res.json();
      return Response.json({ tip: data?.content?.[0]?.text || '' });
    }

    // ── STREAMING COACH ───────────────────────────────────────────────
    if (mode === 'coach_stream') {
      const relevantKB = findRelevantKB(recentTranscript, kbEntries || [], 3);
      const kbContext  = relevantKB.filter((e: any) => e.category !== 'debt_hotpoints').map((e: any) => `Q: ${e.question}\nA: ${formatAnswers(e)}`).join('\n\n');
      const hotpoints = (kbEntries || []).filter((e: any) => e.category === 'debt_hotpoints');
      const hotpointContext = hotpoints.length > 0
        ? hotpoints.map((e: any) => `TRIGGER: ${e.question}\nTYPE: ${e.tags || 'general'}\nGUIDANCE: ${e.answer}`).join('\n---\n')
        : '';
      const objections = (kbEntries || []).filter((e: any) => e.category === 'debt_objections');
      const objectionContext = objections.length > 0
        ? objections.map((e: any) => `OBJECTION: "${e.question}"\nHOW TO HANDLE: ${e.answer}`).join('\n---\n')
        : '';
      const memories = body.memories || [];
      const memoryContext = memories.length > 0
        ? memories.map((m: any) => `- [${m.factType || 'personal'}${m.importance === 'high' ? ' ★ HIGH' : ''}] ${m.factText}${m.context ? ` (context: ${m.context})` : ''}${m.followUpDate ? ` — FOLLOW UP BY ${new Date(m.followUpDate).toLocaleDateString()}` : ''}`).join('\n')
        : '';
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
          max_tokens: 300,
          stream: true,
          system: `You are a real-time sales coach whispering to an agent on a live investor call. ${coachRules?.style || 'Give ONE actionable coaching tip, then provide a specific script of EXACTLY what to say next — ready for the agent to read aloud word-for-word.'}\nFormat your response EXACTLY like this:\nTIP: <1-2 sentence coaching recommendation — what to do and why>\nSAY: "<exact words the agent should say to the customer right now, in quotes, conversational and natural>"\nBe direct and specific — agent reads this mid-call and may read the SAY line aloud verbatim.\nFocus: ${coachRules?.focusAreas || 'handling objections, building rapport, next talking point, timing a close'}.${coachRules?.additionalContext ? `\nContext: ${coachRules.additionalContext}` : ''}${callAttemptNumber ? `\nThis is call #${callAttemptNumber} with this prospect.` : ''}${memoryContext ? `\n\n━━━ KEY FACTS ABOUT THIS PROSPECT — Remember these from previous calls. Weave them in naturally to build rapport (e.g., ask about their wife by name, mention their kid's birthday, reference their job change). These are GOLD for building trust: ━━━\n${memoryContext}` : ''}${hotpointContext ? `\n\n━━━ COACHING HOTPOINTS — Watch for these triggers. If the customer or agent says something matching a trigger, coach the agent using the guidance: ━━━\n${hotpointContext}` : ''}${objectionContext ? `\n\n━━━ OBJECTION HANDLING CATALOG — When the customer raises any of these objections (or something close), coach the agent on how to handle them using the guidance below. Match the customer's words to the closest objection: ━━━\n${objectionContext}` : ''}${kbContext ? `\n\nRelevant KB:\n${kbContext}` : ''}`,
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

    // ── POST-CALL INTENT ANALYSIS (ENHANCED INTENT ENGINE) ────────────
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

      // ── Compute talk ratio from word counts ──────────────────────────
      const allEntries = transcript || [];
      const prospectEntries = allEntries.filter((t: any) => t.speaker === 1 || t.speaker === null || t.speaker === undefined);
      const agentEntries = allEntries.filter((t: any) => t.speaker === 0);
      const prospectWords = prospectEntries.reduce((s: number, t: any) => s + (t.text || '').split(/\s+/).filter((w: string) => w.length > 0).length, 0);
      const agentWords = agentEntries.reduce((s: number, t: any) => s + (t.text || '').split(/\s+/).filter((w: string) => w.length > 0).length, 0);
      const totalWords = prospectWords + agentWords;
      const talkRatioProspect = totalWords > 0 ? Math.round((prospectWords / totalWords) * 100) : 0;

      // ── Compute call duration from timestamps ───────────────────────
      let callDurationSeconds = 0;
      if (allEntries.length >= 2) {
        const first = allEntries[0];
        const last = allEntries[allEntries.length - 1];
        const t1 = first.time ? new Date(first.time).getTime() : 0;
        const t2 = last.time ? new Date(last.time).getTime() : 0;
        if (t1 && t2 && t2 > t1) callDurationSeconds = Math.round((t2 - t1) / 1000);
      }

      // ── Count questions asked by prospect ───────────────────────────
      const prospectText = prospectEntries.map((t: any) => t.text || '').join(' ');
      const questionMatches = prospectText.match(/\?/g) || [];
      const questionCount = questionMatches.length;

      // ── Count hesitation markers ─────────────────────────────────────
      const hesitationRegex = /\b(um|uh|hmm|er|ah|let me think|I need to think|I'm not sure|maybe|perhaps|I suppose|sort of|kind of)\b/gi;
      const hesitationCount = (prospectText.match(hesitationRegex) || []).length;

      const sentimentSummary = total > 0
        ? `${total} utterances with sentiment data. Overall: ${posCount} positive, ${negCount} negative, ${neuCount} neutral. Prospect specifically: ${prospectPos} positive, ${prospectNeg} negative. Sentiment arc: ${arcTrend} (first third: ${Math.round(firstPosRatio*100)}% positive → last third: ${Math.round(lastPosRatio*100)}% positive). Max consecutive negative streak: ${maxNegStreak}. ${maxNegStreak >= 3 ? 'RESISTANCE SPIKE DETECTED.' : ''}`
        : 'No Deepgram sentiment data available for this call.';

      const computedMetrics = `COMPUTED METRICS (use these in your analysis):
- Talk ratio: prospect spoke ${talkRatioProspect}% of the time (${prospectWords} words vs agent ${agentWords} words)
- Call duration: ${callDurationSeconds} seconds (${Math.floor(callDurationSeconds/60)}m ${callDurationSeconds%60}s)
- Questions asked by prospect: ${questionCount}
- Hesitation markers detected: ${hesitationCount}
- Total transcript lines: ${allEntries.length}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          system: `You are an expert sales call analyst running a comprehensive INTENT ENGINE that measures many dimensions of a prospect's behavior, engagement, and intent on a debt settlement sales call. Also extract key facts from the conversation to auto-populate the CRM and build a persistent memory for follow-up calls.

DEEPGRAM SENTIMENT ANALYSIS: ${sentimentSummary}

${computedMetrics}

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
  "engagementScore": 0-100,
  "engagementNotes": "1-2 sentences on how engaged they were — participation depth, responsiveness, initiative",
  "excitementLevel": "low|medium|high",
  "excitementNotes": "what indicated their excitement level — tone, energy words, exclamation, pace",
  "emotionalState": "stressed|hopeful|skeptical|desperate|confident|overwhelmed|neutral",
  "emotionalNotes": "1-2 sentences on their underlying emotional state",
  "commitmentLevel": "none|soft|firm",
  "commitmentDetails": "what they specifically agreed to or committed to, or null if nothing",
  "pace": "rushed|steady|deliberate",
  "paceNotes": "how quickly they want to move forward",
  "rapportLevel": 0-100,
  "rapportNotes": "how much personal connection/rapport was built during the call",
  "questionCount": number,
  "questionTypes": {"buying": number, "informational": number, "technical": number, "objection": number},
  "talkRatioProspect": number,
  "callDurationSeconds": number,
  "hesitationCount": number,
  "objectionCount": number,
  "buyingSignalCount": number,
  "keyMoments": ["moment1","moment2","moment3"],
  "buyingSignals": ["signal1","signal2"],
  "objections": ["objection1","objection2"],
  "recommendedNextStep": "specific actionable next step",
  "keyFacts": [
    {"type":"personal|family|financial|preference|life_event|follow_up|hot_button","fact":"the key fact mentioned","context":"how it came up","importance":"high|medium|low","followUpDate":"ISO date if time-sensitive like a birthday next week, else null"}
  ],
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

    // ── EXTRACT KEY FACTS / MEMORIES FROM CALL ────────────────────────
    if (mode === 'extract_facts') {
      const fullTranscript = (transcript || []).map((t: any) => `[${t.speaker === 0 ? 'AGENT' : 'PROSPECT'}]: ${t.text}`).join('\n');
      const existingFacts = body.existingFacts || [];
      const existingFactTexts = existingFacts.map((f: any) => (f.factText || '').toLowerCase());

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: `You are a sales CRM assistant extracting KEY FACTS and personal details from a debt settlement sales call that the agent should remember for future follow-up calls. Extract:
- Personal details: spouse name, kids' names/ages, birthday, anniversary
- Life events: job change, medical issue, divorce, relocation, retirement
- Financial details: income, debt amount, creditor names, payment struggles
- Preferences: best time to call, communication preference
- Follow-up items: things they said to follow up on ("my wife's birthday is next week", "I get paid Friday", "call me after the holidays")
- Hot buttons: emotional triggers, things that excited or concerned them

Only extract facts that are EXPLICITLY mentioned in the transcript. Do NOT make up data.
Return ONLY this JSON (no markdown):
{"facts":[{"type":"personal|family|financial|preference|life_event|follow_up|hot_button","fact":"the key fact","context":"how it came up in 1 sentence","importance":"high|medium|low","followUpDate":"ISO date if time-sensitive like a birthday next week, else null"}]}

EXISTING FACTS ALREADY STORED (do not duplicate these):
${existingFactTexts.length > 0 ? existingFactTexts.join('\n') : 'None yet'}`,
          messages: [{ role: 'user', content: `Call transcript:\n${fullTranscript.slice(0, 5000)}` }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ facts: result.facts || [] });
      } catch {
        return Response.json({ facts: [] });
      }
    }

    // ── HARDSHIP EXTRACTION ────────────────────────────────────────────
    if (mode === 'hardship') {
      const recentText = (transcript || []).slice(-15).map((t: any) => t.text).join(' ');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: `You are analyzing a live debt settlement call transcript. Extract any hardship information the customer mentions — what caused their financial difficulty, when it started, and how it impacted them.

Look for:
- WHEN: Job loss, medical emergency, divorce, death in family, business closure, reduced hours, etc. — and when it happened
- WHY: The root cause of their financial situation
- HOW: How it impacted their finances — fell behind on payments, used credit cards to survive, depleted savings, etc.

Return JSON. Only include information explicitly mentioned — do NOT make up data. If nothing new is mentioned, return empty strings.

Transcript:
${recentText}`,
          messages: [{ role: 'user', content: 'Extract hardship details:' }],
          response_json_schema: undefined,
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ hardship: result });
      } catch {
        return Response.json({ hardship: null });
      }
    }

    // ── CO-SIGNER EXTRACTION ──────────────────────────────────────────
    if (mode === 'cosigners') {
      const recentText = (transcript || []).slice(-15).map((t: any) => t.text).join(' ');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: `You are analyzing a live debt settlement call transcript. Extract any co-signer information the customer mentions — people who co-signed on their accounts.

For each co-signer, capture:
- name: The co-signer's name
- relationship: Spouse, parent, sibling, friend, business partner, etc.
- phone: Phone number if mentioned
- email: Email if mentioned
- accounts: Which accounts/debts they co-signed on
- employed: Whether they're employed (if mentioned)
- notes: Any other relevant details

Return JSON with a "cosigners" array. Only include information explicitly mentioned — do NOT make up data. If no co-signers are mentioned, return empty array.

Transcript:
${recentText}`,
          messages: [{ role: 'user', content: 'Extract co-signer details:' }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ cosigners: result.cosigners || [] });
      } catch {
        return Response.json({ cosigners: [] });
      }
    }

    // ── CUSTOMER INFO EXTRACTION (name, contact, debt amount) ────────
    if (mode === 'contact') {
      const recentText = (transcript || []).slice(-15).map((t: any) => t.text).join(' ');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: `You are analyzing a LIVE debt settlement call transcript. Extract customer information that the CUSTOMER explicitly states or confirms. Only extract what the CUSTOMER says — NOT what the agent says or reads.

Look for:
- firstName: Customer's first name (when they say "My name is John Smith" or "Yes, this is John" or "It's John")
- lastName: Customer's last name
- phone: Phone number (when customer states or confirms their number)
- email: Email address
- address: Street address
- city: City
- state: State
- zip: Zip code
- debtAmount: Total debt amount (when customer confirms "I owe about $25,000" or "My total debt is around 15,000 dollars") — number only, no $ sign

CRITICAL: Only extract values the CUSTOMER actually says. If the agent says "Is your name John Smith?" and the customer says "Yes", extract firstName=John, lastName=Smith. If the customer says nothing or doesn't confirm, do NOT extract.

Return JSON. Only include fields the customer explicitly mentions or confirms — do NOT make up data. If nothing new is mentioned, return empty object.

Transcript:
${recentText}`,
          messages: [{ role: 'user', content: 'Extract customer details:' }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ contact: result });
      } catch {
        return Response.json({ contact: null });
      }
    }

    // ── EXTRACT PERSONAL INSIGHTS (location, occupation, hobbies, etc.) ──
    if (mode === 'extract_insights') {
      const allLines = transcript || [];
      const recentLines = allLines.slice(-20);
      const startIndex = allLines.length - recentLines.length;
      const transcriptStr = recentLines.map((t: any, i: number) => `[LINE ${startIndex + i}] [${t.speaker === 0 ? 'AGENT' : 'CUSTOMER'}]: ${t.text}`).join('\n');
      const existingInsights = (body.existingInsights || []).map((ins: any) => `${ins.insightType}:${(ins.insightText || '').toLowerCase()}`);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: `You are a sales assistant listening to a live debt settlement call. Extract personal insights the CUSTOMER mentions about themselves — things that would help the agent build rapport and make small talk on follow-up calls.

Look for:
- LOCATION: Where they're from, live, or grew up ("I'm from Dallas", "I live in Chicago", "I'm originally from Ohio")
- OCCUPATION: What they do for a living ("I'm a nurse", "I work in construction", "I'm a teacher")
- HOBBY: Interests, sports, activities ("I love fishing", "I play golf every weekend", "I'm a big Cowboys fan")
- FAMILY: Spouse, kids, parents, siblings ("My wife Sarah", "My son just started college", "My dad is retired")
- LIFE_EVENT: Recent life changes ("I just moved here", "I got married last year", "I'm retiring next month")
- OTHER: Any other personal detail worth remembering for rapport

CRITICAL RULES:
- Only extract what the CUSTOMER says — NOT what the agent says
- Each insight must include the transcriptLineIndex (the LINE number from the formatted transcript)
- Only extract NEW insights not already in the existing list
- Be specific — capture the actual detail (city name, job title, hobby, family member name)

Return ONLY this JSON (no markdown):
{"insights":[{"insightType":"location|occupation|hobby|family|life_event|other","insightText":"the specific detail","transcriptLineIndex":1234,"transcriptSnippet":"the full line from transcript"}]}

EXISTING INSIGHTS ALREADY CAPTURED (do not duplicate):
${existingInsights.length > 0 ? existingInsights.join('\n') : 'None yet'}`,
          messages: [{ role: 'user', content: `Recent transcript:\n${transcriptStr}` }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ insights: result.insights || [] });
      } catch {
        return Response.json({ insights: [] });
      }
    }

    // ── RESEARCH AN INSIGHT (location → web search, occupation → LLM) ──
    if (mode === 'research_insight') {
      const { insightType, insightText } = body;

      if (insightType === 'location') {
        // Use InvokeLLM with internet context for location research
        try {
          const base44 = createClientFromRequest(req);
          const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Research the location: "${insightText}". Find the following information:
1. Neighboring cities and towns (3-5)
2. Notable landmarks and attractions (2-4)
3. Famous or popular restaurants in the area (2-4)
4. Population of the city
5. Sports teams (professional, college, or minor league) (2-4)
6. Last major championship win by any local sports team (year and team)
7. Fun facts about the area (2-3)
8. A 2-3 sentence summary of the area`,
            add_context_from_internet: true,
            response_json_schema: {
              type: 'object',
              properties: {
                neighboringCities: { type: 'array', items: { type: 'string' } },
                landmarks: { type: 'array', items: { type: 'string' } },
                famousRestaurants: { type: 'array', items: { type: 'string' } },
                population: { type: 'string' },
                sportsTeams: { type: 'array', items: { type: 'string' } },
                lastChampionship: { type: 'string' },
                funFacts: { type: 'array', items: { type: 'string' } },
                summary: { type: 'string' },
              },
            },
          });
          return Response.json({ research: result });
        } catch (e) {
          // Fallback to Anthropic without web search
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 800,
              system: `You are a research assistant. Research "${insightText}" from your knowledge. Find: neighboring cities, landmarks, famous restaurants, population, sports teams, last championship win, fun facts, and a summary. Return JSON with keys: neighboringCities (array), landmarks (array), famousRestaurants (array), population (string), sportsTeams (array), lastChampionship (string), funFacts (array), summary (string).`,
              messages: [{ role: 'user', content: `Research the location: ${insightText}` }],
            }),
          });
          const data = await res.json();
          const text = data?.content?.[0]?.text || '{}';
          try {
            const result = JSON.parse(text.replace(/```json|```/g, '').trim());
            return Response.json({ research: result });
          } catch {
            return Response.json({ research: { summary: text.slice(0, 500) || 'Could not research this location.' } });
          }
        }
      } else {
        // Use LLM for occupation/hobby/other research
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            system: `You are a research assistant helping a sales agent learn about a customer's ${insightType} ("${insightText}") so they can build rapport and make small talk. Provide interesting, conversation-worthy details.

Return ONLY this JSON (no markdown):
{
  "overview": "2-3 sentence description",
  "funFacts": ["interesting fact1","interesting fact2","interesting fact3"],
  "conversationStarters": ["question or topic1","question or topic2"],
  "commonChallenges": ["challenge1","challenge2"],
  "relatedTopics": ["topic1","topic2"],
  "summary": "1 sentence summary"
}`,
            messages: [{ role: 'user', content: `Research this ${insightType}: ${insightText}` }],
          }),
        });
        const data = await res.json();
        const text = data?.content?.[0]?.text || '{}';
        try {
          const result = JSON.parse(text.replace(/```json|```/g, '').trim());
          return Response.json({ research: result });
        } catch {
          return Response.json({ research: { summary: text.slice(0, 500) || 'Could not research this topic.' } });
        }
      }
    }

    // ── GENERATE SMALL TALK QUESTIONS FROM ALL INSIGHTS ──────────────
    if (mode === 'generate_smalltalk') {
      const insights = body.insights || [];
      const insightsStr = insights.map((ins: any) => `- [${ins.insightType}] ${ins.insightText}${ins.researchJson ? ` (Research: ${ins.researchJson.slice(0, 200)})` : ''}`).join('\n');

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: `You are a sales coach helping an agent prepare small talk questions for a follow-up call with a debt settlement customer. Based on the personal insights gathered, generate 5-8 natural, conversational small talk questions the agent can use to build rapport.

The questions should:
- Feel natural and conversational, not scripted
- Reference specific details the customer shared (their city, job, hobbies, family)
- Show genuine interest in the customer as a person
- Be appropriate for a debt settlement follow-up call (warm but professional)
- Include some that reference the research done on their location/occupation

Return ONLY this JSON (no markdown):
{"questions":["question1","question2","question3","question4","question5"]}`,
          messages: [{ role: 'user', content: `Customer insights:\n${insightsStr}` }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ questions: result.questions || [] });
      } catch {
        return Response.json({ questions: [] });
      }
    }

    // ── GENERATE NEXT CALL BRIEFING ────────────────────────────────────
    if (mode === 'next_call_briefing') {
      const insights = body.insights || [];
      const memories = body.memories || [];
      const lastCallSummary = body.lastCallSummary || '';
      const leadData = body.leadData || {};

      const insightsStr = insights.map((ins: any) => {
        const research = ins.researchJson ? (() => { try { return JSON.parse(ins.researchJson); } catch { return null; } })() : null;
        return `- [${ins.insightType}${ins.isImportant ? ' ★IMPORTANT' : ''}] ${ins.insightText}${research?.summary ? ` — Research: ${research.summary}` : ''}${ins.smallTalkQuestionsJson ? ` — Small talk: ${ins.smallTalkQuestionsJson}` : ''}`;
      }).join('\n');

      const memoriesStr = memories.map((m: any) => `- [${m.factType}${m.importance === 'high' ? ' ★HIGH' : ''}] ${m.factText}${m.context ? ` (${m.context})` : ''}`).join('\n');

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1200,
          system: `You are a sales coach preparing a pre-call briefing for an agent about to call back a debt settlement customer. The agent should read this BEFORE dialing. Create a concise, scannable briefing that covers:

## CUSTOMER SNAPSHOT
- Name, location, occupation
- Key personal details

## RAPPORT BUILDERS — SMALL TALK
- 3-5 specific conversation starters based on what you know about them
- Reference their city (local sports, landmarks), job, hobbies, or family

## IMPORTANT REMINDERS
- Things marked important that the agent MUST remember
- Follow-up items from previous calls
- Time-sensitive details (birthdays, anniversaries, upcoming events)

## WHAT HAPPENED LAST TIME
- Brief summary of the last call
- Where things left off
- Any commitments made

## THIS CALL'S OBJECTIVES
- 2-3 specific goals for this call
- What to accomplish

Keep it concise — the agent reads this right before dialing. Use bullet points and short sentences. No fluff.`,
          messages: [{ role: 'user', content: `Customer: ${leadData.firstName || ''} ${leadData.lastName || ''}\nLocation: ${leadData.city || ''}, ${leadData.state || ''}\nOccupation: ${leadData.employmentStatus || ''}\n\nINSIGHTS FROM PREVIOUS CALLS:\n${insightsStr || 'None yet'}\n\nKEY MEMORIES:\n${memoriesStr || 'None yet'}\n\nLAST CALL SUMMARY:\n${lastCallSummary || 'No previous call data'}` }],
        }),
      });
      const data = await res.json();
      return Response.json({ briefing: data?.content?.[0]?.text || '' });
    }

    // ── POST-CALL FULL REPORT ─────────────────────────────────────────
    if (mode === 'full_report') {
      const { usedCoach, usedQA, usedIntent, coachTips, qaLog, intentResult } = body;
      const fullTranscript = (transcript || []).map((t: any) => t.text).join(' ');

      let reportPrompt = `Generate a comprehensive structured post-call report for a debt settlement sales call.\n${kbName ? `Knowledge Base Used: ${kbName}\n` : ''}\nTranscript:\n"${fullTranscript.slice(0, 5000)}"\n\nInclude these EXACT sections in this order:\n\n## 1. Intent Report\n- Overall intent score and interest level\n- Tonality and sentiment analysis\n- Key buying signals detected\n- Objections and resistance points\n- Emotional state and engagement level\n- Sentiment arc (how their tone shifted)\n\n## 2. Call Summary\n- Brief summary of what was discussed\n- Key points covered\n- Where the call ended up\n\n## 3. Follow-Up Report\n- What was agreed to or committed\n- What the customer needs to think about or discuss\n- Specific follow-up actions needed (e.g., "call back Tuesday after they talk to spouse")\n- Best time and method for follow-up\n- Unresolved questions or concerns\n\n## 4. Potential Strategies to Move Forward\n- 3-5 specific strategies to get this customer to move forward\n- Each strategy should be actionable and tailored to what was learned on this call\n- Include specific talking points or angles to use\n- Address their specific objections and concerns\n- Leverage their stated goals and motivations\n\n## 5. Key Information Gathered\n- Financial details mentioned (debt amount, income, creditors)\n- Personal details (spouse, kids, job, life events)\n- Hardship details if mentioned\n- Co-signers if mentioned\n\n## 6. Clean Transcript\n`;
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
          max_tokens: 2500,
          system: 'You are an expert debt settlement sales call analyst. Generate a detailed, structured post-call report with actionable insights. Be specific and thorough — the agent uses this for follow-up strategy.',
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
            : `Q: ${e.question}\nA: ${formatAnswers(e)}`
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

    // 1. Try direct KB hit — return pre-written answer(s) with zero AI tokens
    if (question) {
      const directHit = findDirectHit(question, kbEntries || []);
      if (directHit) {
        console.log(`[liveAssistantAI] Direct KB hit: "${directHit.question}" (coverage high)`);
        const answers = getAnswers(directHit);
        return Response.json({ answer: answers.join('\n\n---\n\n'), answers, source: 'kb_direct', kbEntry: directHit.question });
      }
    }

    // 2. No direct hit — use AI with relevant KB context
    const relevantKB = findRelevantKB(q, kbEntries || [], 12);
    const kbContext  = relevantKB.length > 0
      ? relevantKB.map((e: any) => e.category === 'raw_chunk'
          ? `[Document excerpt]: ${e.answer}`
          : `Q: ${e.question}\nA: ${formatAnswers(e)}`
        ).join('\n\n')
      : 'No relevant knowledge base entries found.';

    // Include all objections so the agent can handle them with the cataloged guidance
    const allObjections = (kbEntries || []).filter((e: any) => e.category === 'debt_objections');
    const objectionContext = allObjections.length > 0
      ? allObjections.map((e: any) => `OBJECTION: "${e.question}"\nHOW TO HANDLE: ${e.answer}`).join('\n---\n')
      : '';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `You are a real-time sales assistant on a live investor call. Answer questions from the knowledge base. Be concise — 2-4 sentences the agent can speak naturally. If the exact answer is in the KB, use it verbatim. If it requires synthesis, combine the relevant entries. If the customer is raising an objection, use the OBJECTION HANDLING CATALOG below to give the agent the exact rebuttal.\n\nKNOWLEDGE BASE${kbName ? ` (${kbName})` : ''}:\n${kbContext}${objectionContext ? `\n\n━━━ OBJECTION HANDLING CATALOG — If the question is an objection, use the matching handling guidance: ━━━\n${objectionContext}` : ''}`,
        messages: [{ role: 'user', content: `${recentTranscript ? `Recent conversation:\n${recentTranscript}\n\n` : ''}Question: "${question}"\n\nAnswer from KB:` }],
      }),
    });
    const data = await res.json();
    return Response.json({ answer: data?.content?.[0]?.text || 'No answer found.', source: 'kb_ai' });

  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});