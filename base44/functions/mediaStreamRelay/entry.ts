/**
 * mediaStreamRelay — App-side receiver for the Render WS Bridge container.
 *
 * Phase 1 (this build): TRANSPORT ONLY.
 *   - Receives start / media_batch / stop events from the bridge container.
 *   - Validates a shared secret (WS_BRIDGE_AUTH_TOKEN) if set.
 *   - Maintains in-memory session state per streamSid.
 *   - Accumulates inbound audio and logs batch counts for transport validation.
 *   - Saves a transcript record on stop if any conversation was captured.
 *
 * Phase 2 (flip AI_PROCESSING_ENABLED to true):
 *   - Transcribe accumulated audio with Deepgram.
 *   - Call the LLM (reuses callLLM + FRONTER_SCRIPT_SYSTEM_PROMPT).
 *   - Generate TTS and push it back to Twilio via the bridge /play endpoint.
 *
 * Called by the bridge container (POST from forwardToApp), NOT by the frontend.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { callLLM } from '../../shared/llmHelper.ts';
import { FRONTER_SCRIPT_SYSTEM_PROMPT, prepareTransfer } from '../../shared/aiAgentHelpers.ts';
import { twilioFetch } from '../../shared/twilioHelpers.ts';

// Flip to true to enable Deepgram transcription + LLM + TTS (Phase 2).
const AI_PROCESSING_ENABLED = true;

// In-memory session store: streamSid -> session.
// Works when the same worker handles all batches for a stream (the bridge
// sends batches from one persistent WebSocket in quick succession).
const sessions = new Map<string, any>();

export default async function(req: Request): Promise<Response> {
  try {
    // ── Auth: shared secret from the bridge container ──
    const authToken = secrets.get('WS_BRIDGE_AUTH_TOKEN') || '';
    if (authToken) {
      const auth = req.headers.get('Authorization') || '';
      if (auth !== `Bearer ${authToken}`) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { event, streamSid, callSid, media, tracks, customParameters } = body;

    if (!event || !streamSid) {
      return Response.json({ error: 'missing event or streamSid' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req).asServiceRole;

    // ── START: initialize session ──
    if (event === 'start') {
      let lead: any = null;
      let config: any = {};
      const leadId = customParameters?.leadId || '';
      if (leadId) {
        try { lead = await base44.entities.FronterLead.get(leadId); } catch {}
      }
      if (lead) {
        try {
          const configs = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
          config = configs?.[0] || {};
        } catch {}
      }

      sessions.set(streamSid, {
        callSid,
        leadId: lead?.id || leadId,
        lead,
        config,
        audioBuffer: [] as string[],
        conversation: [] as Array<{ role: string; content: string }>,
        batchCount: 0,
        startedAt: Date.now(),
        processing: false,
      });

      // Seed conversation with greeting if available
      if (lead && config.greeting) {
        const greeting = (config.greeting as string)
          .replace(/\{\{first_name\}\}/g, lead.firstName || '')
          .replace(/\{\{last_name\}\}/g, lead.lastName || '');
        sessions.get(streamSid).conversation.push({ role: 'assistant', content: greeting });
      }

      console.log('[mediaStreamRelay] START', streamSid, 'lead', lead?.id, 'AI:', AI_PROCESSING_ENABLED);
      return Response.json({ ok: true, aiEnabled: AI_PROCESSING_ENABLED });
    }

    // ── MEDIA_BATCH: accumulate audio, optionally process ──
    if (event === 'media_batch') {
      const session = sessions.get(streamSid);
      if (!session) return Response.json({ ok: true, note: 'no session' });

      if (media && Array.isArray(media)) {
        for (const m of media) {
          if (m.track === 'inbound' && m.payload) {
            session.audioBuffer.push(m.payload);
            session.batchCount++;
          }
        }
      }

      // Phase 2 seam: transcribe + LLM + TTS when enabled
      if (AI_PROCESSING_ENABLED && session.audioBuffer.length > 0) {
        await processWithAI(req, base44, session, streamSid);
      }

      return Response.json({ ok: true, batches: session.batchCount });
    }

    // ── STOP: finalize and clean up ──
    if (event === 'stop') {
      const session = sessions.get(streamSid);
      if (session) {
        const dur = Math.round((Date.now() - session.startedAt) / 1000);
        console.log('[mediaStreamRelay] STOP', streamSid, 'batches:', session.batchCount, 'dur:', dur + 's');

        // Save transcript if we captured any conversation
        if (session.conversation.length > 0 && session.leadId && session.callSid) {
          try {
            await saveTranscript(base44, session);
          } catch (e) {
            console.warn('[mediaStreamRelay] transcript save failed:', e?.message);
          }
        }
        sessions.delete(streamSid);
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'unknown event' }, { status: 400 });
  } catch (error) {
    console.error('[mediaStreamRelay] error:', error?.message);
    return Response.json({ error: error?.message || 'internal error' }, { status: 500 });
  }
}

// Map config LLM names to valid InvokeLLM model names
const MODEL_MAP: Record<string, string> = {
  'claude-sonnet-5': 'claude-sonnet-5',
  'claude-opus-5': 'claude_opus_5',
  'claude-sonnet-4-6': 'claude_sonnet_4_6',
  'gpt-5-4': 'gpt_5_4',
  'gemini-3-1-pro': 'gemini_3_1_pro',
};

// Minimum audio chunks before processing (75 chunks ≈ 1.5 seconds at 20ms/chunk)
const MIN_CHUNKS_FOR_PROCESSING = 75;

/**
 * Phase 2: Transcribe audio with Deepgram, call LLM, generate TTS, push to Twilio.
 * Called on each media_batch when enough audio has accumulated.
 */
async function processWithAI(req: Request, base44: any, session: any, streamSid: string) {
  // Skip if already processing or not enough audio accumulated yet
  if (session.processing) return;
  if (session.audioBuffer.length < MIN_CHUNKS_FOR_PROCESSING) return;

  session.processing = true;
  const audioChunks = session.audioBuffer.splice(0); // Take all and clear buffer

  try {
    // 1. Concatenate base64 mulaw audio chunks into raw bytes
    let totalLen = 0;
    const rawChunks: Uint8Array[] = [];
    for (const b64 of audioChunks) {
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      rawChunks.push(bytes);
      totalLen += bytes.length;
    }
    const rawAudio = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of rawChunks) {
      rawAudio.set(chunk, offset);
      offset += chunk.length;
    }

    // 2. Send to Deepgram for batch transcription (mulaw, 8kHz)
    const deepgramKey = secrets.get('DEEPGRAM_API_KEY') || '';
    if (!deepgramKey) {
      console.warn('[mediaStreamRelay] No DEEPGRAM_API_KEY — skipping AI');
      return;
    }

    const dgRes = await fetch(
      'https://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&channels=1&model=nova-2&smart_format=true&punctuate=true&interim_results=false',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': 'application/octet-stream',
        },
        body: rawAudio,
      }
    );

    if (!dgRes.ok) {
      console.warn('[mediaStreamRelay] Deepgram STT error:', dgRes.status);
      return;
    }

    const dgData = await dgRes.json();
    const transcript = dgData?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    console.log('[mediaStreamRelay] Transcript:', transcript);

    // If no speech detected, skip LLM/TTS
    if (!transcript || transcript.trim().length === 0) return;

    // 3. Call LLM with conversation history
    session.conversation.push({ role: 'user', content: transcript });

    const systemPrompt = session.config?.systemPrompt || FRONTER_SCRIPT_SYSTEM_PROMPT;
    const filledPrompt = systemPrompt
      .replace(/\{\{first_name\}\}/g, session.lead?.firstName || '')
      .replace(/\{\{last_name\}\}/g, session.lead?.lastName || '')
      .replace(/\{\{email\}\}/g, session.lead?.email || '')
      .replace(/\{\{city\}\}/g, session.lead?.city || '')
      .replace(/\{\{state\}\}/g, session.lead?.state || '');

    const conversationText = session.conversation
      .map((m) => `${m.role === 'user' ? 'Prospect' : 'Agent'}: ${m.content}`)
      .join('\n');

    const llmModel = MODEL_MAP[session.config?.llmModel] || 'claude-sonnet-5';

    let llmResponse = '';
    try {
      const data = await callLLM(req, {
        model: llmModel,
        max_tokens: 300,
        system: filledPrompt,
        messages: [{ role: 'user', content: conversationText }],
      });
      llmResponse = data?.content?.[0]?.text || '';
      if (llmResponse.length > 500) llmResponse = llmResponse.slice(0, 497) + '...';
    } catch (e) {
      console.error('[mediaStreamRelay] LLM error:', e?.message);
      return;
    }

    // Strip TRANSFER/ENDCALL keywords from spoken response
    const upperResponse = llmResponse.toUpperCase();
    const wantsTransfer = upperResponse.includes('TRANSFER');
    const wantsEndCall = upperResponse.includes('ENDCALL');
    const spokenResponse = llmResponse.replace(/\bTRANSFER\b|\bENDCALL\b/gi, '').trim() || llmResponse;

    session.conversation.push({ role: 'assistant', content: spokenResponse });
    console.log('[mediaStreamRelay] LLM response:', spokenResponse);

    // 4. Generate TTS using Deepgram Aura (mulaw, 8kHz for Twilio Media Streams)
    const ttsVoice = session.config?.ttsVoiceModel || 'aura-2-thalia-en';
    const ttsRes = await fetch(
      `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(ttsVoice)}&encoding=mulaw&sample_rate=8000&container=none`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': 'text/plain',
        },
        body: spokenResponse,
      }
    );

    if (!ttsRes.ok) {
      console.error('[mediaStreamRelay] Deepgram TTS error:', ttsRes.status);
      return;
    }

    const ttsAudio = await ttsRes.arrayBuffer();
    const ttsBytes = new Uint8Array(ttsAudio);
    // Base64 encode the mulaw audio for the bridge /play endpoint
    let binary = '';
    for (let i = 0; i < ttsBytes.length; i++) binary += String.fromCharCode(ttsBytes[i]);
    const ttsBase64 = btoa(binary);

    // 5. Send TTS audio to bridge /play endpoint → Twilio Media Stream
    const bridgeUrl = (secrets.get('WS_BRIDGE_URL') || '').replace(/\/$/, '');
    const bridgeToken = secrets.get('WS_BRIDGE_AUTH_TOKEN') || '';
    if (bridgeUrl) {
      await fetch(`${bridgeUrl}/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bridgeToken ? { 'Authorization': `Bearer ${bridgeToken}` } : {}),
        },
        body: JSON.stringify({ streamSid, payload: ttsBase64 }),
      });
      console.log('[mediaStreamRelay] TTS sent to bridge, bytes:', ttsBytes.length);
    }

    // 6. Save conversation to lead notes (for transfer flow and persistence)
    if (session.leadId) {
      try {
        await base44.entities.FronterLead.update(session.leadId, {
          notes: JSON.stringify(session.conversation),
          lastCalledAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[mediaStreamRelay] Failed to save conversation:', e?.message);
      }
    }

    // 7. Handle transfer / endcall — redirect the Twilio call
    const BASE_URL = 'https://rosieai-investorpage.base44.app';
    if (wantsTransfer) {
      console.log('[mediaStreamRelay] Transfer requested for lead', session.leadId);
      await prepareTransfer(req, base44, session.lead, session.config, session.conversation);
      if (session.callSid) {
        try {
          const transferUrl = `${BASE_URL}/functions/dialerVoiceHandler?Mode=aiAgentTransfer&LeadId=${encodeURIComponent(session.leadId || '')}`;
          await twilioFetch(`/Calls/${session.callSid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Url: transferUrl }),
          });
          console.log('[mediaStreamRelay] Call redirected to transfer TwiML');
        } catch (e) {
          console.error('[mediaStreamRelay] Failed to redirect call for transfer:', e?.message);
        }
      }
    } else if (wantsEndCall) {
      console.log('[mediaStreamRelay] End call requested for lead', session.leadId);
      if (session.leadId) {
        try {
          await base44.entities.FronterLead.update(session.leadId, {
            callCount: (session.lead?.callCount || 0) + 1,
            lastCallResult: 'not_interested',
            status: 'removed',
            lastCalledAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('[mediaStreamRelay] Failed to update lead on endcall:', e?.message);
        }
      }
      if (session.callSid) {
        try {
          const endCallUrl = `${BASE_URL}/functions/dialerVoiceHandler?Mode=aiAgentEndCall`;
          await twilioFetch(`/Calls/${session.callSid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Url: endCallUrl }),
          });
          console.log('[mediaStreamRelay] Call redirected to endcall TwiML');
        } catch (e) {
          console.error('[mediaStreamRelay] Failed to redirect call for endcall:', e?.message);
        }
      }
    }
  } catch (error) {
    console.error('[mediaStreamRelay] processWithAI error:', error?.message);
  } finally {
    session.processing = false;
  }
}

/**
 * Save the conversation as a FronterCallTranscript record.
 */
async function saveTranscript(base44: any, session: any) {
  const transcriptData = session.conversation.map((m: any) => ({
    speaker: m.role === 'assistant' ? 0 : 1,
    text: m.content,
    time: new Date().toISOString(),
  }));

  const leadName = `${session.lead?.firstName || ''} ${session.lead?.lastName || ''}`.trim();
  await base44.entities.FronterCallTranscript.create({
    leadId: session.leadId,
    leadName,
    fronterUsername: 'ai_agent',
    transcriptJson: JSON.stringify(transcriptData),
    transcriptLineCount: transcriptData.length,
    callSid: session.callSid,
    callDate: new Date().toISOString(),
    callResult: 'media_stream',
  });
}