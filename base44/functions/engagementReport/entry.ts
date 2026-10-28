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
import { categoryFor, scoreForSystem } from '../../shared/engagement.ts';
import { readScoringRules } from '../../shared/scoringConfig.ts';

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
    const user = await marketingUser(base44, body); // platform admin, or a fronter / admin session

    // Marking a hot lead worked is the one write this console makes: it records who
    // picked it up, and it clears by itself if that lead heats up again.
    if (body.action === 'handleHotLead') return Response.json(await markHandled(base44, user, body));

    // The rules an admin saved on the Automations & Scoring screen, over the built-in model.
    const rules = await readScoringRules(base44);

    if (body.leadId) return Response.json({ lead: await scoreOne(base44, String(body.leadId), rules) });
    return Response.json(await buildReport(base44, body, rules));
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

/**
 * The send log the report counts against.
 *
 * EmailMessage is what every tracked send writes today — credentials & welcome,
 * follow-ups, campaign mail, reminders. EmailLog is the older log that only some
 * senders also wrote, so it is folded in only for a send EmailMessage does not
 * already hold: counting both would double every campaign send.
 */
async function readSends(base44: any, since: string) {
  const [messages, legacy] = await Promise.all([
    readAll(base44.asServiceRole.entities.EmailMessage, { sentAt: { $gte: since } }, MAX_SENDS, '-sentAt'),
    readAll(base44.asServiceRole.entities.EmailLog, { sentAt: { $gte: since } }, MAX_SENDS, '-sentAt'),
  ]);

  const rows: any[] = messages
    .filter((message: any) => message.status !== 'failed' && message.status !== 'skipped_duplicate' && !message.unsentAt)
    .map((message: any) => ({
      leadId: message.contactId || '',
      toName: message.contactName || '',
      toEmail: message.contactEmail || '',
      templateId: message.templateId || '',
      templateName: message.templateName || '',
      subject: message.subject || '',
      sentAt: message.sentAt || message.created_date,
    }));

  const seen = new Set(rows.map((row: any) => `${row.leadId || row.toEmail}|${row.templateId || row.templateName}`));
  legacy.forEach((log: any) => {
    const key = `${log.leadId || log.toEmail || ''}|${log.templateId || log.templateName || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      leadId: log.leadId || '',
      toName: log.toName || '',
      toEmail: log.toEmail || '',
      templateId: log.templateId || '',
      templateName: log.templateName || '',
      subject: log.subject || '',
      sentAt: log.sentAt || log.created_date,
    });
  });

  return rows.sort((a: any, b: any) => String(b.sentAt || '').localeCompare(String(a.sentAt || ''))).slice(0, MAX_SENDS);
}

/** One contact card: its score in each system, and what to do next. */
async function scoreOne(base44: any, leadId: string, rules: any) {
  const page = await base44.asServiceRole.entities.EmailTrackingEvent.filter({ leadId }, { sort: '-trackedAt', limit: 200 });
  const events = (Array.isArray(page) ? page : (page?.items || [])).filter((event: any) => EVENT_TYPES.includes(String(event.eventType)));

  let lead: any = null;
  try { lead = await base44.asServiceRole.entities.FronterLead.get(leadId); } catch { lead = null; }
  const fronterLead = !!lead;
  if (!lead) lead = await base44.asServiceRole.entities.DebtLead.get(leadId).catch(() => null);
  const live = fronterLead ? 'fronter' : 'coach';

  const coach = scoreForSystem(leadId, events, 'coach', Date.now(), rules);
  const fronter = scoreForSystem(leadId, events, 'fronter', Date.now(), rules);

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

const isConfirmed = (event: any, now: number, rules: any) => {
  const at = event?.trackedAt || event?.created_date;
  return !at || now - new Date(at).getTime() > rules.botFilterSeconds * 1000;
};

const templateKey = (templateId: any, templateName: any) => (templateId ? `id:${templateId}` : `name:${templateName || ''}`);

async function buildReport(base44: any, body: any, rules: any) {
  const now = Date.now();
  const days = Math.max(1, Math.min(180, Number(body.days) || 30));
  const since = new Date(now - days * 86_400_000).toISOString();

  const [rawEvents, sends, fronterTemplates, coachTemplates] = await Promise.all([
    readAll(base44.asServiceRole.entities.EmailTrackingEvent, { trackedAt: { $gte: since } }, MAX_EVENTS, '-trackedAt'),
    readSends(base44, since),
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
    .filter((event: any) => EVENT_TYPES.includes(String(event.eventType)) && event.leadId && isConfirmed(event, now, rules))
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
    const result = buildSystem({ system, events: systemEvents, sends: systemSends, now, rules });
    systems[system] = result;
    result.leadIds.slice(0, TOP_LEADS).forEach((leadId: string) => wanted.add(leadId));
    result.hotLeadIds.forEach((leadId: string) => wanted.add(leadId));
    // Anyone a tile counts must resolve to a name, or the click-through has nothing to show.
    Object.values(result.metricLeads || {}).flat().forEach((leadId: any) => wanted.add(String(leadId)));
    systemEvents.slice(0, RECENT).forEach((event: any) => wanted.add(String(event.leadId)));
  });

  // Names captured at send time, so an event whose lead lives outside either CRM still reads as a person.
  const sentNames = new Map<string, string>();
  sends.forEach((log: any) => { if (log.leadId && log.toName) sentNames.set(String(log.leadId), String(log.toName)); });
  const describe = await buildDescribe(base44, [...wanted], sentNames);

  // ── The permanent hot-lead record ──
  // The cue at the top of the console only shows who is hot this minute and clears
  // itself. Everyone who has ever crossed into hot is written down here instead, with
  // when they first appeared, when they were last on the list and how often they came back.
  await Promise.all(SYSTEMS.map(async (system) => {
    const result = systems[system];
    const entries = result.hotLeadIds
      .map((leadId: string) => ({ leadId, ...(result.scoreOf[leadId] || {}) }))
      .filter((entry: any) => typeof entry.score === 'number');
    await recordHotLeads(base44, system, entries, describe);
    result.hotHistory = await readHotHistory(base44, system);
  }));

  SYSTEMS.forEach((system) => {
    const result = systems[system];
    const rowIds = [...new Set([...result.leadIds.slice(0, TOP_LEADS), ...Object.values(result.metricLeads || {}).flat()])] as string[];
    result.leads = rowIds.map((leadId: string) => {
      const entry = result.scoreOf[leadId] || {};
      return {
        id: leadId,
        leadId,
        ...describe(leadId),
        score: entry.score ?? 0,
        tier: entry.tier || 'cold',
        tierLabel: entry.tierLabel || '',
        hotLead: !!entry.hotLead,
        action: entry.action || '',
        reasons: entry.reasons || [],
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
        phone: who.phone || '',
        email: who.email || '',
        source: who.source || '',
        onFile: who.onFile !== false,
        eventType: event.eventType,
        url: event.url || '',
        categoryLabel: event.categoryLabel || '',
        templateName: event.templateName || '',
        trackedAt: event.trackedAt || event.created_date,
      };
    });
    delete result.scoreOf;
    delete result.leadIds;
    delete result.hotLeadIds;
    delete result.recentEvents;
  });

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    migrationStartScore: rules.migrationStartScore,
    truncated: { events: rawEvents.length >= MAX_EVENTS, sends: sends.length >= MAX_SENDS },
    systems,
  };
}

/** One system's whole report — its own summary, campaigns, ranking and feed. */
function buildSystem({ system, events, sends, now, rules }: any) {
  const byLead = new Map<string, any[]>();
  events.forEach((event: any) => {
    const leadId = String(event.leadId);
    if (!byLead.has(leadId)) byLead.set(leadId, []);
    byLead.get(leadId)!.push(event);
  });

  const scored = [...byLead.entries()]
    .map(([leadId, rows]) => ({ leadId, ...scoreForSystem(leadId, rows, system, now, rules) }))
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

  // Who is behind each number — every tile in the console is click-through, so each
  // metric carries the ids of the people it counted and the summary is their length.
  const leadsWhere = (keep: (entry: any) => boolean) => scored.filter(keep).map((entry: any) => entry.leadId);
  const metricLeads: Record<string, string[]> = {
    emailsSent: [...new Set(sends.map((log: any) => String(log.leadId || '')).filter(Boolean))],
    leadsEngaged: leadsWhere(() => true),
    uniqueOpeners: leadsWhere((entry) => (entry.signals?.opens || 0) > 0),
    uniqueClickers: leadsWhere((entry) => (entry.signals?.clicks || 0) > 0),
    welcomeViews: leadsWhere((entry) => !!entry.signals?.welcomeAudioAt),
    qualifyVisits: leadsWhere((entry) => !!entry.signals?.qualifyAt),
    hotLeads: leadsWhere((entry) => !!entry.hotLead),
    engagedLeads: leadsWhere((entry) => entry.tier === 'hot' || entry.tier === 'engaged'),
    avgScore: leadsWhere(() => true),
  };

  const summary = {
    emailsSent: sends.length,
    leadsEmailed: metricLeads.emailsSent.length,
    leadsEngaged: metricLeads.leadsEngaged.length,
    opens: events.filter((event: any) => event.eventType === 'open').length,
    uniqueOpeners: metricLeads.uniqueOpeners.length,
    clicks: events.filter((event: any) => event.eventType === 'click').length,
    uniqueClickers: metricLeads.uniqueClickers.length,
    welcomeViews: metricLeads.welcomeViews.length,
    qualifyVisits: metricLeads.qualifyVisits.length,
    hotLeads: metricLeads.hotLeads.length,
    engagedLeads: metricLeads.engagedLeads.length,
    avgScore: scored.length ? Math.round(scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length) : 0,
  };

  return {
    system,
    summary,
    metricLeads,
    campaigns: campaignRows,
    hot: scored.filter((entry) => entry.hotLead).slice(0, 10).map((entry) => ({ leadId: entry.leadId, score: entry.score, action: entry.action, reasons: entry.reasons })),
    hotLeadIds: scored.filter((entry) => entry.hotLead).map((entry) => entry.leadId),
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

const pageRows = (page: any) => (Array.isArray(page) ? page : (page?.items || []));

/** How often an untouched record's heartbeat is re-stamped while it stays hot. */
const HOT_REFRESH_MS = 5 * 60 * 1000;

/**
 * Write down everyone who is hot, and keep writing them down. A lead who cools keeps
 * their record (the live flag just drops); a lead who heats up again counts another visit
 * on the same record. Writes happen only when something actually changed.
 */
async function recordHotLeads(base44: any, system: string, entries: any[], describe: (leadId: string) => any) {
  const entity = base44.asServiceRole.entities.EngagementHotLead;
  const nowIso = new Date().toISOString();
  const now = Date.now();
  const hot = new Map<string, any>(entries.map((entry: any) => [String(entry.leadId), entry]));

  const live = pageRows(await entity.filter({ system, wasHot: true }, { limit: 200 }).catch(() => []));
  const liveIds = new Set(live.map((row: any) => String(row.leadId)));
  const backOnTheList = [...hot.keys()].filter((leadId) => !liveIds.has(leadId));
  const returning = backOnTheList.length
    ? new Map<string, any>(pageRows(await entity.filter({ system, leadId: { $in: backOnTheList } }, { limit: 200 }).catch(() => []))
      .map((row: any) => [String(row.leadId), row]))
    : new Map<string, any>();

  const writes: Promise<any>[] = [];
  const save = (id: string, patch: any) => writes.push(entity.update(id, patch).catch(() => null));

  // 1. Records already on the live list: refresh them, or close the ones that cooled.
  for (const record of live) {
    const entry = hot.get(String(record.leadId));
    if (!entry) {
      save(record.id, { wasHot: false, cooledAt: nowIso });
      continue;
    }
    hot.delete(String(record.leadId));
    const patch = recordPatch(record, entry, describe(String(record.leadId)) || {}, { nowIso, reenter: false });
    const lastHot = record.lastHotAt ? new Date(record.lastHotAt).getTime() : 0;
    if (!lastHot || now - lastHot > HOT_REFRESH_MS) patch.lastHotAt = nowIso;
    if (Object.keys(patch).length) save(record.id, patch);
  }

  // 2. A lead who comes back to the list: same record, another visit.
  for (const record of returning.values()) {
    const entry = hot.get(String(record.leadId));
    if (!entry) continue;
    hot.delete(String(record.leadId));
    const patch = recordPatch(record, entry, describe(String(record.leadId)) || {}, { nowIso, reenter: true });
    patch.lastHotAt = nowIso;
    save(record.id, patch);
  }

  // 3. Anyone new to the list is written down the first time they appear.
  for (const entry of hot.values()) {
    const fresh = describe(String(entry.leadId)) || {};
    writes.push(entity.create({
      leadId: String(entry.leadId),
      system,
      source: fresh.source || system,
      name: fresh.name || '',
      phone: fresh.phone || '',
      email: fresh.email || '',
      firstHotAt: nowIso,
      lastEnteredAt: nowIso,
      lastHotAt: nowIso,
      cooledAt: null,
      hotSessions: 1,
      peakScore: Number(entry.score || 0),
      lastScore: Number(entry.score || 0),
      wasHot: true,
      action: entry.action || '',
      reasonsJson: JSON.stringify(entry.reasons || []),
      handledAt: null,
      handledBy: '',
    }).catch(() => null));
  }

  await Promise.all(writes);
}

/** What changed on a record since the last pass — empty when nothing did. */
function recordPatch(record: any, entry: any, fresh: any, { nowIso, reenter }: { nowIso: string; reenter: boolean }) {
  const patch: any = {};
  if (!record.name && fresh.name) patch.name = fresh.name;
  if (!record.phone && fresh.phone) patch.phone = fresh.phone;
  if (!record.email && fresh.email) patch.email = fresh.email;
  if (reenter) {
    patch.wasHot = true;
    patch.cooledAt = null;
    patch.hotSessions = Number(record.hotSessions || 0) + 1;
    patch.lastEnteredAt = nowIso;
    patch.handledAt = null;
    patch.handledBy = '';
  }
  if (Number(entry.score || 0) > Number(record.peakScore || 0)) patch.peakScore = Number(entry.score || 0);
  if (Number(record.lastScore || 0) !== Number(entry.score || 0)) patch.lastScore = Number(entry.score || 0);
  if ((record.action || '') !== (entry.action || '')) patch.action = entry.action || '';
  const reasons = JSON.stringify(entry.reasons || []);
  if ((record.reasonsJson || '') !== reasons) patch.reasonsJson = reasons;
  return patch;
}

/** The record, newest arrival first, with whether each lead is on the live list right now. */
async function readHotHistory(base44: any, system: string) {
  const rows = pageRows(await base44.asServiceRole.entities.EngagementHotLead
    .filter({ system }, { sort: '-lastEnteredAt', limit: 200 })
    .catch(() => []));
  return rows.map((row: any) => ({
    id: row.id,
    leadId: String(row.leadId),
    system: row.system,
    name: row.name || '',
    phone: row.phone || '',
    email: row.email || '',
    source: row.source || row.system,
    firstHotAt: row.firstHotAt || row.created_date,
    lastEnteredAt: row.lastEnteredAt || row.firstHotAt || row.created_date,
    lastHotAt: row.lastHotAt || row.lastEnteredAt || row.created_date,
    hotSessions: Number(row.hotSessions || 1),
    peakScore: Number(row.peakScore || 0),
    lastScore: Number(row.lastScore || 0),
    stillHot: row.wasHot === true,
    handledAt: row.handledAt || null,
    handledBy: row.handledBy || '',
    action: row.action || '',
    reasons: safeReasons(row.reasonsJson),
  }));
}

function safeReasons(value: any): string[] {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.filter((reason) => typeof reason === 'string') : [];
  } catch { return []; }
}

/** A person worked the record — or put it back on the queue. */
async function markHandled(base44: any, user: any, body: any) {
  const id = String(body.recordId || '');
  const system = String(body.system || 'coach');
  if (!id) throw new Error('Choose a hot lead record.');
  const record = await base44.asServiceRole.entities.EngagementHotLead.get(id).catch(() => null);
  if (!record) throw new Error('That hot lead record no longer exists.');
  const handled = body.handled !== false;
  await base44.asServiceRole.entities.EngagementHotLead.update(id, {
    handledAt: handled ? new Date().toISOString() : null,
    handledBy: handled ? (user?.username || '') : '',
  });
  return { ok: true, system, history: await readHotHistory(base44, system) };
}