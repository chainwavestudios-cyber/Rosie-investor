/**
 * aiInputSummary — AI function that reviews the transcript up to the point
 * where the fronter pressed the AI Input button, and produces a concise
 * summary of what has happened so far. The summary is saved to the lead's
 * notes log by the frontend.
 *
 * The WHOLE call is read: the transcript is split into chunks, every chunk is
 * summarized, and the parts are merged into one summary. It used to stop at
 * 8,000 characters, which dropped everything after roughly the first 25 minutes.
 *
 * Returns: { summary: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { formatTranscriptLines, chunkTranscript, runChunks } from '../../shared/transcriptAnalysis.ts';

const SYSTEM = `You are an AI assistant analyzing a live sales call transcript. Summarize what has happened so far in the call.

Focus on:
1. Key information the customer has shared (debt amount, debt type, employment, income, hardship, contact details, etc.)
2. Where the conversation is at right now (what step or phase of the script)
3. Any objections, concerns, or questions raised by the customer
4. What the agent should focus on next

Rules:
- Keep the summary concise (3-5 sentences) and written in plain English.
- Only include information the CUSTOMER actually stated — not what the agent said.
- This summary will be saved to the lead's notes, so make it useful for future reference.
- Do not use em-dashes. Use commas or periods instead.`;

async function summarizeChunk(base44: any, chunk: string): Promise<string> {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `${SYSTEM}\n\nCall transcript:\n${chunk}`,
  });
  return typeof result === 'string' ? result : (result?.text || result?.content?.[0]?.text || '');
}

// Joins the per-chunk summaries of a long call into one coherent summary.
async function condense(base44: any, summaries: string[]): Promise<string> {
  const prompt = `Below are summaries of consecutive parts of ONE sales call, in order (part 1 is the beginning of the call).

Combine them into a single concise summary of the whole call, following the same rules:
- 5 to 8 sentences, plain English.
- Only customer-stated information.
- Cover how the call progressed from the opening to the latest part, what the customer shared, and what the agent should do next.
- Do not use em-dashes. Use commas or periods instead.

${summaries.map((s, i) => `PART ${i + 1}: ${s}`).join('\n\n')}`;

  const result = await base44.integrations.Core.InvokeLLM({ prompt });
  const text = typeof result === 'string' ? result : (result?.text || result?.content?.[0]?.text || '');
  return text || summaries.join(' ');
}

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { transcript } = body;

    if (!transcript || !Array.isArray(transcript) || transcript.length < 2) {
      return Response.json({ summary: 'No transcript available yet.' });
    }

    const base44 = createClientFromRequest(req).asServiceRole;
    const chunks = chunkTranscript(formatTranscriptLines(transcript));

    const parts = await runChunks(chunks, (chunk) => summarizeChunk(base44, chunk));
    const summaries = parts.filter((s): s is string => !!s && !!s.trim());

    if (summaries.length === 0) return Response.json({ summary: '' });

    const summary = summaries.length === 1 ? summaries[0] : await condense(base44, summaries);
    return Response.json({ summary });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('CREDIT_EXHAUSTED') || msg.includes('quota') || msg.includes('429') || msg.includes('402')) {
      return Response.json({ error: msg, creditError: true }, { status: 500 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}