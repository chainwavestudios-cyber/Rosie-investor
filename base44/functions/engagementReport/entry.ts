/**
 * engagementReport — the brain behind the Email Engagement page and the
 * contact-card engagement score.
 *
 * Reads the tracked email activity (EmailTrackingEvent) joined to the sends that
 * produced it (EmailLog) and returns, in one call:
 *   • per-campaign effectiveness — which email actually moves people
 *   • per-lead engagement scores, ranked, for follow-up
 *   • the live activity tail
 * Pass { leadId } for one contact card's score.
 *
 * Access: a platform admin, or a fronter / admin / super-admin session.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { marketingUser } from '../../shared/fronterMarketing.ts';
import { BOT_FILTER_MS, engagementForLead } from '../../shared/engagement.ts';

const PAGE = 200;
const MAX_EVENTS = 1000;
const MAX_SENDS = 1000;
const TOP_LEADS = 60;
const RECENT = 30;
const LEAD_CHUNK = 25;
const EVENT_TYPES = ['open', 'click', 'qualify_visit'];

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

/** One contact card: its score, what produced it, and what to do next. */
async function scoreOne(base44: any, leadId: string) {
  const page = await base44.asServiceRole.entities.EmailTrackingEvent.filter({ leadId }, { sort: '-trackedAt', limit: 200 });
  const events = Array.isArray(page) ? page : (page?.items || []);
  const scored = engagementForLead(leadId, events, Date.now());
  let lead: any = null;
  try { lead = await base44.asServiceRole.entities.FronterLead.get(leadId); } catch { lead = null; }
  if (!lead) lead = await base44.asServiceRole.entities.DebtLead.get(leadId).catch(() => null);
  return {
    id: leadId,
    leadId,
    name: lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : '',
    score: scored.score,
    tier: scored.tier,
    tierLabel: scored.tierLabel,
    action: scored.action,
    reasons: scored.reasons,
    signals: scored.signals,
    lastAt: scored.signals.lastAt,
  };
}

const isConfirmed = (event: any, now: number) => {  const at = event?.trackedAt || event?.created_date;
  return !at || now - new Date(at).getTime() > BOT_FILTER_MS;
};

const templateKey = (templateId: any, templateName: any) => (templateId ? `id:${templateId}` : `name:${templateName || ''}`);

async function buildReport(base44: any, body: any) {
  const now = Date.now();
  const days = Math.max(1, Math.min(180, Number(body.days) || 30));
  const since = new Date(now - days * 86_400_000).toISOString();

  const [events, sends, fronterTemplates, coachTemplates] = await Promise.all([
    readAll(base44.asServiceRole.entities.EmailTrackingEvent, { trackedAt: { $gte: since } }, MAX_EVENTS, '-trackedAt'),
    readAll(base44.asServiceRole.entities.EmailLog, { sentAt: { $gte: since } }, MAX_SENDS, '-sentAt'),
    readAll(base44.asServiceRole.entities.FronterEmailTemplate, {}, 300, '-created_date'),
    readAll(base44.asServiceRole.entities.DebtEmailTemplate, {}, 300, '-created_date'),
  ]);

  // Every template we can name, so an event that carries only a templateId is still attributed.
  const templates = new Map<string, { name: string; system: string }>();
  fronterTemplates.forEach((row: any) => templates.set(String(row.id), { name: row.label || 'Fronter template', system: 'fronter' }));
  coachTemplates.forEach((row: any) => templates.set(String(row.id), { name: row.name || 'Coach template', system: 'coach' }));
  const confirmed = events.filter((event: any) => EVENT_TYPES.includes(String(event.eventType)) && event.leadId && isConfirmed(event, now));

  // ── Leads, scored ──
  const byLead = new Map<string, any[]>();
  confirmed.forEach((event: any) => {
    const leadId = String(event.leadId);
    if (!byLead.has(leadId)) byLead.set(leadId, []);
    byLead.get(leadId)!.push(event);
  });
  const scored = [...byLead.entries()]
    .map(([leadId, rows]) => ({ leadId, ...engagementForLead(leadId, rows, now) }))
    .sort((a, b) => (b.score - a.score) || (new Date(b.signals.lastAt || 0).getTime() - new Date(a.signals.lastAt || 0).getTime()));
  const scoreOf = new Map(scored.map((entry) => [entry.leadId, entry]));

  // ── Campaigns ──
  const campaigns = new Map<string, any>();
  const campaignRow = (key: string) => {
    if (!campaigns.has(key)) {
      campaigns.set(key, {
        key, sent: 0, emailedLeads: new Set<string>(), leadIds: new Set<string>(),
        opens: 0, openerLeads: new Set<string>(), clicks: 0, clickerLeads: new Set<string>(),
        welcomeLeads: new Set<string>(), qualifyLeads: new Set<string>(), lastAt: null, lastSentAt: null,
        fallbackName: '', templateId: null,
      });
    }
    return campaigns.get(key);
  };

  sends.forEach((log: any) => {
    if (!log.templateId) return; // unattributable send (investor / portal mail) — not a campaign
    const row = campaignRow(templateKey(log.templateId, null));
    row.sent += 1;
    if (log.leadId) row.emailedLeads.add(String(log.leadId));
    if (log.sentAt && (!row.lastSentAt || log.sentAt > row.lastSentAt)) row.lastSentAt = log.sentAt;
  });

  confirmed.forEach((event: any) => {
    const row = campaignRow(templateKey(event.templateId, event.templateName));
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
      const known = templates.get(String(row.templateId || ''));
      const scores = [...row.leadIds].map((leadId) => scoreOf.get(leadId)?.score || 0);
      const fallbackName = row.fallbackName || row.key.slice(5) || 'Untracked template';
      return {
        key: row.key,
        name: known?.name || fallbackName,
        attributed: !!known || !!row.fallbackName,
        system: known?.system || 'other',
        sent: row.sent,
        emailedLeads: row.emailedLeads.size,
        engagedLeads: row.leadIds.size,
        opens: row.opens,
        uniqueOpeners: row.openerLeads.size,
        clicks: row.clicks,
        uniqueClickers: row.clickerLeads.size,
        welcomeViews: row.welcomeLeads.size,
        qualifyVisits: row.qualifyLeads.size,
        hotLeads: [...row.leadIds].filter((leadId) => scoreOf.get(leadId)?.tier === 'hot').length,
        avgScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
        lastAt: row.lastAt || row.lastSentAt,
      };
    })
    .filter((row) => row.engagedLeads > 0 || (row.sent > 0 && row.attributed))
    // Named campaigns first: the unattributed bucket must never read as the winner.
    .sort((a, b) => (Number(b.attributed) - Number(a.attributed)) || (b.avgScore - a.avgScore) || (b.engagedLeads - a.engagedLeads));

  // ── Lead rows for the ranking and the feed ──
  const wanted = [...new Set([...scored.slice(0, TOP_LEADS).map((entry) => entry.leadId), ...confirmed.slice(0, RECENT).map((event: any) => String(event.leadId))])];
  const leadRows: any[] = [];
  for (let index = 0; index < wanted.length; index += LEAD_CHUNK) {
    const chunk = wanted.slice(index, index + LEAD_CHUNK);
    const page = await base44.asServiceRole.entities.FronterLead.filter({ id: { $in: chunk } }, { limit: chunk.length });
    const items = Array.isArray(page) ? page : (page?.items || []);
    leadRows.push(...items);
  }
  const leadById = new Map(leadRows.map((lead: any) => [String(lead.id), lead]));

  // Anything that is not a fronter contact lives in Debt Call Coach — name those too.
  const missing = wanted.filter((leadId) => !leadById.has(leadId));
  for (let index = 0; index < missing.length; index += LEAD_CHUNK) {
    const chunk = missing.slice(index, index + LEAD_CHUNK);
    const page = await base44.asServiceRole.entities.DebtLead.filter({ id: { $in: chunk } }, { limit: chunk.length });
    const items = Array.isArray(page) ? page : (page?.items || []);
    items.forEach((lead: any) => leadById.set(String(lead.id), { ...lead, coachLead: true }));
  }

  const describe = (leadId: string) => {
    const lead = leadById.get(leadId);
    if (!lead) return { name: '', phone: '', email: '', assignedTo: '', status: '', source: 'fronter' };
    return {
      name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
      phone: lead.phone || '',
      email: lead.email || '',
      assignedTo: lead.coachLead ? (lead.debtCoachOwner || '') : (lead.assignedTo || ''),
      status: lead.status || '',
      source: lead.coachLead ? 'coach' : 'fronter',
    };
  };

  const leads = scored.slice(0, TOP_LEADS).map((entry) => ({
    id: entry.leadId,
    leadId: entry.leadId,
    ...describe(entry.leadId),
    score: entry.score,
    tier: entry.tier,
    tierLabel: entry.tierLabel,
    action: entry.action,
    reasons: entry.reasons,
    opens: entry.signals.opens,
    clicks: entry.signals.clicks,
    linkKeys: entry.signals.linkKeys,
    welcomeViewed: !!entry.signals.welcomeAudioAt,
    qualifyVisited: !!entry.signals.qualifyAt,
    templates: entry.signals.templates,
    lastAt: entry.signals.lastAt,
  }));

  const summary = {
    emailsSent: sends.length,
    leadsEmailed: new Set(sends.map((log: any) => String(log.leadId || '')).filter(Boolean)).size,
    leadsEngaged: scored.length,
    opens: confirmed.filter((event: any) => event.eventType === 'open').length,
    uniqueOpeners: scored.filter((entry) => entry.signals.opens > 0).length,
    clicks: confirmed.filter((event: any) => event.eventType === 'click').length,
    uniqueClickers: scored.filter((entry) => entry.signals.clicks > 0).length,
    welcomeViews: scored.filter((entry) => entry.signals.welcomeAudioAt).length,
    qualifyVisits: scored.filter((entry) => entry.signals.qualifyAt).length,
    hotLeads: scored.filter((entry) => entry.tier === 'hot').length,
    engagedLeads: scored.filter((entry) => entry.tier === 'hot' || entry.tier === 'engaged').length,
    avgScore: scored.length ? Math.round(scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length) : 0,
  };

  const recent = confirmed.slice(0, RECENT).map((event: any) => ({
    id: event.id,
    leadId: String(event.leadId),
    leadName: describe(String(event.leadId)).name,
    eventType: event.eventType,
    url: event.url || '',
    templateName: templates.get(String(event.templateId || ''))?.name || event.templateName || '',
    trackedAt: event.trackedAt || event.created_date,
  }));

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    truncated: { events: events.length >= MAX_EVENTS, sends: sends.length >= MAX_SENDS },
    summary,
    campaigns: campaignRows,
    leads,
    recent,
  };
}