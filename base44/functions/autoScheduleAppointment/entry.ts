/**
 * autoScheduleAppointment — Scans a call transcript for callback/follow-up
 * requests, parses the requested time, checks Google Calendar for conflicts,
 * and creates a 30-minute event. If the slot is busy, pushes forward until free.
 *
 * Time defaults (America/New_York):
 *   "morning" / "AM"   → 10:00 AM
 *   "afternoon" / "PM" → 2:00 PM
 *   "evening"          → 5:00 PM
 *   specific time      → use it
 * Duration: 30 minutes. Business hours: 8 AM – 6 PM ET.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ET_TZ = 'America/New_York';

// Convert a Date to an ISO string in UTC
function toISO(d: Date): string { return d.toISOString(); }

// Get the connector token + auth header
async function getCalendarAuth(base44: any) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

// List calendar events in a time window
async function listEvents(authHeader: any, timeMin: string, timeMax: string): Promise<any[]> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=100&orderBy=startTime`;
  const res = await fetch(url, { headers: authHeader });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
}

// Check if a time slot conflicts with any existing event
function hasConflict(events: any[], start: Date, end: Date): boolean {
  for (const ev of events) {
    const evStart = new Date(ev.start?.dateTime || ev.start?.date || '');
    const evEnd = new Date(ev.end?.dateTime || ev.end?.date || '');
    if (start < evEnd && end > evStart) return true;
  }
  return false;
}

// Push a start time forward in 30-min increments until no conflict, within business hours
function findFreeSlot(events: any[], start: Date, maxAttempts = 48): { start: Date; end: Date } | null {
  let s = new Date(start);
  for (let i = 0; i < maxAttempts; i++) {
    const e = new Date(s.getTime() + 30 * 60 * 1000); // 30 min
    // Check business hours 8am-6pm ET
    const hourET = parseInt(s.toLocaleString('en-US', { timeZone: ET_TZ, hour: '2-digit', hour12: false }), 10);
    if (hourET >= 8 && hourET < 18) {
      if (!hasConflict(events, s, e)) return { start: s, end: e };
    }
    // Push 30 min forward
    s = new Date(s.getTime() + 30 * 60 * 1000);
    // If past 6pm, jump to next day 9am
    const nextHourET = parseInt(s.toLocaleString('en-US', { timeZone: ET_TZ, hour: '2-digit', hour12: false }), 10);
    if (nextHourET >= 18) {
      s.setDate(s.getDate() + 1);
      s.setHours(9, 0, 0, 0);
    }
  }
  return null;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { transcript, leadId, leadName, agentName, dryRun } = body;

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return Response.json({ hasCallbackRequest: false, message: 'No transcript provided' });
    }

    // Build transcript text
    const transcriptText = transcript.map((line: any) => {
      const speaker = line.speaker === 0 ? 'Agent' : 'Customer';
      return `${speaker}: ${line.text}`;
    }).join('\n');

    const nowET = new Date().toLocaleString('en-US', { timeZone: ET_TZ });

    // Step 1: Use LLM to detect callback requests and parse the time
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an appointment scheduler analyzing a debt settlement call transcript. Current datetime: ${nowET} (America/New_York timezone).

Look for any callback, follow-up, or meeting scheduling requests from the customer. Examples:
- "Call me back tomorrow afternoon"
- "Let's talk next week"
- "Schedule a follow-up for Friday morning"
- "Call me Monday at 3pm"
- "I'm busy now, try me tomorrow"

If a callback/follow-up is requested, determine the target date and time in America/New_York timezone:
- "morning" or "AM" → 10:00 AM
- "afternoon" or "PM" → 2:00 PM
- "evening" → 5:00 PM
- If a specific time is mentioned, use it
- If "tomorrow" is used, that's the next calendar day
- If a day of week is mentioned (e.g. "Tuesday"), use the next occurrence of that day
- If no time qualifier, default to 10:00 AM

Return JSON:
- hasCallbackRequest: boolean
- startISO: ISO datetime string in UTC (convert from ET) — the target start time, or null
- summary: brief description of what to discuss (1 sentence)
- timeLabel: human-readable time (e.g., "Tomorrow at 2:00 PM ET")

If no callback request found, return hasCallbackRequest: false with nulls.

Transcript:
${transcriptText}`,
      response_json_schema: {
        type: 'object',
        properties: {
          hasCallbackRequest: { type: 'boolean' },
          startISO: { type: 'string' },
          summary: { type: 'string' },
          timeLabel: { type: 'string' },
        },
      },
    });

    if (!result?.hasCallbackRequest || !result.startISO) {
      return Response.json({ hasCallbackRequest: false, message: 'No callback request detected in transcript' });
    }

    const requestedStart = new Date(result.startISO);

    // Step 2: Get calendar auth + list events for the next 7 days to check conflicts
    const authHeader = await getCalendarAuth(base44);
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const events = await listEvents(authHeader, timeMin, timeMax);

    // Step 3: Find a free slot — push forward if conflict
    const freeSlot = findFreeSlot(events, requestedStart);
    if (!freeSlot) {
      return Response.json({ hasCallbackRequest: true, scheduled: false, error: 'No free slot found within 48 attempts' });
    }

    const startISO = freeSlot.start.toISOString();
    const endISO = freeSlot.end.toISOString();
    const wasRescheduled = freeSlot.start.getTime() !== requestedStart.getTime();

    if (dryRun) {
      return Response.json({
        hasCallbackRequest: true,
        scheduled: false,
        dryRun: true,
        requestedTime: result.timeLabel,
        resolvedTime: `${freeSlot.start.toLocaleString('en-US', { timeZone: ET_TZ })} ET`,
        startISO, endISO,
        summary: result.summary,
        wasRescheduled,
      });
    }

    // Step 4: Create the Google Calendar event
    const title = `📞 Follow-up Call — ${leadName || 'Client'}`;
    const description = `Auto-scheduled from call transcript\nAgent: ${agentName || '—'}\nLead ID: ${leadId || '—'}\n\n${result.summary || ''}`;

    const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        summary: title,
        start: { dateTime: startISO },
        end: { dateTime: endISO },
        description,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      return Response.json({ hasCallbackRequest: true, scheduled: false, error: createData.error?.message || 'Failed to create event' });
    }

    // Step 5: Log activity on the lead
    if (leadId) {
      try {
        await base44.asServiceRole.entities.DebtLeadActivity.create({
          leadId,
          leadName: leadName || '',
          activityType: 'calendar_event',
          activityText: `📅 Auto-scheduled follow-up: ${result.timeLabel}${wasRescheduled ? ` (moved to ${freeSlot.start.toLocaleString('en-US', { timeZone: ET_TZ, dateStyle: 'medium', timeStyle: 'short' })} ET due to conflict)` : ''}`,
          createdBy: agentName || 'auto-scheduler',
          metadataJson: JSON.stringify({ eventId: createData.id, startISO, endISO, htmlLink: createData.htmlLink }),
        });
      } catch {}
    }

    return Response.json({
      hasCallbackRequest: true,
      scheduled: true,
      eventId: createData.id,
      htmlLink: createData.htmlLink,
      requestedTime: result.timeLabel,
      resolvedTime: `${freeSlot.start.toLocaleString('en-US', { timeZone: ET_TZ, dateStyle: 'medium', timeStyle: 'short' })} ET`,
      startISO, endISO,
      summary: result.summary,
      wasRescheduled,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message, scheduled: false }, { status: 500 });
  }
}