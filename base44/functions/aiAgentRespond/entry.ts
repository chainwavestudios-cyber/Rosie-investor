/**
 * aiAgentRespond — Twilio <Gather> speech callback for the AI Fronting Agent.
 *
 * The AI agent works exactly like a fronter, following the 5-step Debt Relief
 * Transfer script:
 *   1. Introduction & Verification
 *   2. Pitch & Qualification (terminate if debt < $10k)
 *   3. Debt Breakdown & Confirmation
 *   4. Program Value & Handoff (email + summary + transfer trigger)
 *   5. Transfer Execution (primary line → 2nd line → NO CONNECT)
 *
 * Twilio POSTs the prospect's speech here after each <Gather>. We:
 *   1. Load the lead + AIAgentConfig (system prompt, model, transfer numbers)
 *   2. Load the running conversation from the lead's notes field
 *   3. Append the prospect's speech, call the LLM for a response
 *   4. Save the updated conversation back to the lead
 *   5. Return TwiML: <Say> the response, then <Gather> for the next turn
 *
 * Transfer flow:
 *   - When the LLM says "TRANSFER", we:
 *     a. Extract debt data + contact data from the conversation
 *     b. Send credentials email (via Gmail connector)
 *     c. Generate AI input summary and save to notes
 *     d. Return TwiML: <Say> transfer message → <Dial> primary number
 *   - The <Dial> action callback hits ?transferFallback=1 → dials 2nd number
 *   - The 2nd <Dial> action callback hits ?transferNoConnect=1 → NO CONNECT
 *
 * If the LLM says "ENDCALL", we say goodbye and hang up (unqualified/disqualified).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { xmlEscape, toE164 } from '../../shared/twilioHelpers.ts';
import { callLLM } from '../../shared/llmHelper.ts';
import { extractDebtData, extractContactData, generateCallSummary, sendCredentialsEmail, FRONTER_SCRIPT_SYSTEM_PROMPT } from '../../shared/aiAgentHelpers.ts';

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
    const transferFallback = url.searchParams.get('transferFallback') === '1';
    const transferNoConnect = url.searchParams.get('transferNoConnect') === '1';

    // ── Transfer fallback: primary dial ended (no answer) → dial 2nd line ──
    if (transferFallback && leadId) {
      return await handleTransferFallback(req, leadId);
    }

    // ── Transfer NO CONNECT: 2nd dial also ended (no answer) → disconnect ──
    if (transferNoConnect && leadId) {
      return await handleTransferNoConnect(req, leadId);
    }

    // ── Normal conversation flow ──
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
    // Use the custom system prompt if configured, otherwise use the built-in fronter script
    const systemPrompt = config.systemPrompt || FRONTER_SCRIPT_SYSTEM_PROMPT;

    // Substitute lead variables into the system prompt
    const filledPrompt = systemPrompt
      .replace(/\{\{first_name\}\}/g, leadData.firstName || '')
      .replace(/\{\{last_name\}\}/g, leadData.lastName || '')
      .replace(/\{\{email\}\}/g, leadData.email || '')
      .replace(/\{\{city\}\}/g, leadData.city || '')
      .replace(/\{\{state\}\}/g, leadData.state || '');

    const conversationText = conversation
      .map((m) => `${m.role === 'user' ? 'Prospect' : 'Agent'}: ${m.content}`)
      .join('\n');

    const prompt = `${filledPrompt}

Conversation so far:
${conversationText}

Respond as the Agent. Keep your response to 1-3 sentences since it will be spoken aloud on a phone call. Do not use formatting, emojis, or special characters. If the prospect is qualified and ready for transfer, say "TRANSFER" to connect them to an advisor. If the prospect is not qualified or not interested, say "ENDCALL" to end the call politely. Otherwise, continue the conversation naturally.`;

    let llmResponse = 'I see, can you tell me more about that?';
    try {
      const model = MODEL_MAP[config.llmModel] || 'claude-sonnet-5';
      const data = await callLLM(req, { model, max_tokens: 300, system: filledPrompt, messages: [{ role: 'user', content: conversationText }] });
      llmResponse = data?.content?.[0]?.text || '';
      if (llmResponse.length > 500) llmResponse = llmResponse.slice(0, 497) + '...';
    } catch (e) {
      console.error('[aiAgentRespond] LLM error:', e?.message);
    }

    // Strip TRANSFER/ENDCALL keywords from the spoken response
    const upperResponse = llmResponse.toUpperCase();
    const wantsTransfer = upperResponse.includes('TRANSFER');
    const wantsEndCall = upperResponse.includes('ENDCALL');
    const spokenResponse = llmResponse.replace(/\bTRANSFER\b|\bENDCALL\b/gi, '').trim() || llmResponse;

    // Add agent response to conversation
    conversation.push({ role: 'assistant', content: spokenResponse });

    // Save conversation back to lead
    try {
      await base44.entities.FronterLead.update(leadId, {
        notes: JSON.stringify(conversation),
        lastCalledAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[aiAgentRespond] Failed to save conversation:', e?.message);
    }

    // ── ENDCALL: prospect is unqualified or not interested ──
    if (wantsEndCall && !wantsTransfer) {
      const newCount = (leadData.callCount || 0) + 1;
      try {
        await base44.entities.FronterLead.update(leadId, {
          callCount: newCount,
          lastCalledAt: new Date().toISOString(),
          lastCallResult: 'not_interested',
          status: 'removed',
        });
      } catch {}
      return twimlResponse(`<Response>
  <Say voice="Polly.Joanna-Neural">${xmlEscape(spokenResponse)}</Say>
  <Hangup/>
</Response>`);
    }

    // ── TRANSFER: prospect is qualified → execute the full transfer sequence ──
    if (wantsTransfer) {
      return await executeTransfer(req, base44, leadData, config, conversation, spokenResponse);
    }

    // ── Continue the conversation ──
    const respondUrl = `${BASE_URL}/functions/aiAgentRespond?leadId=${encodeURIComponent(leadId)}`;
    return twimlResponse(`<Response>
  <Say voice="Polly.Joanna-Neural">${xmlEscape(spokenResponse)}</Say>
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

/**
 * Execute the full transfer sequence — mirrors the fronter's
 * @@SEND_EMAIL@@ + @@AI_INPUT@@ + @@COMPLETED_STEPS@@ + merge flow.
 *
 * 1. Extract debt data + contact data from the conversation
 * 2. Send credentials email (via Gmail connector)
 * 3. Generate AI input summary and save to notes
 * 4. Update lead status to 'transferred'
 * 5. Return TwiML: <Say> transfer message → <Dial> primary number
 *    The <Dial> action callback hits ?transferFallback=1 for 2nd line fallback.
 */
async function executeTransfer(req: Request, base44: any, leadData: any, config: any, conversation: any[], spokenResponse: string): Promise<Response> {
  const leadId = leadData.id;
  const now = new Date().toISOString();
  const callerId = Deno.env.get('TWILIO_FROM_NUMBER') || '';
  const primaryNumber = config.transferPhoneNumber || '+16193530919';
  const secondaryNumber = config.transferPhoneNumber2 || '+12162586934';

  console.log('[aiAgentRespond] → TRANSFER sequence for lead', leadId);

  // ── 1. Extract debt data + contact data from the conversation ──
  const [debtData, contactData] = await Promise.all([
    extractDebtData(req, conversation),
    extractContactData(req, conversation, leadData),
  ]);

  // Build lead updates from extracted data
  const leadUpdates: any = {
    status: 'transferred',
    lastCallResult: 'transferred',
    transferredAt: now,
    transferredTo: `Chris Bongiorno (${primaryNumber})`,
    lastCalledAt: now,
  };

  // Apply contact data updates (email, address, etc.)
  if (contactData.updates && Object.keys(contactData.updates).length > 0) {
    Object.assign(leadUpdates, contactData.updates);
  }

  // Apply debt data updates
  if (debtData.confirmed) {
    if (debtData.debtAmount != null) leadUpdates.debtAmount = debtData.debtAmount;
    if (debtData.debtTypesJson) leadUpdates.debtTypesJson = debtData.debtTypesJson;
    if (debtData.debtAmountsJson) leadUpdates.debtAmountsJson = debtData.debtAmountsJson;
  }

  // ── 2. Send credentials email (if enabled and email available) ──
  let emailSent = false;
  if (config.preTransferEmailEnabled !== false) {
    // Re-fetch lead data with contact updates applied for the email
    const emailLeadData = { ...leadData, ...contactData.updates };
    const emailResult = await sendCredentialsEmail(base44, emailLeadData, 'ai_agent');
    emailSent = emailResult.sent;
    if (emailSent) {
      leadUpdates.credsSentAt = now;
      leadUpdates.credsSentTemplate = emailResult.templateLabel || 'credentials';
      if (leadData.status === 'prospect') {
        leadUpdates.status = 'lead';
      }
    }
    console.log('[aiAgentRespond] Email sent:', emailSent, emailResult.reason || '');
  }

  // ── 3. Generate AI input summary and save to notes ──
  const summary = await generateCallSummary(req, conversation);
  if (summary) {
    try {
      let notesLog: any[] = [];
      try { notesLog = JSON.parse(leadData.notesLogJson || '[]'); } catch {}
      notesLog.push({
        text: `🤖 AI Input Summary: ${summary}`,
        timestamp: now,
        author: 'AI',
        type: 'ai_input',
      });
      if (debtData.confirmed && debtData.summary) {
        notesLog.push({
          text: `💰 Debt Confirm: ${debtData.summary}`,
          timestamp: now,
          author: 'AI',
          type: 'debt_confirm',
        });
      }
      leadUpdates.notesLogJson = JSON.stringify(notesLog);
    } catch {}
  }

  // ── 4. Update lead with all extracted data + status ──
  try {
    await base44.entities.FronterLead.update(leadId, leadUpdates);
  } catch (e) {
    console.warn('[aiAgentRespond] Failed to update lead on transfer:', e?.message);
  }

  // ── 5. Return TwiML: transfer message → dial primary number ──
  // The Dial action callback hits ?transferFallback=1 → dials 2nd line
  const fallbackUrl = `${BASE_URL}/functions/aiAgentRespond?transferFallback=1&leadId=${encodeURIComponent(leadId)}`;
  const transferMessage = spokenResponse || 'Great! Let me connect you with one of our senior debt advisors. Please hold for just a moment.';

  return twimlResponse(`<Response>
  <Say voice="Polly.Joanna-Neural">${xmlEscape(transferMessage)}</Say>
  <Dial callerId="${xmlEscape(callerId)}" timeout="30" action="${xmlEscape(fallbackUrl)}" method="POST">
    <Number>${xmlEscape(primaryNumber)}</Number>
  </Dial>
</Response>`);
}

/**
 * Transfer fallback — primary dial ended (no answer/voicemail).
 * Dial the secondary number with a no-connect action callback.
 */
async function handleTransferFallback(req: Request, leadId: string): Promise<Response> {
  const base44 = createClientFromRequest(req).asServiceRole;
  const callerId = Deno.env.get('TWILIO_FROM_NUMBER') || '';

  let config: any = {};
  try {
    const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
    config = configs?.[0] || {};
  } catch {}

  const secondaryNumber = config.transferPhoneNumber2 || '+12162586934';
  const noConnectUrl = `${BASE_URL}/functions/aiAgentRespond?transferNoConnect=1&leadId=${encodeURIComponent(leadId)}`;

  console.log('[aiAgentRespond] → Transfer fallback: dialing 2nd line', secondaryNumber);

  return twimlResponse(`<Response>
  <Say voice="Polly.Joanna-Neural">Let me try connecting you to another advisor. Please hold.</Say>
  <Dial callerId="${xmlEscape(callerId)}" timeout="30" action="${xmlEscape(noConnectUrl)}" method="POST">
    <Number>${xmlEscape(secondaryNumber)}</Number>
  </Dial>
</Response>`);
}

/**
 * Transfer NO CONNECT — both lines failed.
 * Update lead disposition and hang up.
 */
async function handleTransferNoConnect(req: Request, leadId: string): Promise<Response> {
  const base44 = createClientFromRequest(req).asServiceRole;
  const now = new Date().toISOString();

  console.log('[aiAgentRespond] → Transfer NO CONNECT: both lines failed for lead', leadId);

  try {
    await base44.entities.FronterLead.update(leadId, {
      lastCallResult: 'queued_no_connect',
      lastCalledAt: now,
      status: 'lead',
    });
  } catch (e) {
    console.warn('[aiAgentRespond] Failed to update lead on no-connect:', e?.message);
  }

  return twimlResponse(`<Response>
  <Say voice="Polly.Joanna-Neural">I'm sorry, our senior advisors are currently assisting other clients. We will call you back shortly to connect you with an advisor. Thank you for your patience. Have a great day.</Say>
  <Hangup/>
</Response>`);
}