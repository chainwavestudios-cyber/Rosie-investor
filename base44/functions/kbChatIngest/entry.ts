/**
 * kbChatIngest — AI-powered knowledge base chat.
 * Dual-mode: auto-detects whether the user is ASKING a question (answers from
 * KB + database) or PROVIDING content to ingest (analyzes and saves KB entries).
 *
 * Input: { message: string, fileUrl?: string, fileType?: 'image'|'audio', fileName?: string }
 * Output: { mode: 'answer'|'ingest', response: string, entries: [...], savedCount?: number }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const KB_CATEGORIES = [
  { id: 'debt_agent', label: 'Agent Script', desc: 'Openers, rebuttals, qualifying questions, closing language' },
  { id: 'debt_customer', label: 'Customer Q&A', desc: 'Common customer questions with pre-written answers' },
  { id: 'debt_hotpoints', label: 'Coaching Hotpoint', desc: 'Triggers and coaching guidance for live calls' },
  { id: 'debt_doc', label: 'Document Knowledge', desc: 'Program details, compliance, factual info' },
  { id: 'debt_faq', label: 'FAQ', desc: 'Frequently asked questions about the program' },
  { id: 'debt_kb', label: 'General KB', desc: 'General knowledge that does not fit other categories' },
];

// ── KB search helpers ──────────────────────────────────────────────────
function getAnswers(e: any): string[] {
  const out: string[] = [];
  if (e?.answersJson) {
    try { const arr = JSON.parse(e.answersJson); if (Array.isArray(arr)) for (const a of arr) { if (typeof a === 'string' && a.trim()) out.push(a); } } catch {}
  }
  if (out.length === 0 && e?.answer && String(e.answer).trim()) out.push(String(e.answer));
  return out;
}

function formatAnswers(e: any): string {
  const answers = getAnswers(e);
  if (answers.length <= 1) return answers[0] || '';
  return answers.map((a, i) => `${i + 1}. ${a}`).join('\n');
}

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
  for (const phrase of phrases) { if (haystack.includes(phrase)) score += 3; }
  return score;
}

function findRelevantKB(question: string, kbEntries: any[], topN = 10): any[] {
  if (!kbEntries?.length) return [];
  const qLower = question.toLowerCase();
  const words = qLower.split(/\W+/).filter((w: string) => w.length >= 3);
  return kbEntries
    .filter((e: any) => e.category !== 'raw_document' && e.category !== 'raw_chunk')
    .map((e: any) => ({ ...e, score: scoreEntry(qLower, words, e) }))
    .filter((e: any) => e.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, topN);
}

// ── Question detection ─────────────────────────────────────────────────
function isQuestion(message: string): boolean {
  const q = message.toLowerCase().trim();
  if (q.endsWith('?')) return true;
  if (q.length > 300) return false; // long messages are content to ingest
  // Instructional content that starts with "when" but isn't a question
  if (/\b(respond:|say:|answer:|script:|handle:|rebuttal:|opener:|closer:|hotpoint:|when a customer|when the customer|when they say|when prospect)\b/.test(q)) return false;
  const qWords = /^(what|how|why|when|where|who|which|can|could|would|is|are|do|does|will|should|have|has|tell me|explain|show me|give me|list|how many|what's|who's|where's)\b/;
  return qWords.test(q);
}

// ── Database context gathering ─────────────────────────────────────────
async function gatherDatabaseContext(question: string, base44: any): Promise<string> {
  const q = question.toLowerCase();
  const parts: string[] = [];
  const svc = base44.asServiceRole;

  try {
    if (/\b(lead|client|customer|prospect|debtor)s?\b/.test(q)) {
      const leads = await svc.entities.DebtLead.list('-updated_date', 10);
      parts.push(`Recent leads (showing ${leads.length}): ` + leads.map((l: any) =>
        `${l.firstName} ${l.lastName} (${l.status || 'unknown'}, ${l.callCount || 0} calls, debt: $${l.debtAmount || 0})`).join('; '));
    }
    if (/\b(call|transcript|conversation|recording)s?\b/.test(q)) {
      const calls = await svc.entities.DebtCallTranscript.list('-callDate', 10);
      parts.push(`Recent calls (showing ${calls.length}): ` + calls.map((c: any) =>
        `${c.leadName} on ${c.callDate ? new Date(c.callDate).toLocaleDateString() : 'unknown'}, ${c.durationSeconds || 0}s, intent: ${c.intentScore ?? 'n/a'}`).join('; '));
    }
    if (/\b(agent|user|dialer|employee|manager|rep|admin)s?\b/.test(q)) {
      const users = await svc.entities.DebtCoachUser.list('-created_date', 20);
      parts.push(`Users (showing ${users.length}): ` + users.map((u: any) =>
        `${u.username} (${u.role})`).join(', '));
    }
    if (/\b(activity|note|log|history|synopsis|memo)s?\b/.test(q)) {
      const acts = await svc.entities.DebtLeadActivity.list('-created_date', 10);
      parts.push(`Recent activity (showing ${acts.length}): ` + acts.map((a: any) =>
        `${a.activityType}: ${(a.activityText || '').slice(0, 80)}`).join('; '));
    }
    if (/\b(insight|stat|statistic|metric|score)s?\b/.test(q)) {
      const insights = await svc.entities.CustomerInsight.list('-created_date', 10);
      parts.push(`Recent insights (showing ${insights.length}): ` + insights.map((i: any) =>
        `${i.insightType}: ${i.insightText}`).join('; '));
    }
    if (/\b(scrap|social|reddit|twitter|tiktok|facebook|lead gen)\b/.test(q)) {
      const scraped = await svc.entities.ScrapedLead.list('-created_date', 10);
      parts.push(`Scraped leads (showing ${scraped.length}): ` + scraped.map((s: any) =>
        `${s.userHandle} (${s.platform}, ${s.distressCategory || 'none'})`).join('; '));
    }
  } catch (e: any) {
    console.error('[kbChatIngest] gatherDatabaseContext error:', e?.message || String(e));
  }

  return parts.join('\n\n');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Non-fatal auth — debt coach users use custom auth, may not have a Base44 token
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}

    const body = await req.json();
    const { message, fileUrl, fileType, fileName } = body;

    if (!message && !fileUrl) {
      return Response.json({ error: 'No content provided' }, { status: 400 });
    }

    const hasFile = !!fileUrl;
    const asking = !hasFile && isQuestion(message);

    // ── QUESTION MODE: search KB + database and answer ──────────────────
    if (asking) {
      const svc = base44.asServiceRole;
      const kbEntries = await svc.entities.KnowledgeBase.list('-created_date', 500);
      const relevant = findRelevantKB(message, kbEntries, 10);
      const dbContext = await gatherDatabaseContext(message, base44);
      const kbContext = relevant.map((e: any) => `Q: ${e.question}\nA: ${formatAnswers(e)}`).join('\n\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI assistant for a debt settlement sales platform called Settlement IQ. The user is asking you a question. Answer based on the knowledge base and database data below.

If the knowledge base has relevant entries, use them as your primary source.
If the database context has relevant data (leads, calls, users, etc.), incorporate that.
If neither has the answer, say you don't have that information and suggest what the user could do.

Knowledge Base entries (most relevant):
${kbContext || '(no relevant KB entries found)'}

Database context:
${dbContext || '(no relevant database records found)'}

User question: ${message}

Answer concisely and accurately in 2-4 sentences. If you used KB entries, mention "from the knowledge base." If you used database data, mention what data you found.`,
        response_json_schema: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            source: { type: 'string' },
          },
        },
      });

      return Response.json({
        mode: 'answer',
        response: result?.answer || "I couldn't find an answer to that question.",
        source: result?.source || 'none',
        entries: relevant.slice(0, 5).map((e: any) => ({ id: e.id, question: e.question, answer: formatAnswers(e), category: e.category, tags: e.tags })),
      });
    }

    // ── INGEST MODE: analyze content and save to KB ─────────────────────
    let llmPrompt = '';
    let fileUrls: string[] = [];

    if (fileUrl && fileType === 'audio') {
      let transcriptText: string;
      try {
        transcriptText = await base44.integrations.Core.TranscribeAudio({ audio_url: fileUrl });
      } catch {
        const res = await base44.functions.invoke('transcribeAudioLarge', { audio_url: fileUrl });
        transcriptText = res?.transcript || res?.data?.transcript || '';
      }
      llmPrompt = `The user uploaded an audio file${fileName ? ` named "${fileName}"` : ''}. Here is the transcript:\n\n${transcriptText}\n\nUser message: ${message || '(no additional message)'}`;
    } else if (fileUrl && fileType === 'image') {
      fileUrls = [fileUrl];
      llmPrompt = `The user uploaded an image${fileName ? ` named "${fileName}"` : ''}. Analyze what is in the image and extract any knowledge-base content from it.\n\nUser message: ${message || '(no additional message)'}`;
    } else {
      llmPrompt = `User message:\n${message || ''}`;
    }

    const categoryList = KB_CATEGORIES.map(c => `- ${c.id} (${c.label}): ${c.desc}`).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI knowledge-base assistant for a debt settlement sales platform. The user is sending you content (text, an image, or an audio transcript) via chat. Your job is to:

1. Analyze the content the user sent.
2. Determine the BEST way to store this in the knowledge base — pick the right category, structure it as Q&A pairs or hotpoints, and extract every distinct piece of useful information.
3. Return a natural-language chat response explaining what you found and what you're saving, plus the structured KB entries.

Available KB categories:
${categoryList}

Guidelines:
- For agent scripts: structure as "Title/Topic" → "Script Content"
- For customer Q&A: structure as "Customer Question" → "Answer"
- For hotpoints: structure as "Trigger/Situation" → "Coaching Guidance", and set tags to one of: objection, closing, discovery, red_flag, buying_signal, general
- For docs/FAQ: structure as "Question" → "Answer" with factual program details
- Extract MULTIPLE entries if the content contains multiple distinct pieces of info.
- If the content is unclear or not useful for a sales KB, say so and return an empty entries array.
- Keep answers concise but complete — 1-4 sentences each.
- For hotpoints, include the agent strategy in the answer if relevant.

Return JSON with:
- "response": your natural-language chat reply (2-4 sentences, conversational, tell the user what you extracted and where you're putting it)
- "entries": array of { "question": string, "answer": string, "category": string (one of the category ids above), "tags": string (optional, for hotpoints) }

${llmPrompt}`,
      response_json_schema: {
        type: 'object',
        properties: {
          response: { type: 'string' },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                answer: { type: 'string' },
                category: { type: 'string' },
                tags: { type: 'string' },
              },
            },
          },
        },
      },
      file_urls: fileUrls.length > 0 ? fileUrls : undefined,
    });

    const responseText = result?.response || 'I analyzed the content but could not structure it.';
    const entries = result?.entries || [];

    // Save entries using service role (avoids auth issues for debt-coach users)
    const svc = base44.asServiceRole;
    const saved: any[] = [];
    for (const e of entries) {
      if (!e.question || !e.answer) continue;
      const validCats = KB_CATEGORIES.map(c => c.id);
      const category = validCats.includes(e.category) ? e.category : 'debt_kb';
      try {
        const created = await svc.entities.KnowledgeBase.create({
          question: e.question,
          answer: e.answer,
          category,
          tags: e.tags || '',
          kbName: 'Debt Settlement',
          source: fileName ? `AI Chat — ${fileName}` : 'AI Chat',
        });
        saved.push(created);
      } catch {}
    }

    return Response.json({
      mode: 'ingest',
      response: responseText,
      entries: saved.map(s => ({ id: s.id, question: s.question, answer: s.answer, category: s.category, tags: s.tags })),
      savedCount: saved.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}