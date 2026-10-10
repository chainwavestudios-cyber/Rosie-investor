/**
 * sendFronterMeetingReminders — Checks all scheduled meetings with customer
 * reminders enabled and sends:
 * 1. Night-before reminder at 8pm customer's timezone
 * 2. 1-hour-before reminder
 * Called by a scheduled workflow every 15 minutes.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ET_TZ = 'America/New_York';

function getTzParts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
  };
}

function formatInTz(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Get all meetings with customerReminder=true and status=scheduled
    const meetings = await base44.asServiceRole.entities.FronterMeeting.filter({
      customerReminder: true,
      status: 'scheduled',
    });

    let sentCount = 0;

    for (const meeting of meetings) {
      const customerTz = meeting.customerTimezone || ET_TZ;
      const meetingStart = new Date(meeting.meetingStartISO);
      const meetingEmail = meeting.leadEmail;

      if (!meetingEmail) continue;

      // ── Night-before reminder: 8pm customer timezone, day before meeting ──
      if (!meeting.nightBeforeReminderSent) {
        const nowParts = getTzParts(now, customerTz);
        const meetingParts = getTzParts(meetingStart, customerTz);

        const meetingDate = new Date(meetingParts.year, meetingParts.month - 1, meetingParts.day);
        const dayBefore = new Date(meetingDate);
        dayBefore.setDate(dayBefore.getDate() - 1);

        if (nowParts.year === dayBefore.getFullYear() &&
            nowParts.month - 1 === dayBefore.getMonth() &&
            nowParts.day === dayBefore.getDate() &&
            nowParts.hour >= 20) {
          const formattedTime = formatInTz(meeting.meetingStartISO, customerTz);
          try {
            await base44.integrations.Core.SendEmail({
              to: meetingEmail,
              subject: 'Reminder: Your meeting tomorrow',
              body: `Hello ${meeting.leadName},\n\nThis is a reminder for your scheduled meeting tomorrow:\n\n${formattedTime}\n\nMeeting Notes:\n${meeting.meetingNotes || 'N/A'}\n\nWe look forward to speaking with you.\n\nThank you.`,
            });
            await base44.asServiceRole.entities.FronterMeeting.update(meeting.id, { nightBeforeReminderSent: true });
            sentCount++;
          } catch (e) { console.warn('Night-before email failed:', e); }
        }
      }

      // ── 1-hour-before reminder ──
      if (!meeting.hourBeforeReminderSent) {
        const oneHourBefore = new Date(meetingStart.getTime() - 60 * 60 * 1000);
        if (now >= oneHourBefore && now < meetingStart) {
          const formattedTime = formatInTz(meeting.meetingStartISO, customerTz);
          try {
            await base44.integrations.Core.SendEmail({
              to: meetingEmail,
              subject: 'Reminder: Your meeting in 1 hour',
              body: `Hello ${meeting.leadName},\n\nYour meeting is in 1 hour:\n\n${formattedTime}\n\nMeeting Notes:\n${meeting.meetingNotes || 'N/A'}\n\nWe look forward to speaking with you.\n\nThank you.`,
            });
            await base44.asServiceRole.entities.FronterMeeting.update(meeting.id, { hourBeforeReminderSent: true });
            sentCount++;
          } catch (e) { console.warn('1-hour-before email failed:', e); }
        }
      }
    }

    return Response.json({ success: true, sentCount, checkedCount: meetings.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}