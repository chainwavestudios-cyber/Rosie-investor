/**
 * videoQualify.ts — shared logic for the Vapi "Sarah" video qualification widget:
 * vault-token lead lookup, session records, the Vapi assistant payload, and the
 * Twilio live-transfer bridge. Used by vapiQualify, vapiWebhook and vapiBridgeTwiml.
 */
import { secrets } from 'base44:runtime';
import { toE164, twilioFetch, xmlEscape } from './twilioHelpers.ts';

export const FALLBACK_APP_URL = 'https://rosieai-investorpage.base44.app';
export const VAPI_API = 'https://api.vapi.ai';
export const ASSISTANT_NAME = 'Sarah - Debt Video Qualifier';
export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
export const TRIGGER_TOOL_NAME = 'trigger_sales_call';
export const NOTICE_ID_RE = /^[A-Za-z]{2,5}-\d{5}-\d{3}$/;

export const FIRST_MESSAGE = "Hey {{name}}! I'm Sarah. I was just reviewing your profile inside the system. I noticed you're navigating some tough credit card balances over in {{state}}, and I wanted to see if we can help you wipe them out. To make sure you qualify for our programmatic relief, do you currently owe more than $5,000 across your accounts?";

export const SYSTEM_PROMPT = `You are Sarah, an empathetic, clear, and highly professional financial assistant qualifying leads for a debt relief program. Your tone must be warm and human—never rigid or legalistic. You already know the user's name is {{name}} and their location is {{state}}.

Strict Execution Path:
1. Confirm total debt is over $5,000. If yes, validate their response empathetically ('I know how heavy that can feel, but you're in the right place') and move forward.
2. Ask them to narrow down their total card balance range ($5k-$10k, $10k-$20k, or $20k+).
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
      type: 'OBJECT',
      properties: {
        verified_phone: {
          type: 'STRING',
          description: 'The validated phone number provided by the user.',
        },
        debt_tier: {
          type: 'STRING',
          description: 'The selected range of debt: 5k-10k, 10k-20k, or 20k+',
        },
      },
      required: ['verified_phone', 'debt_tier'],
    },
  },
};

export function appBaseUrl(req: Request): string {
  return (req.headers.get('X-Base44-App-Url') || FALLBACK_APP_URL).replace(/\/+$/, '');
}

/** The assistant definition pushed to Vapi — the script content comes from the app's own config. */
export function buildAssistantPayload(cfg: any, baseUrl: string) {
  return {
    name: ASSISTANT_NAME,
    firstMessage: cfg?.firstMessage || FIRST_MESSAGE,
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: 'openai',
      model: cfg?.llmModel || 'gpt-4o',
      temperature: typeof cfg?.temperature === 'number' ? cfg.temperature : 0.6,
      messages: [{ role: 'system', content: cfg?.systemPrompt || SYSTEM_PROMPT }],
      tools: [TRIGGER_TOOL],
    },
    voice: { provider: 'elevenlabs', voiceId: cfg?.elevenLabsVoiceId || DEFAULT_VOICE_ID },
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

/** The email link carries the vault entry id (or the Notice ID printed on the notice). */
export async function resolveVaultLead(base44: any, token: string): Promise<any> {
  const t = String(token || '').trim();
  if (!t) return null;
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