/**
 * kbChatIngest — AI-powered knowledge base chat.
 * Dual-mode: auto-detects whether the user is ASKING a question (answers from
 * KB + database) or PROVIDING content to ingest (analyzes and saves KB entries).
 *
 * Input: { message: string, fileUrl?: string, fileType?: 'image'|'audio', fileName?: string }
 * Output: { mode: 'answer'|'ingest', response: string, entries: [...], savedCount?: number }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { formatAnswers, findRelevantKB } from '../../shared/kbSearch.ts';

const KB_CATEGORIES = [
  { id: 'debt_agent', label: 'Agent Script', desc: 'Openers, rebuttals, qualifying questions, closing language' },
  { id: 'debt_customer', label: 'Customer Q&A', desc: 'Common customer questions with pre-written answers' },
  { id: 'debt_hotpoints', label: 'Coaching Hotpoint', desc: 'Triggers and coaching guidance for live calls' },
  { id: 'debt_doc', label: 'Document Knowledge', desc: 'Program details, compliance, factual info' },
  { id: 'debt_faq', label: 'FAQ', desc: 'Frequently asked questions about the program' },
  { id: 'debt_kb', label: 'General KB', desc: 'General knowledge that does not fit other categories' },
];

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
      const kbEntries = await svc.entities.KnowledgeBase.list('-created_date', 1000);
      const debtOnly = kbEntries.filter((e: any) => !e.kbName || e.kbName === 'Debt Settlement');
      const relevant = findRelevantKB(message, debtOnly, 10);
      // KB Chat answers only from the published KB. Avoid exposing user/lead records
      // through a KB ingestion endpoint that also serves custom Debt Coach sessions.
      const dbContext = '';
      const kbContext = relevant.map((e: any) => `Q: ${e.question}\nA: ${formatAnswers(e)}`).join('\n\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI assistant for a debt settlement sales platform called Settlement IQ. The user is asking you a question. Answer based on the knowledge base and database data below.

If the knowledge base has relevant entries, use them as your primary source.
Do not claim to have access to personal prospect, staff, or live database records in this chat.
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

    // AI extraction is unverified. Never create or overwrite a live answer here.
    // Send proposed entries to a shared review queue instead; the KB Manager is
    // the only promotion surface and never replaces existing answers implicitly.
    const svc = base44.asServiceRole;
    const saved: any[] = [];
    const errors: string[] = [];
    const proposed = Array.isArray(entries) ? entries.slice(0, 40) : [];
    for (const e of proposed) {
      const question = String(e?.question || '').trim();
      const answer = String(e?.answer || '').trim();
      if (!question || !answer) continue;
      const validCats = KB_CATEGORIES.map(c => c.id);
      const category = validCats.includes(e.category) ? e.category : 'debt_kb';
      try {
        const created = await svc.entities.DebtKBProposal.create({
          question, answer, category, tags: String(e.tags || ''),
          source: fileName ? `AI Chat — ${fileName}` : 'AI Chat',
          status: 'pending_review', createdBy: user?.email || 'Debt Coach KB Chat'
        });
        saved.push(created);
      } catch (err: any) { errors.push(err?.message || String(err)); }
    }
    return Response.json({
      mode: 'ingest',
      response: saved.length
        ? `${saved.length} proposed KB entr${saved.length === 1 ? 'y is' : 'ies are'} awaiting human review. They are NOT live and cannot replace existing answers. Review them in Knowledge Base → Review Queue.`
        : (errors.length ? 'No entries were queued because saving failed.' : responseText),
      entries: saved.map(s => ({ id: s.id, question: s.question, answer: s.answer, category: s.category, tags: s.tags, status: 'pending_review' })),
      pendingCount: saved.length, savedCount: 0, reviewRequired: true,
      ...(errors.length ? { warning: `${errors.length} entries could not be queued.` } : {})
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}