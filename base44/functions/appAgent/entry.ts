// ACE — the app-wide AI command console behind the ⌘A / Ctrl+A hotkey.
//
// Runs a tool-using loop (Anthropic Messages API, the app's own key so every run
// is metered exactly like the rest of the app's AI into AICreditUsage). The agent
// knows the whole platform through the shared system map, can read any entity,
// change a lead/task when asked, call a few read-only functions, and returns a
// [[GOTO:...]] directive that the console UI turns into real navigation.
//
// Auth: a verified Debt Call Coach portal session, or a Base44 app user.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { waitUntil } from 'base44:runtime';
import { computeCostUsd } from '../../shared/aiCost.ts';
import { fillMergeTags } from '../../shared/mergeTags.ts';
import {
  buildAppAgentSystemPrompt,
  READABLE_ENTITIES,
  WRITABLE_ENTITIES,
  SAFE_FUNCTIONS,
  HEAVY_FIELDS,
} from '../../shared/appSystemMap.ts';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_STEPS = 6;
const MAX_ROWS = 25;
const MAX_TOOL_CHARS = 7000;
const PROTECTED_FIELDS = ['id', 'created_by_id', 'app_id', 'passwordHash', 'sessionToken', 'role'];

const TOOLS = [
  {
    name: 'query_entity',
    description:
      'Read records from the app database. Use this for every factual question about leads, calls, transcripts, users, costs, quotas, scripts and settings. `filter` is a MongoDB-style object, e.g. {"status":"new"} or {"firstName":{"$regex":"john"}} or {"created_date":{"$gte":"2026-10-01"}}. `sort` is a field name, prefix with - for descending. Set count_only to just get a number.',
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Entity name exactly as listed in the system prompt' },
        filter: { type: 'object', description: 'MongoDB-style query filter (optional)' },
        sort: { type: 'string', description: 'Sort field, -prefix for descending (optional)' },
        limit: { type: 'number', description: `Max rows (default ${MAX_ROWS})` },
        count_only: { type: 'boolean', description: 'Return only the matching count' },
      },
      required: ['entity'],
    },
  },
  {
    name: 'update_record',
    description:
      'Change fields on ONE record. Allowed only on DebtLead, FronterLead and AssistantTask, and only when the user clearly asked for that change. Pass the fields to change as `data`.',
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'DebtLead, FronterLead or AssistantTask' },
        id: { type: 'string', description: 'Record id' },
        data: { type: 'object', description: 'Fields to update' },
      },
      required: ['entity', 'id', 'data'],
    },
  },
  {
    name: 'call_function',
    description:
      'Call one of the read-only helper functions: getScriptsForBob, listCalendarEvents, twilioGetLines, twilioCallLogs, listElevenLabsVoices. Nothing that sends, dials or writes can be called this way.',
    input_schema: {
      type: 'object',
      properties: {
        function_name: { type: 'string', description: 'Function name' },
        args: { type: 'object', description: 'Arguments object' },
      },
      required: ['function_name'],
    },
  },
  {
    name: 'send_welcome_emails',
    description:
      'Send the welcome & login-info email (the fronter credential template) to prospects from calls. Use this ONLY when the user explicitly asks to send welcome / credentials emails. With no lead_ids it targets FronterLead records that have an email, were called within since_hours, and have not been sent credentials yet. Fronters and dialers can only email their own leads. It sends real email, so report exactly who was emailed and who was skipped.',
    input_schema: {
      type: 'object',
      properties: {
        lead_ids: { type: 'array', items: { type: 'string' }, description: 'Specific FronterLead ids to email (optional)' },
        since_hours: { type: 'number', description: 'Only leads called within this many hours (default 24)' },
        limit: { type: 'number', description: 'Maximum emails this run (default 20)' },
      },
    },
  },
];

// The welcome email falls back to this when no credential template is saved yet.
const WELCOME_FALLBACK = {
  label: '👋 Welcome & Login Info',
  subject: 'Welcome to Rosie AI — Your Login Information',
  body: `<div style="font-family:Georgia,serif;font-size:14px;color:#333;">
<p>Hi {{firstName}},</p>
<p>Welcome to the Rosie AI family! We are excited to have you on board.</p>
<p><strong>Your Login Information:</strong><br/>
Portal: https://rosieai-investorpage.base44.app/portal-login<br/>
Email: {{email}}</p>
<p>You will receive a separate email with your temporary password. Please log in and complete your profile at your earliest convenience.</p>
<p>Best regards,<br/>Rosie AI Team</p>
</div>`,
};

function fillTemplate(text: string, lead: any) {
  // {{FirstName}} and {{firstName}} both resolve.
  return fillMergeTags(text, {
    firstName: lead?.firstName || 'there',
    lastName: lead?.lastName || '',
    email: lead?.email || '',
  });
}

async function welcomeTemplate(base44: any) {
  try {
    const page = await base44.asServiceRole.entities.FronterEmailTemplate.list({ limit: 100 });
    const rows = page?.items || page || [];
    const hit = rows.find((t: any) => /welcome/i.test(t.label || ''))
      || rows.find((t: any) => /credential|login/i.test(t.label || ''))
      || rows[0];
    if (hit?.subject && hit?.body) return hit;
  } catch { /* fall through to the built-in welcome */ }
  return WELCOME_FALLBACK;
}

// Welcome & credential emails to the prospects that came out of calls.
async function sendWelcomeEmails(base44: any, who: any, input: any) {
  const leadIds = Array.isArray(input?.lead_ids)
    ? input.lead_ids.filter((v: any) => typeof v === 'string' && v.trim()).slice(0, 40)
    : [];
  const hours = Math.min(Math.max(Number(input?.since_hours) || 24, 1), 720);
  const limit = Math.min(Math.max(Number(input?.limit) || 20, 1), 40);
  const ownOnly = ['fronter', 'dialer'].includes(String(who?.role || '').toLowerCase()) ? who.username : null;
  const leads = base44.asServiceRole.entities.FronterLead;
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  let targets: any[] = [];
  if (leadIds.length) {
    const rows = await Promise.all(leadIds.map((id: string) => leads.get(id).catch(() => null)));
    targets = rows.filter(Boolean);
    if (ownOnly) {
      const mine = String(ownOnly).toLowerCase();
      targets = targets.filter((l: any) => String(l.assignedTo || '').toLowerCase() === mine);
    }
  } else {
    // one query per status, merged here — compound filters are unreliable in this SDK
    const collected: any[] = [];
    for (const status of ['prospect', 'lead']) {
      const filter: Record<string, any> = { status, lastCalledAt: { $gte: since } };
      if (ownOnly) filter.assignedTo = ownOnly;
      const page = await leads.filter(filter, '-lastCalledAt', limit);
      collected.push(...(page?.items || []));
    }
    const seen = new Set<string>();
    targets = collected
      .filter((l: any) => (seen.has(l.id) ? false : (seen.add(l.id), true)))
      .sort((a: any, b: any) => String(b.lastCalledAt || '').localeCompare(String(a.lastCalledAt || '')))
      .slice(0, limit);
  }

  if (!targets.length) {
    return {
      ok: true,
      text: ownOnly
        ? `No prospects assigned to ${ownOnly} were called in the last ${hours}h. Nobody was emailed.`
        : `No prospects with a call in the last ${hours}h matched. Nobody was emailed.`,
    };
  }

  const template = await welcomeTemplate(base44);
  const emailed: string[] = [];
  const skipped: string[] = [];

  for (const lead of targets) {
    const email = String(lead?.email || '').trim();
    const name = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || lead?.id;
    if (!email) { skipped.push(`${name} (no email on the card)`); continue; }
    if (lead?.credsSentAt) { skipped.push(`${name} (already welcomed)`); continue; }
    try {
      const res = await base44.asServiceRole.functions.invoke('sendGmailEmail', {
        to: email,
        subject: fillTemplate(template.subject, lead),
        html: fillTemplate(template.body, lead),
        leadId: lead.id,
        templateId: template.id,
        templateName: template.label,
        sentBy: who?.username || 'ACE',
      });
      if (res?.data?.error || res?.error) throw new Error(res?.data?.error || res?.error);

      const now = new Date().toISOString();
      const updates: Record<string, any> = { credsSentAt: now, credsSentTemplate: template.label || 'Welcome' };
      if (lead.status === 'prospect') updates.status = 'lead';
      try {
        const log = JSON.parse(lead?.notesLogJson || '[]');
        log.push({ text: `👋 Welcome & login email sent to ${email} from ACE`, timestamp: now, author: who?.username || 'ACE', type: 'creds' });
        updates.notesLogJson = JSON.stringify(log);
      } catch { /* the send already happened */ }
      await leads.update(lead.id, updates);
      emailed.push(`${name} <${email}>`);
    } catch (e: any) {
      skipped.push(`${name} (send failed: ${e?.message || String(e)})`);
    }
  }

  return {
    ok: true,
    text: [
      emailed.length ? `Emailed ${emailed.length} — ${emailed.join('; ')}` : 'Nobody was emailed.',
      skipped.length ? `Skipped ${skipped.length} — ${skipped.join('; ')}` : '',
    ].filter(Boolean).join('\n').slice(0, MAX_TOOL_CHARS),
  };
}

function slim(rows: any[]) {
  return rows.map((row) => {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(row || {})) {
      if (HEAVY_FIELDS.has(key)) continue;
      if (typeof value === 'string' && value.length > 400) out[key] = value.slice(0, 400) + '…';
      else out[key] = value;
    }
    return out;
  });
}

// One exact-usage row per Anthropic call, so the console's spend shows up in the
// AI Reports tab and the nightly cost report alongside every other AI feature.
function logUsage(base44: any, username: string, usage: any) {
  if (!usage) return;
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
  try {
    waitUntil(base44.asServiceRole.entities.AICreditUsage.create({
      callType: 'app_agent',
      provider: 'anthropic',
      model: MODEL,
      agentUsername: username || '',
      estimatedCredits: 0,
      costUsd: computeCostUsd({ model: MODEL, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }),
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      calledAt: new Date().toISOString(),
    })).catch(() => {});
  } catch { /* metering must never break the answer */ }
}

// The workspace header is only valid when it belongs to the key in use. If the
// configured workspace is rejected, retry once without it so the console still
// answers instead of dying on a stale secret.
async function callAnthropic(apiKey: string, payload: any) {
  const send = (workspaceId?: string) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
    },
    body: JSON.stringify(payload),
  });

  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  const first = await send(workspaceId);
  if (first.ok || !workspaceId) return first;

  const errorBody = await first.clone().json().catch(() => null);
  if (!/workspace/i.test(errorBody?.error?.message || '')) return first;

  console.log('[appAgent] ANTHROPIC_WORKSPACE_ID rejected by the API key — retrying without it');
  return send();
}

async function resolveIdentity(base44: any, body: any) {
  if (body?.sessionUserId && body?.sessionToken) {
    try {
      const portalUser = await base44.asServiceRole.entities.DebtCoachUser.get(body.sessionUserId);
      if (portalUser && portalUser.isActive && portalUser.sessionToken === body.sessionToken) {
        return { username: portalUser.username, role: portalUser.role, source: 'portal' };
      }
    } catch { /* fall through to the Base44 session */ }
  }
  try {
    const me = await base44.auth.me();
    if (me) return { username: me.full_name || me.email, role: me.role, source: 'base44' };
  } catch { /* not signed in */ }
  return null;
}

async function runTool(base44: any, toolUse: any, who: any) {
  const input = toolUse?.input || {};
  try {
    if (toolUse.name === 'query_entity') {
      if (!READABLE_ENTITIES.has(input.entity)) {
        return { ok: false, text: `Unknown entity "${input.entity}" — use an entity name from the system prompt.` };
      }
      const api = base44.asServiceRole.entities[input.entity];
      const filter = input.filter && typeof input.filter === 'object' ? input.filter : {};
      if (input.count_only) return { ok: true, text: `${input.entity} count: ${await api.count(filter)}` };
      const res = await api.filter(filter, input.sort || '-created_date', Math.min(Number(input.limit) || MAX_ROWS, MAX_ROWS));
      const rows = Array.isArray(res) ? res : (res?.items || []);
      return { ok: true, text: JSON.stringify(slim(rows)).slice(0, MAX_TOOL_CHARS) };
    }

    if (toolUse.name === 'update_record') {
      if (!WRITABLE_ENTITIES.has(input.entity)) {
        return { ok: false, text: `${input.entity} is read-only — only DebtLead, FronterLead and AssistantTask can be changed.` };
      }
      if (!input.id || !input.data || typeof input.data !== 'object') {
        return { ok: false, text: 'Need both an id and the fields to change.' };
      }
      const data: Record<string, any> = { ...input.data };
      for (const field of PROTECTED_FIELDS) delete data[field];
      if (!Object.keys(data).length) return { ok: false, text: 'Nothing to change after removing protected fields.' };
      await base44.asServiceRole.entities[input.entity].update(input.id, data);
      return { ok: true, text: `Updated ${input.entity} ${input.id} → ${JSON.stringify(data)}` };
    }

    if (toolUse.name === 'call_function') {
      if (!SAFE_FUNCTIONS.has(input.function_name)) {
        return { ok: false, text: `${input.function_name} is not on your callable list.` };
      }
      const res = await base44.asServiceRole.functions.invoke(input.function_name, input.args || {});
      return { ok: true, text: JSON.stringify(res?.data ?? res).slice(0, MAX_TOOL_CHARS) };
    }

    if (toolUse.name === 'send_welcome_emails') {
      return await sendWelcomeEmails(base44, who, input);
    }

    return { ok: false, text: `Unknown tool "${toolUse.name}".` };
  } catch (e: any) {
    return { ok: false, text: `Tool failed: ${e?.message || String(e)}` };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const who = await resolveIdentity(base44, body);
    if (!who) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const history = (Array.isArray(body?.messages) ? body.messages : [])
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-12)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!history.length) return Response.json({ error: 'No message' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ reply: 'The AI console is not configured — the Anthropic API key is missing from the app secrets.' });
    }

    const system = [{
      type: 'text',
      text: buildAppAgentSystemPrompt(who, body?.context || {}),
      cache_control: { type: 'ephemeral' },
    }];
    const messages: any[] = [...history];
    const toolLog: any[] = [];

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await callAnthropic(apiKey, {
        model: MODEL,
        max_tokens: 1300,
        temperature: 0.2,
        system,
        messages,
        tools: TOOLS,
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        console.error('[appAgent] Anthropic error:', JSON.stringify(data)?.slice(0, 600));
        return Response.json({
          reply: 'The AI is not responding right now. Check the Anthropic key and workspace in the app secrets, then try again.',
          error: data?.error?.message || 'anthropic_error',
        });
      }

      logUsage(base44, who.username, data?.usage);

      const content = Array.isArray(data?.content) ? data.content : [];
      const toolUses = content.filter((c: any) => c?.type === 'tool_use');
      const text = content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('\n').trim();

      if (!toolUses.length) return Response.json({ reply: text || 'Done.', toolLog });

      messages.push({ role: 'assistant', content });
      const results: any[] = [];
      for (const toolUse of toolUses) {
        const result = await runTool(base44, toolUse, who);
        toolLog.push({ name: toolUse.name, input: toolUse.input, ok: result.ok });
        results.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result.text });
      }
      messages.push({ role: 'user', content: results });
    }

    return Response.json({ reply: 'That needed more digging than I can do in one pass — try narrowing the question.', toolLog });
  } catch (e: any) {
    console.error('[appAgent] failed:', e?.message || String(e));
    return Response.json({ reply: 'The console hit an error. Try again in a moment.', error: e?.message || String(e) });
  }
});