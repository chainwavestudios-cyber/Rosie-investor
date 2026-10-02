import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/**
 * consolidateTranscript — Real-time transcript classification (regex-based, zero AI cost).
 * Fragment merging is already done client-side in processNewEntry. This function
 * now only classifies each line using simple rules:
 * - Ends with "?" → question
 * - Contains objection phrases → objection
 * - Contains greeting phrases → greeting
 * - Contains closing phrases → closing
 * - Everything else → statement
 *
 * Called periodically (~every 30s) during a live call to label transcript lines.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { transcript } = body;

    if (!Array.isArray(transcript) || transcript.length === 0) {
      return Response.json({ lines: transcript || [] });
    }

    const OBJECTION_RE = /\b(i'm not sure|that's expensive|is this a scam|i need to think|not interested|can't afford|too much|how much is this|what's the catch|sounds risky|don't trust|been burned|prove it|guarantee|what if it doesn't work|hurts my credit|why should i|not comfortable)\b/i;
    const GREETING_RE = /^(hi|hello|hey|good morning|good afternoon|good evening|thanks for|thank you for|how are you|how's it going|nice to speak|appreciate you)\b/i;
    const CLOSING_RE = /\b(have a great day|we'll be in touch|goodbye|bye|talk to you soon|see you|have a good one|take care|look forward to)\b/i;

    const lines = transcript.map((t: any) => {
      const text = String(t.text || '').trim();
      let classification = 'statement';
      if (/\?\s*$/.test(text)) {
        classification = 'question';
      } else if (CLOSING_RE.test(text)) {
        classification = 'closing';
      } else if (GREETING_RE.test(text)) {
        classification = 'greeting';
      } else if (OBJECTION_RE.test(text)) {
        classification = 'objection';
      }
      return {
        speaker: typeof t.speaker === 'number' ? t.speaker : 0,
        text,
        classification,
        time: t.time || new Date().toISOString(),
        sentiment: t.sentiment || null,
      };
    }).filter((l: any) => l.text.length > 0);

    return Response.json({ lines });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}