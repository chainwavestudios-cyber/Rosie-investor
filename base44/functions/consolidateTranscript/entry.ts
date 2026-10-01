import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/**
 * consolidateTranscript — Real-time transcript consolidation engine.
 * Takes fragmented Deepgram utterances and merges consecutive same-speaker
 * fragments into complete sentences, then classifies each line as:
 * question, statement, objection, greeting, or closing.
 *
 * Called periodically (~every 12s) during a live call to clean up the display.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { transcript } = body;

    if (!Array.isArray(transcript) || transcript.length < 2) {
      return Response.json({ lines: transcript || [] });
    }

    // Format transcript for AI — speaker 0 = agent, 1 = customer
    const transcriptStr = transcript.map((t: any) => {
      const speaker = t.speaker === 0 ? 'AGENT' : 'CUSTOMER';
      return `[${speaker}] ${t.text || ''}`;
    }).join('\n');

    const result: any = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a transcript consolidation engine for a live phone call. The speech-to-text engine breaks speech into many small fragments. Your job is to merge these into complete, coherent sentences.

RULES:
1. Merge consecutive fragments from the SAME speaker into complete sentences
2. Each output line = ONE complete sentence or natural statement (split run-ons at sentence boundaries)
3. Classify each line as exactly one of: "question", "statement", "objection", "greeting", "closing"
4. Do NOT invent or add content — only merge and resegment existing text
5. Preserve speaker (0=agent, 1=customer) and use the timestamp from the FIRST fragment in each merged group
6. Preserve sentiment from the first fragment if available
7. "question" = asks something or ends with "?"
8. "objection" = expresses doubt, concern, or resistance ("I'm not sure", "that's expensive", "is this a scam", "I need to think about it")
9. "greeting" = opening pleasantry ("Hi", "How are you", "thanks for taking my call")
10. "closing" = sign-off ("have a great day", "we'll be in touch", "goodbye")
11. "statement" = everything else

Return JSON with a "lines" array. Each line must have: speaker, text, classification, time, sentiment.

TRANSCRIPT TO CONSOLIDATE:
${transcriptStr}`,
      response_json_schema: {
        type: 'object',
        properties: {
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                speaker: { type: 'number' },
                text: { type: 'string' },
                classification: { type: 'string' },
                time: { type: 'string' },
                sentiment: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const rawLines = (result as any)?.lines || [];
    // Sanitize — ensure each line has valid fields
    const lines = rawLines.map((l: any) => ({
      speaker: typeof l.speaker === 'number' ? l.speaker : 0,
      text: String(l.text || '').trim(),
      classification: ['question', 'statement', 'objection', 'greeting', 'closing'].includes(l.classification)
        ? l.classification
        : 'statement',
      time: l.time || new Date().toISOString(),
      sentiment: l.sentiment || null,
    })).filter((l: any) => l.text.length > 0);

    return Response.json({ lines });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}