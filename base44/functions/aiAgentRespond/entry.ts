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
import { getPollyVoice } from '../../shared/aiVoiceMap.ts';
import { prepareTransfer, FRONTER_SCRIPT_SYSTEM_PROMPT } from '../../shared/aiAgentHelpers.ts';
import { verifyTwilioSignature } from '../../shared/verifyTwilioSignature.ts';

const BASE_URL = 'https://rosieai-investorpage.base44.app';

// In-memory guard: prevents duplicate transfer execution for the same CallSid.
// Twilio can fire multiple speech callbacks before the first finishes.
const transferringCalls = new Set<string>();

// Map config LLM names to valid InvokeLLM model names (the Anthropic direct
// call in llmHelper will fail for these and fall back to InvokeLLM, which
// recognizes these exact names).
const MODEL_MAP: Record<string, string> = {
  'claude-sonnet-5': 'claude-sonnet-5',
  'claude-opus-5': 'claude_opus_5',
  'claude-sonnet-4-6': 'claude_sonnet_4_6',
  'gpt-5-4': 'gpt_5_4',
  'gemini-3-1-pro': 'gemini_3_1_pro',
};

function twimlResponse(twiml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${twiml}`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

/**
 * Save the AI agent conversation to a FronterCallTranscript record.
 * Creates on first turn, updates on subsequent turns, finalizes with callResult.
 * Converts the internal conversation format [{role, content}] to the transcript
 * format [{speaker, text, time}] where speaker 0=agent, 1=customer.
 */
async function saveAiAgentTranscript(base44: any, callSid: string, leadId: string, leadName: string, conversation: any[], callResult?: string) {
  if (!callSid || !leadId) return null;

  const transcriptData = conversation.map(m => ({
    speaker: m.role === 'assistant' ? 0 : 1,
    text: m.content,
    time: new Date().toISOString(),
  }));

  // Look up existing transcript by callSid
  let existing: any = null;
  try {
    const results = await base44.entities.FronterCallTranscript.filter({ callSid });
    const items = results?.items || (Array.isArray(results) ? results : []);
    existing = items[0] || null;
  } catch {}

  const payload: any = {
    leadId,
    leadName,
    fronterUsername: 'ai_agent',
    transcriptJson: JSON.stringify(transcriptData),
    transcriptLineCount: transcriptData.length,
    callSid,
  };
  if (callResult) payload.callResult = callResult;

  if (existing) {
    await base44.entities.FronterCallTranscript.update(existing.id, payload);
    return existing.id;
  } else {
    const rec = await base44.entities.FronterCallTranscript.create({
      ...payload,
      callDate: new Date().toISOString(),
    });
    return rec?.id || null;
  }
}

export default async function(req: Request): Promise<Response> {
  // ── Read raw body once for signature verification, then parse ──
  // req.text() consumes the body stream, so we parse from the raw string
  // instead of calling req.formData() again.
  const rawBody = await req.text();

  // Verify Twilio signature (skips silently in dev/preview with no auth token)
  if (!await verifyTwilioSignature(req, rawBody)) {
    console.warn('[aiAgentRespond] Twilio signature verification failed');
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = new URLSearchParams(rawBody);

  try {
    const url = new URL(req.url);
    const leadId = url.searchParams.get('leadId') || '';
    const transferFallback = url.searchParams.get('transferFallback') === '1';
    const transferNoConnect = url.searchParams.get('transferNoConnect') === '1';

    // ── Transfer fallback: primary dial ended (no answer) → dial 2nd line ──
    if (transferFallback && leadId) {
      return await handleTransferFallback(req, leadId, form);
    }

    // ── Transfer NO CONNECT: 2nd dial also ended (no answer) → disconnect ──
    if (transferNoConnect && leadId) {
      return await handleTransferNoConnect(req, leadId, form);
    }

    // ── Normal conversation flow ──
    // Twilio sends form-encoded SpeechResult
    const speechResult = (form.get('SpeechResult') || '').toString().trim();
    const confidence = (form.get('Confidence') || '').toString();
    const callSid = (form.get('CallSid') || '').toString();

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

    // Resolve the TTS voice from config — maps to a Twilio Polly voice
    const pollyVoice = getPollyVoice(config.ttsVoiceModel || 'aura-2-thalia-en');
    const llmModel = MODEL_MAP[config.llmModel] || 'claude-sonnet-5';
    console.log('[aiAgentRespond] Voice:', pollyVoice, '| LLM:', llmModel, '| TTS config:', config.ttsVoiceModel, '| LLM config:', config.llmModel);

    if (!leadData) {
      return twimlResponse(`<Response><Say voice="${pollyVoice}">There was an error. Goodbye.</Say><Hangup/></Response>`);
    }

    // ── Load conversation history from the call transcript (keyed by CallSid) ──
    // This isolates conversation state per call, preventing contamination when
    // the same lead is called twice or two calls overlap. Lead notes are kept
    // free for human-authored notes and AI input summaries.
    let conversation: Array<{ role: string; content: string }> = [];
    if (callSid) {
      try {
        const results = await base44.entities.FronterCallTranscript.filter({ callSid });
        const items = results?.items || (Array.isArray(results) ? results : []);
        const existingTranscript = items[0];
        if (existingTranscript?.transcriptJson) {
          const parsed = JSON.parse(existingTranscript.transcriptJson);
          if (Array.isArray(parsed)) {
            conversation = parsed.map((m: any) => ({
              role: m.speaker === 0 ? 'assistant' : 'user',
              content: m.text,
            }));
          }
        }
      } catch (e) {
        console.warn('[aiAgentRespond] Failed to load transcript for callSid:', callSid, e?.message);
      }
    }

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
  <Say voice="${pollyVoice}">Are you still there?</Say>
  <Gather input="speech" speechTimeout="auto" action="${respondUrl}" method="POST" language="en-US" enhanced="true" speechModel="conversational" />
  <Say voice="${pollyVoice}">I'll try again later. Have a good day. Goodbye.</Say>
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

Respond as the Agent. Keep your response to 1-3 sentences since it will be spoken aloud on a phone call. Do not use formatting, emojis, or special characters.

At the very end of your response, append an action tag on its own line:
  [ACTION: transfer] — if the prospect is qualified and ready for transfer
  [ACTION: end_call] — if the prospect is not qualified (debt under $10,000) or not interested
  [ACTION: continue] — if the conversation should continue naturally
Only include ONE action tag. The text before the tag is what gets spoken aloud.`;

    let llmResponse = 'I see, can you tell me more about that? [ACTION: continue]';
    try {
      const data = await callLLM(req, { model: llmModel, max_tokens: 300, system: filledPrompt, messages: [{ role: 'user', content: prompt }] });
      llmResponse = data?.content?.[0]?.text || '';
      if (llmResponse.length > 600) llmResponse = llmResponse.slice(0, 597) + '...';
    } catch (e) {
      console.error('[aiAgentRespond] LLM error:', e?.message);
    }

    // ── Structured action parsing: [ACTION: transfer|end_call|continue] ──
    // More robust than keyword matching — the tag is clearly delimited and
    // validated against an allowlist. Defaults to 'continue' if absent.
    const actionMatch = llmResponse.match(/\[ACTION:\s*(transfer|end_call|continue)\s*\]/i);
    const action = actionMatch ? actionMatch[1].toLowerCase() : 'continue';
    const wantsTransfer = action === 'transfer';
    const wantsEndCall = action === 'end_call';
    const spokenResponse = llmResponse.replace(/\[ACTION:\s*(?:transfer|end_call|continue)\s*\]/gi, '').trim() || llmResponse;

    // Add agent response to conversation
    conversation.push({ role: 'assistant', content: spokenResponse });

    // Save transcript to FronterCallTranscript entity (per-call conversation state)
    if (callSid) {
      try {
        await saveAiAgentTranscript(base44, callSid, leadId, `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim(), conversation);
      } catch (e) {
        console.warn('[aiAgentRespond] Failed to save transcript:', e?.message);
      }
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
      // Finalize transcript with call result
      if (callSid) {
        try {
          await saveAiAgentTranscript(base44, callSid, leadId, `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim(), conversation, 'not_interested');
        } catch {}
      }
      return twimlResponse(`<Response>
  <Say voice="${pollyVoice}">${xmlEscape(spokenResponse)}</Say>
  <Hangup/>
</Response>`);
    }

    // ── TRANSFER: prospect is qualified → execute the full transfer sequence ──
    if (wantsTransfer) {
      return await executeTransfer(req, base44, leadData, config, conversation, spokenResponse, callSid);
    }

    // ── Continue the conversation ──
    const respondUrl = `${BASE_URL}/functions/aiAgentRespond?leadId=${encodeURIComponent(leadId)}`;
    return twimlResponse(`<Response>
  <Say voice="${pollyVoice}">${xmlEscape(spokenResponse)}</Say>
  <Gather input="speech" speechTimeout="auto" action="${respondUrl}" method="POST" language="en-US" enhanced="true" speechModel="conversational" />
  <Say voice="${pollyVoice}">I didn't catch that. Can you repeat that?</Say>
  <Gather input="speech" speechTimeout="auto" action="${respondUrl}" method="POST" language="en-US" enhanced="true" speechModel="conversational" />
  <Say voice="${pollyVoice}">I'll try again later. Goodbye.</Say>
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
async function executeTransfer(req: Request, base44: any, leadData: any, config: any, conversation: any[], spokenResponse: string, callSid: string = ''): Promise<Response> {
  const leadId = leadData.id;
  const now = new Date().toISOString();
  const callerId = Deno.env.get('TWILIO_FROM_NUMBER') || '';
  const primaryNumber = config.transferPhoneNumber || '+16193530919';
  const pollyVoice = getPollyVoice(config.ttsVoiceModel || 'aura-2-thalia-en');

  // ── Idempotency: prevent duplicate transfers for the same call ──
  if (callSid && transferringCalls.has(callSid)) {
    console.log('[aiAgentRespond] Transfer already in progress for callSid:', callSid, '— skipping');
    return twimlResponse(`<Response><Hangup/></Response>`);
  }
  // Also check if the lead was already transferred (covers cross-call duplicates)
  if (leadData.status === 'transferred') {
    console.log('[aiAgentRespond] Lead already transferred — skipping');
    return twimlResponse(`<Response><Hangup/></Response>`);
  }
  if (callSid) transferringCalls.add(callSid);

  // ── Deterministic qualification: reject if debt is known and below $10k ──
  // The LLM's system prompt instructs it to say ENDCALL for debt < $10k, but
  // we enforce it here in code so a hallucinated TRANSFER can't bypass it.
  if (leadData.debtAmount != null && leadData.debtAmount > 0 && leadData.debtAmount < 10000) {
    console.log('[aiAgentRespond] Debt amount $' + leadData.debtAmount + ' below $10k threshold — denying transfer');
    if (callSid) transferringCalls.delete(callSid);
    try {
      await base44.entities.FronterLead.update(leadId, {
        callCount: (leadData.callCount || 0) + 1,
        lastCallResult: 'not_interested',
        status: 'removed',
        lastCalledAt: now,
      });
    } catch {}
    if (callSid) {
      try {
        await saveAiAgentTranscript(base44, callSid, leadId, `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim(), conversation, 'not_interested');
      } catch {}
    }
    return twimlResponse(`<Response>
  <Say voice="${pollyVoice}">I appreciate your time, but our programs are designed for debt amounts of $10,000 or more. If your situation changes, please don't hesitate to reach out. Have a great day.</Say>
  <Hangup/>
</Response>`);
  }

  console.log('[aiAgentRespond] → TRANSFER sequence for lead', leadId);

  // 1-4. Prep transfer (extract data, send email, generate summary, update lead)
  await prepareTransfer(req, base44, leadData, config, conversation);

  // Finalize transcript with transfer result
  if (callSid) {
    try {
      await saveAiAgentTranscript(base44, callSid, leadId, `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim(), conversation, 'transfer_started');
    } catch (e) {
      console.warn('[aiAgentRespond] Failed to finalize transcript:', e?.message);
    }
  }

  // 5. Return TwiML: transfer message → dial primary number
  const fallbackUrl = `${BASE_URL}/functions/aiAgentRespond?transferFallback=1&leadId=${encodeURIComponent(leadId)}`;
  const transferMessage = spokenResponse || 'Great! Let me connect you with one of our senior debt advisors. Please hold for just a moment.';

  return twimlResponse(`<Response>
  <Say voice="${pollyVoice}">${xmlEscape(transferMessage)}</Say>
  <Dial callerId="${xmlEscape(callerId)}" timeout="30" action="${xmlEscape(fallbackUrl)}" method="POST">
    <Number>${xmlEscape(primaryNumber)}</Number>
  </Dial>
</Response>`);
}

/**
 * Transfer fallback — primary dial ended (no answer/voicemail).
 * Dial the secondary number with a no-connect action callback.
 */
async function handleTransferFallback(req: Request, leadId: string, form: URLSearchParams): Promise<Response> {
  const base44 = createClientFromRequest(req).asServiceRole;
  const callerId = Deno.env.get('TWILIO_FROM_NUMBER') || '';

  // Check the primary dial result — only dial secondary if primary failed.
  // Twilio sends DialCallStatus in the action callback form data.
  const dialStatus = (form.get('DialCallStatus') || '').toString();

  console.log('[aiAgentRespond] → Transfer fallback: primary DialCallStatus:', dialStatus);

  // A completed advisor leg confirms a connected Dial; only now mark transfer.
  if (dialStatus === 'completed' || dialStatus === 'answered') {
    console.log('[aiAgentRespond] → Primary transfer succeeded, hanging up');
    if (leadId) {
      try {
        await base44.entities.FronterLead.update(leadId, {
          status: 'transferred', lastCallResult: 'transferred',
          callStatus: 'transferred', transferredAt: new Date().toISOString(),
          transferredTo: 'AI Agent → Primary Senior Advisor',
        });
      } catch (e) { console.warn('[aiAgentRespond] Primary transfer status update failed:', e?.message); }
    }
    return twimlResponse(`<Response><Hangup/></Response>`);
  }

  let config: any = {};
  try {
    const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
    config = configs?.[0] || {};
  } catch (e) {
    console.warn('[aiAgentRespond] Failed to load config for fallback:', e?.message);
  }

  const secondaryNumber = config.transferPhoneNumber2 || '+12162586934';
  const pollyVoice = getPollyVoice(config.ttsVoiceModel || 'aura-2-thalia-en');
  const noConnectUrl = `${BASE_URL}/functions/aiAgentRespond?transferNoConnect=1&leadId=${encodeURIComponent(leadId)}`;

  console.log('[aiAgentRespond] → Transfer fallback: dialing 2nd line', secondaryNumber);

  return twimlResponse(`<Response>
  <Say voice="${pollyVoice}">Let me try connecting you to another advisor. Please hold.</Say>
  <Dial callerId="${xmlEscape(callerId)}" timeout="30" action="${xmlEscape(noConnectUrl)}" method="POST">
    <Number>${xmlEscape(secondaryNumber)}</Number>
  </Dial>
</Response>`);
}

/**
 * Transfer NO CONNECT — both lines failed.
 * Update lead disposition and hang up.
 */
async function handleTransferNoConnect(req: Request, leadId: string, form: URLSearchParams): Promise<Response> {
  const base44 = createClientFromRequest(req).asServiceRole;
  const now = new Date().toISOString();
  const pollyVoice = getPollyVoice('aura-2-thalia-en');

  // Parse CallSid from the Dial action callback form data
  const callSid = (form.get('CallSid') || '').toString();
  const secondaryDialStatus = (form.get('DialCallStatus') || '').toString();
  let leadName = '';

  // A successful secondary advisor leg must not be recorded as no-connect.
  if (secondaryDialStatus === 'completed' || secondaryDialStatus === 'answered') {
    try {
      await base44.entities.FronterLead.update(leadId, {
        status: 'transferred', lastCallResult: 'transferred',
        callStatus: 'transferred', transferredAt: now,
        transferredTo: 'AI Agent → Secondary Senior Advisor',
      });
    } catch (e) { console.warn('[aiAgentRespond] Secondary transfer status update failed:', e?.message); }
    return twimlResponse(`<Response><Hangup/></Response>`);
  }

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

  // Finalize transcript with no-connect result
  if (callSid) {
    try {
      // Load lead for the name
      const lead = await base44.entities.FronterLead.get(leadId);
      leadName = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim();
      // Load the conversation from the call transcript (per-call state)
      let conversation: any[] = [];
      try {
        const results = await base44.entities.FronterCallTranscript.filter({ callSid });
        const items = results?.items || (Array.isArray(results) ? results : []);
        const transcript = items[0];
        if (transcript?.transcriptJson) {
          const parsed = JSON.parse(transcript.transcriptJson);
          if (Array.isArray(parsed)) {
            conversation = parsed.map((m: any) => ({ role: m.speaker === 0 ? 'assistant' : 'user', content: m.text }));
          }
        }
      } catch {}
      await saveAiAgentTranscript(base44, callSid, leadId, leadName, conversation, 'queued_no_connect');
    } catch (e) {
      console.warn('[aiAgentRespond] Failed to finalize transcript on no-connect:', e?.message);
    }
  }

  return twimlResponse(`<Response>
  <Say voice="${pollyVoice}">I'm sorry, our senior advisors are currently assisting other clients. We will call you back shortly to connect you with an advisor. Thank you for your patience. Have a great day.</Say>
  <Hangup/>
</Response>`);
}