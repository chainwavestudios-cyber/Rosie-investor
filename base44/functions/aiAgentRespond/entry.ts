/**
 * aiAgentRespond — Twilio <Gather> speech callback for the AI Fronting Agent.
 *
 * Twilio POSTs the prospect's speech here after each <Gather>. We:
 *   1. Load the lead + AIAgentConfig (system prompt, model, transfer number)
 *   2. Load the running conversation from the lead's notes field
 *   3. Append the prospect's speech, call the LLM for a response
 *   4. Save the updated conversation back to the lead
 *   5. Return TwiML: <Say> the response, then <Gather> for the next turn
 *
 * If the LLM says "TRANSFER", we dial the transfer number from the config.
 * If the prospect is silent, we retry once, then say goodbye and hang up.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { xmlEscape } from '../../shared/twilioHelpers.ts';

const BASE_URL = 'https://rosieai-investorpage.base44.app';

const MODEL_MAP: Record<string, string> = {
  'claude-sonnet-5': 'claude-sonnet-5',
  'claude-opus-5': 'claude_opus_5_5',
  'claude-sonnet-4-6': 'claude-sonnet-5',
  'gpt-5-4': 'gpt_6_sol',
  'gemini-3-1-pro': 'gemini_3_8_flash',
};

function twimlResponse(twiml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${twiml}`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

export default async function(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const leadId = url.searchParams.get('leadId') || '';

    // Twilio sends form-encoded SpeechResult
    let speechResult = '';
    let confidence = '';
    try {
      const form = await req.formData();
      speechResult = (form.get('SpeechResult') || '').toString().trim();
      confidence = (form.get('Confidence') || '').toString();
    } catch {}

    console.log('[aiAgentRespond] leadId:', leadId, 'speech:', speechResult, 'conf:', confidence);

    if (!leadId) {
      return twimlResponse(`<Response><Say voice="Polly.Joanna-Neural">There was an error. Goodbye.</Say><Hangup/></Response>`);
    }

    const base44 = createClientFromRequest(req).asServiceRole;

    // Load lead and AI agent config in parallel
    const [lead, configs] = await Promise.allSettled([
      base44.entities.FronterLead.get(leadId),
      base44.entities.AIAgentConfig.filter({ configName: 'default' }),
    ]);
    const leadData = lead.status === 'fulfilled' ? lead.value : null;
    const config = configs.status === 'fulfilled' && configs.value?.[0] ? configs.value[0] : {};

    if (!leadData) {
      return twimlResponse(`<Response><Say voice="Polly.Joanna-Neural">There was an error. Goodbye.</Say><Hangup/></Response>`);
    }

    // ── Load conversation history from notes field ──
    let conversation: Array<{ role: string; content: string }> = [];
    try {
      const parsed = JSON.parse(leadData.notes || '[]');
      if (Array.isArray(parsed)) conversation = parsed;
    } catch {}

    // First turn: seed the conversation with the greeting so the LLM has context
    if (conversation.length === 0 && config.greeting) {
      const greetingText = config.greeting
        .replace(/\{\{first_name\}\}/g, leadData.firstName || '')
        .replace(/\{\{last_name\}\}/g, leadData.lastName || '');
      conversation.push({ role: 'assistant', content: greetingText });
    }

    // If no speech was detected (Gather timed out), retry once then say goodbye
    if (!speechResult) {
      const respondUrl = `${BASE_URL}/functions/aiAgentRespond?leadId=${encodeURIComponent(leadId)}`;
      return twimlResponse(`<Response>
  <Say voice="Polly.Joanna-Neural">Are you still there?</Say>
  <Gather input="speech" speechTimeout="auto" action="${respondUrl}" method="POST" language="en-US" enhanced="true" speechModel="conversational" />
  <Say voice="Polly.Joanna-Neural">I'll try again later. Have a good day. Goodbye.</Say>
  <Hangup/>
</Response>`);
    }

    // Add the prospect's speech to the conversation
    conversation.push({ role: 'user', content: speechResult });

    // ── Call the LLM for a response ──
    const systemPrompt = config.systemPrompt || 'You are a friendly debt settlement call agent. Ask about their debt situation and whether they want to speak with an advisor. Keep responses to 1-3 sentences. Be conversational and empathetic. If the prospect seems qualified and interested, say "TRANSFER" to connect them to an advisor.';

    const conversationText = conversation
      .map((m) => `${m.role === 'user' ? 'Prospect' : 'Agent'}: ${m.content}`)
      .join('\n');

    const prompt = `${systemPrompt}

Conversation so far:
${conversationText}

Respond as the Agent. Keep your response to 1-3 sentences since it will be spoken aloud on a phone call. Do not use formatting, emojis, or special characters. If the prospect seems qualified and interested, say "TRANSFER" to connect them to an advisor. Otherwise, continue the conversation naturally.`;

    let llmResponse = 'I see, can you tell me more about that?';
    try {
      const model = MODEL_MAP[config.llmModel] || 'claude-sonnet-5';
      const res = await base44.integrations.Core.InvokeLLM({ prompt, model });
      llmResponse = typeof res === 'string' ? res : String(res || '');
      if (llmResponse.length > 500) llmResponse = llmResponse.slice(0, 497) + '...';
    } catch (e) {
      console.error('[aiAgentRespond] LLM error:', e?.message);
    }

    // Add agent response to conversation
    conversation.push({ role: 'assistant', content: llmResponse });

    // Save conversation back to lead
    try {
      await base44.entities.FronterLead.update(leadId, {
        notes: JSON.stringify(conversation),
        lastCalledAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[aiAgentRespond] Failed to save conversation:', e?.message);
    }

    // ── Check for transfer request ──
    if (llmResponse.toUpperCase().includes('TRANSFER') && config.transferPhoneNumber) {
      const callerId = Deno.env.get('TWILIO_FROM_NUMBER') || '';
      console.log('[aiAgentRespond] → Transfer to', config.transferPhoneNumber);
      return twimlResponse(`<Response>
  <Say voice="Polly.Joanna-Neural">Great! Let me connect you with one of our advisors. Please hold.</Say>
  <Dial callerId="${xmlEscape(callerId)}" timeout="30">
    <Number>${xmlEscape(config.transferPhoneNumber)}</Number>
  </Dial>
  <Say voice="Polly.Joanna-Neural">The advisor is unavailable right now. We will call you back soon. Goodbye.</Say>
  <Hangup/>
</Response>`);
    }

    // ── Continue the conversation ──
    const respondUrl = `${BASE_URL}/functions/aiAgentRespond?leadId=${encodeURIComponent(leadId)}`;
    return twimlResponse(`<Response>
  <Say voice="Polly.Joanna-Neural">${xmlEscape(llmResponse)}</Say>
  <Gather input="speech" speechTimeout="auto" action="${respondUrl}" method="POST" language="en-US" enhanced="true" speechModel="conversational" />
  <Say voice="Polly.Joanna-Neural">I didn't catch that. Can you repeat that?</Say>
  <Gather input="speech" speechTimeout="auto" action="${respondUrl}" method="POST" language="en-US" enhanced="true" speechModel="conversational" />
  <Say voice="Polly.Joanna-Neural">I'll try again later. Goodbye.</Say>
  <Hangup/>
</Response>`);
  } catch (error) {
    console.error('[aiAgentRespond] Fatal error:', error?.message);
    return twimlResponse(`<Response><Say voice="Polly.Joanna-Neural">I am sorry, there was an error. Goodbye.</Say><Hangup/></Response>`);
  }
}