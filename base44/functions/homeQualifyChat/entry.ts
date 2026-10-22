/**
 * homeQualifyChat — the public website assistant on the homepage.
 *
 *   chat             — answers the visitor from the knowledge base and qualifies them
 *                      (first name, state, debt range). Every message is stored so the
 *                      command center can watch the conversation live.
 *   request_call     — saves the prospect on a contact card, then dials the outbound
 *                      AI agent (aiAgentDial → dialerVoiceHandler Mode=aiAgent), which
 *                      drops them into the welcome/queue hold and merges the advisor in.
 *   poll             — the visitor's browser asks whether a specialist has written.
 *   admin_overview   — the command center lists the live visitor chats.
 *   admin_transcript — the command center reads one visitor's conversation.
 *   takeover         — a specialist takes the chat over from the bot.
 *   agent_reply      — a specialist writes into the visitor's chat.
 *   handback / close — hand the chat back to the bot, or end the session.
 *
 * The command-center actions are gated on a live Debt Coach admin session
 * (DebtCoachUser.sessionToken), never on a username.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assignNoticeIds } from '../../shared/noticeId.ts';
import { formatAnswers, findRelevantKB } from '../../shared/kbSearch.ts';

const KB_NAME = 'Debt Settlement';
const KB_LIMIT = 400;
const TOP_MATCHES = 6;
const DIAL_COOLDOWN_MINUTES = 10;
const TRANSCRIPT_LIMIT = 120;
const MAX_SESSIONS = 20;
const ADMIN_ROLES = ['admin', 'super_admin'];
const ADMIN_ACTIONS = ['admin_overview', 'admin_transcript', 'takeover', 'agent_reply', 'handback', 'close', 'config_get', 'config_save'];

/**
 * The chatbot's questions and logic live in HomeChatConfig (one row, configName 'default')
 * and are edited on /adminfrontpage. Everything below is the fallback used when that row is
 * missing or a field is blank, so the widget keeps working untouched.
 */
type Question = { field: string; question: string; guidance: string };
type Range = { label: string; amount: number };

const DEFAULT_QUESTIONS: Question[] = [
  { field: 'name', question: 'First, what is your first and last name?', guidance: '' },
  { field: 'email', question: 'What is the best email address for you?', guidance: '' },
  { field: 'phone', question: 'What phone number should we call you on?', guidance: '' },
  { field: 'state', question: 'Which state do you live in?', guidance: '' },
  { field: 'debtTier', question: 'Roughly how much credit card debt are you carrying?', guidance: 'A ballpark figure is fine. Place a number they give into the range it falls in.' },
  { field: 'monthlyPayment', question: 'What do you pay in total each month across all your cards?', guidance: 'Tell them a ballpark figure is fine.' },
  { field: 'cardholderStatus', question: 'Are the cards in your name, or is there a co-signer on the accounts?', guidance: '' },
  { field: 'hardship', question: 'Have you had a hardship, such as a loss of a job, an injury, an illness, a divorce or childcare costs?', guidance: '' },
];

const DEFAULT_RANGES: Range[] = [
  { label: 'Less than $20,000', amount: 15000 },
  { label: '$20,000 - $40,000', amount: 30000 },
  { label: 'More than $40,000', amount: 50000 },
];

const DEFAULT_FACTS = [
  'The program is for people carrying $10k to $250k of credit card debt.',
  'The evaluation is free and there is no obligation.',
  'We work on eligible unsecured credit card debt; a specialist reviews the accounts and the plan with them.',
  'Results vary and we never promise a specific savings figure or outcome.',
];

const DEFAULT_PROHIBITIONS = [
  'Never promise a specific reduction, approval or savings amount.',
  'Never ask for a Social Security number, bank login or card number.',
  'Never give legal, tax or credit-repair advice.',
  'Never state, guess or suggest a name for the visitor. Do not use their first name until they have told it to you themselves, and never write a suggestion like "My name is Sarah" - you do not know their name.',
  'Never use a name for yourself. You are the Debt Solutions website assistant.',
];

const DEFAULT_ELIGIBILITY_LINE = 'It looks like you would be eligible for a federal program that can help you reduce your overall debt load, increase your cash flow, and make sure your payments go toward reducing the principal balance.';
const DEFAULT_CALL_OFFER = 'tell them a specialist can call them right now and set "interested" to true. Never set it before that line. If they decline, set "interested" to false and keep helping them with questions.';
const DEFAULT_OPENING = "Let's see what you may qualify for. First, what is your first and last name?";
const DEFAULT_WIDGET_TITLE = 'State Rate Reduction Qualification';
const DEFAULT_WIDGET_STATUS = 'Online · Live';
const DEFAULT_READY_FIELDS = ['name', 'debtTier'];

function parseJson(raw: any, fallback: any) {
  try {
    const value = JSON.parse(String(raw || ''));
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function questionList(raw: any): Question[] {
  const rows = parseJson(raw, []);
  const clean = (Array.isArray(rows) ? rows : [])
    .map((row: any) => ({
      field: String(row?.field || '').trim().slice(0, 40),
      question: String(row?.question || '').trim().slice(0, 400),
      guidance: String(row?.guidance || '').trim().slice(0, 400),
    }))
    .filter((row) => row.field && row.question);
  return clean.length ? clean.slice(0, 20) : DEFAULT_QUESTIONS;
}

function rangeList(raw: any): Range[] {
  const rows = parseJson(raw, []);
  const clean = (Array.isArray(rows) ? rows : [])
    .map((row: any) => ({
      label: String(row?.label || '').trim().slice(0, 60),
      amount: Number(row?.amount) > 0 ? Math.round(Number(row.amount)) : 0,
    }))
    .filter((row) => row.label);
  return clean.length ? clean.slice(0, 8) : DEFAULT_RANGES;
}

function stringList(raw: any, fallback: string[]): string[] {
  const rows = parseJson(raw, []);
  const clean = (Array.isArray(rows) ? rows : [])
    .map((row: any) => String(row || '').trim().slice(0, 300))
    .filter(Boolean);
  return clean.length ? clean.slice(0, 30) : fallback;
}

/** The chatbot's settings — every blank field falls back to the built-in default. */
function chatConfig(row: any) {
  const questions = questionList(row?.questionsJson);
  const ranges = rangeList(row?.debtRangesJson);
  const configured = stringList(row?.readyFieldsJson, []);
  const fields = questions.map((question) => question.field);
  const readyFields = (configured.length ? configured : DEFAULT_READY_FIELDS).filter((field) => fields.includes(field));
  return {
    widgetTitle: String(row?.widgetTitle || '').trim() || DEFAULT_WIDGET_TITLE,
    widgetStatusText: String(row?.widgetStatusText || '').trim() || DEFAULT_WIDGET_STATUS,
    openingMessage: String(row?.openingMessage || '').trim() || DEFAULT_OPENING,
    questions,
    ranges,
    tiers: ranges.map((range) => range.label),
    tierAmounts: Object.fromEntries(ranges.map((range) => [range.label, range.amount])),
    eligibilityLine: String(row?.eligibilityLine || '').trim() || DEFAULT_ELIGIBILITY_LINE,
    callOfferText: String(row?.callOfferText || '').trim() || DEFAULT_CALL_OFFER,
    facts: stringList(row?.factsJson, DEFAULT_FACTS),
    prohibitions: stringList(row?.prohibitionsJson, DEFAULT_PROHIBITIONS),
    readyFields: readyFields.length ? readyFields : DEFAULT_READY_FIELDS,
  };
}

async function loadChatConfig(service: any) {
  try {
    const rows = await service.entities.HomeChatConfig.filter({ configName: 'default' }, '-created_date', 1);
    return chatConfig((rows || [])[0] || null);
  } catch {
    return chatConfig(null);
  }
}

/** What the visitor has already told us, read by the question's field. */
function knownValue(collected: any, field: string): string {
  if (field === 'name') return [collected?.firstName, collected?.lastName].filter(Boolean).join(' ');
  return String(collected?.[field] || '').trim();
}

function knownLabel(field: string): string {
  const labels: Record<string, string> = {
    name: 'first and last name',
    debtTier: 'debt range',
    monthlyPayment: 'monthly payment',
    cardholderStatus: 'cards',
  };
  return labels[field] || field;
}

function normalizePhone(raw: any): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (/^\+[1-9]\d{7,14}$/.test(String(raw || '').trim())) return String(raw).trim();
  return '';
}

function cleanToken(raw: any): string {
  return String(raw || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);
}

function sessionLabel(firstName: any, lastName: any, token: string): string {
  const name = `${firstName || ''} ${lastName || ''}`.trim();
  if (name) return name;
  const short = cleanToken(token).slice(0, 4).toUpperCase();
  return short ? `Visitor ${short}` : 'New visitor';
}

async function verifyAdmin(service: any, userId: any, token: any): Promise<any | null> {
  if (!userId || !token) return null;
  try {
    const user = await service.entities.DebtCoachUser.get(String(userId));
    if (!user || !user.isActive || user.sessionToken !== token) return null;
    if (!ADMIN_ROLES.includes(user.role)) return null;
    return user;
  } catch {
    return null;
  }
}

async function findSession(service: any, token: string): Promise<any | null> {
  if (!token) return null;
  try {
    const rows = await service.entities.HomeChatSession.filter({ sessionToken: token }, '-created_date', 1);
    return (rows || [])[0] || null;
  } catch {
    return null;
  }
}

async function ensureSession(service: any, token: string, pagePath: string): Promise<any> {
  const existing = await findSession(service, token);
  if (existing) return existing;
  return await service.entities.HomeChatSession.create({
    sessionToken: token,
    status: 'bot',
    visitorLabel: sessionLabel('', '', token),
    pagePath: pagePath || '/',
    messageCount: 0,
    lastMessageAt: new Date().toISOString(),
    lastPreview: '',
  });
}

async function addMessage(service: any, token: string, role: string, text: string, authorName = ''): Promise<any> {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) return null;
  return await service.entities.HomeChatMessage.create({ sessionToken: token, role, text: clean, authorName });
}

function isCardId(value: string): boolean {
  return /^[a-f0-9]{16,32}$/i.test(value);
}

/** The fields the visitor is asked to confirm, read off their contact card. */
function cardProfile(card: any, source: string) {
  const apt = String(card?.apt || '').trim();
  const street = String(card?.address || '').trim();
  const address = [
    street,
    apt && apt.toUpperCase() !== 'N/A' ? apt : '',
    card?.city,
    [card?.state, card?.zipCode].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  return {
    id: card?.id || '',
    source,
    firstName: card?.firstName || '',
    lastName: card?.lastName || '',
    phone: card?.phone || '',
    address,
    state: card?.state || '',
    homeValue: typeof card?.homeValue === 'number' ? card.homeValue : null,
    linesOfCredit: typeof card?.tradelines === 'number' ? card.tradelines : null,
    noticeId: card?.noticeId || '',
    leadNumber: card?.leadNumber || '',
  };
}

/** Resolve whatever an email link carried (id, notice id, phone or email) to the visitor's card. */
async function findContactCard(service: any, candidates: string[]): Promise<any | null> {
  const first = async (entityName: string, query: any, source: string) => {
    try {
      const rows = await service.entities[entityName].filter(query, '-created_date', 3);
      if (rows?.length) return { card: rows[0], source };
    } catch {
      /* try the next shape */
    }
    return null;
  };

  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (!value) continue;

    if (isCardId(value)) {
      try {
        const card = await service.entities.FronterLead.get(value);
        if (card) return { card, source: 'contact_card' };
      } catch {
        /* not a contact card id */
      }
    }

    if (/^NFS-/i.test(value)) {
      const hit = await first('FronterLead', { noticeId: value.toUpperCase() }, 'contact_card');
      if (hit) return hit;
    }

    if (value.includes('@')) {
      const hit = await first('FronterLead', { email: value }, 'contact_card')
        || await first('FronterLead', { email: value.toLowerCase() }, 'contact_card')
        || await first('LeadVaultEntry', { email: value.toLowerCase() }, 'vault');
      if (hit) return hit;
    }

    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
      const last10 = digitsOnly.slice(-10);
      const hit = await first('FronterLead', { phone: last10 }, 'contact_card')
        || await first('FronterLead', { phone: `+1${last10}` }, 'contact_card')
        || await first('LeadVaultEntry', { phone: last10 }, 'vault')
        || await first('LeadVaultEntry', { phone: `+1${last10}` }, 'vault');
      if (hit) return hit;
    }

    if (isCardId(value)) {
      try {
        const entry = await service.entities.LeadVaultEntry.get(value);
        if (entry) return { card: entry, source: 'vault' };
      } catch {
        /* not a vault id */
      }
    }
  }

  return null;
}

function readMessage(row: any) {
  return {
    id: row.id,
    role: row.role,
    text: row.text || '',
    authorName: row.authorName || '',
    createdAt: row.created_date,
  };
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
      const cfg = await loadChatConfig(service);
      const firstName = String(body?.firstName || '').trim().slice(0, 60);
      const lastName = String(body?.lastName || '').trim().slice(0, 60);
      const state = String(body?.state || '').trim().slice(0, 20).toUpperCase();
      const debtTier = cfg.tiers.includes(body?.debtTier) ? body.debtTier : '';
      const email = String(body?.email || '').trim().slice(0, 120);
      const monthlyPayment = String(body?.monthlyPayment || '').trim().slice(0, 40);
      const cardholderStatus = String(body?.cardholderStatus || '').trim().slice(0, 40);
      const hardship = String(body?.hardship || '').trim().slice(0, 300);
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

      const debtAmount = debtTier ? cfg.tierAmounts[debtTier] : undefined;
      const summary = [
        `Requested a call from the website chat on ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET.`,
        `Email given: ${email || 'not given'}`,
        `Debt range given: ${debtTier || 'not given'}`,
        `Monthly payment across all cards: ${monthlyPayment || 'not given'}`,
        `Cards: ${cardholderStatus || 'not given'}`,
        `Hardship: ${hardship || 'not given'}`,
        'Phone consent given: yes',
        '',
        'Chat:',
        notes,
      ].join('\n');

      let lead = (existing || [])[0] || null;
      try {
        if (lead) {
          lead = await service.entities.FronterLead.update(lead.id, {
            firstName: firstName || lead.firstName,
            lastName: lastName || lead.lastName,
            email: email || lead.email,
            state: state || lead.state,
            debtAmount: debtAmount || lead.debtAmount,
            hardshipQualification: hardship || lead.hardshipQualification,
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
            email,
            state,
            debtAmount,
            hardshipQualification: hardship,
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

    // ── widget_config: the title and first line the visitor's widget shows ───
    if (action === 'widget_config') {
      const cfg = await loadChatConfig(service);
      return Response.json({
        widgetTitle: cfg.widgetTitle,
        widgetStatusText: cfg.widgetStatusText,
        openingMessage: cfg.openingMessage,
      });
    }

    // ── poll: the visitor's browser asks whether a specialist has written ─────
    if (action === 'poll') {
      const token = cleanToken(body?.sessionToken);
      if (!token) return Response.json({ status: 'bot', messages: [] });
      const session = await findSession(service, token);
      let rows: any[] = [];
      try {
        rows = (await service.entities.HomeChatMessage.filter({ sessionToken: token, role: 'specialist' }, 'created_date', 40)) || [];
      } catch {
        rows = [];
      }
      return Response.json({
        status: session?.status || 'bot',
        takenOverBy: session?.takenOverBy || '',
        messages: rows.map(readMessage),
      });
    }

    // ── the command center's live chat console ───────────────────────────────
    if (ADMIN_ACTIONS.includes(action)) {
      const admin = await verifyAdmin(service, body?.adminUserId, body?.adminToken);
      if (!admin) return Response.json({ error: 'Your admin session has expired — sign in again.' }, { status: 403 });

      // The chatbot's questions and logic, read and written by /adminfrontpage.
      if (action === 'config_get') {
        let row: any = null;
        try {
          const rows = await service.entities.HomeChatConfig.filter({ configName: 'default' }, '-created_date', 1);
          row = (rows || [])[0] || null;
        } catch {
          row = null;
        }
        return Response.json({
          config: chatConfig(row),
          saved: !!row,
          updatedBy: row?.updatedBy || '',
          updatedAt: row?.updatedAt || '',
        });
      }

      if (action === 'config_save') {
        const incoming = body?.config || {};
        const next = chatConfig({
          widgetTitle: incoming.widgetTitle,
          widgetStatusText: incoming.widgetStatusText,
          openingMessage: incoming.openingMessage,
          questionsJson: JSON.stringify(Array.isArray(incoming.questions) ? incoming.questions : []),
          debtRangesJson: JSON.stringify(Array.isArray(incoming.ranges) ? incoming.ranges : []),
          eligibilityLine: incoming.eligibilityLine,
          callOfferText: incoming.callOfferText,
          factsJson: JSON.stringify(Array.isArray(incoming.facts) ? incoming.facts : []),
          prohibitionsJson: JSON.stringify(Array.isArray(incoming.prohibitions) ? incoming.prohibitions : []),
          readyFieldsJson: JSON.stringify(Array.isArray(incoming.readyFields) ? incoming.readyFields : []),
        });
        const payload = {
          configName: 'default',
          widgetTitle: next.widgetTitle,
          widgetStatusText: next.widgetStatusText,
          openingMessage: next.openingMessage,
          questionsJson: JSON.stringify(next.questions),
          debtRangesJson: JSON.stringify(next.ranges),
          eligibilityLine: next.eligibilityLine,
          callOfferText: next.callOfferText,
          factsJson: JSON.stringify(next.facts),
          prohibitionsJson: JSON.stringify(next.prohibitions),
          readyFieldsJson: JSON.stringify(next.readyFields),
          updatedBy: admin.username,
          updatedAt: new Date().toISOString(),
        };
        let existing: any[] = [];
        try {
          existing = (await service.entities.HomeChatConfig.filter({ configName: 'default' }, '-created_date', 1)) || [];
        } catch {
          existing = [];
        }
        const saved: any = existing[0]
          ? await service.entities.HomeChatConfig.update(existing[0].id, payload)
          : await service.entities.HomeChatConfig.create(payload);
        return Response.json({
          ok: true,
          config: chatConfig(saved),
          updatedBy: payload.updatedBy,
          updatedAt: payload.updatedAt,
        });
      }

      if (action === 'admin_overview') {
        let rows: any[] = [];
        try {
          rows = (await service.entities.HomeChatSession.list('-lastMessageAt', 30)) || [];
        } catch {
          rows = [];
        }
        const sessions = (rows || [])
          .filter((s: any) => s.status !== 'closed')
          .slice(0, MAX_SESSIONS)
          .map((s: any) => ({
            sessionToken: s.sessionToken,
            visitorLabel: s.visitorLabel || sessionLabel(s.firstName, s.lastName, s.sessionToken),
            status: s.status || 'bot',
            firstName: s.firstName || '',
            lastName: s.lastName || '',
            state: s.state || '',
            debtTier: s.debtTier || '',
            messageCount: s.messageCount || 0,
            lastPreview: s.lastPreview || '',
            lastMessageAt: s.lastMessageAt || s.created_date,
            takenOverBy: s.takenOverBy || '',
          }));
        return Response.json({ sessions });
      }

      const token = cleanToken(body?.sessionToken);
      const session = await findSession(service, token);
      if (!session) return Response.json({ error: 'That visitor chat is no longer available.' }, { status: 404 });

      if (action === 'admin_transcript') {
        let rows: any[] = [];
        try {
          rows = (await service.entities.HomeChatMessage.filter({ sessionToken: token }, 'created_date', TRANSCRIPT_LIMIT)) || [];
        } catch {
          rows = [];
        }
        return Response.json({
          session: {
            sessionToken: session.sessionToken,
            visitorLabel: session.visitorLabel || '',
            status: session.status || 'bot',
            firstName: session.firstName || '',
            state: session.state || '',
            debtTier: session.debtTier || '',
            takenOverBy: session.takenOverBy || '',
            takenOverAt: session.takenOverAt || '',
            lastMessageAt: session.lastMessageAt || '',
          },
          messages: rows.map(readMessage),
        });
      }

      if (action === 'takeover') {
        await addMessage(
          service,
          token,
          'specialist',
          `Hi${session.firstName ? ` ${session.firstName}` : ''}, this is ${admin.username} with Debt Solutions. I have your details in front of me, so go ahead and ask me anything.`,
          admin.username,
        );
        await service.entities.HomeChatSession.update(session.id, {
          status: 'human',
          takenOverBy: admin.username,
          takenOverAt: new Date().toISOString(),
          lastMessageAt: new Date().toISOString(),
          lastPreview: `${admin.username} joined the chat`,
          messageCount: (session.messageCount || 0) + 1,
        });
        return Response.json({ ok: true, status: 'human' });
      }

      if (action === 'agent_reply') {
        const text = String(body?.text || '').trim().slice(0, 1500);
        if (!text) return Response.json({ error: 'Type a message first.' }, { status: 400 });
        await addMessage(service, token, 'specialist', text, admin.username);
        await service.entities.HomeChatSession.update(session.id, {
          status: 'human',
          takenOverBy: session.takenOverBy || admin.username,
          takenOverAt: session.takenOverAt || new Date().toISOString(),
          lastMessageAt: new Date().toISOString(),
          lastPreview: text.slice(0, 140),
          messageCount: (session.messageCount || 0) + 1,
        });
        return Response.json({ ok: true });
      }

      if (action === 'handback') {
        await service.entities.HomeChatSession.update(session.id, { status: 'bot', takenOverBy: '', takenOverAt: '' });
        return Response.json({ ok: true, status: 'bot' });
      }

      if (action === 'close') {
        await service.entities.HomeChatSession.update(session.id, { status: 'closed', closedAt: new Date().toISOString() });
        return Response.json({ ok: true, status: 'closed' });
      }
    }

    // ── lead_profile: who is this, if they came in from an email link? ────────
    if (action === 'lead_profile') {
      const candidates = Array.isArray(body?.candidates)
        ? body.candidates.map((value: any) => String(value || '').trim()).filter(Boolean).slice(0, 8)
        : [];
      if (candidates.length === 0) return Response.json({ found: false });

      const hit = await findContactCard(service, candidates);
      if (!hit) return Response.json({ found: false });
      return Response.json({ found: true, profile: cardProfile(hit.card, hit.source) });
    }

    // ── confirm_profile: note on the card that the visitor agreed to it ───────
    if (action === 'confirm_profile') {
      const cardId = String(body?.leadId || '').trim();
      const source = body?.source === 'vault' ? 'vault' : 'contact_card';
      const name = String(body?.name || '').trim().slice(0, 80);
      if (!cardId) return Response.json({ error: 'leadId is required' }, { status: 400 });

      const line = `Confirmed their details on the website${name ? ` (${name})` : ''}`;
      try {
        if (source === 'vault') {
          const entry: any = await service.entities.LeadVaultEntry.get(cardId);
          const notes = String(entry?.notes || '').trim();
          await service.entities.LeadVaultEntry.update(cardId, {
            notes: notes ? `${notes}\n${line}` : line,
          });
        } else {
          const card: any = await service.entities.FronterLead.get(cardId);
          let log: any[] = [];
          try {
            log = JSON.parse(card?.notesLogJson || '[]');
            if (!Array.isArray(log)) log = [];
          } catch {
            log = [];
          }
          log.push({ text: `✅ ${line}`, timestamp: new Date().toISOString(), author: 'website', type: 'confirm' });
          await service.entities.FronterLead.update(cardId, { notesLogJson: JSON.stringify(log.slice(-100)) });
        }
      } catch (error: any) {
        console.error('[homeQualifyChat] Could not note the confirmation:', error?.message);
        return Response.json({ error: 'We could not save that just now — your advisor can confirm it on your call.' });
      }
      return Response.json({ ok: true });
    }

    // ── chat: answer from the KB and qualify ─────────────────────────────────
    const message = String(body?.message || '').trim().slice(0, 1200);
    if (!message) return Response.json({ error: 'message required' }, { status: 400 });

    const token = cleanToken(body?.sessionToken)
      || `v${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const pagePath = String(body?.pagePath || '/').slice(0, 200);
    const prior = body?.collected || {};
    const session = await ensureSession(service, token, pagePath);
    const now = new Date().toISOString();

    // The visitor's message is always recorded, so a specialist can read it.
    await addMessage(service, token, 'visitor', message);

    // A specialist has the chat — the bot stays quiet until they hand it back.
    if (session.status === 'human') {
      await service.entities.HomeChatSession.update(session.id, {
        status: 'human',
        firstName: prior.firstName || session.firstName || '',
        lastName: prior.lastName || session.lastName || '',
        email: prior.email || session.email || '',
        phone: prior.phone || session.phone || '',
        state: prior.state || session.state || '',
        debtTier: prior.debtTier || session.debtTier || '',
        monthlyPayment: prior.monthlyPayment || session.monthlyPayment || '',
        cardholderStatus: prior.cardholderStatus || session.cardholderStatus || '',
        hardship: prior.hardship || session.hardship || '',
        visitorLabel: sessionLabel(prior.firstName || session.firstName, prior.lastName || session.lastName, token),
        lastMessageAt: now,
        lastPreview: message.slice(0, 140),
        messageCount: (session.messageCount || 0) + 1,
      });
      return Response.json({
        humanTakeover: true,
        reply: '',
        quickReplies: [],
        collected: prior,
        readyForCall: false,
        sessionToken: token,
      });
    }

    const history = Array.isArray(body?.history) ? body.history.slice(-12) : [];
    const context = await kbContext(service, message);
    const cfg = await loadChatConfig(service);
    const order = cfg.questions
      .map((question, index) => `${index + 1}. ${question.question}${question.guidance ? ` ${question.guidance}` : ''}`)
      .join('\n');
    const known = cfg.questions
      .map((question) => `${knownLabel(question.field)}: ${knownValue(prior, question.field) || 'unknown'}`)
      .join('\n');
    const facts = cfg.facts.map((fact) => `- ${fact}`).join('\n');
    const prohibitions = cfg.prohibitions.map((rule) => `- ${rule}`).join('\n');
    const rangeLabels = cfg.tiers.map((tier) => `"${tier}"`).join(', ');

    const result = await service.integrations.Core.InvokeLLM({
      prompt: `You are the website assistant for Debt Solutions, a debt relief company helping people with credit card debt. You are warm, plain-spoken and brief: 1-3 short sentences, plain prose, no markdown, no emojis, never use an em dash.

TWO JOBS
1. Answer the visitor's questions using the knowledge base excerpts below as your primary source. If the knowledge base does not cover it, say a specialist will cover it on their call — do not invent program details.
2. Qualify them by working through the order below, one question per message.

QUALIFICATION ORDER — ask for ONE thing per message, in exactly this order. Never ask for two things in the same message, and never jump ahead.
${order}

DEBT RANGES — record how much debt they carry as exactly one of these labels: ${rangeLabels}. If they give a number, use the range it falls into.

THE ELIGIBILITY LINE — once all ${cfg.questions.length} are answered, say this once, close to word for word:
"${cfg.eligibilityLine}"

FACTS YOU MAY STATE
${facts}

NEVER
${prohibitions}

MOVING TO A CALL
Only after the eligibility line has been delivered, ${cfg.callOfferText}

ALREADY ANSWERED — DO NOT ASK AGAIN
Anything shown as known below, or already in the conversation, is answered: do not ask for it again. If a phone number or an email is already on their file, confirm it with them instead of asking from scratch. Always ask about the first item on the list you do not have yet, and if they volunteer something out of order, take it and move on.

ALREADY KNOWN ABOUT THIS VISITOR
${known}

KNOWLEDGE BASE EXCERPTS
${context || '(nothing matched this question)'}

CONVERSATION SO FAR
${history.map((h: any) => `${h.role === 'user' ? 'Visitor' : 'Assistant'}: ${h.content}`).join('\n') || '(no earlier messages)'}

VISITOR JUST SAID: ${message}

Return JSON with:
- reply: your next message to the visitor
- quickReplies: 2-3 very short suggested replies written in the visitor's own voice, for example "Yes, more than $5,000" or "How does it work?", never containing a name, or an empty array
- firstName: their first name if now known, otherwise empty string
- lastName: their last name if known, otherwise empty string
- email: their email address if they gave it, otherwise empty string
- phone: the phone number they gave, otherwise empty string
- state: their US state if known, otherwise empty string
- debtTier: exactly one of ${rangeLabels} if known, otherwise empty string
- monthlyPayment: what they pay each month across all the cards, in their own words, e.g. "$450" - otherwise empty string
- cardholderStatus: "In their name" or "Co-signer" if known, otherwise empty string
- hardship: the hardship they described in a few words, e.g. "Lost job", otherwise empty string
- interested: true only after the eligibility line has been delivered, and only if they have not declined a call`,
      response_json_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string' },
          quickReplies: { type: 'array', items: { type: 'string' } },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          state: { type: 'string' },
          debtTier: { type: 'string' },
          monthlyPayment: { type: 'string' },
          cardholderStatus: { type: 'string' },
          hardship: { type: 'string' },
          interested: { type: 'boolean' },
        },
      },
    });

    const data = result || {};
    // The model invents names: it has offered "My name is Sarah" as a suggestion and returned
    // first names nobody typed. Only a name the visitor actually wrote is treated as real, and
    // a suggestion never carries a name.
    const visitorSaid = (value: any) => {
      const typed = String(value || '').trim().toLowerCase();
      return !!typed && message.toLowerCase().includes(typed);
    };
    // Same protection for the details they type: a phone, an email or a figure is only
    // recorded when it actually appears in what the visitor wrote this turn.
    const digitsSaid = (value: any) => {
      const tail = String(value || '').replace(/\D/g, '').slice(-10);
      return tail.length === 10 && message.replace(/\D/g, '').includes(tail);
    };
    const amountSaid = (value: any) => {
      const digits = String(value || '').replace(/\D/g, '');
      return !!digits && message.replace(/\D/g, '').includes(digits);
    };
    const cardholderLabel = (value: any) => {
      const raw = String(value || '');
      if (/co-?\s?sign/i.test(raw)) return 'Co-signer';
      if (/name/i.test(raw)) return 'In their name';
      return '';
    };
    const suggestions = (Array.isArray(data.quickReplies) ? data.quickReplies : [])
      .filter((q: any) => typeof q === 'string' && q.trim())
      .filter((q: string) => !/(my name(?:'s| is)|this is)\s+[a-z]/i.test(q))
      .slice(0, 3);
    const collected: Record<string, any> = {
      firstName: visitorSaid(data.firstName) ? String(data.firstName).trim() : (prior.firstName || ''),
      lastName: visitorSaid(data.lastName) ? String(data.lastName).trim() : (prior.lastName || ''),
      state: String(data.state || '').trim().toUpperCase() || prior.state || '',
      debtTier: cfg.tiers.includes(data.debtTier) ? data.debtTier : (prior.debtTier && cfg.tiers.includes(prior.debtTier) ? prior.debtTier : ''),
      email: visitorSaid(data.email) ? String(data.email).trim().slice(0, 120) : (prior.email || ''),
      phone: digitsSaid(data.phone) ? normalizePhone(data.phone) : (prior.phone || ''),
      monthlyPayment: amountSaid(data.monthlyPayment) ? String(data.monthlyPayment).trim().slice(0, 40) : (prior.monthlyPayment || ''),
      cardholderStatus: cardholderLabel(data.cardholderStatus) || prior.cardholderStatus || '',
      hardship: String(data.hardship || '').trim().slice(0, 200) || prior.hardship || '',
    };
    if (data.interested === false) collected.interested = false;
    else if (data.interested === true) collected.interested = true;
    else if (prior.interested !== undefined) collected.interested = prior.interested;

    const hasField = (field: string) => (field === 'name' ? !!collected.firstName : !!String(collected[field] || '').trim());
    const readyForCall = cfg.readyFields.every(hasField) && collected.interested !== false;
    const replyText = String(data.reply || 'Could you tell me that again?');

    await addMessage(service, token, 'assistant', replyText);
    await service.entities.HomeChatSession.update(session.id, {
      status: 'bot',
      firstName: collected.firstName || '',
      lastName: collected.lastName || '',
      email: collected.email || '',
      phone: collected.phone || '',
      state: collected.state || '',
      debtTier: collected.debtTier || '',
      monthlyPayment: collected.monthlyPayment || '',
      cardholderStatus: collected.cardholderStatus || '',
      hardship: collected.hardship || '',
      visitorLabel: sessionLabel(collected.firstName, collected.lastName, token),
      lastMessageAt: new Date().toISOString(),
      lastPreview: replyText.slice(0, 140),
      messageCount: (session.messageCount || 0) + 2,
    });

    return Response.json({
      reply: replyText,
      quickReplies: suggestions,
      collected,
      readyForCall,
      sessionToken: token,
    });
  } catch (error: any) {
    console.error('[homeQualifyChat] Error:', error?.message);
    return Response.json({ error: error?.message || 'The assistant is unavailable right now.' }, { status: 500 });
  }
}