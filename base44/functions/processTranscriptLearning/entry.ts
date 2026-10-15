/**
 * processTranscriptLearning — Extracts Q&A pairs from completed call transcripts.
 *
 * Called after a call ends. Reads the transcript, uses InvokeLLM (Automatic model)
 * to extract question→answer pairs that the agent handled well, and saves them
 * as HistoricalQAExample records with status 'pending_review'.
 *
 * An admin reviews them in the QA Review tab. Approved pairs are promoted to the
 * KnowledgeBase entity, making the live Q&A copilot smarter over time.
 *
 * Input: { transcript, leadId, leadName, transcriptId }
 * Output: { extracted: number }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { transcript, leadId, leadName, transcriptId } = body;

    if (!transcript || !Array.isArray(transcript) || transcript.length < 4) {
      return Response.json({ extracted: 0, reason: 'transcript too short' });
    }

    const base44 = createClientFromRequest(req).asServiceRole;

    // Format transcript for the LLM
    // Speaker 0 = agent, 1 = prospect (Deepgram convention)
    const transcriptText = transcript
      .map((t: any) => `[${t.speaker === 0 ? 'AGENT' : 'CUSTOMER'}]: ${t.text || ''}`)
      .join('\n');

    // Use InvokeLLM on Automatic (no model specified) to extract Q&A pairs
    const result: any = await base44.integrations.Core.InvokeLLM({
      prompt: `You are analyzing a completed debt settlement sales call transcript. Your job is to extract question-and-answer pairs where the CUSTOMER asked a genuine question and the AGENT gave a clear, correct answer.

Only extract pairs where:
1. The customer asked a real question (not just small talk or acknowledgements)
2. The agent gave a substantive, accurate answer (not just "let me check" or "I don't know")
3. The answer would be useful for future calls (factual, reusable knowledge)

Skip:
- Small talk, greetings, acknowledgements
- Questions the agent fumbled or didn't answer well
- Duplicate or near-duplicate questions
- Questions about the agent's personal info

Return JSON with this exact structure:
{
  "qaPairs": [
    {
      "question": "the customer's question, rephrased clearly",
      "answer": "the agent's answer, cleaned up and rephrased as a standalone answer (not 'I said...' but as the answer itself)"
    }
  ]
}

Transcript:
${transcriptText.slice(0, 8000)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          qaPairs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                answer: { type: 'string' },
              },
              required: ['question', 'answer'],
            },
          },
        },
      },
    });

    const qaPairs = result?.qaPairs || [];
    if (qaPairs.length === 0) {
      return Response.json({ extracted: 0 });
    }

    // Deduplicate against existing pending examples for this lead
    const existing = await base44.entities.HistoricalQAExample.filter(
      { leadId, status: 'pending_review' },
      { limit: 100 }
    );
    const existingItems = existing?.items || (Array.isArray(existing) ? existing : []);
    const existingQs = new Set(existingItems.map((e: any) => (e.question || '').toLowerCase().slice(0, 80)));

    // Also deduplicate against existing KB entries (already approved/learned)
    const kbEntries = await base44.entities.KnowledgeBase.filter(
      { kbName: 'Debt Settlement' },
      { limit: 500 }
    );
    const kbItems = kbEntries?.items || (Array.isArray(kbEntries) ? kbEntries : []);
    const kbQs = new Set(kbItems.map((e: any) => (e.question || '').toLowerCase().slice(0, 80)));

    const newPairs = qaPairs.filter((qa: any) => {
      const q = (qa.question || '').toLowerCase().slice(0, 80);
      return q && !existingQs.has(q) && !kbQs.has(q);
    });

    if (newPairs.length === 0) {
      return Response.json({ extracted: 0, reason: 'all duplicates' });
    }

    // Save as pending review records
    const records = newPairs.map((qa: any) => ({
      leadId: leadId || '',
      leadName: leadName || '',
      transcriptId: transcriptId || '',
      question: (qa.question || '').slice(0, 500),
      answer: (qa.answer || '').slice(0, 2000),
      status: 'pending_review',
      extractedAt: new Date().toISOString(),
    }));

    await base44.entities.HistoricalQAExample.bulkCreate(records);

    return Response.json({ extracted: records.length });
  } catch (error) {
    console.error('[processTranscriptLearning] error:', error?.message);
    return Response.json({ error: 'internal error', extracted: 0 }, { status: 500 });
  }
}