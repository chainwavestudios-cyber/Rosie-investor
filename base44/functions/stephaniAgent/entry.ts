/**
 * stephaniAgent — the brain and the voice of the video qualifier when the avatar runs
 * on our own agent loop instead of Protoface's hosted assistant. The avatar only
 * renders the face; every word she says comes from here, and the knowledge base is
 * what she answers from.
 *
 *  action: 'room'          — hands the page its short-lived video-room passes and the
 *                            opening line, and marks the session live.
 *  action: 'createSession' — starts the Protoface avatar session in that room (called by
 *                            the page's avatar client, so the Protoface key stays here).
 *  action: 'endSession'    — ends that avatar session.
 *  action: 'reply'         — what she says next: our LLM grounded in the knowledge base.
 *  action: 'speak'         — her voice: 16 kHz audio bytes for the avatar to lip-sync.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { mintRoomPass } from '../../shared/livekitToken.ts';
import { getSpeechPcmBase64, PCM_SAMPLE_RATE } from '../../shared/elevenLabsTts.ts';
import { findRelevantKB, formatAnswers } from '../../shared/kbSearch.ts';
import { toE164 } from '../../shared/twilioHelpers.ts';
import { SYSTEM_PROMPT, findSession, leadView, loadConfig } from '../../shared/videoQualify.ts';

const PROTOFACE_API = 'https://api.protoface.com';
const DEFAULT_VOICE_ID = 'ogwqBH5bbF03DSbNiRNN';
const DEFAULT_KB = 'Debt Settlement';
const KB_LIMIT = 400;
const TOP_MATCHES = 6;
const MAX_SESSION_SECONDS = 900;
const IDLE_SECONDS = 120;
const HISTORY_TURNS = 10;
const TIERS = ['5k-10k', '10k-20k', '20k+'];

function clean(value: any, max: number): string {
  return String(value || '').trim().slice(0, max);
}

/** The one line she opens with, personalised from the lead's own record. */
function openingLine(cfg: any, lead: any, session: any): string {
  const firstName = lead?.firstName || String(session?.leadName || '').split(' ')[0] || 'there';
  const stateName = lead?.state || session?.state || 'your area';
  return String(cfg?.firstMessage || '')
    .replace(/\{\{\s*name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*state\s*\}\}/gi, stateName)
    .trim();
}

async function knowledgeContext(service: any, kbName: string, question: string): Promise<string> {
  let entries: any[] = [];
  try {
    const [kb, fronter] = await Promise.all([
      service.entities.KnowledgeBase.filter({ kbName }, '-created_date', KB_LIMIT).catch(() => []),
      service.entities.FronterKnowledgeBase.list('-created_date', KB_LIMIT).catch(() => []),
    ]);
    entries = [...(kb || []), ...(fronter || [])];
  } catch {
    entries = [];
  }
  const matches = findRelevantKB(question, entries, TOP_MATCHES);
  return matches.map((entry: any) => `Q: ${entry.question}\nA: ${formatAnswers(entry)}`).join('\n\n');
}

function replyPrompt(args: {
  agentName: string;
  script: string;
  lead: any;
  session: any;
  text: string;
  history: any[];
  context: string;
}): string {
  const firstName = args.lead?.firstName || String(args.session?.leadName || '').split(' ')[0] || 'the prospect';
  const stateName = args.lead?.state || args.session?.state || 'unknown';
  const history = args.history
    .map((turn: any) => `${turn?.role === 'user' ? 'Prospect' : 'You'}: ${clean(turn?.text, 400)}`)
    .join('\n');

  return `You are ${args.agentName}, speaking out loud on a live video call with a debt-relief prospect. Warm, plain-spoken, human. One or two short sentences, everyday words, no lists, no markdown, no emojis, never an em dash. Short answers matter: they keep the video in perfect sync.

YOUR SCRIPT
${args.script}

WHAT YOU ALREADY KNOW
- Prospect first name: ${firstName}
- State: ${stateName}
- Debt range on file: ${args.session?.debtTier || 'not established yet'}
- Phone number on file: ${args.session?.verifiedPhone || 'not given yet'}

HARD RULES
- Never promise a specific reduction, approval or savings amount.
- Never ask for a Social Security number, a bank login, a card number or a date of birth.
- Never invent programme details. If the knowledge base below does not cover something, say a specialist will go over it with them.
- Say amounts as words, never symbols: "five to ten thousand dollars", "ten to twenty thousand", "more than twenty thousand".
- Ask for at most one thing in a reply, and never repeat a question they have already answered.

KNOWLEDGE BASE EXCERPTS
${args.context || '(nothing matched what they said)'}

CONVERSATION SO FAR
${history || '(this is the start of the call)'}

PROSPECT JUST SAID: ${args.text}

Return JSON:
- say: exactly the words you speak next, in your own voice.
- debtTier: one of "5k-10k", "10k-20k", "20k+" once they have told you their range, otherwise an empty string.
- phone: the 10-digit phone number they just gave you, otherwise an empty string.`;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'room');
    const service = base44.asServiceRole;
    const cfg = await loadConfig(base44);
    const token = clean(body.sessionToken, 80);
    const session = token ? await findSession(base44, { sessionToken: token }) : null;

    // ── room: the credentials the page joins with, plus her opening line ──────
    if (action === 'room') {
      if (!session) return Response.json({ error: 'This call session has expired.' }, { status: 404 });
      const avatarId = clean(cfg.protofaceAvatarId, 80);
      if (!avatarId) return Response.json({ error: 'No avatar is set for the video widget yet.' }, { status: 400 });

      const pass = await mintRoomPass(`qualify-${session.sessionToken}`, `prospect-${session.sessionToken}`);
      const lead = session.vaultLeadId
        ? await service.entities.LeadVaultEntry.get(session.vaultLeadId).catch(() => null)
        : null;

      if (session.status !== 'bridged') {
        await service.entities.VideoQualifySession.update(session.id, { mode: 'voice', status: 'in_progress' }).catch(() => null);
      }

      return Response.json({
        ok: true,
        ...pass,
        avatarId,
        agentName: clean(cfg.agentName, 40) || 'Stephani',
        voiceId: clean(cfg.agentVoiceId, 60) || clean(cfg.elevenLabsVoiceId, 60) || DEFAULT_VOICE_ID,
        kbName: clean(cfg.kbName, 60) || DEFAULT_KB,
        opening: openingLine(cfg, lead, session),
        lead: leadView(lead),
      });
    }

    // ── createSession: bring the avatar itself into the room ─────────────────
    if (action === 'createSession') {
      if (!session) return Response.json({ error: 'This call session has expired.' }, { status: 404 });
      const apiKey = String(secrets.get('PROTOFACE_API_KEY') || '').trim();
      if (!apiKey) return Response.json({ error: 'The avatar service key is not set yet.' }, { status: 500 });

      const expectedRoom = `qualify-${session.sessionToken}`;
      const roomName = clean(body.roomName, 120);
      const livekitUrl = clean(body.livekitUrl, 200);
      if (roomName !== expectedRoom || livekitUrl !== clean(secrets.get('LIVEKIT_URL'), 200)) {
        return Response.json({ error: 'That call room is not valid.' }, { status: 400 });
      }

      const res = await fetch(`${PROTOFACE_API}/v1/sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatar_id: clean(body.avatarId, 80) || clean(cfg.protofaceAvatarId, 80),
          transport: {
            type: 'livekit',
            url: livekitUrl,
            room_name: roomName,
            worker_token: clean(body.workerToken, 4000),
            worker_identity: clean(body.workerIdentity, 80) || undefined,
            audio_source: 'data_stream',
          },
          quality: 'standard',
          max_duration_seconds: MAX_SESSION_SECONDS,
          idle_timeout_seconds: IDLE_SECONDS,
          metadata: { sessionToken: session.sessionToken },
        }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.error?.message || `The avatar could not join the call (${res.status}).`;
        console.error('[stephaniAgent] avatar session failed:', res.status, data?.error?.code, detail);
        return Response.json({ ok: false, error: detail, protofaceStatus: res.status, protofaceCode: data?.error?.code || '' });
      }
      return Response.json({ ok: true, session: data });
    }

    // ── endSession: take the avatar out of the room ─────────────────────────
    if (action === 'endSession') {
      const apiKey = String(secrets.get('PROTOFACE_API_KEY') || '').trim();
      const sessionId = clean(body.sessionId, 120);
      if (apiKey && sessionId) {
        await fetch(`${PROTOFACE_API}/v1/sessions/${encodeURIComponent(sessionId)}/end`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(15000),
        }).catch(() => null);
      }
      return Response.json({ ok: true });
    }

    // ── speak: her voice, as raw audio for the avatar to lip-sync ───────────
    if (action === 'speak') {
      const text = clean(body.text, 600);
      if (!text) return Response.json({ error: 'text is required.' }, { status: 400 });
      const voiceId = clean(cfg.agentVoiceId, 60) || clean(cfg.elevenLabsVoiceId, 60) || DEFAULT_VOICE_ID;
      const speech = await getSpeechPcmBase64(text, voiceId);
      if (!speech) return Response.json({ error: 'Her voice is unavailable right now.' }, { status: 502 });
      return Response.json({ ok: true, audio: speech.audio, sampleRate: speech.sampleRate || PCM_SAMPLE_RATE });
    }

    // ── reply: what she says next, answered from the knowledge base ─────────
    if (action === 'reply') {
      if (!session) return Response.json({ error: 'This call session has expired.' }, { status: 404 });
      const text = clean(body.text, 1200);
      if (!text) return Response.json({ error: 'text is required.' }, { status: 400 });

      const history = Array.isArray(body.history) ? body.history.slice(-HISTORY_TURNS) : [];
      const lead = session.vaultLeadId
        ? await service.entities.LeadVaultEntry.get(session.vaultLeadId).catch(() => null)
        : null;
      const context = await knowledgeContext(service, clean(cfg.kbName, 60) || DEFAULT_KB, text);

      const result: any = await service.integrations.Core.InvokeLLM({
        prompt: replyPrompt({
          agentName: clean(cfg.agentName, 40) || 'Stephani',
          script: clean(cfg.systemPrompt, 6000) || SYSTEM_PROMPT,
          lead,
          session,
          text,
          history,
          context,
        }),
        response_json_schema: {
          type: 'object',
          properties: {
            say: { type: 'string' },
            debtTier: { type: 'string' },
            phone: { type: 'string' },
          },
        },
      });

      const say = clean(result?.say, 800) || 'Sorry, could you say that once more for me?';
      // A figure or a number is only recorded when it really came out of their mouth.
      const tier = TIERS.includes(clean(result?.debtTier, 20)) ? clean(result.debtTier, 20) : '';
      const digits = String(result?.phone || '').replace(/\D/g, '');
      const phone = digits.length >= 10 && text.replace(/\D/g, '').includes(digits.slice(-10)) ? toE164(result.phone) : '';

      const patch: Record<string, any> = {};
      if (tier && tier !== session.debtTier) patch.debtTier = tier;
      if (phone && phone !== session.verifiedPhone) patch.verifiedPhone = phone;
      if (Object.keys(patch).length) {
        await service.entities.VideoQualifySession.update(session.id, patch).catch(() => null);
      }

      return Response.json({ ok: true, say, debtTier: tier, phone });
    }

    if (action === 'avatars') {
      const apiKey = String(secrets.get('PROTOFACE_API_KEY') || '').trim();
      const res = await fetch(`${PROTOFACE_API}/v1/avatars?limit=100`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20000),
      });
      const data: any = await res.json().catch(() => ({}));
      const rows = Array.isArray(data) ? data : data?.data || data?.items || [];
      return Response.json({
        ok: res.ok,
        status: res.status,
        total: rows.length,
        avatars: rows
          .filter((row: any) => !String(row?.id || '').startsWith('av_stock'))
          .slice(0, 20)
          .map((row: any) => ({ id: row?.id, name: row?.name, status: row?.status })),
        error: res.ok ? null : data?.error?.message || null,
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('[stephaniAgent] Error:', error?.message);
    return Response.json({ error: error?.message || 'The video assistant is unavailable right now.' }, { status: 500 });
  }
}