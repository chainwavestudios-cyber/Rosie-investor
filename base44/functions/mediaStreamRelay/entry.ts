/**
 * mediaStreamRelay — Business-logic layer for the AI voice agent.
 *
 * Architecture (Option 2): The bridge owns real-time audio (Deepgram streaming
 * STT, TTS generation, playback queue, barge-in). This function owns business
 * logic: config/lead loading, LLM inference, transfer execution, transcript
 * persistence, disposition management.
 *
 * Protocol (bridge → relay, POST to this function):
 *   { event: "init", streamSid, callSid, leadId }
 *     → { greeting, ttsEngine, ttsVoiceModel, llmModel, leadId, leadFirstName, leadLastName }
 *   { event: "turn", streamSid, callSid, transcript, conversation, leadId }
 *     → { action: "speak"|"transfer"|"end_call", text, disposition }
 *   { event: "transfer", streamSid, callSid, conversation, leadId }
 *     → { ok, transferNumber }
 *   { event: "end_call", streamSid, callSid, disposition, leadId }
 *     → { ok }
 *   { event: "stop", streamSid, callSid, conversation, recordingBase64, leadId }
 *     → { ok }
 *
 * Auth: WS_BRIDGE_AUTH_TOKEN (fail-closed — rejects if missing in production)
 * Structured actions: replaces TRANSFER/ENDCALL text markers with schema-validated JSON
 * Disposition: separated from call termination (ending a call ≠ "not interested")
 * Persistence: idempotent transcript saves, no overwriting lead notes with conversation
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { FRONTER_SCRIPT_SYSTEM_PROMPT, prepareTransfer } from '../../shared/aiAgentHelpers.ts';
import { twilioFetch } from '../../shared/twilioHelpers.ts';

const BASE_URL = 'https://rosieai-investorpage.base44.app';

// Map config LLM names to valid InvokeLLM model names
const MODEL_MAP: Record<string, string> = {
  'claude-sonnet-5': 'claude-sonnet-5',
  'claude-opus-5': 'claude_opus_5',
  'claude-sonnet-4-6': 'claude_sonnet_4_6',
  'gpt-5-4': 'gpt_5_4',
  'gemini-3-1-pro': 'gemini_3_1_pro',
};

const VALID_ACTIONS = ['speak', 'transfer', 'end_call'];
const VALID_DISPOSITIONS = ['interested', 'not_interested', 'callback_requested', 'transferred', 'opt_out', 'no_response', 'technical_failure'];

// ── Bridge /play helper (authenticated with PLAY_AUTH_TOKEN) ──────────
async function playToBridge(streamSid: string, body: any): Promise<any> {
  const bridgeUrl = secrets.get('WS_BRIDGE_URL') || '';
  const playToken = secrets.get('PLAY_AUTH_TOKEN') || '';
  if (!bridgeUrl || !playToken || !streamSid) return null;
  try {
    const url = bridgeUrl.replace(/\/$/, '') + '/play';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${playToken}`,
      },
      body: JSON.stringify({ streamSid, ...body }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.warn('[mediaStreamRelay] /play failed:', res.status); return null; }
    return await res.json();
  } catch (e) {
    console.warn('[mediaStreamRelay] /play error:', e?.message);
    return null;
  }
}

// Generate TTS audio (base64 mulaw 8kHz) via ElevenLabs, fallback Deepgram Aura
async function generateTTS(text: string, config: any): Promise<string> {
  const elevenlabsKey = secrets.get('ELEVENLABS_API_KEY') || '';
  const deepgramKey = secrets.get('DEEPGRAM_API_KEY') || '';
  const engine = config.ttsEngine || 'elevenlabs';

  if (engine === 'elevenlabs' && elevenlabsKey) {
    try {
      const voiceId = config.ttsVoiceModel || '21m00Tcm4TlvDq8ikWAM';
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=ulaw_8000`,
        {
          method: 'POST',
          headers: { 'xi-api-key': elevenlabsKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      }
      console.warn('[mediaStreamRelay] ElevenLabs TTS error:', res.status);
    } catch (e) {
      console.warn('[mediaStreamRelay] ElevenLabs TTS failed:', e?.message);
    }
  }

  if (deepgramKey) {
    try {
      const voice = config.ttsVoiceModel || 'aura-2-thalia-en';
      const res = await fetch(
        `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}&encoding=mulaw&sample_rate=8000&container=none`,
        {
          method: 'POST',
          headers: { 'Authorization': `Token ${deepgramKey}`, 'Content-Type': 'text/plain' },
          body: text,
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      }
      console.warn('[mediaStreamRelay] Deepgram TTS error:', res.status);
    } catch (e) {
      console.warn('[mediaStreamRelay] Deepgram TTS failed:', e?.message);
    }
  }
  return '';
}

// Estimate playback duration: ~12 chars/sec, min 2s, plus 500ms buffer
function estimatePlaybackMs(text: string): number {
  return Math.max(2000, Math.ceil(text.length / 12) * 1000) + 500;
}

export default async function(req: Request): Promise<Response> {
  try {
    // ── Auth: fail-closed ──
    const authToken = secrets.get('WS_BRIDGE_AUTH_TOKEN') || '';
    if (authToken) {
      const auth = req.headers.get('Authorization') || '';
      if (auth !== `Bearer ${authToken}`) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
      }
    }

    // ── Parse and validate body ──
    const body = await req.json();
    const { event, streamSid } = body;

    if (!event || !streamSid) {
      return Response.json({ error: 'missing event or streamSid' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req).asServiceRole;

    // ── Route to event handler ──
    if (event === 'init') return await handleInit(base44, body);
    if (event === 'turn') return await handleTurn(base44, body);
    if (event === 'transfer') return await handleTransfer(req, base44, body);
    if (event === 'end_call') return await handleEndCall(base44, body);
    if (event === 'stop') return await handleStop(base44, body);

    return Response.json({ error: 'unknown event' }, { status: 400 });
  } catch (error) {
    console.error('[mediaStreamRelay] error:', error?.message);
    // Never return raw internal exception messages to callers
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}

// ── INIT: load config + lead, return greeting ───────────────────────────
async function handleInit(base44: any, body: any): Promise<Response> {
  const { leadId } = body;
  let lead: any = null;
  let config: any = {};

  if (leadId) {
    try { lead = await base44.entities.FronterLead.get(leadId); } catch {}
  }
  try {
    const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
    config = configs?.[0] || {};
  } catch {}

  // Build greeting with variable substitution
  let greeting = '';
  if (config.greeting) {
    greeting = config.greeting as string;
    if (lead) {
      greeting = greeting
        .replace(/\{\{first_name\}\}/g, lead.firstName || '')
        .replace(/\{\{last_name\}\}/g, lead.lastName || '')
        .replace(/\{\{email\}\}/g, lead.email || '');
    }
  }

  return Response.json({
    greeting,
    ttsEngine: config.ttsEngine || 'elevenlabs',
    ttsVoiceModel: config.ttsVoiceModel || '',
    llmModel: config.llmModel || 'claude-sonnet-5',
    leadId: lead?.id || leadId,
    leadFirstName: lead?.firstName || '',
    leadLastName: lead?.lastName || '',
  });
}

// ── TURN: LLM response with structured action ──────────────────────────
async function handleTurn(base44: any, body: any): Promise<Response> {
  const { transcript, conversation, leadId } = body;

  if (!transcript || typeof transcript !== 'string') {
    return Response.json({ error: 'missing transcript' }, { status: 400 });
  }

  // Load config
  let config: any = {};
  try {
    const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
    config = configs?.[0] || {};
  } catch {}

  // Load lead
  let lead: any = null;
  if (leadId) {
    try { lead = await base44.entities.FronterLead.get(leadId); } catch {}
  }

  // Build system prompt with variable substitution
  const systemPrompt = config.systemPrompt || FRONTER_SCRIPT_SYSTEM_PROMPT;
  const filledPrompt = systemPrompt
    .replace(/\{\{first_name\}\}/g, lead?.firstName || '')
    .replace(/\{\{last_name\}\}/g, lead?.lastName || '')
    .replace(/\{\{email\}\}/g, lead?.email || '')
    .replace(/\{\{city\}\}/g, lead?.city || '')
    .replace(/\{\{state\}\}/g, lead?.state || '');

  // Build conversation text from structured messages (preserves role distinction)
  const conversationText = (conversation || [])
    .map((m: any) => `${m.role === 'user' ? 'Prospect' : 'Agent'}: ${m.content}`)
    .join('\n');

  const llmModel = MODEL_MAP[config.llmModel] || 'claude-sonnet-5';

  let action = 'speak';
  let text = '';
  let disposition = '';

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${filledPrompt}

Conversation so far:
${conversationText}

Respond as the Agent to the prospect's latest message. Keep your response to 1-3 sentences since it will be spoken aloud on a phone call. Do not use formatting, emojis, or special characters.

Determine the action:
- "speak": Continue the conversation naturally
- "transfer": The prospect is qualified and ready for transfer to a senior advisor
- "end_call": The prospect is not qualified (debt under $10,000) or explicitly not interested

Return JSON with:
- action: one of "speak", "transfer", "end_call"
- text: what to speak aloud (1-3 sentences, no formatting)
- disposition: if end_call, one of "not_interested", "opt_out", "no_response", "technical_failure"`,
      response_json_schema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: VALID_ACTIONS },
          text: { type: 'string' },
          disposition: { type: 'string', enum: VALID_DISPOSITIONS },
        },
        required: ['action', 'text'],
      },
      model: llmModel,
    });

    // Validate LLM response against schema
    action = VALID_ACTIONS.includes(result?.action) ? result.action : 'speak';
    text = typeof result?.text === 'string' ? result.text : '';
    if (text.length > 500) text = text.slice(0, 497) + '...';
    disposition = VALID_DISPOSITIONS.includes(result?.disposition) ? result.disposition : 'no_response';
  } catch (e) {
    console.error('[mediaStreamRelay] LLM error:', e?.message);
    action = 'speak';
    text = "I'm sorry, could you repeat that?";
  }

  // Deterministic qualification: reject transfer if debt is known and below $10k
  if (action === 'transfer' && lead?.debtAmount != null && lead.debtAmount > 0 && lead.debtAmount < 10000) {
    action = 'speak';
    text = "I appreciate your time, but our programs are designed for debt amounts of $10,000 or more. If your situation changes, please don't hesitate to reach out.";
    disposition = 'not_interested';
  }

  return Response.json({ action, text, disposition });
}

// ── TRANSFER: execute transfer prep + redirect Twilio call ───────────────
async function handleTransfer(req: Request, base44: any, body: any): Promise<Response> {
  const { callSid, conversation, leadId } = body;

  let lead: any = null;
  let config: any = {};
  if (leadId) {
    try { lead = await base44.entities.FronterLead.get(leadId); } catch {}
  }
  try {
    const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
    config = configs?.[0] || {};
  } catch {}

  // Execute transfer prep (extract data, send email, generate summary, update lead)
  try {
    await prepareTransfer(req, base44, lead, config, conversation || []);
  } catch (e) {
    console.error('[mediaStreamRelay] Transfer prep failed:', e?.message);
  }

  // Play transfer announcement via bridge (ElevenLabs/Deepgram) before redirect
  const transferMsg = "Let me connect you with one of our senior debt advisors. Please hold for just a moment.";
  const ttsAudio = await generateTTS(transferMsg, config);
  if (ttsAudio) {
    await playToBridge(body.streamSid, { clear: true });
    await playToBridge(body.streamSid, { payload: ttsAudio });
    await new Promise(r => setTimeout(r, estimatePlaybackMs(transferMsg)));
  }

  // Redirect Twilio call to transfer TwiML (SkipSay since message already played via bridge)
  if (callSid) {
    try {
      const transferUrl = `${BASE_URL}/functions/dialerVoiceHandler?Mode=aiAgentTransfer&LeadId=${encodeURIComponent(leadId || '')}&SkipSay=true`;
      await twilioFetch(`/Calls/${callSid}.json`, {
        method: 'POST',
        body: new URLSearchParams({ Url: transferUrl }),
      });
    } catch (e) {
      console.error('[mediaStreamRelay] Failed to redirect call for transfer:', e?.message);
    }
  }

  return Response.json({ ok: true, transferNumber: config.transferPhoneNumber || '+16193530919' });
}

// ── END_CALL: update disposition (NOT automatic "removed") ──────────────
async function handleEndCall(base44: any, body: any): Promise<Response> {
  const { callSid, disposition, leadId, streamSid } = body;

  // Load config for TTS voice
  let config: any = {};
  try {
    const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
    config = configs?.[0] || {};
  } catch {}

  // Validate disposition
  const validDisposition = VALID_DISPOSITIONS.includes(disposition) ? disposition : 'no_response';

  // Update lead with disposition — only set status to 'removed' for explicit opt-out/not-interested
  if (leadId) {
    try {
      const lead = await base44.entities.FronterLead.get(leadId);
      const update: any = {
        callCount: (lead?.callCount || 0) + 1,
        lastCallResult: validDisposition,
        lastCalledAt: new Date().toISOString(),
      };
      if (validDisposition === 'opt_out' || validDisposition === 'not_interested') {
        update.status = 'removed';
      }
      await base44.entities.FronterLead.update(leadId, update);
    } catch (e) {
      console.error('[mediaStreamRelay] Failed to update lead on end_call:', e?.message);
    }
  }

  // Play goodbye via bridge (ElevenLabs/Deepgram) before redirect
  const endMsg = "Thank you for your time. Have a great day. Goodbye.";
  const ttsAudio = await generateTTS(endMsg, config);
  if (ttsAudio) {
    await playToBridge(streamSid, { clear: true });
    await playToBridge(streamSid, { payload: ttsAudio });
    await new Promise(r => setTimeout(r, estimatePlaybackMs(endMsg)));
  }

  // Redirect Twilio call to endcall TwiML (SkipSay since message already played via bridge)
  if (callSid) {
    try {
      const endCallUrl = `${BASE_URL}/functions/dialerVoiceHandler?Mode=aiAgentEndCall&SkipSay=true`;
      await twilioFetch(`/Calls/${callSid}.json`, {
        method: 'POST',
        body: new URLSearchParams({ Url: endCallUrl }),
      });
    } catch (e) {
      console.error('[mediaStreamRelay] Failed to redirect call for end_call:', e?.message);
    }
  }

  return Response.json({ ok: true });
}

// ── STOP: save transcript + upload recording (idempotent) ────────────────
async function handleStop(base44: any, body: any): Promise<Response> {
  const { callSid, conversation, recordingBase64, leadId } = body;

  let recordingUri = '';

  // Upload recording (stored privately)
  if (recordingBase64 && recordingBase64.length > 0) {
    try {
      // Convert base64 mulaw to WAV
      const raw = atob(recordingBase64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      // Build WAV header (mulaw, 8kHz, mono, 8-bit)
      const header = new Uint8Array(44);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x52494646, false);   // "RIFF"
      view.setUint32(4, 36 + bytes.length, true);
      view.setUint32(8, 0x57415645, false);    // "WAVE"
      view.setUint32(12, 0x666d7420, false);   // "fmt "
      view.setUint32(16, 16, true);
      view.setUint16(20, 7, true);              // μ-law
      view.setUint16(22, 1, true);              // mono
      view.setUint32(24, 8000, true);
      view.setUint32(28, 8000, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true);
      view.setUint32(36, 0x64617461, false);   // "data"
      view.setUint32(40, bytes.length, true);

      const wav = new Uint8Array(44 + bytes.length);
      wav.set(header, 0);
      wav.set(bytes, 44);

      const file = new File([wav], `recording-${callSid || 'unknown'}.wav`, { type: 'audio/wav' });
      const result = await base44.integrations.Core.UploadPrivateFile({ file });
      recordingUri = result?.file_uri || '';
    } catch (e) {
      console.warn('[mediaStreamRelay] Recording upload failed:', e?.message);
    }
  }

  // Save transcript (idempotent: check for existing by callSid)
  if (conversation && conversation.length > 0 && leadId && callSid) {
    try {
      const existing = await base44.entities.FronterCallTranscript.filter({ callSid });
      const items = existing?.items || (Array.isArray(existing) ? existing : []);
      if (items.length === 0) {
        // Only create if no existing transcript for this callSid (idempotent)
        let lead: any = null;
        try { lead = await base44.entities.FronterLead.get(leadId); } catch {}
        const leadName = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim();

        const transcriptData = conversation.map((m: any) => ({
          speaker: m.role === 'assistant' ? 0 : 1,
          text: m.content,
          time: new Date().toISOString(),
        }));

        await base44.entities.FronterCallTranscript.create({
          leadId,
          leadName,
          fronterUsername: 'ai_agent',
          transcriptJson: JSON.stringify(transcriptData),
          transcriptLineCount: transcriptData.length,
          callSid,
          callDate: new Date().toISOString(),
          callResult: 'media_stream',
          recordingUrl: recordingUri || undefined,
        });
      }
    } catch (e) {
      console.warn('[mediaStreamRelay] Transcript save failed:', e?.message);
    }
  }

  return Response.json({ ok: true });
}