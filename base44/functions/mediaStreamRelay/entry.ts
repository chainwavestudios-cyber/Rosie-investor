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
import { FRONTER_SCRIPT_SYSTEM_PROMPT } from '../../shared/aiAgentHelpers.ts';

// Flip to true to enable Deepgram transcription + LLM + TTS (Phase 2).
const AI_PROCESSING_ENABLED = false;

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
        await processWithAI(base44, session, streamSid);
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

/**
 * Phase 2: Transcribe audio with Deepgram, call LLM, generate TTS, push to Twilio.
 * This is the seam — implement when AI_PROCESSING_ENABLED is flipped to true.
 */
async function processWithAI(base44: any, session: any, streamSid: string) {
  // 1. Concatenate base64 mulaw audio chunks
  // 2. Send to Deepgram for transcription (batch or streaming)
  // 3. If transcript is a complete utterance, call LLM with conversation history
  // 4. Generate TTS (Deepgram Aura or platform TTS)
  // 5. Call bridge /play endpoint with TTS audio
  //    const bridgeUrl = secrets.get('WS_BRIDGE_URL');
  //    const token = secrets.get('WS_BRIDGE_AUTH_TOKEN');
  //    await fetch(`${bridgeUrl}/play`, { method: 'POST', headers: {...}, body: JSON.stringify({ streamSid, payload }) });
  // 6. Clear the audio buffer
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