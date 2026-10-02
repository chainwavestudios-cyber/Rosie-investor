import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// ── Platform LLM helper ────────────────────────────────────────────────────
// Routes all AI features through the platform InvokeLLM integration (platform
// credits) instead of direct Anthropic API calls, which were failing due to an
// exhausted API key. Returns an Anthropic-shaped response ({ content: [{ text }] })
// so existing call sites parse unchanged.
async function callLLM(req: Request, body: any): Promise<any> {
  const base44 = createClientFromRequest(req);
  const system = body?.system || '';
  const userContent = body?.messages?.[0]?.content || '';
  const prompt = system ? `${system}\n\n${userContent}` : userContent;
  const res: any = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
  const text = typeof res === 'string' ? res : (res?.text || res?.content?.[0]?.text || JSON.stringify(res));
  return { content: [{ type: 'text', text }] };
}

// ── Cached LLM helper (direct Anthropic API with prompt caching) ──────────
// Sends a static system block with cache_control so the KB/hotpoints/objections
// text is cached by Anthropic (90% discount on cached read tokens). Falls back
// to InvokeLLM (platform credits, no caching) if the API key is missing or the
// call fails.
async function callLLMCached(req: Request, opts: {
  cachedSystem: string;
  system: string;
  userContent: string;
  model?: string;
  maxTokens?: number;
}): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model || 'claude-haiku-4-5-20251001',
          max_tokens: opts.maxTokens || 500,
          system: [
            { type: 'text', text: opts.cachedSystem, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: opts.system },
          ],
          messages: [{ role: 'user', content: opts.userContent }],
        }),
      });
      if (!response.ok) throw new Error(`Anthropic API ${response.status}`);
      const data = await response.json();
      return { content: [{ type: 'text', text: data.content?.[0]?.text || '' }] };
    } catch (e) {
      console.log('[callLLMCached] Anthropic failed, falling back to InvokeLLM:', e?.message || String(e));
    }
  }
  // Fallback: InvokeLLM (no caching)
  const base44 = createClientFromRequest(req);
  const prompt = `${opts.cachedSystem}\n\n${opts.system}\n\n${opts.userContent}`;
  const res: any = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
  const text = typeof res === 'string' ? res : (res?.text || res?.content?.[0]?.text || JSON.stringify(res));
  return { content: [{ type: 'text', text }] };
}

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

// ── Script redirect helper ──────────────────────────────────────────────────
// Given the agent's current position in the teleprompter script, returns a
// short redirect telling the agent what to say next to get back on script.
function buildScriptRedirect(scriptPosition: any): string {
  if (!scriptPosition || !scriptPosition.scriptLines || scriptPosition.activeIdx == null) return '';
  const lines = scriptPosition.scriptLines;
  const idx = scriptPosition.activeIdx;
  // Grab the next 2-3 script lines after the current position
  const nextLines: string[] = [];
  for (let i = idx + 1; i < lines.length && nextLines.length < 3; i++) {
    const text = (lines[i] || '').replace(/@@CUE:\w+:.*@@/g, '').trim();
    if (text) nextLines.push(text);
  }
  if (nextLines.length === 0) return '';
  return `↩ BACK TO SCRIPT (you're on line ${idx + 1}):\n${nextLines.map((l, i) => `${i === 0 ? '▶ ' : '  '} ${l}`).join('\n')}`;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { question, transcript, kbEntries, mode, existingProfile,
            intentRules, coachRules, qaHistory, engagementScore,
            kbName, previousAnswer, internetQuery,
            callAttemptNumber, scriptPosition, aiInputActive } = body;

    const recentTranscript = buildTranscriptString(transcript, 15);
    const fullTranscriptStr = buildTranscriptString(transcript, 9999);

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
      // Static (cached): base instructions + hotpoints + objections — same for every coach call in a session
      const cachedSystem = `You are a real-time sales coach whispering to an agent on a live debt settlement call. Give ONE actionable coaching tip, then provide a specific script of EXACTLY what to say next — ready for the agent to read aloud word-for-word.
Format your response EXACTLY like this:
TIP: <1-2 sentence coaching recommendation — what to do and why>
SAY: "<exact words the agent should say to the customer right now, in quotes, conversational and natural>"
Be direct and specific — agent reads this mid-call and may read the SAY line aloud verbatim.
Focus: handling objections, building rapport, next talking point, timing a close.
${hotpointContext ? `\n━━━ COACHING HOTPOINTS — Watch for these triggers in the live conversation. If the customer or agent says something matching a trigger, immediately coach the agent using the guidance and strategy below: ━━━\n${hotpointContext}` : ''}
${objectionContext ? `\n━━━ OBJECTION HANDLING CATALOG — When the customer raises any of these objections (or something close), coach the agent on how to handle them using the guidance below. Match the customer's words to the closest objection: ━━━\n${objectionContext}` : ''}`;
      // Dynamic: memories + relevant KB — changes per coach call
      const dynamicSystem = `${memoryContext ? `━━━ KEY FACTS ABOUT THIS PROSPECT — Remember these from previous calls. Weave them in naturally to build rapport (e.g., ask about their wife by name, mention their kid's birthday, reference their job change). These are GOLD for building trust: ━━━\n${memoryContext}` : ''}${kbContext ? `\n\nRelevant KB:\n${kbContext}` : ''}`;
      const data = await callLLMCached(req, {
          cachedSystem,
          system: dynamicSystem,
          userContent: `Live conversation:\n${recentTranscript}\n\nCoaching tip now:`,
          maxTokens: 300,
      });
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
      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: `You are a real-time sales coach whispering to an agent on a live investor call. ${coachRules?.style || 'Give ONE actionable coaching tip, then provide a specific script of EXACTLY what to say next — ready for the agent to read aloud word-for-word.'}\nFormat your response EXACTLY like this:\nTIP: <1-2 sentence coaching recommendation — what to do and why>\nSAY: "<exact words the agent should say to the customer right now, in quotes, conversational and natural>"\nBe direct and specific — agent reads this mid-call and may read the SAY line aloud verbatim.\nFocus: ${coachRules?.focusAreas || 'handling objections, building rapport, next talking point, timing a close'}.${coachRules?.additionalContext ? `\nContext: ${coachRules.additionalContext}` : ''}${callAttemptNumber ? `\nThis is call #${callAttemptNumber} with this prospect.` : ''}${memoryContext ? `\n\n━━━ KEY FACTS ABOUT THIS PROSPECT — Remember these from previous calls. Weave them in naturally to build rapport (e.g., ask about their wife by name, mention their kid's birthday, reference their job change). These are GOLD for building trust: ━━━\n${memoryContext}` : ''}${hotpointContext ? `\n\n━━━ COACHING HOTPOINTS — Watch for these triggers. If the customer or agent says something matching a trigger, coach the agent using the guidance: ━━━\n${hotpointContext}` : ''}${objectionContext ? `\n\n━━━ OBJECTION HANDLING CATALOG — When the customer raises any of these objections (or something close), coach the agent on how to handle them using the guidance below. Match the customer's words to the closest objection: ━━━\n${objectionContext}` : ''}${kbContext ? `\n\nRelevant KB:\n${kbContext}` : ''}`,
          messages: [{ role: 'user', content: `Live conversation:\n${recentTranscript}\n\nCoaching tip now:` }],
      });
      return Response.json({ tip: data?.content?.[0]?.text || '' });
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

      const data = await callLLM(req, {
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
      });
      const text = data?.content?.[0]?.text || '{}';
      let result: any = null;
      try {
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        if (parsed && typeof parsed.intentScore === 'number' && !Number.isNaN(parsed.intentScore)) result = parsed;
      } catch {}
      // Fallback to the platform InvokeLLM integration when the direct Anthropic
      // call failed (out-of-credits, rate limit, or unparseable response). InvokeLLM
      // uses platform credits, so the intent engine still runs.
      if (!result) {
        try {
          const base44 = createClientFromRequest(req);
          const fb: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `You are an expert sales call analyst running a comprehensive INTENT ENGINE for a debt settlement sales call. Also extract key facts to auto-populate the CRM and build a persistent memory for follow-up calls.

DEEPGRAM SENTIMENT ANALYSIS: ${sentimentSummary}

${computedMetrics}

DUCK: ${intentRules?.duckDefinition || 'Skeptical, argumentative, raises objections, combative, negative tone'}
COW: ${intentRules?.cowDefinition || 'Curious, agreeable, asks genuine buying questions, positive tone'}
POSITIVE SIGNALS TO DETECT: ${intentRules?.positiveSignals || 'that sounds amazing, I love that, how do I sign up, I\'m ready, let\'s do it, what\'s the minimum, send me the portal, I want to move forward, that makes sense, tell me more'}
NEGATIVE SIGNALS TO DETECT: ${intentRules?.negativeSignals || 'not interested, call me later, I need to think about it, talk to my spouse, too risky, too expensive, I\'ve been burned before, what\'s the guarantee, I doubt that, prove it, what\'s the catch'}

Analyze the transcript and return a JSON object with: intentScore (0-100), tonality (positive|neutral|negative|mixed), tonalityNotes, interestLevel (high|medium|low), interestReason, animalType (duck|cow|unknown), animalConfidence (0-100), sentimentArc (warming|cooling|flat|volatile), sentimentArcNotes, engagementScore (0-100), engagementNotes, excitementLevel (low|medium|high), excitementNotes, emotionalState (stressed|hopeful|skeptical|desperate|confident|overwhelmed|neutral), emotionalNotes, commitmentLevel (none|soft|firm), commitmentDetails, pace (rushed|steady|deliberate), paceNotes, rapportLevel (0-100), rapportNotes, questionCount, talkRatioProspect, callDurationSeconds, hesitationCount, objectionCount, buyingSignalCount, keyMoments (array of strings), buyingSignals (array of strings), objections (array of strings), recommendedNextStep, keyFacts (array of {type, fact, context, importance, followUpDate}), and extractedData ({mentionedAmount, accountType, iraDetails, bestTimeToCall, positiveSignals, negativeSignals, extractedNotes}).

Full call transcript:
${fullTranscript.slice(0, 6000)}`,
            response_json_schema: {
              type: 'object',
              properties: {
                intentScore: { type: 'number' },
                tonality: { type: 'string' },
                tonalityNotes: { type: 'string' },
                interestLevel: { type: 'string' },
                interestReason: { type: 'string' },
                animalType: { type: 'string' },
                animalConfidence: { type: 'number' },
                sentimentArc: { type: 'string' },
                sentimentArcNotes: { type: 'string' },
                engagementScore: { type: 'number' },
                engagementNotes: { type: 'string' },
                excitementLevel: { type: 'string' },
                excitementNotes: { type: 'string' },
                emotionalState: { type: 'string' },
                emotionalNotes: { type: 'string' },
                commitmentLevel: { type: 'string' },
                commitmentDetails: { type: 'string' },
                pace: { type: 'string' },
                paceNotes: { type: 'string' },
                rapportLevel: { type: 'number' },
                rapportNotes: { type: 'string' },
                questionCount: { type: 'number' },
                talkRatioProspect: { type: 'number' },
                callDurationSeconds: { type: 'number' },
                hesitationCount: { type: 'number' },
                objectionCount: { type: 'number' },
                buyingSignalCount: { type: 'number' },
                keyMoments: { type: 'array', items: { type: 'string' } },
                buyingSignals: { type: 'array', items: { type: 'string' } },
                objections: { type: 'array', items: { type: 'string' } },
                recommendedNextStep: { type: 'string' },
                keyFacts: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, fact: { type: 'string' }, context: { type: 'string' }, importance: { type: 'string' }, followUpDate: { type: 'string' } } } },
                extractedData: { type: 'object' },
              },
            },
          });
          if (fb && typeof fb.intentScore === 'number' && !Number.isNaN(fb.intentScore)) result = fb;
        } catch (e) {
          return Response.json({ intent: null, error: 'Intent engine failed (Anthropic + InvokeLLM fallback): ' + (e?.message || String(e)) });
        }
      }
      if (!result || typeof result.intentScore !== 'number' || Number.isNaN(result.intentScore)) {
        return Response.json({ intent: null, error: 'Intent engine returned no score' });
      }
      // Blend with engagement score (max 25% influence)
      const engNorm = Math.min(100, Math.max(0, engagementScore || 0));
      const blended = Math.round(result.intentScore * 0.75 + engNorm * 0.25);
      return Response.json({ intent: { ...result, intentScore: blended, rawAiScore: result.intentScore, engagementContribution: Math.round(engNorm * 0.25) } });
    }

    // ── EXTRACT KEY FACTS / MEMORIES FROM CALL ────────────────────────
    if (mode === 'extract_facts') {
      const fullTranscript = (transcript || []).map((t: any) => `[${t.speaker === 0 ? 'AGENT' : 'PROSPECT'}]: ${t.text}`).join('\n');
      const existingFacts = body.existingFacts || [];
      const existingFactTexts = existingFacts.map((f: any) => (f.factText || '').toLowerCase());

      const data = await callLLM(req, {
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
      });
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
      const recentText = (transcript || []).map((t: any) => t.text).join(' ').slice(0, 8000);
      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: `You are analyzing a live debt settlement call transcript. Extract any hardship information the customer mentions — what caused their financial difficulty, when it started, and how it impacted them.

Look for:
- WHEN: Job loss, medical emergency, divorce, death in family, business closure, reduced hours, etc. — and when it happened
- WHY: The root cause of their financial situation
- HOW: How it impacted their finances — fell behind on payments, used credit cards to survive, depleted savings, etc.

Return JSON. Only include information explicitly mentioned — do NOT make up data. If nothing new is mentioned, return empty strings.
${aiInputActive ? '\n⚡ AI INPUT ZONE ACTIVE: The agent is at a marked collection point. The customer is actively describing their hardship RIGHT NOW. Capture every detail: the exact event, timing, cause, and financial impact. Be thorough.' : ''}

Transcript:
${recentText}`,
          messages: [{ role: 'user', content: 'Extract hardship details:' }],
          response_json_schema: undefined,
      });
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
      const recentText = (transcript || []).map((t: any) => t.text).join(' ').slice(0, 8000);
      const data = await callLLM(req, {
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
${aiInputActive ? '\n⚡ AI INPUT ZONE ACTIVE: The agent is at a marked collection point. The customer is actively discussing co-signers RIGHT NOW. Capture every co-signer detail: names, relationships, contact info, which accounts, employment status.' : ''}

Transcript:
${recentText}`,
          messages: [{ role: 'user', content: 'Extract co-signer details:' }],
      });
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ cosigners: result.cosigners || [] });
      } catch {
        return Response.json({ cosigners: [] });
      }
    }

    // ── CREDIT REVIEW EXTRACTION (credit score, behind on payments) ──
    if (mode === 'credit') {
      const recentText = (transcript || []).map((t: any) => t.text).join(' ').slice(0, 8000);
      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: `You are analyzing a live debt settlement call transcript. The agent is reviewing the customer credit situation. Extract credit review information the customer confirms.

Look for:
- creditScore: The customer credit score (number, e.g. 680) — when they say "my score is about 680" or "it is in the 600s"
- behindOnPayments: Whether they are behind on any credit card payments (true/false) — when they say "I am behind" or "I have missed a couple payments"
- monthsBehind: How many months behind they are (number) — when they say "I am 3 months behind" or "I have not paid in 4 months"

Return JSON. Only include fields the customer explicitly mentions or confirms — do NOT make up data. If nothing new is mentioned, return empty object.
${aiInputActive ? '\n⚡ AI INPUT ZONE ACTIVE: The agent is at a marked collection point. The customer is actively reviewing their credit RIGHT NOW. Capture every detail: exact credit score, which cards they are behind on, how many months behind, any missed payments.' : ''}

Transcript:
${recentText}`,
          messages: [{ role: 'user', content: 'Extract credit review details:' }],
      });
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ credit: result });
      } catch {
        return Response.json({ credit: null });
      }
    }

    // ── BUDGET EXTRACTION (income + monthly expenses with custom keys) ──
    if (mode === 'budget') {
      const recentText = (transcript || []).map((t: any) => t.text).join(' ').slice(0, 8000);
      const existingBillsJson = body.existingBills || '{}';
      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `You are analyzing a live debt settlement call transcript. The agent is reviewing the customer monthly budget — income and expenses. Extract any monthly expense amounts and income the customer confirms.

Look for:
- monthlyIncome: Monthly take-home income (number) — when they say "I take home about 4000 a month" or "my income is around 3500"
- bills: An object mapping expense categories to monthly dollar amounts (numbers only)

Standard bill keys to use when they apply: rent, auto, autoInsurance, gas, groceries, utilities, phone, internet, studentLoans, healthInsurance, childcare, misc
CUSTOM EXPENSE KEYS: If the customer mentions a bill type that does not fit a standard key, CREATE a custom camelCase key (e.g. "gym", "storage", "alimony", "petInsurance", "tithes", "subscriptions", "childSupport") and include it with the amount. This lets the system capture ANY expense the customer mentions.

Only include expenses and income the customer explicitly mentions or confirms — do NOT make up data. If nothing new is mentioned, return empty object.
${aiInputActive ? '\n⚡ AI INPUT ZONE ACTIVE: The agent is at a marked collection point. The customer is actively going over their budget RIGHT NOW. Capture every expense: rent/mortgage, car payment, insurance, gas, groceries, utilities, phone, internet, student loans, health insurance, childcare, and ANY other bill they mention. Create custom keys for non-standard expenses. Also capture monthly income if stated.' : ''}

Existing bills already captured (merge with these, do not duplicate):
${existingBillsJson}

Transcript:
${recentText}`,
          messages: [{ role: 'user', content: 'Extract budget details:' }],
      });
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ budget: result });
      } catch {
        return Response.json({ budget: null });
      }
    }

    // ── CUSTOMER INFO EXTRACTION (name, contact, debt amount) ────────
    if (mode === 'contact') {
      const recentText = (transcript || []).map((t: any) => t.text).join(' ').slice(0, 8000);
      const data = await callLLM(req, {
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

NAME CORRECTIONS: The customer may CORRECT their name after initially stating it — e.g. "It's John" then later "Actually it's Jonathan, not John" or "My full name is Jonathan". Always return the LATEST, most-correct version of the name the customer confirms. If a correction appears later in the transcript, use the corrected name, not the original. Also catch clarifications like "Yes, with an H" or "That's J-O-N-A-T-H-A-N" — apply the correction.

CRITICAL: Only extract values the CUSTOMER actually says. If the agent says "Is your name John Smith?" and the customer says "Yes", extract firstName=John, lastName=Smith. If the customer says nothing or doesn't confirm, do NOT extract.
${aiInputActive ? '\n⚡ AI INPUT ZONE ACTIVE: The agent is at a marked collection point in the script. The customer is actively providing information RIGHT NOW. Be thorough — capture every detail the customer confirms: full name, phone, email, address, debt amount, creditor names, balances, monthly income, expenses. Extract aggressively but still only what the customer actually says.' : ''}
Return JSON. Only include fields the customer explicitly mentions or confirms — do NOT make up data. If nothing new is mentioned, return empty object.

Transcript:
${recentText}`,
          messages: [{ role: 'user', content: 'Extract customer details:' }],
      });
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ contact: result });
      } catch {
        return Response.json({ contact: null });
      }
    }

    // ── HANDOFF INTRO EXTRACTION (transfer agent introduces customer) ──
    if (mode === 'handoff') {
      const openingLines = (transcript || []).slice(0, 8).map((t: any) => `[${t.speaker === 0 ? 'AGENT' : 'CALLER'}]: ${t.text}`).join('\n');
      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: `You are analyzing the OPENING of an incoming debt settlement call. At the very start, the answering agent says something like "debt advisors this is [agent name]". Then a transfer agent (the person who warm-transferred the call) introduces the customer/prospect, saying things like "I have Bob on the line here, and he has approx 20k in debt" or "this is Sarah, she's got about 35 thousand in credit card debt".

Extract from these opening lines:
- customerFirstName: The PROSPECT/CUSTOMER's first name (the person being transferred in, NOT the agent and NOT the transfer agent). e.g. "Bob", "Sarah"
- customerLastName: The prospect's last name if mentioned
- debtAmount: Total debt amount mentioned (number only, no $ or commas). Handle "20k" → 20000, "35 thousand" → 35000, "approx 20k" → 20000, "15 grand" → 15000.
- city: The prospect's city if the transfer agent mentions where they're from ("he's calling from Dallas" → "Dallas", "she's out in Phoenix, AZ" → "Phoenix")
- state: The prospect's state if mentioned ("out in Phoenix, AZ" → "AZ", "from Tampa, Florida" → "FL"). Use the 2-letter state abbreviation if the full state name is given.
- agentFirstName: The answering agent's first name if they state it ("debt advisors this is Chris" → "Chris")

CRITICAL: Do NOT confuse the transfer agent's name with the customer's name. The customer is the person being transferred/introduced ("I have Bob on the line" → customer is Bob). The agent is the one who answered the phone ("debt advisors this is Chris" → agent is Chris).

Return JSON. Only include fields explicitly mentioned — do NOT make up data. If nothing relevant was said, return empty object.

Opening lines:
${openingLines}`,
          messages: [{ role: 'user', content: 'Extract handoff details:' }],
      });
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ handoff: result });
      } catch {
        return Response.json({ handoff: null });
      }
    }

    // ── EXTRACT PERSONAL INSIGHTS (location, occupation, hobbies, etc.) ──
    if (mode === 'extract_insights') {
      const allLines = transcript || [];
      // Scan the FULL transcript (capped at 8000 chars) so early mentions of
      // location/occupation aren't missed when the conversation has moved on.
      const transcriptStr = allLines.map((t: any, i: number) => `[LINE ${i}] [${t.speaker === 0 ? 'AGENT' : 'CUSTOMER'}]: ${t.text}`).join('\n').slice(0, 8000);
      const existingInsights = (body.existingInsights || []).map((ins: any) => `${ins.insightType}:${(ins.insightText || '').toLowerCase()}`);

      const data = await callLLM(req, {
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
      });
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ insights: result.insights || [] });
      } catch {
        return Response.json({ insights: [] });
      }
    }

    // ── DOB / BIRTH YEAR RESEARCH (auto internet search for birth-year facts) ──
    if (mode === 'dob_research') {
      const fullText = (transcript || []).map((t: any) => `[${t.speaker === 0 ? 'AGENT' : 'CUSTOMER'}]: ${t.text}`).join('\n').slice(0, 8000);
      // 1. Extract DOB / birth year from transcript
      const extractData = await callLLM(req, {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `Extract the customer's date of birth from this call transcript. The customer may say "I was born on March 15, 1985" or "My birthday is 03/15/1985" or "DOB is 4/22/1972" or "I'm 41 years old" (estimate birth year from age). Return JSON with dateOfBirth (raw text as stated) and birthYear (4-digit number). If no DOB or age is mentioned, return empty object {}.
Transcript:
${fullText}`,
        messages: [{ role: 'user', content: 'Extract DOB:' }],
      });
      const dobText = extractData?.content?.[0]?.text || '{}';
      let dobResult: any = {};
      try { dobResult = JSON.parse(dobText.replace(/```json|```/g, '').trim()); } catch {}
      if (!dobResult.birthYear) return Response.json({ dob: null });

      const birthYear = Number(dobResult.birthYear);
      // 2. Internet search for fun facts about that birth year
      try {
        const base44 = createClientFromRequest(req);
        const research: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Research the year ${birthYear} — the year this person was born. Find fun, conversation-worthy facts a sales agent could use to build rapport:
1. Notable inventions or breakthroughs from ${birthYear}
2. Major world events that happened in ${birthYear}
3. Who was the US President in ${birthYear}
4. Was ${birthYear} a US presidential election year?
5. Popular culture: top movies, songs, or cultural moments from ${birthYear}
6. A fun 2-3 sentence summary a sales agent could use to build rapport with someone born in ${birthYear}`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              inventions: { type: 'array', items: { type: 'string' } },
              majorEvents: { type: 'array', items: { type: 'string' } },
              president: { type: 'string' },
              wasElectionYear: { type: 'boolean' },
              popCulture: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' },
            },
          },
        });
        return Response.json({ dob: { dateOfBirth: dobResult.dateOfBirth || '', birthYear, research } });
      } catch (e: any) {
        return Response.json({ dob: { dateOfBirth: dobResult.dateOfBirth || '', birthYear, research: { summary: 'Could not research birth year: ' + (e?.message || String(e)) } } });
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
          const data = await callLLM(req, {
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 800,
              system: `You are a research assistant. Research "${insightText}" from your knowledge. Find: neighboring cities, landmarks, famous restaurants, population, sports teams, last championship win, fun facts, and a summary. Return JSON with keys: neighboringCities (array), landmarks (array), famousRestaurants (array), population (string), sportsTeams (array), lastChampionship (string), funFacts (array), summary (string).`,
              messages: [{ role: 'user', content: `Research the location: ${insightText}` }],
          });
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
        const data = await callLLM(req, {
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
        });
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

      const data = await callLLM(req, {
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
      });
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

      const data = await callLLM(req, {
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
      });
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

      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2500,
          system: 'You are an expert debt settlement sales call analyst. Generate a detailed, structured post-call report with actionable insights. Be specific and thorough — the agent uses this for follow-up strategy.',
          messages: [{ role: 'user', content: reportPrompt }],
      });
      return Response.json({ report: data?.content?.[0]?.text || '' });
    }

    // ── CALL ANALYSIS (timeline + manager report + suggestions + follow-up) ──
    if (mode === 'call_analysis') {
      const allEntries = transcript || [];
      const fullTranscript = allEntries.map((t: any) => {
        const sp = t.speaker === 0 ? 'AGENT' : 'CUSTOMER';
        const time = t.time ? new Date(t.time).toISOString().split('T')[1]?.split('.')[0] : '';
        return `[${time}] ${sp}: ${t.text}`;
      }).join('\n');

      // Compute call duration for timeline scaling
      let callDurationSeconds = 0;
      if (allEntries.length >= 2) {
        const t1 = allEntries[0].time ? new Date(allEntries[0].time).getTime() : 0;
        const t2 = allEntries[allEntries.length - 1].time ? new Date(allEntries[allEntries.length - 1].time).getTime() : 0;
        if (t1 && t2 && t2 > t1) callDurationSeconds = Math.round((t2 - t1) / 1000);
      }

      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          system: `You are an expert sales call analyst and sales manager reviewing a debt settlement sales call. You must produce a STRUCTURED analysis with four parts: a call timeline diagram, a manager's quality assessment, pitch/interaction suggestions, and a detailed follow-up plan.

Analyze the transcript with timestamps. The call lasted approximately ${callDurationSeconds} seconds (${Math.floor(callDurationSeconds/60)}m ${callDurationSeconds%60}s).

Respond ONLY with this exact JSON (no markdown):
{
  "timeline": [
    {"offsetSeconds": 0, "type": "milestone|strength|issue|neutral", "label": "short label (2-4 words)", "detail": "1 sentence explaining what happened at this point", "severity": "low|medium|high"}
  ],
  "managerReport": {
    "clarityScore": 0-100,
    "clarityNotes": "how clearly the agent communicated key points",
    "objectionHandlingScore": 0-100,
    "objectionHandlingNotes": "how well they handled objections",
    "callControlScore": 0-100,
    "callControlNotes": "did they control the call or were they controlled",
    "controlledBy": "agent|customer|balanced",
    "closingScore": 0-100,
    "closingNotes": "how well they moved toward or executed a close",
    "overallGrade": "A|B|C|D|F",
    "summary": "2-3 sentence overall assessment of the agent's performance",
    "strengths": ["specific strength 1", "specific strength 2"],
    "weaknesses": ["specific weakness 1", "specific weakness 2"]
  },
  "pitchSuggestions": [
    {"area": "Opener|Discovery|Pitch|Objection Handling|Closing|Rapport", "issue": "what they did wrong or could improve", "suggestion": "specific change to make in their pitch or interaction style"}
  ],
  "detailedFollowUp": {
    "personalityType": "description of the customer's personality based on the call (e.g. analytical skeptic, warm but cautious, rushed decision-maker)",
    "questionProfile": "what types of questions they asked and what that tells you about their buying readiness",
    "engagementLevel": "low|medium|high",
    "engagementNotes": "how engaged they were and what drove that engagement",
    "recommendedApproach": "1-2 sentences on the best approach for the next call",
    "talkingPoints": ["specific talking point 1", "specific talking point 2", "specific talking point 3"],
    "bestTiming": "when and how to follow up (e.g. 'Call Tuesday morning, they mentioned being free before 10am')",
    "followUpActions": ["specific action 1", "specific action 2"]
  }
}

GUIDELINES:
- Timeline: identify 5-12 key moments across the call. Use "milestone" for call structure points (greeting, discovery, pitch, close), "strength" for moments the agent did well, "issue" for problems (missed objection, lost control, unclear explanation, dead air). offsetSeconds should be the approximate time in the call (0 to ${callDurationSeconds}).
- Manager Report: grade the AGENT, not the prospect. Be honest and specific. "controlledBy" = did the agent steer the conversation or did the customer?
- Pitch Suggestions: 3-6 concrete, actionable changes. Reference what actually happened in the call.
- Detailed Follow-Up: base everything on what you learned about THIS customer's personality, the questions they asked, and their engagement level. Don't be generic.`,
          messages: [{ role: 'user', content: `Call transcript with timestamps:\n${fullTranscript.slice(0, 7000)}` }],
      });
      const text = data?.content?.[0]?.text || '{}';
      try {
        // Extract the JSON object from the response (handles markdown fences and extra text)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanText = jsonMatch ? jsonMatch[0] : text.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanText);
        return Response.json({ analysis: result });
      } catch {
        return Response.json({ analysis: null, error: 'Parse failed', raw: text.slice(0, 500) });
      }
    }

    // ── CLIENT PROFILE ────────────────────────────────────────────────
    if (mode === 'profile') {
      const existing = (() => { try { return JSON.parse(existingProfile || '{}'); } catch { return {}; } })();
      const fullTranscript = (transcript || []).map((t: any) => t.text).join(' ');
      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `You are analyzing a sales call to build a persistent client profile. Return ONLY this exact JSON (no markdown):
{"animalType":"duck or cow or unknown","animalConfidence":0-100,"overallIntentLabel":"hot or warm or cold","traits":{"asksLotOfQuestions":true/false,"quickToInterrupt":true/false,"asksBuyingQuestions":true/false,"talksALot":true/false,"asksTechnicalQuestions":true/false,"raisesObjections":true/false,"agreeable":true/false,"priceConscious":true/false,"decisionMaker":true/false},"keyObservations":["obs1","obs2"],"recommendedApproach":"one sentence","callCount":${(existing.callCount || 0) + 1},"lastCallSummary":"2-3 sentence summary"}${aiInputActive ? '\n\n⚡ AI INPUT ZONE ACTIVE: The agent is at a marked collection point. Be especially thorough in capturing personality traits, buying signals, and key observations from what the customer is actively sharing right now.' : ''}`,
          messages: [{ role: 'user', content: `Existing profile:\n${JSON.stringify(existing)}\n\nTranscript:\n"${fullTranscript.slice(0, 4000)}"` }],
      });
      const text2 = data?.content?.[0]?.text || '{}';
      try { return Response.json({ profile: JSON.parse(text2.replace(/```json|```/g, '').trim()) }); }
      catch { return Response.json({ profile: existing }); }
    }

    // ── Internet search ───────────────────────────────────────────────
    if (mode === 'internet_search') {
      const searchQ = internetQuery || question || '';
      try {
        const base44 = createClientFromRequest(req);
        const result: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a sales assistant helping an agent on a live investor call. Search the web for current, accurate information to answer the question. Provide a concise, factual answer in 2-4 sentences that the agent can speak naturally.\n\nSearch for current information to answer this question for an investor call:\n\n${searchQ}`,
          add_context_from_internet: true,
        });
        const answer = (typeof result === 'string' ? result : (result?.text || '')) || 'Could not find information.';
        return Response.json({ answer, source: 'internet' });
      } catch (e: any) {
        return Response.json({ answer: 'Could not search the web right now: ' + (e?.message || String(e)), source: 'internet' });
      }
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
      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `You are a sales assistant providing expanded information from a knowledge base. The agent already gave an initial answer and needs more detail. Search the KB context and provide additional relevant facts, numbers, or context not already covered.\n\nKNOWLEDGE BASE:\n${kbContext}`,
          messages: [{ role: 'user', content: `Question: "${question}"\n\nInitial answer already given: "${previousAnswer || ''}"\n\nProvide ADDITIONAL specific details, numbers, or context from the KB that wasn't in the initial answer:` }],
      });
      return Response.json({ answer: data?.content?.[0]?.text || 'No additional information found.', source: 'kb' });
    }

    // ── HOT CALL TRACKER (turbo intent + agent performance) ─────────
    if (mode === 'hot_call_check') {
      const allLines = transcript || [];
      const recentLines = allLines.slice(-24);
      const prospectEntries = allLines.filter((t: any) => t.speaker === 1 || t.speaker === null || t.speaker === undefined);
      const agentEntries = allLines.filter((t: any) => t.speaker === 0);
      const prospectWords = prospectEntries.reduce((s: number, t: any) => s + (t.text || '').split(/\s+/).filter((w: string) => w.length > 0).length, 0);
      const agentWords = agentEntries.reduce((s: number, t: any) => s + (t.text || '').split(/\s+/).filter((w: string) => w.length > 0).length, 0);
      const totalWords = prospectWords + agentWords;
      const talkRatioProspect = totalWords > 0 ? Math.round((prospectWords / totalWords) * 100) : 0;
      const utterances = allLines.filter((t: any) => t.sentiment);
      const posCount = utterances.filter((t: any) => t.sentiment === 'positive').length;
      const negCount = utterances.filter((t: any) => t.sentiment === 'negative').length;
      const prospectQs = (prospectEntries.map((t: any) => t.text || '').join(' ').match(/\?/g) || []).length;
      const transcriptStr = recentLines.map((t: any) => `[${t.speaker === 0 ? 'AGENT' : 'CUSTOMER'}]: ${t.text}`).join('\n');
      const priorStatus = body.priorStatus || 'unknown';

      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `You are a HOT CALL detection engine for a debt settlement sales call — a "turbo" intent engine. A HOT CALL is a prospect showing GENUINE INTEREST: heavily engaged, asking good buying questions, eager to participate, or open to hearing about the program.

COMPUTED METRICS:
- Talk ratio (prospect): ${talkRatioProspect}% (${prospectWords} prospect words vs ${agentWords} agent words)
- Sentiment: ${posCount} positive, ${negCount} negative utterances
- Prospect questions asked: ${prospectQs}
- Total lines: ${allLines.length}
- Call duration so far: ${body.callDurationSeconds || 0}s
- Prior status this call: ${priorStatus}

TASKS:
1. HOT DETECTION: isHot (bool), hotScore 0-100, hotReason (1 sentence), hotConfidence 0-100.
   HOT signals: buying questions ("how do I sign up","what's the minimum","what do I need to do","tell me more"), positive/eager tone, agreeing, asking about next steps, mentioning they want to move forward, engaged follow-ups.
   COLD signals: "not interested","don't call me","take me off your list","not right now", silence, combative/negative, very short dismissive answers.
2. STOP MONITORING: set stopMonitoring=true if the call is CLEARLY NOT hot (hotScore < 25) AND enough has happened (duration > 45s OR 10+ lines). This saves AI credits. Once a call has been hot, NEVER set stopMonitoring.
3. AGENT PERFORMANCE (assess always, but it only matters when isHot): agentScore 0-100, confident (bool — sounds nervous/hesitant/unsure vs in control), answeringQuestions (bool — fully answering vs deflecting/stumbling), issues (array of short strings e.g. "sounds nervous","gave incomplete answer","talking too much","missed buying signal"), summary (1 sentence).
4. CRITICAL: true if isHot AND the agent is underperforming — agentScore < 60, OR not confident, OR not answeringQuestions fully. A hot prospect being mishandled by a nervous/hesitant agent is critical.

Return ONLY this JSON (no markdown):
{"isHot":false,"hotScore":0,"hotReason":"","hotConfidence":0,"stopMonitoring":false,"agentPerformance":{"score":0,"confident":true,"answeringQuestions":true,"issues":[],"summary":""},"critical":false}`,
          messages: [{ role: 'user', content: `Recent transcript:\n${transcriptStr.slice(0, 4000)}` }],
      });
      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Response.json({ hot: result });
      } catch {
        return Response.json({ hot: null });
      }
    }

    // ── Q&A (default) — try direct hit first, AI only if needed ──────
    const q = question || recentTranscript;

    // 1. Try direct KB hit — return pre-written answer(s) with zero AI tokens
    if (question) {
      const directHit = findDirectHit(question, kbEntries || []);
      if (directHit) {
        console.log(`[liveAssistantAI] Direct KB hit: "${directHit.question}" (coverage high)`);
        const answers = getAnswers(directHit);
        // Notate the newest answer if there are multiple
        let formattedAnswer: string;
        if (answers.length > 1) {
          formattedAnswer = answers.map((a, i) => {
            const label = i === answers.length - 1 ? '★ NEWEST' : `Answer ${i + 1}`;
            return `[${label}]\n${a}`;
          }).join('\n\n---\n\n');
        } else {
          formattedAnswer = answers[0] || '';
        }
        // Append script redirect if we know the agent's position
        const redirect = buildScriptRedirect(scriptPosition);
        if (redirect) formattedAnswer += `\n\n${redirect}`;
        return Response.json({ answer: formattedAnswer, answers, source: 'kb_direct', kbEntry: directHit.question });
      }
    }

    // 2. No direct hit — use AI with relevant KB context
    const relevantKB = findRelevantKB(q, kbEntries || [], 12);
    // Only count as "has KB context" if the top hit has a meaningful score (>= 2),
    // not just a single common-word match like "the" or "how"
    const hasKBContext = relevantKB.length > 0 && (relevantKB[0]?.score || 0) >= 2;
    const kbContext  = hasKBContext
      ? relevantKB.filter((e: any) => (e.score || 0) >= 2).map((e: any) => e.category === 'raw_chunk'
          ? `[Document excerpt]: ${e.answer}`
          : `Q: ${e.question}\nA: ${formatAnswers(e)}`
        ).join('\n\n')
      : 'No relevant knowledge base entries found.';

    // Include all objections so the agent can handle them with the cataloged guidance
    const allObjections = (kbEntries || []).filter((e: any) => e.category === 'debt_objections');
    const objectionContext = allObjections.length > 0
      ? allObjections.map((e: any) => `OBJECTION: "${e.question}"\nHOW TO HANDLE: ${e.answer}`).join('\n---\n')
      : '';

    // If no meaningful KB context at all, this is a pure AI fallback — label it so the frontend can show "AI ANSWER"
    if (!hasKBContext && !objectionContext) {
      const data = await callLLM(req, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: `You are a real-time sales assistant on a live call. The knowledge base has no relevant answer for this question. Use your own knowledge to provide a helpful, concise answer the agent can speak naturally — 2-4 sentences. If you truly cannot answer, say so honestly.`,
          messages: [{ role: 'user', content: `${fullTranscriptStr ? `Full conversation so far:\n${fullTranscriptStr}\n\n` : ''}Question: "${question}"\n\nAnswer:` }],
      });
      const redirect = buildScriptRedirect(scriptPosition);
      const answer = data?.content?.[0]?.text || 'No answer found.';
      return Response.json({ answer: redirect ? `${answer}\n\n${redirect}` : answer, source: 'ai_fallback' });
    }

    // Static (cached): base instructions + objection catalog — same for every Q&A in a session
    const cachedSystem = `You are a real-time sales assistant on a live investor call. Answer questions from the knowledge base. Be concise — 2-4 sentences the agent can speak naturally. If the exact answer is in the KB, use it verbatim. If it requires synthesis, combine the relevant entries. If the customer is raising an objection, use the OBJECTION HANDLING CATALOG below to give the agent the exact rebuttal.${objectionContext ? `\n\n━━━ OBJECTION HANDLING CATALOG — If the question is an objection, use the matching handling guidance: ━━━\n${objectionContext}` : ''}`;
    // Dynamic: relevant KB entries — changes per question
    const dynamicSystem = `KNOWLEDGE BASE${kbName ? ` (${kbName})` : ''}:\n${kbContext}`;
    const data = await callLLMCached(req, {
        cachedSystem,
        system: dynamicSystem,
        userContent: `${fullTranscriptStr ? `Full conversation so far:\n${fullTranscriptStr}\n\n` : ''}Question: "${question}"\n\nAnswer from KB:`,
        maxTokens: 500,
    });
    const redirect = buildScriptRedirect(scriptPosition);
    const answer = data?.content?.[0]?.text || 'No answer found.';
    return Response.json({ answer: redirect ? `${answer}\n\n${redirect}` : answer, source: 'kb_ai' });

  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});