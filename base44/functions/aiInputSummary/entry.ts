/**
 * aiInputSummary — AI function that reviews the transcript up to the point
 * where the fronter pressed the AI Input button, and produces a concise
 * summary of what has happened so far. The summary is saved to the lead's
 * notes log by the frontend.
 *
 * Returns: { summary: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { transcript } = body;

    if (!transcript || !Array.isArray(transcript) || transcript.length < 2) {
      return Response.json({ summary: 'No transcript available yet.' });
    }

    const transcriptStr = (transcript as any[]).map((t: any) => {
      const speaker = t.speaker === 0 ? 'AGENT' : t.speaker === 1 ? 'CUSTOMER' : (t.role || 'UNKNOWN').toUpperCase();
      return `[${speaker}]: ${t.text}`;
    }).join('\n').slice(0, 8000);

    const system = `You are an AI assistant analyzing a live sales call transcript. Summarize what has happened so far in the call.

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

    const base44 = createClientFromRequest(req).asServiceRole;
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${system}\n\nCall transcript so far:\n${transcriptStr}`,
    });

    const summary = typeof result === 'string' ? result : (result?.text || result?.content?.[0]?.text || '');
    return Response.json({ summary });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('CREDIT_EXHAUSTED') || msg.includes('quota') || msg.includes('429') || msg.includes('402')) {
      return Response.json({ error: msg, creditError: true }, { status: 500 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}