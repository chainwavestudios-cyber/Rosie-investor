/**
 * kbChatIngest — AI-powered knowledge base ingestion chat.
 * Receives a message with optional file (image or audio), analyzes the content,
 * determines the best KB category and structure, and returns proposed entries
 * plus a natural-language response explaining what it did.
 *
 * Input: { message: string, fileUrl?: string, fileType?: 'image'|'audio', fileName?: string }
 * Output: { response: string, entries: [{question, answer, category, tags}] }
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

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { message, fileUrl, fileType, fileName } = body;

    if (!message && !fileUrl) {
      return Response.json({ error: 'No content provided' }, { status: 400 });
    }

    // ── Step 1: Prepare content for the LLM ──────────────────────────────
    let llmPrompt = '';
    let fileUrls: string[] = [];

    if (fileUrl && fileType === 'audio') {
      // Transcribe audio first
      let transcriptText: string;
      try {
        transcriptText = await base44.integrations.Core.TranscribeAudio({ audio_url: fileUrl });
      } catch {
        // Fall back to large-file transcription function
        const res = await base44.functions.invoke('transcribeAudioLarge', { audio_url: fileUrl });
        transcriptText = res?.transcript || res?.data?.transcript || '';
      }
      llmPrompt = `The user uploaded an audio file${fileName ? ` named "${fileName}"` : ''}. Here is the transcript:\n\n${transcriptText}\n\nUser message: ${message || '(no additional message)'}`;
    } else if (fileUrl && fileType === 'image') {
      // Use vision LLM with the image
      fileUrls = [fileUrl];
      llmPrompt = `The user uploaded an image${fileName ? ` named "${fileName}"` : ''}. Analyze what is in the image and extract any knowledge-base content from it.\n\nUser message: ${message || '(no additional message)'}`;
    } else {
      llmPrompt = `User message:\n${message || ''}`;
    }

    // ── Step 2: Ask the LLM to analyze and structure the content ──────────
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
- If the content is a question ABOUT the KB (not content to add), respond conversationally and return an empty entries array.
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

    // ── Step 3: Save the entries to the KB ───────────────────────────────
    const saved: any[] = [];
    for (const e of entries) {
      if (!e.question || !e.answer) continue;
      const validCats = KB_CATEGORIES.map(c => c.id);
      const category = validCats.includes(e.category) ? e.category : 'debt_kb';
      try {
        const created = await base44.entities.KnowledgeBase.create({
          question: e.question,
          answer: e.answer,
          category,
          tags: e.tags || '',
          kbName: 'Debt Settlement',
          source: fileName ? `AI Chat — ${fileName}` : 'AI Chat',
          created_date: new Date().toISOString(),
        });
        saved.push(created);
      } catch {}
    }

    // Notify the frontend that the KB was updated
    return Response.json({
      response: responseText,
      entries: saved.map(s => ({ id: s.id, question: s.question, answer: s.answer, category: s.category, tags: s.tags })),
      savedCount: saved.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}