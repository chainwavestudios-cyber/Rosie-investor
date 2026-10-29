/**
 * videoQualify.ts — shared logic for the Vapi "Sarah" video qualification widget:
 * vault-token lead lookup, session records, the Vapi assistant payload, and the
 * Twilio live-transfer bridge. Used by vapiQualify, vapiWebhook and vapiBridgeTwiml.
 */
import { secrets } from 'base44:runtime';
import { toE164, twilioFetch, xmlEscape } from './twilioHelpers.ts';
import { PROTOFACE_ID_RE } from './protofaceId.ts';
import { getCalendarAuth, hasConflict, listEvents, nextBusinessSlot } from './googleCalendarHelpers.ts';
import saveCalendarAppointment from './saveCalendarAppointment.ts';
import { objectionSkillForPrompt } from './rosieObjections.ts';

export const FALLBACK_APP_URL = 'https://rosieai-investorpage.base44.app';
export const VAPI_API = 'https://api.vapi.ai';
export const ASSISTANT_NAME = 'Sarah - Debt Video Qualifier';
export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
export const DEFAULT_CARTESIA_VOICE_ID = '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc';
export const TRIGGER_TOOL_NAME = 'trigger_sales_call';
export const NOTICE_ID_RE = /^[A-Za-z]{2,5}-\d{5}-\d{3}$/;

export const FIRST_MESSAGE = "Hey {{name}}! I'm Sarah. I was just reviewing your profile inside the system. I noticed you're navigating some tough credit card balances over in {{state}}, and I wanted to see if we can help you wipe them out. To make sure you qualify for our programmatic relief, do you currently owe more than $10,000 across your accounts?";

export const SYSTEM_PROMPT = `You are Sarah, an empathetic, clear, and highly professional financial assistant qualifying leads for a debt relief program. Your tone must be warm and human—never rigid or legalistic. You already know the user's name is {{name}} and their location is {{state}}.

Strict Execution Path:
1. Confirm total debt is over $10,000. If yes, validate their response empathetically ('I know how heavy that can feel, but you're in the right place') and move forward.
2. Ask them to narrow down their total card balance range ($10k-$20k, $20k-$40k, or $40k+).
3. Confirm their best contact phone number. Say: 'Perfect. Let me verify the best phone number to connect you to our team right now.'

Operational Rules:
- Keep your spoken answers strictly under 2 short sentences. Short phrases keep the Protoface real-time video rendering buffer running flawlessly under 300ms latency.
- Never break character.
- Once the user explicitly speaks or types their phone number, immediately invoke the tool function trigger_sales_call to pass their record to our Twilio router. Conclude by saying: 'Awesome, hold on just one second while I patch you straight through to us!'`;

export const TRIGGER_TOOL = {
  type: 'function',
  function: {
    name: TRIGGER_TOOL_NAME,
    description: 'Triggers a Twilio bridge call to patch the qualified lead directly to the primary rep line once the phone number is collected.',
    parameters: {
      type: 'object',
      properties: {
        verified_phone: {
          type: 'string',
          description: 'The validated phone number provided by the user.',
        },
        debt_tier: {
          type: 'string',
          description: 'The selected range of debt: 10k-20k, 20k-40k, or 40k+',
        },
      },
      required: ['verified_phone', 'debt_tier'],
    },
  },
};

export function appBaseUrl(req: Request): string {
  return (req.headers.get('X-Base44-App-Url') || FALLBACK_APP_URL).replace(/\/+$/, '');
}

/** Cartesia (Sonic) is the default voice; ElevenLabs stays available as a fallback. */
function buildVoice(cfg: any) {
  if (String(cfg?.voiceProvider || 'cartesia') === 'cartesia') {
    return { provider: 'cartesia', voiceId: cfg?.cartesiaVoiceId || DEFAULT_CARTESIA_VOICE_ID };
  }
  return { provider: '11labs', voiceId: cfg?.elevenLabsVoiceId || DEFAULT_VOICE_ID };
}

/** The assistant definition pushed to Vapi — the script content comes from the app's own config. */
export function buildAssistantPayload(cfg: any, baseUrl: string, objections: any[] = []) {
  return {
    name: ASSISTANT_NAME,
    firstMessage: cfg?.firstMessage || FIRST_MESSAGE,
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: 'openai',
      model: cfg?.llmModel || 'gpt-4o',
      temperature: typeof cfg?.temperature === 'number' ? cfg.temperature : 0.6,
      // Her script, plus the objection-handling skill and the objections on file.
      messages: [{ role: 'system', content: `${cfg?.systemPrompt || SYSTEM_PROMPT}\n\n${objectionSkillForPrompt(objections)}` }],
      tools: [TRIGGER_TOOL],
    },
    voice: buildVoice(cfg),
    server: { url: `${baseUrl}/functions/vapiWebhook`, secret: secrets.get('VAPI_WEBHOOK_SECRET') || '' },
  };
}

export async function vapiFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${VAPI_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secrets.get('VAPI_PRIVATE_KEY') || ''}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Vapi error ${res.status}`);
  return data;
}

export async function loadConfig(base44: any): Promise<any> {
  const { items } = await base44.asServiceRole.entities.VideoQualifyConfig.filter({ configName: 'default' }, { limit: 1 });
  if (items && items[0]) return items[0];
  return await base44.asServiceRole.entities.VideoQualifyConfig.create({ configName: 'default' });
}

/**
 * The assistants a visitor can choose between. The config's own list wins; when it
 * is empty the widget keeps its single avatar, so an app with one face is unchanged.
 */
export function assistantList(cfg: any): any[] {
  let raw: any[] = [];
  try {
    const parsed = JSON.parse(String(cfg?.assistantsJson || '[]'));
    if (Array.isArray(parsed)) raw = parsed;
  } catch {
    raw = [];
  }
  const cleaned = raw
    .map((entry: any) => ({
      key: String(entry?.key || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      name: String(entry?.name || '').trim().slice(0, 40),
      avatarId: String(entry?.avatarId || '').trim().slice(0, 80),
      blurb: String(entry?.blurb || '').trim().slice(0, 120),
      voiceId: String(entry?.voiceId || '').trim().slice(0, 60),
      firstMessage: String(entry?.firstMessage || '').trim().slice(0, 1200),
    }))
    .filter((entry: any) => entry.key && entry.avatarId && entry.name);
  if (cleaned.length) return cleaned;

  const single = String(cfg?.protofaceAvatarId || '').trim();
  if (!single) return [];
  return [{
    key: 'default',
    name: String(cfg?.agentName || 'Stephani').trim().slice(0, 40) || 'Stephani',
    avatarId: single,
    blurb: '',
  }];
}

/** The assistant an invitation link or the visitor picked; anything unknown falls back to the first. */
export function resolveAssistant(cfg: any, key: string): any {
  const list = assistantList(cfg);
  const wanted = String(key || '').trim().toLowerCase();
  return list.find((entry: any) => entry.key === wanted) || list[0] || null;
}

/**
 * The voice an assistant speaks with — their own ElevenLabs voice when the assistant
 * carries one (matched by key or by the name stamped on the session), otherwise empty
 * so the widget's single voice is used.
 */
export function voiceForAssistant(cfg: any, keyOrName: string): string {
  const wanted = String(keyOrName || '').trim().toLowerCase();
  if (!wanted) return '';
  const entry = assistantList(cfg).find((a: any) => a.key === wanted || String(a.name || '').toLowerCase() === wanted);
  return String(entry?.voiceId || '').trim();
}

/**
 * The lip-sync pacing the widget runs on: how much audio is handed to the avatar at a time,
 * how long between chunks, and how long her voice waits before the visitor hears it.
 */
export const SPEECH_DEFAULTS = { chunkMs: 100, gapMs: 100, voiceDelayMs: 1200 };

export function speechTuning(cfg: any) {
  const num = (value: any, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  };
  return {
    chunkMs: num(cfg?.speechChunkMs, SPEECH_DEFAULTS.chunkMs, 20, 500),
    gapMs: num(cfg?.speechGapMs, SPEECH_DEFAULTS.gapMs, 0, 500),
    voiceDelayMs: num(cfg?.voiceDelayMs, SPEECH_DEFAULTS.voiceDelayMs, 0, 3000),
  };
}

/**
 * The email link carries the lead's Protoface ID, a vault entry id, or the
 * Notice ID printed on the notice.
 */
export async function resolveVaultLead(base44: any, token: string): Promise<any> {
  const t = String(token || '').trim();
  if (!t) return null;

  if (PROTOFACE_ID_RE.test(t)) {
    const vault = await base44.asServiceRole.entities.LeadVaultEntry.filter({ protofaceId: t }, { limit: 1 });
    if (vault?.items && vault.items[0]) return vault.items[0];
    const card = await base44.asServiceRole.entities.FronterLead.filter({ protofaceId: t }, { limit: 1 });
    if (card?.items && card.items[0]) return card.items[0];
    // A Debt Call Coach contact card carries its own token too (minted from the card).
    const coach = await base44.asServiceRole.entities.DebtLead.filter({ protofaceId: t }, { limit: 1 });
    return (coach?.items && coach.items[0]) || null;
  }

  if (!NOTICE_ID_RE.test(t)) {
    try {
      const rec = await base44.asServiceRole.entities.LeadVaultEntry.get(t);
      if (rec && rec.id) return rec;
    } catch {
      // fall through to the Notice ID lookup
    }
  }
  const { items } = await base44.asServiceRole.entities.LeadVaultEntry.filter({ noticeId: t }, { limit: 1 });
  return (items && items[0]) || null;
}

/**
 * The contact card behind an email link token. The video CTA is deliberately kept
 * out of the email provider's link tracking, so nothing reports it as a click —
 * the visit itself is what gets recorded, and this is how it finds its card.
 */
export async function contactCardForToken(base44: any, token: string): Promise<any> {
  const t = String(token || '').trim();
  if (!t) return null;
  if (PROTOFACE_ID_RE.test(t)) {
    const { items } = await base44.asServiceRole.entities.FronterLead.filter({ protofaceId: t }, { limit: 1 });
    if (items && items[0]) return items[0];
  }
  try {
    const card = await base44.asServiceRole.entities.FronterLead.get(t);
    if (card && card.id) return card;
  } catch {
    // the token is not a contact card id
  }
  return null;
}

/** Records that a prospect reached the qualification page. Never breaks the visitor's flow. */
export async function recordQualifyVisit(base44: any, card: any, req: Request): Promise<boolean> {
  if (!card?.id) return false;
  try {
    await base44.asServiceRole.entities.EmailTrackingEvent.create({
      leadId: card.id,
      eventType: 'qualify_visit',
      userAgent: req.headers.get('user-agent') || '',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
      trackedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('[videoQualify] qualification visit not recorded:', (error as Error).message);
    return false;
  }
}

/** Only what the widget needs — never the lead's email, address or phone. */
export function leadView(lead: any) {
  if (!lead) return null;
  return {
    id: lead.id || '',
    firstName: lead.firstName || '',
    state: lead.state || '',
    estimatedDebt: Number(lead.estimatedDebt || lead.debtAmount || 0) || 0,
  };
}

export async function startSession(base44: any, lead: any, source: string): Promise<any> {
  return await base44.asServiceRole.entities.VideoQualifySession.create({
    sessionToken: crypto.randomUUID(),
    vaultLeadId: lead?.id || '',
    leadName: lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : '',
    state: lead?.state || '',
    estimatedDebt: Number(lead?.estimatedDebt || lead?.debtAmount || 0) || 0,
    source: lead ? 'email_link' : source || 'landing_page',
    status: 'started',
  });
}

export async function findSession(base44: any, opts: { sessionToken?: string; vapiCallId?: string }): Promise<any> {
  const sessionToken = String(opts.sessionToken || '').trim();
  if (sessionToken) {
    const { items } = await base44.asServiceRole.entities.VideoQualifySession.filter({ sessionToken }, { limit: 1 });
    if (items && items[0]) return items[0];
  }
  const vapiCallId = String(opts.vapiCallId || '').trim();
  if (vapiCallId) {
    const { items } = await base44.asServiceRole.entities.VideoQualifySession.filter({ vapiCallId }, { limit: 1 });
    if (items && items[0]) return items[0];
  }
  return null;
}

export async function findSessionById(base44: any, id: string): Promise<any> {
  if (!id) return null;
  try {
    const rec = await base44.asServiceRole.entities.VideoQualifySession.get(id);
    return rec || null;
  } catch {
    return null;
  }
}

/**
 * The live transfer: calls the primary sales line first, then the TwiML whisper asks
 * the rep's leg to Dial the prospect's verified phone so both land in one conversation.
 */
export async function routeToSalesLine(
  base44: any,
  cfg: any,
  session: any,
  args: { phone?: string; debtTier?: string; baseUrl: string; mode?: string },
): Promise<any> {
  if (!session) throw new Error('This qualification session has expired.');
  const phone = toE164(args.phone || '');
  if (!/^\+\d{10,}$/.test(phone)) throw new Error('A complete 10-digit phone number is required.');
  const salesLine = toE164(cfg?.salesLine || '');
  if (!/^\+\d{10,}$/.test(salesLine)) throw new Error('The primary sales line is not configured yet.');
  const from = toE164(Deno.env.get('TWILIO_FROM_NUMBER') || '');
  const tier = String(args.debtTier || '').trim();
  const twimlUrl = `${args.baseUrl}/functions/vapiBridgeTwiml?session=${session.id}`;

  const call = await twilioFetch('/Calls.json', {
    method: 'POST',
    body: new URLSearchParams({
      To: salesLine,
      From: from,
      Url: twimlUrl,
      Method: 'POST',
      StatusCallback: `${twimlUrl}&status=1`,
      StatusCallbackEvent: 'completed',
      Timeout: '30',
    }).toString(),
  });

  await base44.asServiceRole.entities.VideoQualifySession.update(session.id, {
    verifiedPhone: phone,
    debtTier: tier,
    mode: args.mode || 'voice',
    status: 'routing',
    twilioCallSid: call.sid || '',
    routedAt: new Date().toISOString(),
    error: '',
  });

  // Qualified Lead — Call Routing
  if (session.vaultLeadId) {
    await base44.asServiceRole.entities.LeadVaultEntry.update(session.vaultLeadId, { pipelineStatus: 'transferred' });
  }

  return { callSid: call.sid || '', status: 'routing' };
}

const SESSION_STATUS_BY_CALL: Record<string, string> = {
  queued: 'routing',
  initiated: 'routing',
  ringing: 'routing',
  'in-progress': 'bridged',
  answered: 'bridged',
  completed: 'bridged',
  'no-answer': 'no_answer',
  busy: 'no_answer',
  canceled: 'no_answer',
  failed: 'failed',
};

export function sessionStatusForCallStatus(callStatus: string): string {
  return SESSION_STATUS_BY_CALL[String(callStatus || '').toLowerCase()] || 'bridged';
}

/** The coach's copy of the conversation. Capped — a long call must stay inside the record limit. */
export const TRANSCRIPT_LIMIT = 12000;

export function transcriptText(transcript: any): string {
  if (typeof transcript === 'string') return transcript.trim().slice(0, TRANSCRIPT_LIMIT);
  if (!Array.isArray(transcript)) return '';
  return transcript
    .map((line) => `${line?.role === 'user' ? 'Prospect' : line?.role === 'agent' ? 'Agent' : 'Note'}: ${String(line?.text || '').trim()}`)
    .filter((line) => line.length > 8)
    .join('\n')
    .slice(0, TRANSCRIPT_LIMIT);
}

const TIER_DEBT: Record<string, number> = { '10k-20k': 15000, '20k-40k': 30000, '40k+': 50000 };

/** The Debt Call Coach contact card already on file for this phone or email. */
export async function findCoachCard(base44: any, opts: { phone?: string; email?: string }): Promise<any> {
  const phone = String(opts.phone || '').trim();
  if (phone) {
    const { items } = await base44.asServiceRole.entities.DebtLead.filter({ phone }, { limit: 1 });
    if (items && items[0]) return items[0];
  }
  const email = String(opts.email || '').trim();
  if (email) {
    const { items } = await base44.asServiceRole.entities.DebtLead.filter({ email }, { limit: 1 });
    if (items && items[0]) return items[0];
  }
  return null;
}

/**
 * What a finished video qualification leaves behind: a contact card in the Debt
 * Call Coach, the transcript on it, and — unless the prospect was already patched
 * through to a specialist live — the follow-up call on the calendar.
 */
export async function finishQualification(
  base44: any,
  session: any,
  args: { phone?: string; debtTier?: string; transcript?: any; bridged?: boolean; agentName?: string; actor?: string },
): Promise<any> {
  if (!session) throw new Error('This qualification session has expired.');
  const vault = session.vaultLeadId
    ? await base44.asServiceRole.entities.LeadVaultEntry.get(session.vaultLeadId).catch(() => null)
    : null;

  const phone = toE164(args.phone || vault?.phone || session.verifiedPhone || '');
  const debtTier = String(args.debtTier || session.debtTier || '').trim();
  const transcript = transcriptText(args.transcript);
  if (!phone && !debtTier && !transcript) return { skipped: true, reason: 'Nothing was captured on this call.' };

  const agent = String(args.agentName || 'Stephani');
  const nameParts = String(vault?.firstName || session.leadName || '').trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || 'Video';
  const lastName = nameParts.slice(1).join(' ') || 'Prospect';
  const fullName = `${firstName} ${lastName}`;
  const now = new Date().toISOString();
  const existing = await findCoachCard(base44, { phone, email: vault?.email });
  const estimate = TIER_DEBT[debtTier] || Number(vault?.debtAmount || vault?.estimatedDebt || session.estimatedDebt || 0) || 0;
  const notes = [
    `Video qualification with ${agent} (debt range ${debtTier || 'not captured'}).`,
    phone ? `Best number: ${phone}` : '',
    args.bridged ? 'Patched straight through to a specialist during the call.' : 'Follow-up call booked on the calendar.',
    vault?.noticeId ? `Notice ${vault.noticeId}` : '',
  ].filter(Boolean).join('\n');
  const transcriptJson = transcript
    ? JSON.stringify({ at: now, source: 'video_qualification', lines: transcript })
    : existing?.transcriptJson || '';

  const card = existing
    ? await base44.asServiceRole.entities.DebtLead.update(existing.id, {
        phone: existing.phone || phone,
        email: existing.email || vault?.email || '',
        state: existing.state || vault?.state || session.state || '',
        status: existing.status === 'enrolled' ? existing.status : 'qualified',
        notes: existing.notes || notes,
        debtAmount: existing.debtAmount || estimate || undefined,
        transcriptJson,
        rosieAiAssistant: agent,
        lastCallAt: now,
        callCount: Number(existing.callCount || 0) + 1,
      })
    : await base44.asServiceRole.entities.DebtLead.create({
        firstName,
        lastName,
        phone,
        email: vault?.email || '',
        state: vault?.state || session.state || '',
        debtAmount: estimate || undefined,
        status: 'qualified',
        notes,
        transcriptJson,
        rosieAiAssistant: agent,
        lastCallAt: now,
        callCount: 1,
      });

  await base44.asServiceRole.entities.DebtLeadActivity.create({
    leadId: card.id,
    leadName: fullName,
    activityType: 'call',
    activityText: `${agent} video qualification — debt ${debtTier || 'range not captured'}${args.bridged ? ', patched through live' : ''}`,
    createdBy: args.actor || 'stephani-video',
    metadataJson: JSON.stringify({ sessionId: session.id, bridged: !!args.bridged, phone }),
  });

  let appointment: any = null;
  if (!args.bridged && (phone || card.phone)) {
    try {
      const authHeader = await getCalendarAuth(base44);
      const from = new Date(Date.now() + 30 * 60 * 1000);
      const events = await listEvents(authHeader, from.toISOString(), new Date(from.getTime() + 21 * 24 * 3600 * 1000).toISOString(), 250);
      const slot = nextBusinessSlot(events, from);
      if (slot) {
        const saved = await saveCalendarAppointment(
          base44,
          { leadId: card.id, startISO: slot.start.toISOString(), title: `Debt relief follow-up — ${fullName}`, duration: 30 },
          authHeader,
          args.actor || 'stephani-video',
        );
        const savedBody = await saved.json().catch(() => ({}));
        if (saved.ok) appointment = { startISO: slot.start.toISOString(), htmlLink: savedBody?.lead?.appointmentEventHtmlLink || '' };
        else console.error('[videoQualify] appointment not booked:', savedBody?.error || saved.status);
      }
    } catch (error) {
      console.error('[videoQualify] appointment not booked:', (error as Error).message);
    }
  }

  return { ok: true, cardId: card.id, phone, appointment };
}

/** The rep's leg: whisper the context, then join the prospect into the same call. */
export function bridgeTwiml(cfg: any, session: any, from: string): string {
  const phone = String(session?.verifiedPhone || '');
  const head = '<?xml version="1.0" encoding="UTF-8"?>';
  if (!/^\+\d{10,}$/.test(phone)) {
    return `${head}<Response><Say>This transfer is no longer available.</Say></Response>`;
  }
  const whisper = String(cfg?.bridgeWhisper || 'Live transfer from Sarah. A qualified client is on the line. Connecting you now.');
  const tierLine = session?.debtTier ? ` Debt range ${session.debtTier}.` : '';
  return `${head}<Response><Say voice="Polly.Joanna">${xmlEscape(whisper + tierLine)}</Say>` +
    `<Dial callerId="${xmlEscape(from)}" timeout="30"><Number>${xmlEscape(phone)}</Number></Dial>` +
    `<Say voice="Polly.Joanna">The client did not answer. Goodbye.</Say></Response>`;
}