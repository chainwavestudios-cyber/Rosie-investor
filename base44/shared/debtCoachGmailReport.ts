/**
 * Debt Call Coach Gmail engagement report.
 * Scope: DebtEmailTemplate -> debtEmailSender -> Gmail EmailMessage,
 * with EmailTrackingEvent joined by the unique per-send ID.
 * Never reads Fronter templates, SMTPfast campaigns or investor mail.
 * Read-only; historical legacy EmailLog rows are returned separately.
 */

const MAX = 5000;
const PAGE = 200;
// Backend-forwarded redirect clicks frequently arrive as "Base44-Backend".
// That string identifies the relay, not the person who opened the link.
// Count these as UNVERIFIED tracked clicks; do not mislabel them as bots.
// Open pixels remain proxy/unknown because mail services fetch them automatically.
const knownBot = (agent: unknown) => /ggpht\.com|googleimageproxy|googlebot|bingbot|crawler|spider|headless|linkpreview|proofpoint|barracuda|mimecast|safe.?links|urlscan/i.test(String(agent || '').toLowerCase());
const relay = (agent: unknown) => /base44-backend/i.test(String(agent || ''));
const automatedOpen = (agent: unknown) => relay(agent) || knownBot(agent);
const countedClick = (event: any) => event.eventType === 'click' && !!event.url && !knownBot(event.userAgent);
const eventQuality = (event: any) => {
  if (knownBot(event.userAgent)) return 'proxy_or_automated';
  if (event.eventType === 'click' && relay(event.userAgent)) return 'unverified_relay_click';
  if (event.eventType === 'open' && relay(event.userAgent)) return 'proxy_or_automated';
  return 'unverified_nonproxy';
};
const rows = (page: any): any[] => Array.isArray(page) ? page : (page?.items || []);
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const clock = (value: any): number => new Date(value || 0).getTime() || 0;

async function readAll(entity: any, filter: any, sort: string) {
  const out: any[] = [];
  let cursor: string | null = null;
  while (out.length < MAX) {
    const options: any = { sort, limit: Math.min(PAGE, MAX - out.length) };
    if (cursor) options.cursor = cursor;
    const page = await entity.filter(filter, options);
    const next = rows(page);
    out.push(...next);
    cursor = Array.isArray(page) ? null : (page?.next_cursor || null);
    if (!cursor || !next.length) break;
  }
  return { items: out, truncated: out.length === MAX };
}

function intentScore(events: any[], sessions: any[]) {
  const opens = events.filter((e) => e.eventType === 'open' && !automatedOpen(e.userAgent));
  const clickEvents = events.filter(countedClick);
  const links = unique(clickEvents.map((e) => String(e.url)));
  const visits = events.filter((e) => e.eventType === 'qualify_visit' && !knownBot(e.userAgent));
  // Corroborate click redirects with first-party playback/calendar events for
  // high-intent classification. Link scanners alone must not make someone hot.
  const audioBest = Math.max(0, ...sessions.map((s: any) => Number(s.percentListened || 0)));
  const calendarOpened = sessions.some((s: any) => !!s.calendarOpenedAt);
  const websiteClicked = sessions.some((s: any) => !!s.websiteClickedAt);
  const audioPoints = audioBest >= 98 ? 22 : audioBest >= 75 ? 16 : audioBest >= 25 ? 8 : audioBest >= 5 ? 3 : 0;
  const score = Math.min(100, (opens.length ? 3 : 0) + Math.min(links.length, 4) * 12 + (visits.length ? 25 : 0)
    + audioPoints + (calendarOpened ? 15 : 0) + (websiteClicked ? 8 : 0));
  const corroborated = visits.length > 0 || calendarOpened || audioBest >= 75;
  const active = links.length > 0 || visits.length > 0 || audioBest >= 5 || calendarOpened || websiteClicked;
  return { score, tier: score >= 60 && corroborated ? 'high' : active ? 'engaged' : opens.length ? 'open_only' : 'none',
    reasons: [visits.length ? 'Qualification page visited' : '', links.length ? String(links.length) + ' tracked link destination(s) (visitor unverified)' : '', audioBest >= 5 ? String(Math.round(audioBest)) + '% estimated audio playback' : '', calendarOpened ? 'Calendar opened' : '', websiteClicked ? 'Company site opened from welcome page' : '', opens.length ? String(opens.length) + ' non-proxy open(s)' : ''].filter(Boolean) };
}

async function authenticate(base44: any, body: any) {
  const id = String(body.sessionUserId || '');
  const token = String(body.sessionToken || '');
  if (!id || !token) return false;
  const user = await base44.asServiceRole.entities.DebtCoachUser.get(id).catch(() => null);
  return user?.isActive && user.sessionToken === token && ['admin', 'super_admin'].includes(user.role) ? user : null;
}

export default async function debtCoachGmailReport(base44: any, body: any): Promise<Response> {
  try {
    const admin = await authenticate(base44, body);
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const svc = base44.asServiceRole.entities;
    if (body.reportAction === 'handleCoachHotLead') {
      const recordId = String(body.recordId || '');
      const record = recordId ? await svc.EngagementHotLead.get(recordId).catch(() => null) : null;
      if (!record || record.system !== 'coach') return Response.json({ error: 'Coach hot-lead record not found' }, { status: 404 });
      await svc.EngagementHotLead.update(recordId, {
        handledAt: body.handled === false ? null : new Date().toISOString(),
        handledBy: body.handled === false ? '' : admin.username || '',
      });
      return Response.json({ success: true, recordId });
    }

    const days = Math.max(1, Math.min(180, Number(body.days) || 30));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [templatePage, messagePage, eventPage, audioPage] = await Promise.all([
      readAll(svc.DebtEmailTemplate, {}, 'sortOrder'),
      readAll(svc.EmailMessage, { contactKind: 'debt_lead', created_date: { $gte: since } }, '-created_date'),
      readAll(svc.EmailTrackingEvent, { trackedAt: { $gte: since } }, '-trackedAt'),
      readAll(svc.EmailAudioEngagement, { lastAt: { $gte: since } }, '-lastAt'),
    ]);
    const templates = new Map(templatePage.items.map((t: any) => [String(t.id), t]));
    // Send provenance, not words in subject lines, defines what belongs to Coach.
    const coachMessage = (m: any) => m.contactKind === 'debt_lead'
      && m.source !== 'campaign' && (templates.has(String(m.templateId || '')) || m.sentBy === 'debt_coach');
    const messages = messagePage.items.filter(coachMessage);
    const sentCandidates = messages.filter((m: any) => m.status === 'sent' && !!m.sentAt && !m.unsentAt);
    const knownSendIds = new Set<string>();
    const sends = sentCandidates.filter((m: any) => {
      const id = String(m.sendId || m.id);
      if (knownSendIds.has(id)) return false;
      knownSendIds.add(id);
      return true;
    });
    const failed = messages.filter((m: any) => m.status === 'failed');
    const sendById = new Map(sends.map((m: any) => [String(m.sendId || ''), m]).filter(([id]) => !!id));
    const eventBySend = new Map<string, any[]>();
    for (const ev of eventPage.items) {
      const sendId = String(ev.sendId || '');
      const send = sendById.get(sendId);
      if (!send || (ev.leadId && String(ev.leadId) !== String(send.contactId))) continue;
      if (!eventBySend.has(sendId)) eventBySend.set(sendId, []);
      eventBySend.get(sendId)!.push(ev);
    }
    const audioBySend = new Map<string, any[]>();
    for (const record of audioPage.items) {
      const key = String(record.sendId || '');
      if (!sendById.has(key)) continue;
      if (!audioBySend.has(key)) audioBySend.set(key, []);
      audioBySend.get(key)!.push(record);
    }
    const timeline = sends.map((m: any) => {
      const events = eventBySend.get(String(m.sendId)) || [];
      const opens = events.filter((ev) => ev.eventType === 'open');
      const clicks = events.filter((ev) => ev.eventType === 'click');
      const proxyOpens = opens.filter((ev) => automatedOpen(ev.userAgent));
      const sessions = audioBySend.get(String(m.sendId)) || [];
      const intent = intentScore(events, sessions);
      const audioPlays = sessions.reduce((n: number, s: any) => n + Number(s.playCount || 0), 0);
      const audioBestPercent = Math.max(0, ...sessions.map((s: any) => Number(s.percentListened || 0)));
      const audioCompletionRecorded = sessions.some((s: any) => s.completed === true);
      // The browser may miss the ended event even after almost all the audio played.
      // Record that as estimated full playback, not as an ended event.
      const audioCompletionEstimated = !audioCompletionRecorded && sessions.some((s: any) => Number(s.durationSeconds || 0) >= 10 && Number(s.playedSeconds || 0) / Number(s.durationSeconds || 1) >= 0.98);
      const audioCompleted = audioCompletionRecorded || audioCompletionEstimated;
      const calendarOpened = sessions.some((s: any) => !!s.calendarOpenedAt);
      const calendarExternalClicks = sessions.reduce((n: number, s: any) => n + Number(s.calendarExternalClicks || 0), 0);
      const websiteClicked = sessions.some((s: any) => !!s.websiteClickedAt);
      const websiteClicks = sessions.reduce((n: number, s: any) => n + Number(s.websiteClicks || 0), 0);
      const t: any = templates.get(String(m.templateId || ''));
      return {
        id: m.id, sendId: m.sendId, messageId: m.messageId || '', templateId: m.templateId || '',
        templateName: t?.name || m.templateName || 'Deleted template', contactId: m.contactId,
        contactName: m.contactName || '', contactEmail: m.contactEmail || '',
        sentAt: m.sentAt, subject: m.subject || '', senderEmail: m.senderEmail || '',
        status: m.status, firstOpenAt: m.openedAt || null,
        opens: opens.length, nonProxyOpens: opens.length - proxyOpens.length, proxyOpens: proxyOpens.length,
        clicks: clicks.length, distinctLinks: unique(clicks.filter(countedClick).map((e) => String(e.url || ''))).length,
        clickedDestinations: unique(clicks.filter(countedClick).map((e) => String(e.url || ''))),
        lastEventAt: events.reduce((a, e) => clock(e.trackedAt) > clock(a) ? e.trackedAt : a, null),
        intentScore: intent.score, tier: intent.tier, reasons: intent.reasons,
        audioPlays, audioSessionCount: sessions.length, audioBestPercent, audioCompleted, audioCompletionEstimated,
        calendarOpened, calendarExternalClicks, websiteClicked, websiteClicks,
        audioPlayedSeconds: Math.max(0, ...sessions.map((s: any) => Number(s.playedSeconds || 0))),
        events: events.map((e) => ({ id: e.id, type: e.eventType, at: e.trackedAt, url: e.url || '', quality: eventQuality(e) })),
      };
    }).sort((a: any, b: any) => clock(b.sentAt) - clock(a.sentAt));

    // Contact cards are resolved exclusively from DebtLead, never FronterLead.
    const contactIds = unique(timeline.map((m: any) => String(m.contactId || '')));
    const leadDirectory: Record<string, any> = {};
    for (let i = 0; i < contactIds.length; i += 25) {
      const chunk = contactIds.slice(i, i + 25);
      const leadPage = await svc.DebtLead.filter({ id: { $in: chunk } }, { limit: chunk.length }).catch(() => []);
      for (const lead of rows(leadPage)) {
        leadDirectory[String(lead.id)] = {
          leadId: String(lead.id), name: [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim(),
          phone: lead.phone || '', email: lead.email || '', assignedTo: lead.debtCoachOwner || '',
          status: lead.status || '', onFile: true, source: 'coach',
        };
      }
    }

    // Preserve the historical hot-lead ledger. Report reads do not modify it.
    const priorHot = await svc.EngagementHotLead.filter({ system: 'coach' }, { sort: '-lastEnteredAt', limit: 200 }).catch(() => []);
    const hotHistory = rows(priorHot).map((r: any) => ({
      id: r.id, leadId: String(r.leadId || ''), source: 'coach',
      name: leadDirectory[String(r.leadId)]?.name || r.name || '',
      phone: leadDirectory[String(r.leadId)]?.phone || r.phone || '',
      email: leadDirectory[String(r.leadId)]?.email || r.email || '',
      firstHotAt: r.firstHotAt || r.created_date, lastEnteredAt: r.lastEnteredAt || r.firstHotAt || r.created_date,
      lastHotAt: r.lastHotAt || r.lastEnteredAt || r.created_date,
      hotSessions: Number(r.hotSessions || 1), peakScore: Number(r.peakScore || 0),
      lastScore: Number(r.lastScore || 0), stillHot: r.wasHot === true,
      handledAt: r.handledAt || null, handledBy: r.handledBy || '',
      action: r.action || '', reasons: (() => { try { const v = JSON.parse(r.reasonsJson || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } })(),
    }));

    const byTemplate = new Map<string, any>();
    for (const t of templates.values()) {
      const tpl: any = t;
      byTemplate.set(String(tpl.id), { templateId: tpl.id, name: tpl.name, sent: 0, opened: 0, clicked: 0, proxyOnly: 0, totalOpens: 0, totalClicks: 0, lastSentAt: null });
    }
    for (const item of timeline) {
      if (!byTemplate.has(String(item.templateId))) byTemplate.set(String(item.templateId), { templateId: item.templateId, name: item.templateName, sent: 0, opened: 0, clicked: 0, proxyOnly: 0, totalOpens: 0, totalClicks: 0, lastSentAt: null });
      const stat = byTemplate.get(String(item.templateId));
      stat.sent++;
      if (item.nonProxyOpens) stat.opened++;
      if (item.distinctLinks) stat.clicked++;
      if (item.opens && !item.nonProxyOpens) stat.proxyOnly++;
      stat.totalOpens += item.opens;
      stat.totalClicks += item.clicks;
      if (!stat.lastSentAt || clock(item.sentAt) > clock(stat.lastSentAt)) stat.lastSentAt = item.sentAt;
    }

    const legacyHistory: any[] = [];
    let legacyTruncated = false;
    if (body.view === 'old') {
      const old = await readAll(svc.EmailLog, { sentAt: { $gte: since } }, '-sentAt');
      legacyTruncated = old.truncated;
      const currentIds = new Set(messages.map((m: any) => String(m.messageId || '')).filter(Boolean));
      const currentSends = new Set(messages.map((m: any) => String(m.sendId || '')).filter(Boolean));
      for (const log of old.items) {
        if (!templates.has(String(log.templateId || ''))) continue;
        if (log.fromEmail && log.fromEmail !== 'gmail') continue;
        if (log.messageId && currentIds.has(String(log.messageId))) continue;
        if (log.sendId && currentSends.has(String(log.sendId))) continue;
        legacyHistory.push({
          id: log.id, templateName: (templates.get(String(log.templateId)) as any)?.name || log.templateName || '',
          name: log.toName || '', email: log.toEmail || '', leadId: log.leadId || '',
          sentAt: log.sentAt || '', openedAt: log.openedAt || null, clickedAt: log.clickedAt || null,
          status: log.status || 'unknown', subject: log.subject || '', sendId: log.sendId || '', provenance: 'legacy_gmail_log',
        });
      }
    }

    return Response.json({
      scope: 'debt_call_coach_gmail_templates_only', days, generatedAt: new Date().toISOString(),
      truncated: { templates: templatePage.truncated, sends: messagePage.truncated, events: eventPage.truncated, audio: audioPage.truncated, legacy: legacyTruncated },
      failedHistory: failed.map((m: any) => ({ id: m.id, contactName: m.contactName || '', contactEmail: m.contactEmail || '',
        templateName: (templates.get(String(m.templateId)) as any)?.name || m.templateName || '', attemptedAt: m.created_date,
        error: m.error || '', status: m.status })),
      summary: { emailsSent: timeline.length, failedAttempts: failed.length, distinctRecipients: unique(timeline.map((x: any) => String(x.contactId || x.contactEmail))).length,
        withNonProxyOpens: timeline.filter((x: any) => x.nonProxyOpens > 0).length,
        withClicks: timeline.filter((x: any) => x.distinctLinks > 0).length,
        proxyOnlyOpens: timeline.filter((x: any) => x.proxyOnly).length,
        audioStarted: timeline.filter((x: any) => x.audioPlays > 0).length,
        audioCompleted: timeline.filter((x: any) => x.audioCompleted).length,
        calendarOpened: timeline.filter((x: any) => x.calendarOpened).length,
        calendarExternalClicked: timeline.filter((x: any) => x.calendarExternalClicks > 0).length,
        companyWebsiteClicked: timeline.filter((x: any) => x.websiteClicked).length,
        highIntent: unique(timeline.filter((x: any) => x.tier === 'high').map((x: any) => String(x.contactId))).length },
      templates: [...byTemplate.values()].sort((a, b) => b.sent - a.sent),
      leadDirectory, hotHistory, timeline, legacyHistory,
    });
  } catch (error: any) {
    console.error('[debtCoachGmailReport]', error?.message);
    return Response.json({ error: error?.message || 'Report failed' }, { status: 500 });
  }
}