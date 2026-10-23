/**
 * analyzeRosieSession — the coach's read on a prospect's AI conversation.
 *
 * Reads the video-conversation transcript saved on the contact card and writes the
 * full analysis back onto it: what was said, what they asked, what worried them,
 * how engaged they were, and what the coach should do next.
 *
 *  body: { leadId }
 *  → { ok, analysis }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const MAX_CHARS = 12000;

/** The AI conversation stored on the card ({ at, source: video_qualification, lines }). */
function readTranscript(card: any): string {
  let parsed: any = null;
  try {
    parsed = JSON.parse(String(card?.transcriptJson || ''));
  } catch {
    return '';
  }
  if (typeof parsed === 'string') return parsed.slice(0, MAX_CHARS);
  // A phone call keeps its transcript with the call record, not here — this tab is the AI conversation.
  if (!parsed || parsed.source !== 'video_qualification') return '';
  return String(parsed.lines || '').slice(0, MAX_CHARS);
}

function money(value: any): string {
  const amount = Number(value || 0);
  return amount > 0 ? `$${amount.toLocaleString('en-US')}` : 'not on file';
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const leadId = String(body.leadId || '').trim();
    if (!leadId) return Response.json({ error: 'A contact card is required.' }, { status: 400 });

    const card = await base44.asServiceRole.entities.DebtLead.get(leadId).catch(() => null);
    if (!card) return Response.json({ error: 'That contact card could not be found.' }, { status: 404 });

    const transcript = readTranscript(card);
    if (!transcript.trim()) {
      return Response.json({ error: 'There is no AI conversation on this card yet.' }, { status: 400 });
    }

    const firstName = String(card.firstName || '').trim() || 'this prospect';
    const prompt = `You are briefing a debt-relief coach on one conversation between a prospect and an AI assistant on the company's website. The coach will call this person next, so read the whole conversation closely and report only what it actually shows. Never invent a detail that is not in the conversation.

WHO IS ON THE CARD
- Name: ${firstName} ${String(card.lastName || '').trim()}
- State: ${String(card.state || '').trim() || 'not on file'}
- Debt on file: ${money(card.debtAmount)}
- Assistant they spoke with: ${String(card.rosieAiAssistant || '').trim() || 'an AI assistant'}
- Conversation at: ${String(card.lastCallAt || '').trim() || 'unknown'}

THE CONVERSATION
${transcript}

Return JSON:
- headline: one plain sentence on where this prospect stands right now.
- summary: a full narrative of the conversation, 4 to 8 sentences, ending with how it finished.
- situation: what they said about their debts, payments, income, hardship or circumstances. Empty string if they said nothing about it.
- debtRange: the range they gave as "5k-10k", "10k-20k" or "20k+", otherwise "not established".
- phoneGiven: true only if they gave a phone number during this conversation.
- questions: every question THEY asked, as {question, answer} — their words or a close paraphrase, and what they were told. Empty array if they asked none.
- concerns: short strings for every worry, hesitation or objection they raised. Empty array if none.
- engagement: "high", "medium" or "low", followed by one sentence saying why.
- nextStep: the single best next action for the coach, and the first thing to say.
- opening: one warm sentence the coach can open the follow-up call with, using their first name.`;

    const analysis: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          summary: { type: 'string' },
          situation: { type: 'string' },
          debtRange: { type: 'string' },
          phoneGiven: { type: 'boolean' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: { question: { type: 'string' }, answer: { type: 'string' } },
            },
          },
          concerns: { type: 'array', items: { type: 'string' } },
          engagement: { type: 'string' },
          nextStep: { type: 'string' },
          opening: { type: 'string' },
        },
      },
    });

    const stored = analysis && typeof analysis === 'object' ? analysis : { headline: String(analysis || '') };
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.DebtLead.update(card.id, {
      rosieAiAnalysis: JSON.stringify(stored),
      rosieAiAnalyzedAt: now,
    });

    return Response.json({ ok: true, analyzedAt: now, analysis: stored });
  } catch (error) {
    return Response.json(
      { error: (error && (error as Error).message) || 'The conversation could not be analyzed.' },
      { status: 500 },
    );
  }
}