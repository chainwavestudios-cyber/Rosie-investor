# Live Q&A Tool — Full Audit Report

This report documents every file, data flow, and piece of logic that powers the **Live Q&A** feature (the "❓ Q&A" tab inside the AI Assistant popup). It is written for a code audit: every component, backend function, entity, and helper involved is listed, summarized, and — where it matters — quoted in full.

---

## 1. Overview — What the Live Q&A Tool Does

The Live Q&A tool is a real-time assistant that surfaces answers to a sales agent **during a live call**. It:

1. **Listens to the live transcript** (either a browser audio stream transcribed by Deepgram, or a transcript passed in from the live-call page).
2. **Detects questions** in the customer/prospect's speech automatically.
3. **Answers those questions** by searching a knowledge base (KB) and, if needed, synthesizing an answer with an LLM.
4. **Lets the agent ask manual questions** and **star** good Q&A pairs into a reusable "Common Asked Questions" library.
5. **Persists every Q&A** to a `DebtQAHistory` entity per lead for later review.

There are three layers:

| Layer | Where | Responsibility |
|---|---|---|
| **Audio → Transcript** | `DebtAIPanel.jsx` (browser) + Deepgram WebSocket | Captures audio, streams to Deepgram, builds transcript entries |
| **Transcript → Question → Answer** | `AIAssistantPopup.jsx` (`QASection`) + `liveAssistantAI` backend function | Detects questions, calls the backend, renders answers |
| **Storage** | `KnowledgeBase` + `DebtQAHistory` entities | KB entries (answers) + per-lead Q&A history |

---

## 2. File Inventory

Every file involved in the Live Q&A tool:

| File | Role |
|---|---|
| `src/components/debt/DebtAIPanel.jsx` | Host panel; captures audio, builds transcript, renders the AI Assistant popup |
| `src/components/leads/AIAssistantPopup.jsx` | The popup itself; contains `QASection`, `extractQuestions`, `AnswerDisplay`, `QAAnswerActions`, `RightPanel` |
| `src/components/leads/QAPopOutPanel.jsx` | Detached floating Q&A-only window |
| `src/components/leads/CommonQAView.jsx` | "Common Asked Questions" starred library + `starToCommon()` |
| `src/components/debt/CommonQuestionsTab.jsx` | Admin UI to manage KB Q&A entries |
| `src/components/debt/MultiAnswerEditor.jsx` | Editor for multi-answer KB entries (used in KB management, not live) |
| `base44/functions/liveAssistantAI/entry.ts` | **The backend brain** — KB search, LLM answering, gating, all modes |
| `src/entities/KnowledgeBase.json` | Entity schema for KB entries |
| `base44/entities/DebtQAHistory.jsonc` | Entity schema for per-lead Q&A history |

---

## 3. End-to-End Data Flow

```
  ┌─────────────────────────────────────────────────────────────┐
  │  BROWSER (DebtAIPanel.jsx)                                   │
  │                                                              │
  │  Mic audio → AudioContext (16kHz) → Deepgram WebSocket        │
  │       │                                                      │
  │       ▼  ws.onmessage (is_final=true)                         │
  │  transcript entry: { text, speaker, time, sentiment }         │
  │       │                                                      │
  │       ▼  setTwilioTranscript([...prev, entry])                │
  │  normalizedTranscript (speaker swap for AIAssistantPopup)     │
  └──────────────────────────┬──────────────────────────────────┘
                             │  passed as prop
  ┌──────────────────────────▼──────────────────────────────────┐
  │  AIAssistantPopup.jsx → QASection                            │
  │                                                              │
  │  useEffect watches transcript:                               │
  │    1. Only process last line if speaker === 0 (prospect)     │
  │    2. extractQuestions(last.text) → sentences ending in "?"  │
  │    3. Dedupe via seenQ Set                                    │
  │    4. If active + keyword/topic hit + no "?": auto-question  │
  │    5. answerQ(id) → base44.functions.invoke('liveAssistantAI')│
  └──────────────────────────┬──────────────────────────────────┘
                             │  SDK call
  ┌──────────────────────────▼──────────────────────────────────┐
  │  liveAssistantAI (backend function)                          │
  │                                                              │
  │  mode='qa' (default):                                        │
  │    1. findDirectHit(question, kbEntries) → exact KB match?   │
  │       → return pre-written answer (source: 'kb_direct')      │
  │    2. Gating: short/acknowledgement? → skip (zero tokens)    │
  │    3. Haiku classifier: "does this need an answer?"           │
  │       → if no, skip                                          │
  │    4. findRelevantKB(question, kbEntries, 5) → top 5          │
  │    5. callLLMCached (Anthropic Haiku w/ prompt caching)        │
  │       → returns JSON { needs_answer, answer, opener, ... }   │
  │    6. Return { answer, source: 'kb_ai', usage }              │
  └──────────────────────────┬──────────────────────────────────┘
                             │  response
  ┌──────────────────────────▼──────────────────────────────────┐
  │  QASection renders the answer                                │
  │    - AnswerDisplay (single or numbered multi-answer)         │
  │    - QAAnswerActions: +More Info, Talking Points, Research,   │
  │      ★ Common (starToCommon → KnowledgeBase entity)          │
  │    - saveQAHistory → DebtQAHistory entity                    │
  └─────────────────────────────────────────────────────────────┘
```

---

## 4. Audio → Transcript: `DebtAIPanel.jsx`

**File:** `src/components/debt/DebtAIPanel.jsx`

This panel is the entry point. Its `connectStream()` function:

1. Gets microphone audio via `navigator.mediaDevices.getUserMedia`.
2. Creates an `AudioContext` pinned to **16kHz** (Deepgram nova-3 is trained on 16kHz).
3. Opens a WebSocket to `wss://api.deepgram.com/v1/listen` with params: `model=nova-3`, `diarize=true` (single mic) or `multichannel=true` (dual mic), `smart_format=true`, `interim_results=true`, `sentiment=true`.
4. On each Deepgram `is_final` result, builds a transcript entry:

```js
// DebtAIPanel.jsx lines 184-196
ws.onmessage = e => {
  try {
    const data = JSON.parse(e.data);
    const alt = data?.channel?.alternatives?.[0];
    const text = alt?.transcript?.trim();
    if (!text || !data.is_final) return;
    const channel = data.channel !== undefined ? data.channel : (Array.isArray(data.channel_index) ? data.channel_index[0] : 0);
    const speaker = dualMode ? (channel === 0 ? 0 : 1) : (alt.speaker ?? 0);
    const entry = { text, time: new Date(), speaker, sentiment: alt?.sentiments?.segments?.[0]?.sentiment || null };
    setTwilioTranscript(prev => [...prev, entry]);
  } catch {}
};
```

**Key point:** Deepgram's `is_final` flag is the boundary that creates each transcript entry. `interim_results` that are not final are ignored. Speaker is determined by channel (dual-mic mode) or by Deepgram's diarization `alt.speaker` (single-mic mode).

The transcript is then normalized for the AI Assistant popup (speaker labels are swapped so that `1 = agent`, `0 = prospect` inside the popup):

```js
// DebtAIPanel.jsx lines 92-97
const normalizedTranscript = useMemo(
  () => transcriptFormat === 'bob'
    ? activeTranscript.map(e => ({ speaker: e.role === 'trainee' ? 1 : 0, ... }))
    : activeTranscript.map(e => ({ speaker: e.speaker === 0 ? 1 : 0, ... })),
  [activeTranscript, transcriptFormat]
);
```

---

## 5. Question Detection: `extractQuestions()` + Auto-Trigger

**File:** `src/components/leads/AIAssistantPopup.jsx`

### 5.1 `extractQuestions(text)` — lines 157-185

Splits the customer's line into sentences and treats sentences ending in `?` as questions. If a question follows a short non-question sentence, it joins them for context (handles two-part questions like "So my wife is a co-signer, would she need to be on this too?"):

```js
function extractQuestions(text) {
  const found = new Set();
  const trimmed = (text || '').trim();
  if (!trimmed.includes('?')) return [];
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  for (let i = 0; i < sentences.length; i++) {
    if (!sentences[i].includes('?')) continue;
    const q = sentences[i].trim();
    if (q.length <= 8 || q.length >= 300) continue;
    if (i > 0 && !sentences[i - 1].includes('?') && sentences[i - 1].length < 120) {
      found.add((sentences[i - 1].trim() + ' ' + q).trim());
    } else {
      found.add(q);
    }
  }
  if (found.size === 0 && trimmed.length > 12 && trimmed.length < 300) {
    found.add(trimmed);
  }
  return [...found];
}
```

### 5.2 Auto-question trigger — `QASection` useEffect (lines 557-596)

On every new transcript line, `QASection` runs this effect:

```js
useEffect(() => {
  if (!transcript.length) return;
  const last = transcript[transcript.length - 1];
  if (!last?.text) return;
  // Q&A only listens to the prospect (speaker 0 = remote/ch0)
  const isProspect = last.speaker === 0 || last.speaker === null || last.speaker === undefined;
  if (!isProspect) return;
  const detected = extractQuestions(last.text);
  detected.forEach(q => {
    if (!seenQ.current.has(q)) {
      seenQ.current.add(q);
      const id = Date.now() + Math.random();
      setQuestions(prev => [...prev, { id, text: q, time: new Date(), answer: '', answering: false, answered: false, auto: false, manual: false }]);
    }
  });
  const now = Date.now();
  if (active && now - lastAutoRef.current > 2500) {
    const kwRegex = buildKeywordRegex();
    const hit = (kwRegex && kwRegex.test(last.text)) || hasTopicFragment(last.text);
    if (hit && detected.length === 0) {
      lastAutoRef.current = now;
      const autoId = Date.now() + Math.random();
      const autoQ  = last.text.trim().slice(0, 150);
      if (!seenQ.current.has(autoQ)) {
        seenQ.current.add(autoQ);
        setQuestions(prev => [...prev, { id: autoId, text: autoQ, ..., auto: true }]);
        base44.functions.invoke('liveAssistantAI', { question: autoQ, transcript: transcriptRef.current, kbEntries, mode: 'qa' })
          .then(res => { /* update question with answer */ })
          .catch(e => { /* show error */ });
      }
    }
  }
}, [transcript, active, buildKeywordRegex]);
```

**Logic:**
- Only the **prospect's** lines are processed (speaker 0/null/undefined).
- Detected `?` questions are added to the list but **not auto-answered** — the agent clicks "Answer".
- If no `?` is found but the line contains a configured keyword or a topic fragment (`hasTopicFragment`), it's treated as an implied question and **auto-answered** immediately (throttled to 1 per 2.5s).

### 5.3 `hasTopicFragment(text)` — lines 187-192

Returns true only if the text contains `?` AND a topic keyword (minimum, invest, return, ROI, conversion, nasdaq, etc.):

```js
function hasTopicFragment(text) {
  if (!text.includes('?')) return false;
  const TOPIC_RE = /\b(minimum|invest(ment|ing)?|return|ROI|interest rate|conversion|nasdaq|...)\b/gi;
  return TOPIC_RE.test(text);
}
```

---

## 6. Answering: `answerQ()` and the Backend Call

**File:** `src/components/leads/AIAssistantPopup.jsx` (lines 612-626)

When the agent clicks "Answer" (or a question is auto-triggered), `answerQ()` calls the backend:

```js
const answerQ = async (id) => {
  const q = questions.find(x => x.id === id);
  if (!q || q.answering) return;
  setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: true } : x));
  try {
    const res = await base44.functions.invoke('liveAssistantAI', { question: q.text, transcript: transcriptRef.current, kbEntries, mode: 'qa' });
    const data = res?.data || res || {};
    const answers = Array.isArray(data.answers) ? data.answers : [];
    const answer = data.answer || 'No matching information found.';
    setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answered: true, answer, answers, source: data.source } : x));
    saveQAHistory(q.text, answer, q.auto ? 'auto' : 'manual');
  } catch (e) {
    setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answer: `Error: ${e.message}` } : x));
  }
};
```

---

## 7. The Backend: `liveAssistantAI`

**File:** `base44/functions/liveAssistantAI/entry.ts`

This is a single Deno-served function that handles **many modes** via a `mode` field in the request body. For the Live Q&A tool, the relevant mode is the **default (no mode / `mode: 'qa'`)** path at the bottom of the function (lines 1271-1386). Below is the full Q&A logic.

### 7.1 LLM Helpers

Two LLM helpers exist:

- **`callLLM(req, body)`** (lines 8-60): Direct Anthropic API call (Haiku) using `ANTHROPIC_API_KEY`. Falls back to platform `InvokeLLM` on error. Throws `CREDIT_EXHAUSTED` on 401/402/403/429.
- **`callLLMCached(req, opts)`** (lines 67-122): Same, but sends a static `cachedSystem` block with `cache_control: { type: 'ephemeral' }` so the KB/objection catalog is cached by Anthropic (90% discount on cached read tokens). Used by Q&A and coach modes.

### 7.2 KB Search Functions

#### `getAnswers(e)` — lines 127-139
Returns all answers for an entry: parses `answersJson` (array) if present, otherwise falls back to the single `answer` field.

#### `formatAnswers(e)` — lines 142-146
Formats all answers as a numbered list (for AI context).

#### `scoreEntry(qLower, words, e)` — lines 149-163
Scores a KB entry against a question. Points:
- +1 per word found in the haystack (question + answer + answersJson + keywords + variations)
- +0.8 per word found in the entry's `question`
- +0.5 per word found in `keywords`
- +0.6 per word found in `variations`
- +3 per 2-word phrase (4+ char words) found in the haystack

#### `findDirectHit(question, kbEntries)` — lines 165-181
Looks for a strong, high-coverage match:
- Splits question into words ≥ 4 chars.
- Requires ≥ 2 words.
- Filters out `raw_chunk` / `raw_document` categories.
- Computes `coverage` = matched words / total words, and `aScore` via `scoreEntry`.
- Requires `coverage >= 0.5` AND `aScore >= 2`.
- Returns the top candidate or null.

```js
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
    .filter((e: any) => e.coverage >= 0.5 && e.aScore >= 2)
    .sort((a: any, b: any) => b.coverage - a.coverage || b.aScore - a.aScore);
  return candidates.length > 0 ? candidates[0] : null;
}
```

#### `findRelevantKB(question, kbEntries, topN)` — lines 183-206
Broader search for AI context. Scores all entries, returns top N Q&A entries + up to 4 raw chunks.

### 7.3 The Q&A Mode (default) — lines 1271-1386

This is the core of the Live Q&A tool. The full logic:

```js
// ── Q&A (default) — try direct hit first, AI only if needed ──────
const q = question || recentTranscript;

// 1. Try direct KB hit — return pre-written answer(s) with zero AI tokens
if (question) {
  const directHit = findDirectHit(question, kbEntries || []);
  if (directHit) {
    console.log(`[liveAssistantAI] Direct KB hit: "${directHit.question}" (coverage high)`);
    const answers = getAnswers(directHit);
    let formattedAnswer: string;
    if (answers.length > 1) {
      formattedAnswer = answers.map((a, i) => {
        const label = i === answers.length - 1 ? '★ NEWEST' : `Answer ${i + 1}`;
        return `[${label}]\n${a}`;
      }).join('\n\n---\n\n');
    } else {
      formattedAnswer = answers[0] || '';
    }
    const redirect = buildScriptRedirect(scriptPosition);
    if (redirect) formattedAnswer += `\n\n${redirect}`;
    return Response.json({ answer: formattedAnswer, answers, source: 'kb_direct', kbEntry: directHit.question });
  }
}

// 1.5. Pre-AI gating — skip short lines and pure acknowledgements (zero AI cost)
const qWords = (q || '').trim().split(/\s+/).filter((w: string) => w.length > 0);
const ACK_WORDS = new Set(['yeah', 'yes', 'no', 'okay', 'ok', 'right', 'sure', 'yep', 'nope', 'mmm', 'hmm', 'hello', 'hi', 'hey', 'thanks', 'thank', 'correct', 'exactly', 'true', 'got', 'gotcha', 'alright', 'sounds', 'good', 'see', 'makes', 'sense', 'uh', 'huh', 'oh', 'wow', 'nice', 'great', 'cool', 'fine']);
const isShortAck = qWords.length < 6 || qWords.every((w: string) => ACK_WORDS.has(w.toLowerCase().replace(/[.,!?;:'"]/g, '')));
if (isShortAck) {
  return Response.json({ needs_answer: false, answer: '', source: 'gated_short' });
}

// 1.6. Haiku classifier — "does this need an answer?" before spending Q&A tokens
try {
  const classifyData = await callLLM(req, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    system: 'You classify whether a customer statement on a live sales call needs an answer from the agent. Respond with only "yes" or "no". Questions, concerns, objections, and implied questions = "yes". Small talk, greetings, acknowledgements, and pure statements = "no".',
    messages: [{ role: 'user', content: `Customer said: "${q}"\n\nNeeds an answer?` }],
  });
  const classifyText = (classifyData?.content?.[0]?.text || '').toLowerCase().trim();
  if (!classifyText.startsWith('yes')) {
    return Response.json({ needs_answer: false, answer: '', source: 'gated_haiku' });
  }
} catch {
  // If classifier fails, proceed to full Q&A (don't block on classifier error)
}

// 2. No direct hit — use AI with relevant KB context (cut from 12 to 5 entries)
const relevantKB = findRelevantKB(q, kbEntries || [], 5);
const hasKBContext = relevantKB.length > 0 && (relevantKB[0]?.score || 0) >= 2;
const kbContext  = hasKBContext
  ? relevantKB.filter((e: any) => (e.score || 0) >= 2).map((e: any) => e.category === 'raw_chunk'
      ? `[Document excerpt]: ${e.answer}`
      : `Q: ${e.question}\nA: ${formatAnswers(e)}`
    ).join('\n\n')
  : 'No relevant knowledge base entries found.';

const allObjections = (kbEntries || []).filter((e: any) => e.category === 'debt_objections');
const objectionContext = allObjections.length > 0
  ? allObjections.map((e: any) => `OBJECTION: "${e.question}"\nHOW TO HANDLE: ${e.answer}`).join('\n---\n')
  : '';

// Static (cached): base instructions + objection catalog
const cachedSystem = `You are a real-time sales assistant on a live debt settlement call...
Treat statements that imply a question, concern, or objection as questions...
If the customer's statement is just small talk, a greeting, or doesn't need an answer, return exactly: {"needs_answer": false}
When an answer IS needed, return JSON with this exact structure:
{"needs_answer": true, "really_asking": "...", "opener": "...", "answer": "1-2 sentences... Max 60 words.", "detail": "..."}
Rules:
- "answer" must be 60 words max
- "opener" must vary every time
- If the exact answer is in the KB, use it verbatim or lightly paraphrase
- If it requires synthesis, combine relevant entries
- If the customer is raising an objection, use the OBJECTION HANDLING CATALOG
- Return ONLY valid JSON, no markdown
${objectionContext ? `━━━ OBJECTION HANDLING CATALOG ━━━\n${objectionContext}` : ''}`;

// Dynamic: relevant KB entries
const dynamicSystem = `KNOWLEDGE BASE${kbName ? ` (${kbName})` : ''}:\n${kbContext}`;
const data = await callLLMCached(req, {
    cachedSystem,
    system: dynamicSystem,
    userContent: `${fullTranscriptStr ? `Conversation so far:\n${fullTranscriptStr}\n\n` : ''}Customer's latest statement: "${question}"\n\nReturn JSON:`,
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 400,
});
const rawText = data?.content?.[0]?.text || '';
let parsed: any = null;
try {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
} catch { parsed = null; }
if (parsed?.needs_answer === false) {
  return Response.json({ needs_answer: false, answer: '', source: 'kb_ai' });
}
const redirect = buildScriptRedirect(scriptPosition);
const answer = parsed?.answer || rawText || 'No answer found.';
const fullAnswer = redirect ? `${answer}\n\n${redirect}` : answer;
return Response.json({
  answer: fullAnswer,
  really_asking: parsed?.really_asking || '',
  opener: parsed?.opener || '',
  detail: parsed?.detail || '',
  needs_answer: true,
  source: 'kb_ai',
  usage: data?.usage || null,
});
```

### 7.4 Q&A Decision Tree (summary)

```
Question arrives
  │
  ├─ 1. findDirectHit → exact KB match?
  │     YES → return pre-written answer(s), source: 'kb_direct' (ZERO AI tokens)
  │     NO  ↓
  │
  ├─ 1.5. Short/acknowledgement? (< 6 words OR all ack words)
  │     YES → return { needs_answer: false }, source: 'gated_short' (ZERO AI tokens)
  │     NO  ↓
  │
  ├─ 1.6. Haiku classifier ("does this need an answer?")
  │     NO  → return { needs_answer: false }, source: 'gated_haiku' (1 tiny Haiku call)
  │     YES ↓
  │
  └─ 2. findRelevantKB(top 5) + callLLMCached (Haiku w/ prompt caching)
        → returns JSON { needs_answer, answer, opener, detail }
        → source: 'kb_ai'
```

This 3-tier gating is a credit-saving design: most lines never reach the full LLM call.

---

## 8. Answer Rendering: `AnswerDisplay` + `QAAnswerActions`

**File:** `src/components/leads/AIAssistantPopup.jsx`

### 8.1 `AnswerDisplay` — lines 362-378

Renders a single answer or a numbered list of multiple answers:

```jsx
function AnswerDisplay({ answer, answers }) {
  const list = Array.isArray(answers) && answers.length > 1 ? answers : null;
  if (!list) {
    return <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{answer || 'No matching information found.'}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {list.map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', ... }}>
          <span style={{ color: GOLD, ... }}>{i + 1}.</span>
          <span style={{ color: '#e8e0d0', ... }}>{a}</span>
        </div>
      ))}
      <span style={{ color: GOLD, ... }}>{list.length} answers from KB</span>
    </div>
  );
}
```

### 8.2 `QAAnswerActions` — lines 381-445

Four action buttons on each answered question:

| Button | Function | Backend Call |
|---|---|---|
| **+ More** | Expanded info from KB | `liveAssistantAI` mode `qa_expand` |
| **💬 Points** | 4-6 talking points to say aloud | `liveAssistantAI` mode `talking_points` (passed as `coach_stream`) |
| **🔍 Research** | Internet research | `liveAssistantResearch` function |
| **★ Common** | Star to Common Asked Questions | `starToCommon()` → `KnowledgeBase.create()` |

```js
const addToCommon = async () => {
  if (starring || starred) return;
  setStarring(true);
  try {
    await starToCommon(q.text, q.answer, q.answers);
    setStarred(true);
    setTimeout(() => setStarred(false), 2500);
  } catch (e) { alert('Could not save to Common: ' + (e?.message || String(e))); }
  setStarring(false);
};
```

---

## 9. Persistence: `DebtQAHistory` + `KnowledgeBase`

### 9.1 `saveQAHistory()` — AIAssistantPopup.jsx lines 484-500

Every answered question is saved to the `DebtQAHistory` entity:

```js
const saveQAHistory = useCallback(async (question, answer, source = 'auto') => {
  if (!lead?.id) return;
  try {
    const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
    await base44.entities.DebtQAHistory.create({
      leadId: lead.id,
      leadName,
      question,
      answer: answer || '',
      askedAt: new Date().toISOString(),
      source,
    });
    const rows = await base44.entities.DebtQAHistory.filter({ leadId: lead.id }, '-askedAt', 200);
    setHistory(rows || []);
  } catch {}
}, [lead]);
```

### 9.2 `DebtQAHistory` Entity Schema

**File:** `base44/entities/DebtQAHistory.jsonc`

```json
{
  "name": "DebtQAHistory",
  "type": "object",
  "properties": {
    "leadId": { "type": "string", "title": "Lead ID" },
    "leadName": { "type": "string", "title": "Lead Name (for display)" },
    "agentId": { "type": "string", "title": "Agent ID (username)" },
    "transcriptId": { "type": "string", "title": "Call Transcript ID" },
    "question": { "type": "string", "title": "Question" },
    "answer": { "type": "string", "title": "Answer", "format": "textarea" },
    "askedAt": { "type": "string", "format": "date-time", "title": "Asked At" },
    "source": { "type": "string", "title": "Source", "enum": ["auto", "manual", "transcript"], "default": "auto" }
  },
  "required": ["leadId", "question"],
  "rls": { "create": null, "read": null, "update": null, "delete": null }
}
```

**Note:** RLS is `null` on all operations — any authenticated user can read/write/delete any Q&A history record. The `agentId` and `transcriptId` fields exist in the schema but are **not populated** by `saveQAHistory()`.

### 9.3 `KnowledgeBase` Entity Schema

**File:** `src/entities/KnowledgeBase.json`

```json
{
  "name": "KnowledgeBase",
  "type": "object",
  "properties": {
    "question": { "type": "string", "title": "Question" },
    "answer": { "type": "string", "title": "Answer", "format": "textarea" },
    "category": { "type": "string", "title": "Category" },
    "source": { "type": "string", "title": "Source" },
    "tags": { "type": "string", "title": "Tags" },
    "kbName": { "type": "string", "title": "Knowledge Base Name" },
    "keywords": { "type": "string", "title": "Keywords", "description": "Comma-separated search tags auto-generated at extraction time" }
  },
  "required": ["question", "answer"]
}
```

**Note:** This schema does **not** declare `answersJson` or `variations`, yet the backend code reads both (`getAnswers` parses `answersJson`, `scoreEntry` checks `variations`). These fields are used at runtime but not validated by the schema — they are stored as undeclared fields. No RLS is configured on this entity either.

---

## 10. The "Common Asked Questions" Library

**File:** `src/components/leads/CommonQAView.jsx`

### 10.1 `starToCommon(question, answer, answers)` — lines 15-28

Saves a Q&A pair as a new `KnowledgeBase` entry under `kbName="Common Asked Questions"`:

```js
export async function starToCommon(question, answer, answers) {
  if (!question) return;
  const answersJson = Array.isArray(answers) && answers.length > 0 ? JSON.stringify(answers) : '';
  await base44.entities.KnowledgeBase.create({
    question,
    answer: answer || '',
    answersJson,
    category: 'debt_faq',
    source: 'starred_qa',
    kbName: COMMON_KB_NAME,
    tags: 'common',
  });
  window.dispatchEvent(new CustomEvent('debt_common_qa_updated'));
}
```

### 10.2 `CommonQAView` — lines 30-104

Lists starred Q&A pairs. Loads entries with `base44.entities.KnowledgeBase.filter({ kbName: 'Common Asked Questions' })`, renders them as expandable cards, and allows deletion. Refreshes on a `debt_common_qa_updated` custom window event.

### 10.3 `CommonQAPopOut` — lines 106-134

A standalone draggable floating panel that shows `CommonQAView` solo.

---

## 11. Q&A Pop-Out Panel

**File:** `src/components/leads/QAPopOutPanel.jsx`

A detached floating window for Q&A only (no transcript sidebar, no Coach/Intent). It reuses `QASection` from `AIAssistantPopup` in `qaOnly` mode. It supports its own drag/resize and saves its layout via an `onSave` callback. The transcript is intentionally not included here — it lives in the main AI Assistant window.

---

## 12. Common Questions Management Tab

**File:** `src/components/debt/CommonQuestionsTab.jsx`

An admin UI to manage KB Q&A entries. It loads all debt-related KB entries (not just one category), supports search, add, edit, and delete. New entries are created with `category: 'debt_common_qa'` and `kbName: 'Debt Settlement'`.

**Note:** This tab manages a broader set of categories than its name implies — it shows all entries matching `DEBT_KB_CATEGORIES` (14 categories including `debt_objections`, `debt_hotpoints`, etc.), not just `debt_common_qa`.

---

## 13. Multi-Answer Editor

**File:** `src/components/debt/MultiAnswerEditor.jsx`

A React editor for managing multiple answers on a single KB entry. The first answer is the primary; additional answers are alternatives. It parses `answersJson` (array) with a fallback to the legacy single `answer` field, and serializes non-empty answers back as JSON. This is used in KB management, not during live calls.

---

## 14. The `qa_expand` Mode (Backend)

**File:** `base44/functions/liveAssistantAI/entry.ts` (lines 1202-1218)

When the agent clicks "+ More" on an answered question, the backend runs `qa_expand` mode:

```js
if (mode === 'qa_expand') {
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
```

This searches the KB more broadly (top 12 instead of 5) and asks the LLM to provide **additional** details not in the initial answer.

---

## 15. Other Q&A-Related Backend Modes

The `liveAssistantAI` function handles many modes. The ones directly related to the Q&A tool's answer actions:

| Mode | Triggered By | Purpose |
|---|---|---|
| `qa` (default) | Auto-detect, manual ask, pending question | Main Q&A answering |
| `qa_expand` | "+ More" button | Expanded KB info |
| `talking_points` | "💬 Points" button | Passed as `coach_stream` with a custom style prompt |
| `internet_search` | (available but not wired to Q&A buttons) | Web search via InvokeLLM |

The `coach`, `coach_stream`, `intent`, `intent_final`, `extract_facts`, `hardship`, `cosigners`, `credit`, `budget`, `contact`, `handoff`, `extract_insights`, `dob_research`, `birth_year_research`, `research_insight`, `generate_smalltalk`, `next_call_briefing`, `full_report`, `call_analysis`, `profile`, `hot_call_check` modes are used by **other** features (Coach, Intent, profile extraction, post-call reports) and are **not** part of the Q&A tool, though they share the same function.

---

## 16. Transcript Format and Speaker Convention

There is a **critical speaker-label swap** between the two layers:

| Context | Speaker 0 | Speaker 1 |
|---|---|---|
| **Deepgram / live call** | Agent (local mic, ch0) | Customer (remote, ch1) |
| **AIAssistantPopup (normalized)** | Prospect | Agent |

`DebtAIPanel` swaps the labels in `normalizedTranscript` (line 95): `speaker: e.speaker === 0 ? 1 : 0`. Inside `QASection`, prospect = `speaker === 0 || null || undefined`. This is consistent within the popup but is a common source of confusion when auditing.

---

## 17. Credit / Cost Architecture

The Q&A tool is designed to minimize AI credit usage:

1. **Direct KB hit** — zero AI tokens. Returns pre-written answers.
2. **Short/ack gating** — zero AI tokens. Skips lines < 6 words or all-acknowledgement words.
3. **Haiku classifier** — 1 tiny Haiku call (max 10 tokens output). Only runs if gating passes.
4. **Full Q&A** — Haiku with prompt caching. The static system block (base instructions + objection catalog) is cached by Anthropic, giving a 90% discount on cached read tokens. Only the dynamic KB context and user question are new tokens per call.

The `callLLMCached` helper logs usage including `cache_read_input_tokens` and `cache_creation_input_tokens` so cost can be monitored.

If `ANTHROPIC_API_KEY` is exhausted (401/402/403/429), the function throws `CREDIT_EXHAUSTED` and returns a 500 with `creditError: true`. The Q&A tool does not currently surface this error gracefully in the UI — it shows `Error: CREDIT_EXHAUSTED:...` in the answer card.

---

## 18. Security / Access Control Notes

| Entity / Function | RLS | Notes |
|---|---|---|
| `KnowledgeBase` | None configured | Any authenticated user can read/write/delete all KB entries |
| `DebtQAHistory` | `null` on all ops | Any authenticated user can read/write/delete any lead's Q&A history |
| `liveAssistantAI` | No auth check | The function does not verify the caller's identity or role. It trusts the `kbEntries` and `transcript` passed in the request body. |

The `liveAssistantAI` function is a public HTTP endpoint (`/functions/liveAssistantAI`). It does not authenticate the caller. The `kbEntries` are passed from the frontend (already loaded by the client), not fetched server-side, so the backend relies on the client to provide the correct KB.

---

## 19. Known Issues / Audit Observations

1. **`KnowledgeBase` schema mismatch:** The backend reads `answersJson` and `variations` fields, but the entity schema (`src/entities/KnowledgeBase.json`) does not declare them. They are stored as undeclared fields. Consider adding them to the schema for validation.

2. **`DebtQAHistory` unused fields:** `agentId` and `transcriptId` exist in the schema but are never populated by `saveQAHistory()`. This means Q&A history cannot be filtered by agent or linked to a specific call transcript.

3. **No RLS on Q&A data:** Both `KnowledgeBase` and `DebtQAHistory` have no row-level security. Any authenticated app user can read, modify, or delete any Q&A entry or any lead's Q&A history.

4. **`liveAssistantAI` has no auth:** The backend function does not verify the caller. It processes whatever `question`, `transcript`, and `kbEntries` are sent. A malicious caller could invoke it directly to consume AI credits.

5. **Credit exhaustion UX:** When `CREDIT_EXHAUSTED` is returned, the Q&A card shows a raw error string. There is no user-friendly "AI credits exhausted" message or fallback.

6. **`CommonQuestionsTab` category scope:** Despite its name, it shows 14 categories of debt KB entries, not just "common questions." This is intentional (matches Bob's Brain) but could confuse an auditor.

7. **Speaker-label swap:** The swap between Deepgram's convention (0=agent) and the popup's convention (0=prospect) is a known source of confusion. `QASection` only processes `speaker === 0 || null || undefined` as prospect, which is correct post-swap.

8. **`hasTopicFragment` requires `?`:** The auto-trigger function only fires if the text contains a `?`. A prospect saying "I'm worried about my credit score" (no question mark) would not auto-trigger unless a keyword regex match occurs via `buildKeywordRegex` (which requires configured `qaKeywords`).

9. **`extractQuestions` length limits:** Questions shorter than 9 chars or longer than 300 chars are dropped. Very short questions ("Why?") would be filtered out.

10. **`findDirectHit` word filter:** Only words ≥ 4 characters are considered. Questions like "Is it safe?" (words: "safe", 4 chars) would have only 1 qualifying word and would never get a direct hit (requires ≥ 2 words).

---

## 20. Summary

The Live Q&A tool is a 3-layer system:

1. **Audio → Transcript** (`DebtAIPanel` + Deepgram): Real-time speech-to-text, one entry per Deepgram `is_final`.
2. **Transcript → Question → Answer** (`AIAssistantPopup` `QASection` + `liveAssistantAI`): Detects questions, gates on short/ack/classifier, answers via direct KB hit or cached Haiku LLM call.
3. **Persistence** (`DebtQAHistory` + `KnowledgeBase`): Saves every Q&A per lead; stars good ones to a reusable library.

The backend uses a 3-tier credit-saving design (direct hit → gating → Haiku classifier → full LLM) and prompt caching for the static system block. The main audit concerns are: no RLS on Q&A data, no auth on the backend function, schema/field mismatches, and unused entity fields.

<next_prompt>Fix the RLS and auth gaps in the Q&A tool</next_prompt>