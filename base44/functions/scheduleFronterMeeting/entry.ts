/**
 * scheduleFronterMeeting — Scans call transcript for meeting date/time,
 * generates meeting notes, checks Google Calendar for conflicts (moves 30 min
 * forward if conflict), creates the event, and stores the meeting for reminders.
 *
 * Actions:
 *   'scan'     — Parse transcript, return proposed date/time + meeting notes + timezone
 *   'schedule' — Create calendar event + store meeting record
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { ET_TZ, getCalendarAuth, listEvents, hasConflict, formatInTz } from '../../shared/googleCalendarHelpers.ts';

const STATE_TO_TZ: Record<string, string> = {
  CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', IN: 'America/New_York',
  ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York',
  MI: 'America/New_York', NH: 'America/New_York', NJ: 'America/New_York',
  NY: 'America/New_York', NC: 'America/New_York', OH: 'America/New_York',
  PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York',
  VT: 'America/New_York', VA: 'America/New_York', WV: 'America/New_York',
  KY: 'America/New_York',
  AL: 'America/Chicago', AR: 'America/Chicago', IL: 'America/Chicago',
  IA: 'America/Chicago', KS: 'America/Chicago', LA: 'America/Chicago',
  MN: 'America/Chicago', MS: 'America/Chicago', MO: 'America/Chicago',
  NE: 'America/Chicago', ND: 'America/Chicago', OK: 'America/Chicago',
  SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago',
  WI: 'America/Chicago',
  AZ: 'America/Phoenix', CO: 'America/Denver', ID: 'America/Denver',
  MT: 'America/Denver', NM: 'America/Denver', UT: 'America/Denver',
  WY: 'America/Denver',
  CA: 'America/Los_Angeles', OR: 'America/Los_Angeles',
  WA: 'America/Los_Angeles', NV: 'America/Los_Angeles',
};

function getTimezoneFromAddress(address: string): string {
  if (!address) return ET_TZ;
  const match = address.match(/\b([A-Z]{2})\s+\d{5}/);
  if (match && STATE_TO_TZ[match[1]]) return STATE_TO_TZ[match[1]];
  const matches = address.match(/\b[A-Z]{2}\b/g);
  if (matches) {
    for (const s of matches) {
      if (STATE_TO_TZ[s]) return STATE_TO_TZ[s];
    }
  }
  return ET_TZ;
}

function etToUTC(dateStr: string, timeStr: string): Date {
  const utcInput = new Date(`${dateStr}T${timeStr}:00.000Z`);
  const etStr = utcInput.toLocaleString('en-US', { timeZone: ET_TZ });
  const utcStr = utcInput.toLocaleString('en-US', { timeZone: 'UTC' });
  const etDate = new Date(etStr);
  const utcDate = new Date(utcStr);
  const offsetMs = utcDate.getTime() - etDate.getTime();
  return new Date(utcInput.getTime() + offsetMs);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, transcript, leadId, leadName, leadPhone, leadEmail, leadAddress, fronterUsername, startDateTime, meetingNotes: overrideNotes, customerReminder } = body;

    // ── SCAN: parse transcript for date/time + generate meeting notes ──
    if (action === 'scan') {
      if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        return Response.json({ hasMeeting: false, message: 'No transcript provided' });
      }

      const transcriptText = transcript.map((line: any) => {
        const speaker = line.speaker === 0 ? 'Agent' : 'Customer';
        return `${speaker}: ${line.text}`;
      }).join('\n');

      const nowET = new Date().toLocaleString('en-US', { timeZone: ET_TZ });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a scheduling assistant analyzing a debt settlement sales call transcript. Current datetime: ${nowET} (America/New_York timezone).

Look for any agreed-upon meeting, callback, or follow-up time in the transcript. Examples:
- "Let's talk Thursday at 2pm"
- "I'll call you back tomorrow morning"
- "Schedule a follow-up for Friday at 3"
- "How about next Monday at 10am?"

If a meeting time was agreed upon, determine the target date and time in America/New_York timezone:
- "morning" or "AM" -> 10:00 AM
- "afternoon" or "PM" -> 2:00 PM
- "evening" -> 5:00 PM
- If a specific time is mentioned, use it
- If "tomorrow" is used, that's the next calendar day
- If a day of week is mentioned (e.g. "Tuesday"), use the next occurrence of that day
- If no time qualifier, default to 10:00 AM

Also generate concise meeting notes (3-5 bullet points) summarizing what was discussed and what the meeting is about, based on the transcript.

Return JSON:
- hasMeeting: boolean
- startISO: ISO datetime string in UTC (convert from ET), or null
- timeLabel: human-readable time (e.g., "Thursday, October 15 at 2:00 PM ET")
- meetingNotes: 3-5 bullet points of meeting notes (as a single string with newlines)

If no meeting time found, return hasMeeting: false with nulls.

Transcript:
${transcriptText}`,
        response_json_schema: {
          type: 'object',
          properties: {
            hasMeeting: { type: 'boolean' },
            startISO: { type: 'string' },
            timeLabel: { type: 'string' },
            meetingNotes: { type: 'string' },
          },
        },
      });

      const customerTz = getTimezoneFromAddress(leadAddress || '');
      const timeInCustomerTz = result?.startISO ? formatInTz(result.startISO, customerTz) : null;

      return Response.json({
        ...result,
        customerTimezone: customerTz,
        timeInCustomerTz,
      });
    }

    // ── SCHEDULE: create calendar event + store meeting ──
    if (action === 'schedule') {
      if (!startDateTime) {
        return Response.json({ error: 'No start time provided' }, { status: 400 });
      }

      // Parse "2026-10-15T14:00" as Eastern Time and convert to UTC
      const [datePart, timePart] = startDateTime.split('T');
      let start = etToUTC(datePart, timePart);
      let end = new Date(start.getTime() + 30 * 60 * 1000);

      // Check for conflicts — move 30 min forward if conflict (up to 48 attempts)
      const authHeader = await getCalendarAuth(base44);
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const events = await listEvents(authHeader, timeMin, timeMax);

      let attempts = 0;
      let wasRescheduled = false;
      while (hasConflict(events, start, end) && attempts < 48) {
        start = new Date(start.getTime() + 30 * 60 * 1000);
        end = new Date(end.getTime() + 30 * 60 * 1000);
        wasRescheduled = true;
        attempts++;
      }

      const customerTz = getTimezoneFromAddress(leadAddress || '');

      // Create Google Calendar event
      const title = `Follow-up Call — ${leadName || 'Client'}`;
      const description = `Scheduled by: ${fronterUsername || '—'}\nLead: ${leadName || '—'}\n\nMeeting Notes:\n${overrideNotes || ''}`;

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
      if (!createRes.ok) {
        return Response.json({ error: createData.error?.message || 'Failed to create event' }, { status: 500 });
      }

      // Store meeting for reminders
      const meeting = await base44.asServiceRole.entities.FronterMeeting.create({
        leadId: leadId || '',
        leadName: leadName || '',
        leadPhone: leadPhone || '',
        leadEmail: leadEmail || '',
        leadAddress: leadAddress || '',
        fronterUsername: fronterUsername || '',
        meetingStartISO: start.toISOString(),
        meetingEndISO: end.toISOString(),
        customerTimezone: customerTz,
        customerReminder: !!customerReminder,
        nightBeforeReminderSent: false,
        hourBeforeReminderSent: false,
        eventId: createData.id,
        meetingNotes: overrideNotes || '',
        status: 'scheduled',
      });

      const resolvedTimeET = formatInTz(start.toISOString(), ET_TZ);
      const resolvedTimeCustomerTz = formatInTz(start.toISOString(), customerTz);

      return Response.json({
        scheduled: true,
        eventId: createData.id,
        htmlLink: createData.htmlLink,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        resolvedTimeET,
        resolvedTimeCustomerTz,
        customerTimezone: customerTz,
        wasRescheduled,
        meetingId: meeting.id,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}