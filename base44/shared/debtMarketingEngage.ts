/**
 * debtMarketingEngage.ts — what a Debt Call Coach marketing email does when a
 * prospect engages with it.
 *
 *  - records every open, welcome-message view and link click on that lead's
 *    DebtMarketingSend row (the row the nightly report reads)
 *  - fires the auto-chain: welcome message watched + 2 of the 3 tracked links
 *    clicked → queues the campaign's Introduction 2 email
 *  - once Introduction 2 has gone out, books the call: 4 hours after it was
 *    sent, or 12:30pm the next day when those 4 hours land outside the
 *    9am–6pm Eastern working window
 */
import { getCalendarAuth, listEvents, hasConflict } from './googleCalendarHelpers.ts';
import { DEFAULT_TRACKED_DOMAINS } from './debtMarketingRules.ts';
import { ET, etParts, etToUtc } from './etTime.ts';

const FALLBACK_REDIRECT = 'https://rosieai-investorpage.base44.app/';
const CLICK_HISTORY_LIMIT = 80;

type EngageIds = {
  campaignId: string;
  sendId: string;
  vaultEntryId: string;
  eventType: 'open' | 'click';
  url?: string;
  userAgent?: string;
  ip?: string;
};

const parseList = (raw: any): any[] => {
  try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};

// ── the 2-of-3 links rule (same three destinations as the contact-card email) ──
function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

/**
 * The three links are matched by hostname, not by text: the Trustpilot review
 * link contains the company domain inside its path, so a substring match would
 * count one click as two.
 */
function clickedDomains(urls: string[]): string[] {
  const hosts = urls.map((u) => hostOf(String(u || ''))).filter(Boolean);
  return DEFAULT_TRACKED_DOMAINS.filter((domain) =>
    hosts.some((h) => h === domain || h.endsWith(`.${domain}`)),
  );
}

/** Is this click the "listen to my welcome message" link? */
export function isWelcomeClick(url: string, welcomeLinkUrl?: string): boolean {
  const lower = String(url || '').toLowerCase();
  if (/welcome|about-?me|personal-?message|personalmessage/.test(lower)) return true;
  if (!welcomeLinkUrl) return false;
  try {
    const a = new URL(url);
    const b = new URL(welcomeLinkUrl);
    const path = (u: URL) => (u.hostname + u.pathname).toLowerCase().replace(/\/+$/, '');
    return path(a) === path(b) || path(a).startsWith(path(b));
  } catch { return false; }
}

/** Only the hosts that were actually in the email may be forwarded to. */
export function redirectTarget(send: any, campaign: any, url: string): string {
  const allowed = new Set<string>([
    ...parseList(send?.linkHostsJson).map((h: any) => String(h).toLowerCase()),
    hostOf(campaign?.welcomeLinkUrl || ''),
  ].filter(Boolean));
  if (allowed.size === 0) return url; // older rows predate host pinning
  return allowed.has(hostOf(url)) ? url : FALLBACK_REDIRECT;
}

// ── recording one engagement event ───────────────────────────────────────────
export async function recordEngagement(base44: any, ids: EngageIds) {
  const now = new Date().toISOString();
  if (!ids.sendId) return { recorded: false };

  const send = await base44.asServiceRole.entities.DebtMarketingSend.get(ids.sendId).catch(() => null);
  if (!send) return { recorded: false };

  const campaign = send.campaignId
    ? await base44.asServiceRole.entities.DebtMarketingCampaign.get(send.campaignId).catch(() => null)
    : null;

  if (ids.eventType === 'open') {
    await base44.asServiceRole.entities.DebtMarketingSend.update(send.id, {
      openCount: (send.openCount || 0) + 1,
      firstOpenedAt: send.firstOpenedAt || now,
      lastOpenedAt: now,
    });
    return { recorded: true, welcome: false, redirect: '' };
  }

  const url = String(ids.url || '');
  const clicks = parseList(send.clickedUrlsJson);
  clicks.push({ url, at: now });

  const welcome = isWelcomeClick(url, campaign?.welcomeLinkUrl);
  const updates: any = {
    clickedUrlsJson: JSON.stringify(clicks.slice(-CLICK_HISTORY_LIMIT)),
    firstClickedAt: send.firstClickedAt || now,
    lastClickedAt: now,
  };
  if (welcome && !send.welcomeViewedAt) updates.welcomeViewedAt = now;
  await base44.asServiceRole.entities.DebtMarketingSend.update(send.id, updates);

  const chain = await maybeQueueIntro2(base44, { ...send, ...updates }, campaign);
  return {
    recorded: true,
    welcome,
    chain,
    redirect: redirectTarget(send, campaign, url),
  };
}

// ── the auto-chain: welcome watched + 2/3 links → Introduction 2 ─────────────
export async function maybeQueueIntro2(base44: any, send: any, campaign: any) {
  if (!campaign?.intro2TemplateId) return { queued: false, reason: 'no Introduction 2 email chosen' };
  if (send.kind === 'intro2' || send.intro2QueuedAt) return { queued: false, reason: 'already triggered' };
  if (!send.welcomeViewedAt) return { queued: false, reason: 'welcome message not opened yet' };

  const urls = parseList(send.clickedUrlsJson).map((c: any) => c.url);
  const domains = clickedDomains(urls);
  if (domains.length < 2) return { queued: false, reason: `clicked ${domains.length}/3 links` };

  const existing = await base44.asServiceRole.entities.DebtMarketingSend
    .filter({ campaignId: campaign.id, vaultEntryId: send.vaultEntryId, kind: 'intro2' }, { limit: 5 })
    .catch(() => null);
  const already = (existing?.items || existing || []) as any[];
  if (already.length > 0) return { queued: false, reason: 'Introduction 2 already sent' };

  const now = new Date().toISOString();
  await base44.asServiceRole.entities.DebtMarketingSend.create({
    campaignId: campaign.id,
    campaignName: campaign.name,
    vaultEntryId: send.vaultEntryId,
    leadName: send.leadName,
    email: send.email,
    state: send.state,
    sendAt: now,
    status: 'pending',
    kind: 'intro2',
    templateId: campaign.intro2TemplateId,
    templateName: campaign.intro2TemplateName || '',
  });
  await base44.asServiceRole.entities.DebtMarketingSend.update(send.id, {
    intro2QueuedAt: now,
    chainReason: `welcome message opened + clicked ${domains.join(', ')}`,
  });
  return { queued: true, domains };
}

// ── when Introduction 2 has gone out, book the call ─────────────────────────
/**
 * 4 hours after Introduction 2 went out; if those 4 hours land before 9am or
 * after 6pm Eastern, the call moves to 12:30pm the next day.
 */
export function computeIntro2CallTime(sentAtIso: string): Date {
  const sent = new Date(sentAtIso);
  const candidate = new Date(sent.getTime() + 4 * 60 * 60 * 1000);
  const parts = etParts(candidate);
  if (parts.hour >= 9 && parts.hour < 18) return candidate;

  const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + 24 * 60 * 60 * 1000);
  return etToUtc(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), 12, 30);
}

/** The call event + the in-app reminder the coach popup shows. */
export async function scheduleIntro2Call(base44: any, send: any, campaign: any) {
  const sentAt = send.intro2SentAt || send.sentAt || new Date().toISOString();
  const start = computeIntro2CallTime(sentAt);
  const end = new Date(start.getTime() + 15 * 60 * 1000);

  const lead = send.vaultEntryId
    ? await base44.asServiceRole.entities.LeadVaultEntry.get(send.vaultEntryId).catch(() => null)
    : null;
  const name = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || send.leadName || send.email || 'Lead';

  const authHeader = await getCalendarAuth(base44);
  const events = await listEvents(authHeader, new Date().toISOString(), new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString());
  let slotStart = start;
  let slotEnd = end;
  let attempts = 0;
  while (hasConflict(events, slotStart, slotEnd) && attempts < 12) {
    slotStart = new Date(slotStart.getTime() + 15 * 60 * 1000);
    slotEnd = new Date(slotEnd.getTime() + 15 * 60 * 1000);
    attempts++;
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      summary: `📞 Call ${name} — Introduction 2 sent`,
      start: { dateTime: slotStart.toISOString() },
      end: { dateTime: slotEnd.toISOString() },
      description: `Auto-scheduled: ${name} opened the welcome message and clicked 2/3 links, so Introduction 2 was sent.\n\nIntroduction 2 sent: ${sentAt}\nPhone: ${lead?.phone || '—'}\nEmail: ${lead?.email || send.email || '—'}\nCampaign: ${campaign?.name || '—'}`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Calendar request failed (${res.status})`);

  const meeting = await base44.asServiceRole.entities.FronterMeeting.create({
    leadId: send.vaultEntryId || '',
    leadName: name,
    leadPhone: lead?.phone || '',
    leadEmail: lead?.email || send.email || '',
    leadAddress: [lead?.address, lead?.city, lead?.state, lead?.zipCode].filter(Boolean).join(', '),
    fronterUsername: campaign?.createdBy || 'admin',
    meetingStartISO: slotStart.toISOString(),
    meetingEndISO: slotEnd.toISOString(),
    customerTimezone: ET,
    customerReminder: false,
    nightBeforeReminderSent: false,
    hourBeforeReminderSent: false,
    eventId: data?.id || '',
    meetingNotes: 'Auto-scheduled: welcome message opened + 2/3 links clicked → Introduction 2 sent.',
    status: 'scheduled',
  });

  await base44.asServiceRole.entities.DebtMarketingSend.update(send.id, {
    callEventId: data?.id || '',
    callEventAt: slotStart.toISOString(),
    callMeetingId: meeting.id,
  });
  return { callAt: slotStart.toISOString(), eventId: data?.id || '', meetingId: meeting.id };
}