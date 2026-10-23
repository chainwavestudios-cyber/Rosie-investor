/**
 * engagementReport — the brain behind the Email Engagement page and the
 * contact-card engagement score.
 *
 * Two systems, reported separately and never mixed:
 *   • coach   — Debt Call Coach email (credentials & welcome, cold introduction,
 *               follow-up introduction, appointment reminders, notice, Steph,
 *               Golden Boy). Scores land on Debt Call Coach contact cards.
 *   • fronter — the fronter workspace's tracked outreach. Scores drive the
 *               prospect → lead promotion; they never travel into Debt Call Coach.
 *
 * Reads the tracked email activity (EmailTrackingEvent) joined to the sends that
 * produced it (EmailLog) and returns, in one call: per-campaign effectiveness,
 * per-lead engagement scores ranked for follow-up, and the live activity tail.
 * Pass { leadId } for one contact card's score in both systems.
 *
 * Access: a platform admin, or a fronter / admin / super-admin session.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { marketingUser } from '../../shared/fronterMarketing.ts';
import { BOT_FILTER_MS, MIGRATION_START_SCORE, categoryFor, scoreForSystem } from '../../shared/engagement.ts';

const PAGE = 200;
const MAX_EVENTS = 1000;
const MAX_SENDS = 1000;
const TOP_LEADS = 40;
const RECENT = 25;
const LEAD_CHUNK = 25;
const EVENT_TYPES = ['open', 'click', 'qualify_visit'];
const SYSTEMS = ['coach', 'fronter'];

export default async function (req: Request): Promise<Response> {
  try {
    const body: any = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    await marketingUser(base44, body); // platform admin, or a fronter / admin session

    if (body.leadId) return Response.json({ lead: await scoreOne(base44, String(body.leadId)) });
    return Response.json(await buildReport(base44, body));
  } catch (error: any) {
    const forbidden = error?.message === 'Forbidden' || error?.message === 'Unauthorized';
    console.error('[engagementReport] Error:', error?.message);
    return Response.json({ error: error?.message || 'Engagement report failed' }, { status: forbidden ? 403 : 500 });
  }
}

/** Cursor-paged read, capped so one report can never run away. */
async function readAll(entity: any, query: any, max: number, sort: string) {
  const rows: any[] = [];
  let cursor: string | null = null;
  while (rows.length < max) {
    const options: any = { sort, limit: Math.min(PAGE, max - rows.length) };
    if (cursor) options.cursor = cursor;
    const page = await entity.filter(query, options);
    const items = Array.isArray(page) ? page : (page?.items || []);
    rows.push(...items);
    cursor = Array.isArray(page) ? null : (page?.next_cursor || null);
    if (!cursor || items.length === 0) break;
  }
  return rows.slice(0, max);
}

/** One contact card: its score in each system, and what to do next. */
async function scoreOne(base44: any, leadId: string) {
  const page = await base44.asServiceRole.entities.EmailTrackingEvent.filter({ leadId }, { sort: '-trackedAt', limit: 200 });
  const events = (Array.isArray(page) ? page : (page?.items || [])).filter((event: any) => EVENT_TYPES.includes(String(event.eventType)));

  let lead: any = null;
  try { lead = await base44.asServiceRole.entities.FronterLead.get(leadId); } catch { lead = null; }
  const fronterLead = !!lead;
  if (!lead) lead = await base44.asServiceRole.entities.DebtLead.get(leadId).catch(() => null);
  const live = fronterLead ? 'fronter' : 'coach';

  const coach = scoreForSystem(leadId, events, 'coach', Date.now());
  const fronter = scoreForSystem(leadId, events, 'fronter', Date.now());

  return {
    id: leadId,
    leadId,
    name: lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : '',
    liveSystem: live,
    // Flat fields describe the system the card actually lives in.
    score: live === 'coach' ? coach.score : fronter.score,
    tier: live === 'coach' ? coach.tier : fronter.tier,
    tierLabel: live === 'coach' ? coach.tierLabel : fronter.tierLabel,
    hotLead: coach.hotLead,
    action: live === 'coach' ? coach.action : fronter.action,
    reasons: live === 'coach' ? coach.reasons : fronter.reasons,
    lastAt: fronter.lastAt || coach.lastAt,
    coach,
    fronter,
  };
}

const isConfirmed = (event: any, now: number) => {
  const at = event?.trackedAt || event?.created_date;
  return !at || now - new Date(at).getTime() > BOT_FILTER_MS;
};

const templateKey = (templateId: any, templateName: any) => (templateId ? `id:${templateId}` : `name:${templateName || ''}`);

async function buildReport(base44: any, body: any) {
  const now = Date.now();
  const days = Math.max(1, Math.min(180, Number(body.days) || 30));
  const since = new Date(now - days * 86_400_000).toISOString();

  const [rawEvents, sends, fronterTemplates, coachTemplates] = await Promise.all([
    readAll(base44.asServiceRole.entities.EmailTrackingEvent, { trackedAt: { $gte: since } }, MAX_EVENTS, '-trackedAt'),
    readAll(base44.asServiceRole.entities.EmailLog, { sentAt: { $gte: since } }, MAX_SENDS, '-sentAt'),
    readAll(base44.asServiceRole.entities.FronterEmailTemplate, {}, 300, '-created_date'),
    readAll(base44.asServiceRole.entities.DebtEmailTemplate, {}, 300, '-created_date'),
  ]);

  // Every template we can name, so an event that carries only a templateId is still attributed.
  const templates = new Map<string, { name: string; system: string; category: string; categoryLabel: string }>();
  const indexTemplate = (id: any, name: string, origin: string) => {
    const category = categoryFor(name);
    templates.set(String(id), { name, system: category.system, category: category.key, categoryLabel: category.label, origin });
  };
  fronterTemplates.forEach((row: any) => indexTemplate(row.id, row.label || 'Fronter template', 'fronter'));
  coachTemplates.forEach((row: any) => indexTemplate(row.id, row.name || 'Coach template', 'coach'));

  // Each event is labelled with its family up front, so the shared scorer reads one name.
  const events = rawEvents
    .filter((event: any) => EVENT_TYPES.includes(String(event.eventType)) && event.leadId && isConfirmed(event, now))
    .map((event: any) => {
      const known = templates.get(String(event.templateId || ''));
      const name = known?.name || event.templateName || '';
      const category = categoryFor(name);
      return { ...event, templateName: name, category: category.key, categoryLabel: category.label, system: known?.system || category.system };
    });

  const sendingRows = sends.map((log: any) => {
    const known = templates.get(String(log.templateId || ''));
    const category = known ? null : categoryFor(null, log.subject);
    return { ...log, name: known?.name || '', system: known?.system || category!.system, categoryLabel: known?.categoryLabel || category!.label };
  });

  const wanted = new Set<string>();
  const systems: any = {};

  SYSTEMS.forEach((system) => {
    const systemEvents = events.filter((event: any) => event.system === system);
    const systemSends = sendingRows.filter((row: any) => row.system === system);
    const result = buildSystem({ system, events: systemEvents, sends: systemSends, now });
    systems[system] = result;
    result.leadIds.slice(0, TOP_LEADS).forEach((leadId: string) => wanted.add(leadId));
    systemEvents.slice(0, RECENT).forEach((event: any) => wanted.add(String(event.leadId)));
  });

  // Names captured at send time, so an event whose lead lives outside either CRM still reads as a person.
  const sentNames = new Map<string, string>();
  sends.forEach((log: any) => { if (log.leadId && log.toName) sentNames.set(String(log.leadId), String(log.toName)); });
  const describe = await buildDescribe(base44, [...wanted], sentNames);

  SYSTEMS.forEach((system) => {
    const result = systems[system];
    result.leads = result.leadIds.slice(0, TOP_LEADS).map((leadId: string) => {
      const entry = result.scoreOf[leadId];
      return {
        id: leadId,
        leadId,
        ...describe(leadId),
        score: entry.score,
        tier: entry.tier,
        tierLabel: entry.tierLabel,
        hotLead: entry.hotLead,
        action: entry.action,
        reasons: entry.reasons,
        opens: entry.signals?.opens ?? 0,
        clicks: entry.signals?.clicks ?? 0,
        linkKeys: entry.signals?.linkKeys ?? [],
        welcomeViewed: !!entry.signals?.welcomeAudioAt,
        qualifyVisited: !!entry.signals?.qualifyAt,
        templates: entry.signals?.templates ?? [],
        lastAt: entry.lastAt,
      };
    });
    result.recent = result.recentEvents.map((event: any) => {
      const who = describe(String(event.leadId));
      return {
        id: event.id,
        leadId: String(event.leadId),
        leadName: who.name || (who.onFile === false ? 'Contact card removed' : 'Lead'),
        eventType: event.eventType,
        url: event.url || '',
        categoryLabel: event.categoryLabel || '',
        templateName: event.templateName || '',
        trackedAt: event.trackedAt || event.created_date,
      };
    });
    delete result.scoreOf;
    delete result.leadIds;
    delete result.recentEvents;
  });

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    migrationStartScore: MIGRATION_START_SCORE,
    truncated: { events: rawEvents.length >= MAX_EVENTS, sends: sends.length >= MAX_SENDS },
    systems,
  };
}

/** One system's whole report — its own summary, campaigns, ranking and feed. */
function buildSystem({ system, events, sends, now }: any) {
  const byLead = new Map<string, any[]>();
  events.forEach((event: any) => {
    const leadId = String(event.leadId);
    if (!byLead.has(leadId)) byLead.set(leadId, []);
    byLead.get(leadId)!.push(event);
  });

  const scored = [...byLead.entries()]
    .map(([leadId, rows]) => ({ leadId, ...scoreForSystem(leadId, rows, system, now) }))
    .sort((a, b) => (b.score - a.score) || (new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime()));
  const scoreOf: Record<string, any> = Object.fromEntries(scored.map((entry) => [entry.leadId, entry]));

  // ── Campaigns ──
  const campaigns = new Map<string, any>();
  const campaignRow = (key: string, categoryLabel: string) => {
    if (!campaigns.has(key)) {
      campaigns.set(key, {
        key, categoryLabel, sent: 0, emailedLeads: new Set<string>(), leadIds: new Set<string>(),
        opens: 0, openerLeads: new Set<string>(), clicks: 0, clickerLeads: new Set<string>(),
        welcomeLeads: new Set<string>(), qualifyLeads: new Set<string>(), lastAt: null, lastSentAt: null,
        fallbackName: '', templateId: null,
      });
    }
    return campaigns.get(key);
  };

  sends.forEach((log: any) => {
    if (!log.templateId) return; // unattributable send (investor / portal mail) — not a campaign
    const row = campaignRow(templateKey(log.templateId, null), log.categoryLabel || '');
    if (!row.fallbackName && log.name) row.fallbackName = log.name;
    row.sent += 1;
    if (log.leadId) row.emailedLeads.add(String(log.leadId));
    if (log.sentAt && (!row.lastSentAt || log.sentAt > row.lastSentAt)) row.lastSentAt = log.sentAt;
  });

  events.forEach((event: any) => {
    const row = campaignRow(templateKey(event.templateId, event.templateName), event.categoryLabel || '');
    const leadId = String(event.leadId);
    row.leadIds.add(leadId);
    if (event.templateId) row.templateId = event.templateId;
    if (!row.fallbackName && event.templateName) row.fallbackName = event.templateName;
    const at = event.trackedAt || event.created_date;
    if (at && (!row.lastAt || at > row.lastAt)) row.lastAt = at;
    if (event.eventType === 'open') { row.opens += 1; row.openerLeads.add(leadId); }
    else if (event.eventType === 'click') { row.clicks += 1; row.clickerLeads.add(leadId); }
    else if (event.eventType === 'qualify_visit') row.qualifyLeads.add(leadId);
  });

  const campaignRows = [...campaigns.values()]
    .map((row) => {
      const scores = [...row.leadIds].map((leadId) => scoreOf[leadId]?.score || 0);
      const fallbackName = row.fallbackName || row.key.slice(5) || 'Untracked template';
      return {
        key: row.key,
        name: fallbackName,
        categoryLabel: row.categoryLabel || categoryFor(row.fallbackName).label,
        attributed: !!row.fallbackName,
        system,
        sent: row.sent,
        emailedLeads: row.emailedLeads.size,
        engagedLeads: row.leadIds.size,
        opens: row.opens,
        uniqueOpeners: row.openerLeads.size,
        clicks: row.clicks,
        uniqueClickers: row.clickerLeads.size,
        welcomeViews: row.welcomeLeads.size,
        qualifyVisits: row.qualifyLeads.size,
        hotLeads: [...row.leadIds].filter((leadId) => scoreOf[leadId]?.hotLead).length,
        avgScore: scores.length ? Math.round(scores.reduce((sum: number, value: number) => sum + value, 0) / scores.length) : 0,
        lastAt: row.lastAt || row.lastSentAt,
      };
    })
    .filter((row) => row.engagedLeads > 0 || (row.sent > 0 && row.attributed))
    // Named campaigns first: the unattributed bucket must never read as the winner.
    .sort((a, b) => (Number(b.attributed) - Number(a.attributed)) || (b.avgScore - a.avgScore) || (b.engagedLeads - a.engagedLeads));

  const summary = {
    emailsSent: sends.length,
    leadsEmailed: new Set(sends.map((log: any) => String(log.leadId || '')).filter(Boolean)).size,
    leadsEngaged: scored.length,
    opens: events.filter((event: any) => event.eventType === 'open').length,
    uniqueOpeners: scored.filter((entry) => (entry.signals?.opens || 0) > 0).length,
    clicks: events.filter((event: any) => event.eventType === 'click').length,
    uniqueClickers: scored.filter((entry) => (entry.signals?.clicks || 0) > 0).length,
    welcomeViews: scored.filter((entry) => entry.signals?.welcomeAudioAt).length,
    qualifyVisits: scored.filter((entry) => entry.signals?.qualifyAt).length,
    hotLeads: scored.filter((entry) => entry.hotLead).length,
    engagedLeads: scored.filter((entry) => entry.tier === 'hot' || entry.tier === 'engaged').length,
    avgScore: scored.length ? Math.round(scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length) : 0,
  };

  return {
    system,
    summary,
    campaigns: campaignRows,
    hot: scored.filter((entry) => entry.hotLead).slice(0, 10).map((entry) => ({ leadId: entry.leadId, score: entry.score, action: entry.action, reasons: entry.reasons })),
    leadIds: scored.map((entry) => entry.leadId),
    scoreOf,
    recentEvents: events.slice(0, RECENT),
  };
}

/** Names for every lead id we are about to show — fronter cards first, coach leads after. */
async function buildDescribe(base44: any, ids: string[], sentNames?: Map<string, string>) {
  const leadById = new Map<string, any>();
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += LEAD_CHUNK) chunks.push(ids.slice(index, index + LEAD_CHUNK));

  const fronterPages = await Promise.all(chunks.map((chunk) =>
    base44.asServiceRole.entities.FronterLead.filter({ id: { $in: chunk } }, { limit: chunk.length }).catch(() => [])));
  fronterPages.forEach((page: any) => {
    const items = Array.isArray(page) ? page : (page?.items || []);
    items.forEach((lead: any) => leadById.set(String(lead.id), lead));
  });

  const missing = ids.filter((leadId) => !leadById.has(leadId));
  const missingChunks: string[][] = [];
  for (let index = 0; index < missing.length; index += LEAD_CHUNK) missingChunks.push(missing.slice(index, index + LEAD_CHUNK));
  const coachPages = await Promise.all(missingChunks.map((chunk) =>
    base44.asServiceRole.entities.DebtLead.filter({ id: { $in: chunk } }, { limit: chunk.length }).catch(() => [])));
  coachPages.forEach((page: any) => {
    const items = Array.isArray(page) ? page : (page?.items || []);
    items.forEach((lead: any) => leadById.set(String(lead.id), { ...lead, coachLead: true }));
  });

  return (leadId: string) => {
    const lead = leadById.get(leadId);
    if (!lead) return { name: sentNames?.get(leadId) || '', phone: '', email: '', assignedTo: '', status: '', source: 'fronter', onFile: false };
    return {
      name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
      phone: lead.phone || '',
      email: lead.email || '',
      assignedTo: lead.coachLead ? (lead.debtCoachOwner || '') : (lead.assignedTo || ''),
      status: lead.status || '',
      source: lead.coachLead ? 'coach' : 'fronter',
      onFile: true,
    };
  };
}