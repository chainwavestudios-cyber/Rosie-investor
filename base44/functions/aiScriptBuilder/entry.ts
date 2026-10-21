/**
 * aiScriptBuilder — Anthropic script architect for the Debt Settlement platform.
 *
 * Feed it a freshly uploaded / saved / pasted fronter script and it rebuilds the
 * whole script system from it:
 *   • fronter outbound scripts                   (FronterScript)
 *   • AI voice agent config — outbound + inbound (AIAgentConfig)
 *   • rebuttals                                  (Objection)
 *   • common questions                           (FronterKnowledgeBase)
 *   • main knowledge base entries                (KnowledgeBase)
 *
 * Generation runs one section per call so every AI request stays short and the
 * admin sees progress. The UI reviews the proposal, then calls back with
 * action 'apply' to write the approved changes.
 *
 * sections: extract | scripts | agent_config | objections | common_questions | main_kb
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const MODEL = 'claude-sonnet-5';
const KB_NAME = 'Debt Settlement';
const MAX_SOURCE_CHARS = 24000;

const SYSTEM = `You are the lead script architect for an American debt-settlement call center (Debt Advisors of America). You rewrite live-call scripts, rebuttals, knowledge bases and AI voice-agent instructions so a live agent or an AI voice agent can read them out loud, word for word. You know consultative debt-settlement sales, hardship qualification, rate-drop offers, TCPA-safe language and objection handling. Reply with a single valid JSON object and nothing else — no prose, no markdown fences.`;

const CFG_FIELDS = [
  'greeting', 'scriptFlow', 'dynamicRebuttals', 'qaTuning', 'systemPrompt',
  'inboundAgentName', 'inboundOpener', 'inboundSystemPrompt', 'inboundScriptFlow', 'inboundKeywordTriggers',
];

const SCRIPT_TYPES = ['open', 'discovery', 'rebuttal', 'close', 'custom'];
const PRIORITIES = ['high', 'medium', 'low'];

const STR = { type: 'string' };
const STR_ARRAY = { type: 'array', items: { type: 'string' } };

const SECTION_SCHEMAS: Record<string, any> = {
  extract: { type: 'object', properties: { text: STR } },
  scripts: {
    type: 'object',
    properties: {
      scripts: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: STR, scriptType: STR, content: STR },
        },
      },
    },
  },
  agent_config: {
    type: 'object',
    properties: {
      greeting: STR, scriptFlow: STR, dynamicRebuttals: STR, qaTuning: STR, systemPrompt: STR,
      inboundAgentName: STR, inboundOpener: STR, inboundSystemPrompt: STR, inboundScriptFlow: STR, inboundKeywordTriggers: STR,
    },
  },
  objections: {
    type: 'object',
    properties: {
      objections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: STR, triggerPhrases: STR_ARRAY, responseText: STR, mindset: STR, goal: STR, priority: STR,
          },
        },
      },
    },
  },
  common_questions: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: { question: STR, answer: STR, alternativeQuestions: STR_ARRAY, category: STR },
        },
      },
    },
  },
  main_kb: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: { question: STR, answer: STR, category: STR, variations: STR_ARRAY },
        },
      },
    },
  },
  counterpart: {
    type: 'object',
    properties: {
      name: STR,
      direction: STR,
      script: STR,
      config: {
        type: 'object',
        properties: {
          greeting: STR, scriptFlow: STR, dynamicRebuttals: STR, qaTuning: STR, systemPrompt: STR,
          inboundAgentName: STR, inboundOpener: STR, inboundSystemPrompt: STR, inboundScriptFlow: STR, inboundKeywordTriggers: STR,
        },
      },
    },
  },
};

// ── Session ────────────────────────────────────────────────────────────────
// The admin panel runs inside the Debt Call Coach portal, which carries its own
// session — the platform user is not necessarily signed in.
async function verifyAdmin(base44: any, userId: string, sessionToken: string) {
  if (!userId || !sessionToken) return null;
  try {
    const user = await base44.asServiceRole.entities.DebtCoachUser.get(userId);
    if (!user || !user.isActive || user.sessionToken !== sessionToken) return null;
    if (!['admin', 'super_admin'].includes(user.role)) return null;
    return user;
  } catch {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function parseJson(text: string) {
  const raw = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(raw);
  } catch { /* fall through to the brace slice */ }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch { /* unparseable */ }
  }
  return null;
}

// Uploaded scripts live in private storage — sign a short-lived link the AI can read.
async function signedFileUrl(base44: any, fileUri: string) {
  const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 600 });
  const url = signed?.signed_url || signed?.data?.signed_url;
  if (!url) throw new Error('Could not open the uploaded file.');
  return url;
}

/**
 * One Claude Sonnet call per section, always answered as the section's JSON
 * shape so nothing has to be guessed out of free text.
 */
async function askAI(base44: any, prompt: string, schema: any, fileUrls?: string[]) {
  const args: any = { prompt, model: MODEL, response_json_schema: schema };
  if (fileUrls?.length) args.file_urls = fileUrls;
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM(args);
  const data = typeof result === 'string' ? parseJson(result) : result;
  if (!data || typeof data !== 'object') throw new Error('The AI reply could not be read — try this section again.');
  return data;
}

async function runBatched(tasks: (() => Promise<any>)[], size = 6) {
  for (let i = 0; i < tasks.length; i += size) {
    await Promise.allSettled(tasks.slice(i, i + size).map(fn => fn()));
  }
}

function nextOrder(rows: any[], field = 'sortOrder') {
  return rows.reduce((max: number, r: any) => Math.max(max, Number(r?.[field]) || 0), 0);
}

function strArray(value: any): string[] {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    const asJson = parseJson(value);
    if (Array.isArray(asJson)) return asJson.map(v => String(v || '').trim()).filter(Boolean);
    return value.split('\n').map(v => v.trim()).filter(Boolean);
  }
  return [];
}

// ── Section prompts ────────────────────────────────────────────────────────
const SECTIONS: Record<string, { prompt: (src: string, label: string, extra: string) => string }> = {
  scripts: {
    prompt: (src, label) => `Build the COMPLETE fronter live-call script set from the source script below ("${label}").

Rules:
- Stay faithful to the source: same offer, same process, same company voice. Where the source has gaps, fill them with best-practice debt-settlement language. Never invent new products, fees, prices or legal promises.
- Everything is read out loud, word for word, by a live agent on the phone: natural spoken English, short sentences, no markdown headings inside the content.
- Use {{first_name}}, {{state}}, {{debt_amount}} placeholders where personalisation belongs.
- Cover, in this order: (1) Open / introduction with the reason for the call, (2) Qualifying + discovery questions, (3) Value and rate-drop pitch, (4) Rebuttals written into the script, (5) Close and transfer to a Sr. Debt Specialist.
- Every script ends with the exact next step for the agent.
- Produce between 4 and 8 scripts. "scriptType" must be exactly one of: ${SCRIPT_TYPES.join(', ')}.

Return JSON: {"scripts":[{"name":"short name","scriptType":"open","content":"the full script"}]}

SOURCE SCRIPT:
"""
${src}
"""`,
  },
  agent_config: {
    prompt: (src, label, extra) => `Rewrite the AI voice agent's configuration so it runs this script on live calls — both outbound (the agent dials the lead) and inbound (the lead calls the AI agent's line).

CURRENT AGENT CONFIG (keep the agent's identity, name and transfer rules unless the new script changes them):
${extra}

SOURCE SCRIPT ("${label}"):
"""
${src}
"""

Rules:
- greeting: the first line the AI says when a lead answers. One sentence, uses {{first_name}}.
- scriptFlow: the call execution phases in order, with the exact lines the agent says in each phase and the condition for moving on.
- dynamicRebuttals: objection handling written for a voice agent — the objection, the customer's mindset, and the exact spoken response.
- qaTuning: the questions leads actually ask on these calls, each with a tight spoken answer.
- systemPrompt: the full operating brief for the outbound agent — role, tone, pacing, compliance guardrails, what it must never say, and when to transfer.
- inboundAgentName: keep the current agent name unless the source names someone else.
- inboundOpener: the first line the inbound agent says after the intro clips, personalised with {{first_name}} and {{state}} — reference the notice, the roughly $20,000 in high-interest credit card debt and the state rate-drop update.
- inboundSystemPrompt: the MINIMAL inbound script — greet, hold the caller on the roughly $20,000 in high-interest debt and the state rate-drop notice, confirm the debt, then hand off to the live transfer queue. Short spoken lines, never a long brief.
- inboundScriptFlow: the INCOMING call flow only — the phases in order, the notice-ID/address verification, the debt confirmation, and the handoff to the live transfer queue. Never the outbound phases.
- inboundKeywordTriggers: comma-separated phrases from the source that skip straight to the agent hand-off.
- Every field is plain spoken text, no markdown. Leave a field out only when the source truly says nothing about it.

Return JSON: {"greeting":"","scriptFlow":"","dynamicRebuttals":"","qaTuning":"","systemPrompt":"","inboundAgentName":"","inboundOpener":"","inboundSystemPrompt":"","inboundScriptFlow":"","inboundKeywordTriggers":""}`,
  },
  objections: {
    prompt: (src, label) => `Write the complete rebuttal set for the live calls that follow this script ("${label}"). Produce between 12 and 20 objections.

Rules:
- Use the objections a debt-settlement lead actually raises: trust and scam worries, credit impact, "I want to think about it", the spouse, already working with someone, can't afford it, bankruptcy, "just send me info", "I never got a notice", hostile and hang-up moments.
- triggerPhrases: 3 to 8 short phrases the customer might say to start this objection — include the blunt and the polite versions.
- responseText: the exact words the agent says back, spoken, confident and compliant. No promises of results, no guarantees, no invented fees.
- mindset: what the customer is really worried about. goal: what the agent must achieve before moving on.
- priority: high, medium or low by how often it decides the call.

Return JSON: {"objections":[{"title":"","triggerPhrases":[""],"responseText":"","mindset":"","goal":"","priority":"high"}]}

SOURCE SCRIPT:
"""
${src}
"""`,
  },
  common_questions: {
    prompt: (src, label) => `Write the common questions fronters must be able to answer live while working this script ("${label}"). Produce between 15 and 25 entries.

Rules:
- question: the customer's exact words, as they would say them out loud on the call.
- answer: the spoken answer the fronter reads out, plain English, no markdown, no guarantees.
- alternativeQuestions: 3 to 8 other ways the customer might phrase the same thing, including statement form ("I already talked to someone about this").
- category: one or two words, e.g. trust, pricing, process, credit, timing, hardship, compliance.

Return JSON: {"entries":[{"question":"","answer":"","alternativeQuestions":[""],"category":""}]}

SOURCE SCRIPT:
"""
${src}
"""`,
  },
  main_kb: {
    prompt: (src, label) => `Write the main knowledge-base entries that come out of this script ("${label}"). Produce between 15 and 25 entries.

Rules:
- These feed the AI that answers questions during live calls, so answers must be complete and precise, not one-liners: 2 to 5 sentences each, plain spoken English, no markdown.
- question: the question in the customer's voice. answer: the full factual answer grounded in the source script — the offer, the process, the debt types covered, timelines, what the customer has to do next.
- variations: 3 to 8 alternative phrasings of the same question, one per line.
- category: one word, e.g. product, process, pricing, credit, legal, company.

Return JSON: {"entries":[{"question":"","answer":"","category":"","variations":[""]}]}

SOURCE SCRIPT:
"""
${src}
"""`,
  },
  counterpart: {
    prompt: (src, label, extra) => `Turn the source script below ("${label}") into the MIRROR script for the opposite call direction, and rewrite the AI voice agent's script sections for that direction — grounded in the knowledge base.

CONTEXT (source direction, the direction you must write, that direction's current script and config, and the knowledge base):
${extra}

Rules:
- The source is an OUTGOING script (our agent or fronter dials the prospect): write the INCOMING version — the prospect calls us or is called back and reaches the AI desk. Same offer, same voice, same facts, reversed flow: greet the caller, reference the notice and the credit flags, confirm the debt amount and the debt types, then hand off to the live transfer queue.
- The incoming direction is MINIMAL: the shortest version that still works, a few short spoken lines per step and no rabbit holes. Every step holds the caller on two facts — they are carrying about $20,000 in high-interest debt and they qualify for the state rate-drop notice (interest frozen at 0%). Acknowledge in a few words, then come straight back to the $20,000 and the rate-drop.
- The source is an INCOMING script: write the OUTGOING version — our agent dials the prospect, opens with the reason for the call, qualifies, handles the objections and closes to the transfer.
- name: a short NEW name for this direction's AI script, e.g. "INCOMING — rate-drop AI script (v2)". Match the style of the current name given in CONTEXT and bump its version marker.
- script: the complete script for that direction, in the same order and wording style as the source, written to be spoken aloud word for word, no markdown. Use {{first_name}}, {{state}} and {{debt_amount}} where personalisation belongs.
- config: only the fields for THAT direction.
  - incoming: inboundOpener, inboundSystemPrompt, inboundScriptFlow, and inboundAgentName (keep the current agent name). The inbound opener, inbound system prompt and inbound script flow must be the minimal, $20k-anchored incoming script described above — never a long operating brief.
  - outgoing: greeting, systemPrompt, scriptFlow, dynamicRebuttals, qaTuning.
- System Prompt = the full operating brief for that direction: role, tone, pacing, qualification order, compliance guardrails, what it must never say, and when to hand off.
- Script Flow = the call phases in order, each with the exact lines to say and the condition for moving on.
- Rebuttals = objection handling written for a voice agent: the objection, what the customer is really worried about, and the exact spoken response.
- Q&A Tuning = the questions people actually ask on these calls, each with a tight spoken answer.
- Ground every answer, rebuttal and Q&A in the KNOWLEDGE BASE from CONTEXT — reuse its facts, processes, timelines and compliance language. Never invent products, fees, prices or promises.
- Every field is plain spoken text, no markdown.

Return JSON: {"name":"","direction":"incoming","script":"","config":{"greeting":"","systemPrompt":"","scriptFlow":"","dynamicRebuttals":"","qaTuning":"","inboundOpener":"","inboundSystemPrompt":"","inboundScriptFlow":""}}

SOURCE SCRIPT ("${label}" — the script that already exists for the OTHER direction):
"""
${src}
"""`,
  },
};

async function currentAgentConfig(base44: any) {
  try {
    const rows = await base44.asServiceRole.entities.AIAgentConfig.filter({ configName: 'default' });
    const cfg = Array.isArray(rows) ? rows[0] : (rows?.items || [])[0];
    if (!cfg) return '(none saved yet)';
    const picked: Record<string, string> = {};
    CFG_FIELDS.forEach(f => { if (cfg[f]) picked[f] = String(cfg[f]).slice(0, 1500); });
    return JSON.stringify(picked, null, 2);
  } catch {
    return '(none saved yet)';
  }
}

/**
 * The direction the uploaded script is NOT: what that direction's AI script says
 * today, its live agent config, and the knowledge base both directions answer from.
 */
async function counterpartContext(base44: any, sourceDirection: string) {
  const target = sourceDirection === 'incoming' ? 'outgoing' : 'incoming';
  const ctx: any = {
    sourceDirection,
    writeThisDirection: target,
    currentTargetScript: '(none saved yet)',
    currentTargetConfig: {},
    knowledgeBase: [],
  };

  try {
    const page = await base44.asServiceRole.entities.AIAgentScript.filter({ direction: target }, { limit: 5 });
    const rows = page?.items || page || [];
    if (rows[0]) ctx.currentTargetScript = { name: rows[0].name, content: String(rows[0].content || '').slice(0, 6000) };
  } catch { /* no script on file yet */ }

  try {
    const rows = await base44.asServiceRole.entities.AIAgentConfig.filter({ configName: 'default' });
    const cfg = Array.isArray(rows) ? rows[0] : (rows?.items || [])[0];
    if (cfg) {
      const fields = target === 'incoming'
        ? ['inboundAgentName', 'inboundOpener', 'inboundSystemPrompt', 'inboundScriptFlow', 'inboundKeywordTriggers']
        : ['greeting', 'systemPrompt', 'scriptFlow', 'dynamicRebuttals', 'qaTuning'];
      fields.forEach(f => { if (cfg[f]) ctx.currentTargetConfig[f] = String(cfg[f]).slice(0, 1200); });
    }
  } catch { /* defaults are fine */ }

  try {
    const [fronter, main] = await Promise.all([
      base44.asServiceRole.entities.FronterKnowledgeBase.list({ limit: 60 }),
      base44.asServiceRole.entities.KnowledgeBase.filter({ kbName: KB_NAME }, { limit: 60 }),
    ]);
    const pick = (row: any) => ({ q: String(row?.question || '').slice(0, 200), a: String(row?.answer || '').slice(0, 600) });
    ctx.knowledgeBase = [
      ...((fronter?.items || []).map(pick)),
      ...((main?.items || []).map(pick)),
    ].filter((e: any) => e.q && e.a).slice(0, 90);
  } catch { /* script alone is enough */ }

  return JSON.stringify(ctx, null, 2).slice(0, 18000);
}

// ── Apply the approved proposal ────────────────────────────────────────────
async function applyProposal(base44: any, proposal: any, meta: { sourceLabel: string; username: string }) {
  const counts = {
    scripts: { created: 0, updated: 0 },
    agentConfig: false,
    objections: { created: 0, updated: 0 },
    commonQuestions: { created: 0, updated: 0 },
    kbEntries: { created: 0, updated: 0 },
    aiScript: null,
  };

  // 1 — Fronter outbound scripts: same name updates in place, new name is added
  const scripts = Array.isArray(proposal?.scripts) ? proposal.scripts : [];
  if (scripts.length) {
    const existing = (await base44.asServiceRole.entities.FronterScript.list({ limit: 500 })).items || [];
    const byName = new Map(existing.map((s: any) => [String(s.name || '').trim().toLowerCase(), s]));
    let order = nextOrder(existing);
    const tasks: (() => Promise<any>)[] = [];
    for (const s of scripts) {
      const name = String(s?.name || '').trim();
      const content = String(s?.content || '').trim();
      if (!name || !content) continue;
      const payload = {
        name,
        content,
        scriptType: SCRIPT_TYPES.includes(s?.scriptType) ? s.scriptType : 'custom',
      };
      const found = byName.get(name.toLowerCase());
      if (found) {
        tasks.push(async () => { await base44.asServiceRole.entities.FronterScript.update(found.id, payload); counts.scripts.updated++; });
      } else {
        order += 1;
        tasks.push(async () => { await base44.asServiceRole.entities.FronterScript.create({ ...payload, sortOrder: order }); counts.scripts.created++; });
      }
    }
    await runBatched(tasks);
  }

  // 2 — AI voice agent config (outbound + inbound share the singleton row)
  const cfg = proposal?.agentConfig || {};
  const cfgFields: Record<string, string> = {};
  CFG_FIELDS.forEach(f => {
    const v = cfg[f];
    if (typeof v === 'string' && v.trim()) cfgFields[f] = v.trim();
  });
  if (Object.keys(cfgFields).length) {
    const rows = await base44.asServiceRole.entities.AIAgentConfig.filter({ configName: 'default' });
    const row = Array.isArray(rows) ? rows[0] : (rows?.items || [])[0];
    const payload = { ...cfgFields, updatedBy: meta.username };
    if (row) await base44.asServiceRole.entities.AIAgentConfig.update(row.id, payload);
    else await base44.asServiceRole.entities.AIAgentConfig.create({ configName: 'default', ...payload });
    counts.agentConfig = true;
  }

  // 3 — Rebuttals
  const objections = Array.isArray(proposal?.objections) ? proposal.objections : [];
  if (objections.length) {
    const existing = (await base44.asServiceRole.entities.Objection.list({ limit: 500 })).items || [];
    const byTitle = new Map(existing.map((o: any) => [String(o.title || '').trim().toLowerCase(), o]));
    let order = nextOrder(existing);
    const tasks: (() => Promise<any>)[] = [];
    for (const o of objections) {
      const title = String(o?.title || '').trim();
      const responseText = String(o?.responseText || '').trim();
      if (!title || !responseText) continue;
      const payload = {
        title,
        responseText,
        triggerPhrases: JSON.stringify(strArray(o?.triggerPhrases)),
        mindset: String(o?.mindset || '').trim(),
        goal: String(o?.goal || '').trim(),
        priority: PRIORITIES.includes(o?.priority) ? o.priority : 'medium',
        enabled: true,
      };
      const found = byTitle.get(title.toLowerCase());
      if (found) {
        tasks.push(async () => { await base44.asServiceRole.entities.Objection.update(found.id, payload); counts.objections.updated++; });
      } else {
        order += 1;
        tasks.push(async () => { await base44.asServiceRole.entities.Objection.create({ ...payload, sortOrder: order }); counts.objections.created++; });
      }
    }
    await runBatched(tasks);
  }

  // 4 — Common questions (fronter live Q&A)
  const questions = Array.isArray(proposal?.commonQuestions) ? proposal.commonQuestions : [];
  if (questions.length) {
    const existing = (await base44.asServiceRole.entities.FronterKnowledgeBase.list({ limit: 500 })).items || [];
    const byQuestion = new Map(existing.map((q: any) => [String(q.question || '').trim().toLowerCase(), q]));
    let order = nextOrder(existing);
    const tasks: (() => Promise<any>)[] = [];
    for (const q of questions) {
      const question = String(q?.question || '').trim();
      const answer = String(q?.answer || '').trim();
      if (!question || !answer) continue;
      const payload = {
        question,
        answer,
        alternativeQuestions: JSON.stringify(strArray(q?.alternativeQuestions)),
        category: String(q?.category || '').trim(),
        sourceType: 'document',
        sourceFileName: meta.sourceLabel,
      };
      const found = byQuestion.get(question.toLowerCase());
      if (found) {
        tasks.push(async () => { await base44.asServiceRole.entities.FronterKnowledgeBase.update(found.id, payload); counts.commonQuestions.updated++; });
      } else {
        order += 1;
        tasks.push(async () => { await base44.asServiceRole.entities.FronterKnowledgeBase.create({ ...payload, sortOrder: order }); counts.commonQuestions.created++; });
      }
    }
    await runBatched(tasks);
  }

  // 5 — Main knowledge base
  const kbEntries = Array.isArray(proposal?.kbEntries) ? proposal.kbEntries : [];
  if (kbEntries.length) {
    const existing = (await base44.asServiceRole.entities.KnowledgeBase.filter({ kbName: KB_NAME }, { limit: 500 })).items || [];
    const byQuestion = new Map(existing.map((e: any) => [String(e.question || '').trim().toLowerCase(), e]));
    const tasks: (() => Promise<any>)[] = [];
    for (const e of kbEntries) {
      const question = String(e?.question || '').trim();
      const answer = String(e?.answer || '').trim();
      if (!question || !answer) continue;
      const variations = strArray(e?.variations).join('\n');
      const payload = {
        question,
        answer,
        answersJson: JSON.stringify([answer]),
        starredAnswerIndex: 0,
        variations,
        category: String(e?.category || '').trim(),
        kbName: KB_NAME,
        source: `AI Script Builder — ${meta.sourceLabel}`,
      };
      const found = byQuestion.get(question.toLowerCase());
      if (found) {
        tasks.push(async () => { await base44.asServiceRole.entities.KnowledgeBase.update(found.id, payload); counts.kbEntries.updated++; });
      } else {
        tasks.push(async () => { await base44.asServiceRole.entities.KnowledgeBase.create(payload); counts.kbEntries.created++; });
      }
    }
    await runBatched(tasks);
  }

  // 6 — The AI script for one direction: renamed and rewritten in place
  const cp = proposal?.counterpart || {};
  const cpName = String(cp?.name || '').trim();
  const cpContent = String(cp?.script || '').trim();
  if (cpName && cpContent) {
    const cpDirection = cp?.direction === 'incoming' ? 'incoming' : 'outgoing';
    const page = await base44.asServiceRole.entities.AIAgentScript.filter({ direction: cpDirection }, { limit: 10 });
    const rows = page?.items || page || [];
    const payload = {
      name: cpName,
      content: cpContent,
      direction: cpDirection,
      isActive: true,
      sourceLabel: meta.sourceLabel,
      updatedBy: meta.username,
      updatedAt: new Date().toISOString(),
    };
    if (rows[0]) {
      await base44.asServiceRole.entities.AIAgentScript.update(rows[0].id, payload);
      counts.aiScript = { direction: cpDirection, name: cpName, action: 'updated' };
    } else {
      await base44.asServiceRole.entities.AIAgentScript.create(payload);
      counts.aiScript = { direction: cpDirection, name: cpName, action: 'created' };
    }
  }

  return counts;
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const admin = await verifyAdmin(base44, body?.sessionUserId, body?.sessionToken);
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 403 });

    if (body?.action === 'apply') {
      const result = await applyProposal(base44, body?.proposal || {}, {
        sourceLabel: String(body?.sourceLabel || 'uploaded script').slice(0, 120),
        username: admin.username || 'admin',
      });
      return Response.json({ result });
    }

    const section = String(body?.section || 'scripts');
    const label = String(body?.sourceLabel || 'the new fronter script').slice(0, 120);
    const sourceText = typeof body?.sourceText === 'string' ? body.sourceText.trim().slice(0, MAX_SOURCE_CHARS) : '';

    // The uploaded document goes to Claude as a file, and comes back as text that
    // every later section builds from.
    if (section === 'extract') {
      if (!body?.fileUri) return Response.json({ error: 'fileUri required' }, { status: 400 });
      const url = await signedFileUrl(base44, body.fileUri);
      const data = await askAI(
        base44,
        `${SYSTEM}\n\nReturn the COMPLETE text of the attached document, verbatim, exactly as written. Do not summarise, reorder, comment or explain. Preserve every heading, numbering, step and line break.`,
        SECTION_SCHEMAS.extract,
        [url],
      );
      const text = String(data?.text || '').trim();
      if (!text) return Response.json({ error: 'Could not read the uploaded document.' }, { status: 502 });
      return Response.json({ text: text.slice(0, MAX_SOURCE_CHARS) });
    }

    const spec = SECTIONS[section];
    if (!spec) return Response.json({ error: `Unknown section: ${section}` }, { status: 400 });
    if (!sourceText) return Response.json({ error: 'A script is required.' }, { status: 400 });

    const extra = section === 'agent_config'
      ? await currentAgentConfig(base44)
      : section === 'counterpart'
        ? await counterpartContext(base44, body?.sourceDirection === 'incoming' ? 'incoming' : 'outgoing')
        : '';
    const data = await askAI(base44, `${SYSTEM}\n\n${spec.prompt(sourceText, label, extra)}`, SECTION_SCHEMAS[section]);

    return Response.json({ section, data });
  } catch (error: any) {
    console.error('[aiScriptBuilder] error:', error?.message || String(error));
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}