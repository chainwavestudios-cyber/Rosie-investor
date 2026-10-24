/**
 * debtMarketingReport — the nightly engagement report for the Debt Call Coach
 * marketing campaigns.
 *
 * Covers one Eastern Time day and lists, per person: the email that went out,
 * whether it was opened, whether the welcome message was viewed, every link
 * clicked, the Introduction 2 follow-up, and the call it booked.
 *
 * Run nightly by the "Debt Coach Marketing Nightly Report" workflow, or on
 * demand from the Marketing tab ({} = today in ET, or { date: 'YYYY-MM-DD' }).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { automationGate } from '../../shared/automationRules.ts';
import { etDayWindow } from '../../shared/etTime.ts';

const PAGE = 500;

const rows = (page: any): any[] => (Array.isArray(page) ? page : page?.items || []);

const inWindow = (iso: any, start: string, end: string) => !!iso && iso >= start && iso <= end;

const parseList = (raw: any): any[] => {
  try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};

async function windowed(base44: any, field: string, start: string, end: string) {
  const page = await base44.asServiceRole.entities.DebtMarketingSend
    .filter({ [field]: { $gte: start, $lte: end } }, { limit: PAGE })
    .catch(() => []);
  return rows(page);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const gate = await automationGate(base44, 'nightly_marketing');
    if (!gate.run) return Response.json({ skipped: true, automation: 'nightly_marketing', reason: gate.reason });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { start, end, reportDate } = etDayWindow(body?.date || undefined);
    const isNightly = !body?.date && !body?.requestedBy;

    // one granular query per signal — no compound $or queries
    const batches = await Promise.all([
      windowed(base44, 'sentAt', start, end),
      windowed(base44, 'intro2SentAt', start, end),
      windowed(base44, 'firstOpenedAt', start, end),
      windowed(base44, 'lastOpenedAt', start, end),
      windowed(base44, 'welcomeViewedAt', start, end),
      windowed(base44, 'lastClickedAt', start, end),
      windowed(base44, 'callEventAt', start, end),
    ]);

    const byId = new Map<string, any>();
    batches.flat().forEach((send) => byId.set(send.id, send));

    const people = [...byId.values()].map((send) => {
      const clicks = parseList(send.clickedUrlsJson).filter((c: any) => inWindow(c?.at, start, end));
      const opened = inWindow(send.firstOpenedAt, start, end) || inWindow(send.lastOpenedAt, start, end);
      const welcomed = inWindow(send.welcomeViewedAt, start, end);
      const intro2 = inWindow(send.intro2SentAt, start, end);
      const call = inWindow(send.callEventAt, start, end);
      const sent = inWindow(send.sentAt, start, end);
      if (!opened && !welcomed && clicks.length === 0 && !intro2 && !call && !sent) return null;

      return {
        vaultEntryId: send.vaultEntryId || '',
        leadName: send.leadName || send.email || 'Lead',
        email: send.email || '',
        state: send.state || '',
        campaignName: send.campaignName || '',
        kind: send.kind || 'intro',
        templateName: send.templateName || '',
        sentAt: sent ? send.sentAt : '',
        opened,
        openCount: send.openCount || 0,
        firstOpenedAt: opened ? (send.firstOpenedAt || send.lastOpenedAt) : '',
        welcomeViewedAt: welcomed ? send.welcomeViewedAt : '',
        linksClicked: clicks.map((c: any) => ({ url: c.url, at: c.at })),
        intro2SentAt: intro2 ? send.intro2SentAt : '',
        callAt: call ? send.callEventAt : '',
      };
    }).filter(Boolean) as any[];

    people.sort((a, b) =>
      (b.welcomeViewedAt ? 1 : 0) - (a.welcomeViewedAt ? 1 : 0)
      || b.linksClicked.length - a.linksClicked.length
      || (b.opened ? 1 : 0) - (a.opened ? 1 : 0));

    const totals = {
      totalEmailsSent: people.filter((p) => p.sentAt).length,
      totalOpened: people.filter((p) => p.opened).length,
      totalWelcomeViewed: people.filter((p) => p.welcomeViewedAt).length,
      totalLinksClicked: people.reduce((n, p) => n + p.linksClicked.length, 0),
      totalIntro2Sent: people.filter((p) => p.intro2SentAt).length,
      totalCallsScheduled: people.filter((p) => p.callAt).length,
      peopleCount: people.length,
    };

    const payload = {
      reportDate,
      windowStart: start,
      windowEnd: end,
      generatedAt: new Date().toISOString(),
      generatedBy: isNightly ? 'nightly' : (user?.username || 'admin'),
      ...totals,
      rowsJson: JSON.stringify(people),
    };

    const existing = rows(await base44.asServiceRole.entities.DebtMarketingReport
      .filter({ reportDate }, { limit: 5 }).catch(() => []));
    const saved = existing[0]
      ? await base44.asServiceRole.entities.DebtMarketingReport.update(existing[0].id, payload)
      : await base44.asServiceRole.entities.DebtMarketingReport.create(payload);

    return Response.json({ report: { ...payload, id: saved?.id } });
  } catch (error: any) {
    console.error('[debtMarketingReport] error:', error?.message || String(error));
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}