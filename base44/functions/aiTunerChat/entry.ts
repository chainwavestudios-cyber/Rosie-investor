import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * aiTunerChat
 * Server-side proxy for the AI Tuning Assistant chat in AdminDashboard.
 * Calls Claude via the Anthropic API using the server's API key.
 *
 * POST body: { context: string, messages: [{role, content}] }
 * Returns:   { reply: string }
 */

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

Deno.serve(async (req) => {
  if (!ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not set in environment' }, { status: 500 });
  }

  let context = 'intent engine';
  let messages = [];

  try {
    const body = await req.json();
    context = body.context || 'intent engine';
    messages = body.messages || [];
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!messages.length) {
    return Response.json({ error: 'No messages provided' }, { status: 400 });
  }

  const systemPrompt = `You are an expert sales AI tuning assistant helping configure a live call assistant system for an investment sales team. The system uses Claude Haiku for real-time intent classification (Duck/Cow) and coaching during calls. It also has access to Deepgram sentiment data (positive/negative/neutral per utterance) and speaker diarization (S0=agent, S1=prospect).

You are helping tune the ${context}.

When the user shares ideas or observations:
1. Acknowledge their insight
2. Expand it into specific, actionable rules or keywords
3. Explain WHY it works from a sales psychology perspective
4. Offer a "suggested rule" block they can apply

Format suggested rules as JSON in a code block with this structure:
For intent: {"type": "intent_suggestion", "duckSignals": ["phrase1", "phrase2"], "cowSignals": ["phrase1"], "keywords": ["word1"], "sentimentRules": "explanation"}
For coach: {"type": "coach_suggestion", "focusArea": "...", "rule": "...", "context": "..."}

Keep responses conversational but precise. Think like a sales psychologist who also understands AI systems.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[aiTunerChat] Anthropic error:', data);
      return Response.json({ error: 'Anthropic API error', details: data }, { status: 500 });
    }

    const reply = data?.content?.[0]?.text || 'No response generated.';
    return Response.json({ reply });

  } catch (e) {
    console.error('[aiTunerChat] fetch error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});