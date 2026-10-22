/**
 * homeQualifyChat — the public website assistant on the homepage.
 *
 *   chat         — answers the visitor from the knowledge base and qualifies them
 *                  (first name, state, debt range).
 *   request_call — saves the prospect on a contact card, then dials the outbound
 *                  AI agent (aiAgentDial → dialerVoiceHandler Mode=aiAgent), which
 *                  drops them into the welcome/queue hold and merges the advisor in.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assignNoticeIds } from '../../shared/noticeId.ts';
import { formatAnswers, findRelevantKB } from '../../shared/kbSearch.ts';

const KB_NAME = 'Debt Settlement';
const KB_LIMIT = 400;
const TOP_MATCHES = 6;
const DIAL_COOLDOWN_MINUTES = 10;

const TIERS = ['Less than $20,000', '$20,000 - $40,000', 'More than $40,000'];

const TIER_DEBT: Record<string, number> = {
  'Less than $20,000': 15000,
  '$20,000 - $40,000': 30000,
  'More than $40,000': 50000,
};

function normalizePhone(raw: any): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (/^\+[1-9]\d{7,14}$/.test(String(raw || '').trim())) return String(raw).trim();
  return '';
}

async function kbContext(service: any, question: string): Promise<string> {
  let entries: any[] = [];
  try {
    const [kb, fronter] = await Promise.all([
      service.entities.KnowledgeBase.filter({ kbName: KB_NAME }, '-created_date', KB_LIMIT).catch(() => []),
      service.entities.FronterKnowledgeBase.list('-created_date', KB_LIMIT).catch(() => []),
    ]);
    entries = [...(kb || []), ...(fronter || [])];
  } catch {
    entries = [];
  }
  const matches = findRelevantKB(question, entries, TOP_MATCHES);
  if (matches.length === 0) return '';
  return matches.map((e: any) => `Q: ${e.question}\nA: ${formatAnswers(e)}`).join('\n\n');
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'chat';
    const service = base44.asServiceRole;

    // ── request_call: save the card, then dial the outbound AI agent ──────────
    if (action === 'request_call') {
      const firstName = String(body?.firstName || '').trim().slice(0, 60);
      const lastName = String(body?.lastName || '').trim().slice(0, 60);
      const state = String(body?.state || '').trim().slice(0, 20).toUpperCase();
      const debtTier = TIERS.includes(body?.debtTier) ? body.debtTier : '';
      const notes = String(body?.notes || '').slice(0, 3000);
      const phone = normalizePhone(body?.phone);

      if (body?.consent !== true) {
        return Response.json({ ok: false, error: 'Please agree to be contacted by phone before we call you.' }, { status: 400 });
      }
      if (!firstName) return Response.json({ ok: false, error: 'We need your first name before we call.' }, { status: 400 });
      if (!phone) return Response.json({ ok: false, error: 'Enter a valid 10-digit US phone number.' }, { status: 400 });

      // One dial per number per cooldown window — the page is public.
      const existing = await service.entities.FronterLead.filter({ phone }, '-created_date', 5).catch(() => []);
      const dialedRecently = (existing || []).some((lead: any) => {
        if (!lead?.lastCalledAt) return false;
        return Date.now() - new Date(lead.lastCalledAt).getTime() < DIAL_COOLDOWN_MINUTES * 60000;
      });
      if (dialedRecently) {
        return Response.json({
          ok: false,
          alreadyCalled: true,
          message: `We already placed a call to ${phone} in the last few minutes. Please answer that call, or try again shortly.`,
        });
      }

      const debtAmount = debtTier ? TIER_DEBT[debtTier] : undefined;
      const summary = `Requested a call from the website chat on ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET.\nDebt range given: ${debtTier || 'not given'}\nPhone consent given: yes\n\nChat:\n${notes}`;

      let lead = (existing || [])[0] || null;
      try {
        if (lead) {
          lead = await service.entities.FronterLead.update(lead.id, {
            firstName: firstName || lead.firstName,
            lastName: lastName || lead.lastName,
            state: state || lead.state,
            debtAmount: debtAmount || lead.debtAmount,
            status: 'prospect',
            callStatus: 'web_chat_call',
            notes: summary,
          });
        } else {
          const latest = await service.entities.FronterLead.list('-created_date', 1);
          const lastNumber = latest?.[0]?.leadNumber ? parseInt(String(latest[0].leadNumber).replace(/\D/g, ''), 10) + 1 : 1;
          const [noticeId] = await assignNoticeIds(service, 1);
          lead = await service.entities.FronterLead.create({
            leadNumber: `#F${String(lastNumber).padStart(4, '0')}`,
            noticeId,
            firstName,
            lastName,
            phone,
            state,
            debtAmount,
            status: 'prospect',
            callStatus: 'web_chat_call',
            referralSource: 'Website chat',
            assignedTo: 'web_chat',
            assignedAt: new Date().toISOString(),
            assignedBy: 'web_chat',
            uploadedBy: 'web_chat',
            notes: summary,
          });
        }
      } catch (error: any) {
        console.error('[homeQualifyChat] Could not save the contact card:', error?.message);
      }

      // Dial the AI agent — it opens the call, then hands off to the welcome
      // queue and merges the advisor in (dialerVoiceHandler Mode=aiAgent).
      try {
        const response = await service.functions.invoke('aiAgentDial', {
          action: 'startDial',
          phone,
          firstName,
          lastName,
          state,
          debtAmount,
          leadId: lead?.id || '',
          adminUsername: 'web_chat',
        });
        const data = response?.data ?? response ?? {};
        if (data?.error || data?.ok === false) {
          return Response.json({ ok: false, error: data.error || 'The call could not be placed.', message: data.message || '' }, { status: 200 });
        }
        return Response.json({
          ok: true,
          leadNumber: lead?.leadNumber || data?.leadNumber || null,
          message: 'Calling you now — pick up and stay on the line. We will bring a specialist in with you.',
        });
      } catch (error: any) {
        const detail = error?.response?.data || {};
        console.error('[homeQualifyChat] Dial failed:', error?.message);
        return Response.json({
          ok: false,
          error: detail.error || error?.message || 'The call could not be placed.',
          message: detail.message || 'You are saved on our list — a specialist will call you shortly.',
        }, { status: 200 });
      }
    }

    // ── chat: answer from the KB and qualify ─────────────────────────────────
    const message = String(body?.message || '').trim().slice(0, 1200);
    if (!message) return Response.json({ error: 'message required' }, { status: 400 });

    const history = Array.isArray(body?.history) ? body.history.slice(-12) : [];
    const prior = body?.collected || {};
    const context = await kbContext(service, message);

    const result = await service.integrations.Core.InvokeLLM({
      prompt: `You are the website assistant for Debt Solutions, a debt relief company helping people with credit card debt. You are warm, plain-spoken and brief: 1-3 short sentences, plain prose, no markdown, no emojis, never use an em dash.

TWO JOBS
1. Answer the visitor's questions using the knowledge base excerpts below as your primary source. If the knowledge base does not cover it, say a specialist will cover it on their call — do not invent program details.
2. Qualify them: find out their first name, their state, and roughly how much credit card debt they have. Ask for ONE missing detail per message, conversationally.

FACTS YOU MAY STATE
- The program is for people carrying $10k to $250k of credit card debt.
- The evaluation is free and there is no obligation.
- We work on eligible unsecured credit card debt; a specialist reviews the accounts and the plan with them.
- Results vary and we never promise a specific savings figure or outcome.

NEVER
- Never promise a specific reduction, approval or savings amount.
- Never ask for a Social Security number, bank login or card number.
- Never give legal, tax or credit-repair advice.

MOVING TO A CALL
Once you know their first name and their debt range and they have not said they are not interested, tell them a specialist can call them right now and set "interested" to true. If they decline, set "interested" to false and keep helping them with questions.

ALREADY KNOWN ABOUT THIS VISITOR
first name: ${prior.firstName || 'unknown'}
state: ${prior.state || 'unknown'}
debt range: ${prior.debtTier || 'unknown'}

KNOWLEDGE BASE EXCERPTS
${context || '(nothing matched this question)'}

CONVERSATION SO FAR
${history.map((h: any) => `${h.role === 'user' ? 'Visitor' : 'Assistant'}: ${h.content}`).join('\n') || '(no earlier messages)'}

VISITOR JUST SAID: ${message}

Return JSON with:
- reply: your next message to the visitor
- quickReplies: 2-3 very short suggested replies for the visitor, or an empty array
- firstName: their first name if now known, otherwise empty string
- lastName: their last name if known, otherwise empty string
- state: their US state if known, otherwise empty string
- debtTier: exactly one of "Less than $20,000", "$20,000 - $40,000", "More than $40,000" if known, otherwise empty string
- interested: true only if they have not declined a call and you have their name and debt range`,
      response_json_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string' },
          quickReplies: { type: 'array', items: { type: 'string' } },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          state: { type: 'string' },
          debtTier: { type: 'string' },
          interested: { type: 'boolean' },
        },
      },
    });

    const data = result || {};
    const collected: Record<string, any> = {
      firstName: String(data.firstName || '').trim() || prior.firstName || '',
      lastName: String(data.lastName || '').trim() || prior.lastName || '',
      state: String(data.state || '').trim().toUpperCase() || prior.state || '',
      debtTier: TIERS.includes(data.debtTier) ? data.debtTier : (prior.debtTier && TIERS.includes(prior.debtTier) ? prior.debtTier : ''),
    };
    if (data.interested === false) collected.interested = false;
    else if (data.interested === true) collected.interested = true;
    else if (prior.interested !== undefined) collected.interested = prior.interested;

    const readyForCall = !!(collected.firstName && collected.debtTier && collected.interested !== false);

    return Response.json({
      reply: String(data.reply || 'Could you tell me that again?'),
      quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies.filter((q: any) => typeof q === 'string' && q.trim()).slice(0, 3) : [],
      collected,
      readyForCall,
    });
  } catch (error: any) {
    console.error('[homeQualifyChat] Error:', error?.message);
    return Response.json({ error: error?.message || 'The assistant is unavailable right now.' }, { status: 500 });
  }
}