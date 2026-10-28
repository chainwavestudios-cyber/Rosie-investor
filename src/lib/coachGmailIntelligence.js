/**
 * Debt Call Coach-only Gmail intelligence view model.
 * All attribution comes from authenticated Gmail EmailMessage/sendId records.
 * This file never reads Fronter, SMTPfast or investor activity.
 * Non-proxy activity is NOT guaranteed human activity.
 */
const stamp = (value) => value ? new Date(value).getTime() || 0 : 0;
const mostRecent = (a, b) => stamp(a) >= stamp(b) ? a : b;

export const shortHost = (url) => {
  try { return new URL(String(url)).hostname.replace(/^www\./, ''); }
  catch { return 'tracked link'; }
};

export function composeGmailIntelligence(report) {
  const sends = report?.timeline || [];
  const directory = report?.leadDirectory || {};
  const people = new Map();
  const feed = [];

  for (const send of sends) {
    const id = String(send.contactId || send.contactEmail || '');
    if (!id) continue;
    if (!people.has(id)) {
      const contact = directory[id] || {};
      people.set(id, {
        id, leadId: send.contactId || '', source: 'coach',
        name: contact.name || send.contactName || send.contactEmail || 'Unknown contact',
        email: contact.email || send.contactEmail || '',
        phone: contact.phone || '', assignedTo: contact.assignedTo || '',
        status: contact.status || '', onFile: !!contact.onFile,
        sent: 0, opens: 0, proxyOpens: 0, clicks: 0, qualifyVisits: 0,
        clickedUrls: new Set(), clickTemplates: new Set(),
        lastAt: null, lastSentAt: null, reasons: [],
      });
    }
    const p = people.get(id);
    p.sent++;
    p.audioBestPercent = Math.max(Number(p.audioBestPercent || 0), Number(send.audioBestPercent || 0));
    p.audioCompleted = !!p.audioCompleted || !!send.audioCompleted;
    p.calendarOpened = !!p.calendarOpened || !!send.calendarOpened;
    p.websiteClicked = !!p.websiteClicked || !!send.websiteClicked;
    p.opens += Number(send.nonProxyOpens || 0);
    p.proxyOpens += Number(send.proxyOpens || 0);
    p.lastSentAt = mostRecent(p.lastSentAt, send.sentAt);
    p.lastAt = mostRecent(p.lastAt, send.lastEventAt || send.sentAt);
    for (const event of send.events || []) {
      const isAuto = event.quality === 'proxy_or_automated';
      if (!isAuto && event.type === 'click' && event.url) {
        p.clicks++;
        p.clickedUrls.add(String(event.url));
        p.clickTemplates.add(String(send.templateId || send.templateName));
      }
      if (!isAuto && event.type === 'qualify_visit') p.qualifyVisits++;
      feed.push({
        ...event, id: event.id || send.sendId + ':' + event.type + ':' + event.at,
        eventType: event.type, trackedAt: event.at, leadName: p.name,
        leadId: send.contactId, name: p.name, email: p.email, phone: p.phone,
        source: 'coach', onFile: p.onFile, templateName: send.templateName,
        subject: send.subject, sendId: send.sendId,
      });
    }
  }

  const leads = [...people.values()].map((p) => {
    const links = p.clickedUrls.size;
    const audioBest = Number(p.audioBestPercent || 0);
    const audioPoints = audioBest >= 98 ? 22 : audioBest >= 75 ? 16 : audioBest >= 25 ? 8 : audioBest >= 5 ? 3 : 0;
    const score = Math.min(100, (p.opens ? 3 : 0) + Math.min(links, 4) * 12 + (p.qualifyVisits ? 25 : 0)
      + audioPoints + (p.calendarOpened ? 15 : 0) + (p.websiteClicked ? 8 : 0));
    const corroborated = !!p.qualifyVisits || !!p.calendarOpened || audioBest >= 75;
    const active = links > 0 || !!p.qualifyVisits || audioBest >= 5 || !!p.calendarOpened || !!p.websiteClicked;
    const hotLead = score >= 60 && corroborated;
    const tier = hotLead ? 'hot' : active ? 'engaged' : p.opens ? 'warming' : 'cold';
    const reasons = [
      links ? links + ' distinct tracked link destination' + (links === 1 ? '' : 's') + ' (visitor unverified)' : '',
      audioBest >= 5 ? Math.round(audioBest) + '% estimated audio playback' : '',
      p.calendarOpened ? 'Calendar opened' : '',
      p.websiteClicked ? 'Company website opened from welcome page' : '',
      p.qualifyVisits ? p.qualifyVisits + ' tracked qualification visit' + (p.qualifyVisits === 1 ? '' : 's') : '',
      p.opens ? p.opens + ' non-proxy open pixel' + (p.opens === 1 ? '' : 's') : '',
      p.proxyOpens ? p.proxyOpens + ' proxy/automated open' + (p.proxyOpens === 1 ? '' : 's') + ' excluded from score' : '',
    ].filter(Boolean);
    const action = p.qualifyVisits ? 'Review qualification-page visit and contact' :
      hotLead ? 'High cross-channel engagement — prioritize personal follow-up' :
      links >= 2 ? 'Review tracked links; consider a personal follow-up' :
      links ? 'Review recorded link destination and follow up personally' :
      p.opens ? 'Nurture: possible view; no verified buying action' : 'No tracked engagement yet';
    const { clickedUrls, clickTemplates, ...base } = p;
    return { ...base, score, hotLead, tier, reasons, action, linkKeys: [...clickedUrls],
      welcomeViewed: false, qualifyVisited: p.qualifyVisits > 0 };
  }).sort((a, b) => b.score - a.score || stamp(b.lastAt) - stamp(a.lastAt));

  feed.sort((a, b) => stamp(b.at) - stamp(a.at));
  const metricLeads = {
    emailsSent: leads.filter(p => p.sent).map(p => p.id),
    leadsEngaged: leads.filter(p => p.clicks || p.qualifyVisits).map(p => p.id),
    uniqueOpeners: leads.filter(p => p.opens).map(p => p.id),
    uniqueClickers: leads.filter(p => p.clicks).map(p => p.id),
    qualifyVisits: leads.filter(p => p.qualifyVisits).map(p => p.id),
    hotLeads: leads.filter(p => p.hotLead).map(p => p.id),
    proxyOnly: leads.filter(p => p.proxyOpens && !p.opens).map(p => p.id),
  };
  const summary = {
    emailsSent: sends.length,
    leadsEngaged: metricLeads.leadsEngaged.length,
    uniqueOpeners: metricLeads.uniqueOpeners.length,
    uniqueClickers: metricLeads.uniqueClickers.length,
    qualifyVisits: metricLeads.qualifyVisits.length,
    hotLeads: metricLeads.hotLeads.length,
    avgScore: leads.length ? Math.round(leads.reduce((n, p) => n + p.score, 0) / leads.length) : 0,
    proxyOnly: metricLeads.proxyOnly.length,
    failedAttempts: report?.summary?.failedAttempts || 0,
  };
  const hot = leads.filter(p => p.hotLead).slice(0, 10).map(p => ({
    leadId: p.leadId, score: p.score, reasons: p.reasons, action: p.action,
  }));

  return { leads, feed, summary, metricLeads, hot,
    hotHistory: report?.hotHistory || [], templates: report?.templates || [], sends };
}
