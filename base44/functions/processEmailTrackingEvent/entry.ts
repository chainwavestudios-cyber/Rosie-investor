/**
 * processEmailTrackingEvent — Called by the Email Follow-Up Automation workflow
 * 30 seconds after any EmailTrackingEvent is created (bot filter delay).
 *
 * Two automations:
 *   1. FOLLOW-UP EMAIL: If the lead has opened their credentials email AND
 *      clicked at least 2 of 3 tracked websites (Trustpilot, BBB, Our Website),
 *      auto-send the "Follow Up" email template (with tracking injected).
 *   2. CALENDAR EVENT: If the event is an "open" matching the follow-up email's
 *      sendId, create a 15-minute Google Calendar event within the hour to call,
 *      and store a FronterMeeting record so the popup shows in DebtCallCoach.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { getCalendarAuth, listEvents, hasConflict } from '../../shared/googleCalendarHelpers.ts';
import { addBusinessHours, formatEastern, FOLLOW_UP_DELAY_BUSINESS_HOURS } from '../../shared/businessHours.ts';
import { sendFollowUpEmail } from '../../shared/followUpEmail.ts';
import { readScoringRules } from '../../shared/scoringConfig.ts';

const TRACKED_DOMAINS = ['trustpilot.com', 'bbb.org', 'debtadvisorsofamerica.com'];
const BOT_FILTER_MS = 30_000;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { leadId, sendId, eventType } = await req.json();

    if (!leadId) return Response.json({ skipped: true, reason: 'no leadId' });

    let lead;
    try { lead = await base44.asServiceRole.entities.FronterLead.get(leadId); }
    catch { return Response.json({ skipped: true, reason: 'lead not found' }); }
    if (!lead) return Response.json({ skipped: true, reason: 'lead not found' });

    const results = { followUpSent: false, followUpQueued: false, calendarEventCreated: false };

    // ── PART 2: Follow-up email opened → create 15-min call event ──
    if (eventType === 'open' && lead.followUpSendId && sendId === lead.followUpSendId && !lead.followUpCallEventId) {
      try {
        await createCallEvent(base44, lead);
        results.calendarEventCreated = true;
      } catch (e) {
        console.error('[processEmailTrackingEvent] Calendar event failed:', (e as Error).message);
      }
    }

    // ── PART 1: Open + 2/3 clicks → send follow-up email ──
    if (!lead.followUpEmailSentAt) {
      const raw = await base44.asServiceRole.entities.EmailTrackingEvent.filter(
        { leadId },
        '-trackedAt',
        100
      );
      const events = Array.isArray(raw) ? raw : (raw?.items || []);

      const now = Date.now();
      // Both of these are editable on the Automations & Scoring screen.
      const rules = await readScoringRules(base44);
      const botFilterMs = rules.botFilterSeconds * 1000;
      const requiredLinks = rules.followUpLinksRequired;
      const confirmed = events.filter((e: any) => now - new Date(e.trackedAt).getTime() > botFilterMs);

      const hasOpen = confirmed.some((e: any) => e.eventType === 'open') || !!lead.emailOpenedAt;

      const clickedUrls = new Set<string>();
      confirmed.filter((e: any) => e.eventType === 'click' && e.url).forEach((e: any) => clickedUrls.add(e.url));
      try {
        const manual = JSON.parse(lead.emailLinksClickedJson || '[]');
        manual.forEach((l: any) => { if (l.url) clickedUrls.add(l.url); });
      } catch {}

      const clickedDomains = TRACKED_DOMAINS.filter((d) =>
        [...clickedUrls].some((u) => u.includes(d))
      );

      if (hasOpen && clickedDomains.length >= requiredLinks) {
        // The follow-up never chases a lead who has only just been sent their
        // credentials: eight BUSINESS hours have to pass first (Mon–Fri, 9–5 ET).
        // Too early → it is queued for the moment it is allowed and the
        // "Queued Follow-Up Release" tick sends it then.
        const receivedAt = lead.credsSentAt || lead.emailOpenedAt || earliestOpenAt(confirmed);
        const dueAt = addBusinessHours(receivedAt, FOLLOW_UP_DELAY_BUSINESS_HOURS);

        if (Date.now() >= new Date(dueAt).getTime()) {
          try {
            await sendFollowUpEmail(base44, lead);
            results.followUpSent = true;
          } catch (e) {
            console.error('[processEmailTrackingEvent] Follow-up email failed:', (e as Error).message);
          }
        } else if (!lead.followUpQueued) {
          await queueFollowUp(base44, lead, dueAt);
          results.followUpQueued = true;
        }
      }
    }

    return Response.json({ success: true, ...results });
  } catch (error) {
    console.error('[processEmailTrackingEvent] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

// ── Hold the follow-up until its eight business hours have passed ──
async function queueFollowUp(base44: any, lead: any, dueAt: string) {
  await base44.asServiceRole.entities.FronterLead.update(lead.id, { followUpQueued: true, followUpDueAt: dueAt });
  try {
    const log = JSON.parse(lead.notesLogJson || '[]');
    log.push({
      text: `⏳ Auto follow-up email queued for ${formatEastern(dueAt)} — the 8 business hours after the credentials email have to pass first`,
      timestamp: new Date().toISOString(),
      author: 'auto_followup',
      type: 'followup_queued',
    });
    await base44.asServiceRole.entities.FronterLead.update(lead.id, { notesLogJson: JSON.stringify(log) });
  } catch {}
}

// The open that qualifies the lead also proves when the email landed.
function earliestOpenAt(events: any[]): string {
  const opens = events
    .filter((e: any) => e.eventType === 'open' && e.trackedAt)
    .map((e: any) => new Date(e.trackedAt).getTime())
    .filter((t: number) => !Number.isNaN(t));
  if (!opens.length) return new Date().toISOString();
  return new Date(Math.min(...opens)).toISOString();
}

// ── Create a 15-min Google Calendar call event within the hour ──
async function createCallEvent(base44: any, lead: any) {
  let start = new Date(Date.now() + 45 * 60 * 1000); // 45 min from now = within the hour
  let end = new Date(start.getTime() + 15 * 60 * 1000); // 15 min duration

  const authHeader = await getCalendarAuth(base44);
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const events = await listEvents(authHeader, timeMin, timeMax);

  let attempts = 0;
  while (hasConflict(events, start, end) && attempts < 8) {
    start = new Date(start.getTime() + 15 * 60 * 1000);
    end = new Date(end.getTime() + 15 * 60 * 1000);
    attempts++;
  }

  const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
  const title = `📞 Call ${leadName} — Follow-Up Opened`;
  const description = `Auto-scheduled: ${leadName} opened their follow-up email.\n\nLead: ${leadName}\nPhone: ${lead.phone || '—'}\nEmail: ${lead.email || '—'}\nAssigned To: ${lead.assignedTo || '—'}`;

  const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      summary: title,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      description,
    }),
  });

  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(createData.error?.message || 'Failed to create event');

  await base44.asServiceRole.entities.FronterMeeting.create({
    leadId: lead.id,
    leadName,
    leadPhone: lead.phone || '',
    leadEmail: lead.email || '',
    fronterUsername: lead.assignedTo || '',
    meetingStartISO: start.toISOString(),
    meetingEndISO: end.toISOString(),
    customerTimezone: 'America/New_York',
    customerReminder: false,
    nightBeforeReminderSent: false,
    hourBeforeReminderSent: false,
    eventId: createData.id,
    meetingNotes: 'Auto-scheduled when follow-up email was opened.',
    status: 'scheduled',
  });

  await base44.asServiceRole.entities.FronterLead.update(lead.id, {
    followUpCallEventId: createData.id,
    followUpCallEventAt: start.toISOString(),
  });
}