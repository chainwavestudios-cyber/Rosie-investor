/**
 * autoScheduleAppointment — Scans a call transcript for callback/follow-up
 * requests, parses the requested time, checks Google Calendar for conflicts,
 * and creates a 30-minute event.
 *
 * Actions:
 *   'preview' — Parse transcript, find free slot, return info WITHOUT creating.
 *   'create'  — Create the Google Calendar event (with optional attendee email).
 *   (none)    — Backward compat: parse + auto-create (legacy behavior).
 *
 * Time defaults (America/New_York):
 *   "morning" / "AM"   → 10:00 AM
 *   "afternoon" / "PM" → 2:00 PM
 *   "evening"          → 5:00 PM
 *   specific time      → use it
 * Duration: 30 minutes. Business hours: 8 AM – 6 PM ET.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { ET_TZ, getCalendarAuth, listEvents, hasConflict } from '../../shared/googleCalendarHelpers.ts';

function toISO(d: Date): string { return d.toISOString(); }

function findFreeSlot(events: any[], start: Date, maxAttempts = 48): { start: Date; end: Date } | null {
  let s = new Date(start);
  for (let i = 0; i < maxAttempts; i++) {
    const e = new Date(s.getTime() + 30 * 60 * 1000);
    const hourET = parseInt(s.toLocaleString('en-US', { timeZone: ET_TZ, hour: '2-digit', hour12: false }), 10);
    if (hourET >= 8 && hourET < 18) {
      if (!hasConflict(events, s, e)) return { start: s, end: e };
    }
    s = new Date(s.getTime() + 30 * 60 * 1000);
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
    const { transcript, leadId, leadName, agentName, dryRun, action, attendeeEmail, startISO: overrideStart } = body;

    // ── CREATE action: create event directly from provided info ──────────
    if (action === 'create') {
      if (!overrideStart) {
        return Response.json({ scheduled: false, error: 'No start time provided for create action' });
      }
      const authHeader = await getCalendarAuth(base44);
      const start = new Date(overrideStart);
      const end = new Date(start.getTime() + 30 * 60 * 1000);

      // Check for conflict and find free slot
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const events = await listEvents(authHeader, timeMin, timeMax);
      const freeSlot = hasConflict(events, start, end) ? findFreeSlot(events, start) : { start, end };
      if (!freeSlot) {
        return Response.json({ scheduled: false, error: 'No free slot found' });
      }

      const title = `📞 Follow-up Call — ${leadName || 'Client'}`;
      const description = `Auto-scheduled from call transcript\nAgent: ${agentName || '—'}\nLead ID: ${leadId || '—'}\n\n${body.summary || ''}`;
      const attendees = attendeeEmail ? [{ email: attendeeEmail }] : [];

      const createRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${attendees.length > 0 ? 'all' : 'none'}`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          summary: title,
          start: { dateTime: freeSlot.start.toISOString() },
          end: { dateTime: freeSlot.end.toISOString() },
          description,
          ...(attendees.length > 0 ? { attendees } : {}),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        return Response.json({ scheduled: false, error: createData.error?.message || 'Failed to create event' });
      }

      // Log activity
      if (leadId) {
        try {
          await base44.asServiceRole.entities.DebtLeadActivity.create({
            leadId,
            leadName: leadName || '',
            activityType: 'calendar_event',
            activityText: `📅 Follow-up scheduled: ${freeSlot.start.toLocaleString('en-US', { timeZone: ET_TZ, dateStyle: 'medium', timeStyle: 'short' })} ET${attendeeEmail ? ` (invite sent to ${attendeeEmail})` : ''}`,
            createdBy: agentName || 'auto-scheduler',
            metadataJson: JSON.stringify({ eventId: createData.id, startISO: freeSlot.start.toISOString(), endISO: freeSlot.end.toISOString(), htmlLink: createData.htmlLink, attendeeEmail }),
          });
        } catch {}
      }

      return Response.json({
        scheduled: true,
        eventId: createData.id,
        htmlLink: createData.htmlLink,
        resolvedTime: `${freeSlot.start.toLocaleString('en-US', { timeZone: ET_TZ, dateStyle: 'medium', timeStyle: 'short' })} ET`,
        startISO: freeSlot.start.toISOString(),
        endISO: freeSlot.end.toISOString(),
        wasRescheduled: freeSlot.start.getTime() !== start.getTime(),
        attendeeEmail: attendeeEmail || null,
      });
    }

    // ── PREVIEW or default: parse transcript for callback requests ─────────
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return Response.json({ hasCallbackRequest: false, message: 'No transcript provided' });
    }

    const transcriptText = transcript.map((line: any) => {
      const speaker = line.speaker === 0 ? 'Agent' : 'Customer';
      return `${speaker}: ${line.text}`;
    }).join('\n');

    const nowET = new Date().toLocaleString('en-US', { timeZone: ET_TZ });

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
    const authHeader = await getCalendarAuth(base44);
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const events = await listEvents(authHeader, timeMin, timeMax);
    const freeSlot = findFreeSlot(events, requestedStart);
    if (!freeSlot) {
      return Response.json({ hasCallbackRequest: true, scheduled: false, error: 'No free slot found within 48 attempts' });
    }

    const startISOOut = freeSlot.start.toISOString();
    const endISOOut = freeSlot.end.toISOString();
    const wasRescheduled = freeSlot.start.getTime() !== requestedStart.getTime();
    const resolvedTimeLabel = `${freeSlot.start.toLocaleString('en-US', { timeZone: ET_TZ, dateStyle: 'medium', timeStyle: 'short' })} ET`;

    // PREVIEW action: return info without creating
    if (action === 'preview' || dryRun) {
      return Response.json({
        hasCallbackRequest: true,
        scheduled: false,
        dryRun: true,
        requestedTime: result.timeLabel,
        resolvedTime: resolvedTimeLabel,
        startISO: startISOOut,
        endISO: endISOOut,
        summary: result.summary,
        wasRescheduled,
      });
    }

    // DEFAULT (no action): auto-create (legacy behavior)
    const title = `📞 Follow-up Call — ${leadName || 'Client'}`;
    const description = `Auto-scheduled from call transcript\nAgent: ${agentName || '—'}\nLead ID: ${leadId || '—'}\n\n${result.summary || ''}`;

    const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        summary: title,
        start: { dateTime: startISOOut },
        end: { dateTime: endISOOut },
        description,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      return Response.json({ hasCallbackRequest: true, scheduled: false, error: createData.error?.message || 'Failed to create event' });
    }

    if (leadId) {
      try {
        await base44.asServiceRole.entities.DebtLeadActivity.create({
          leadId,
          leadName: leadName || '',
          activityType: 'calendar_event',
          activityText: `📅 Auto-scheduled follow-up: ${result.timeLabel}${wasRescheduled ? ` (moved to ${resolvedTimeLabel} due to conflict)` : ''}`,
          createdBy: agentName || 'auto-scheduler',
          metadataJson: JSON.stringify({ eventId: createData.id, startISO: startISOOut, endISO: endISOOut, htmlLink: createData.htmlLink }),
        });
      } catch {}
    }

    return Response.json({
      hasCallbackRequest: true,
      scheduled: true,
      eventId: createData.id,
      htmlLink: createData.htmlLink,
      requestedTime: result.timeLabel,
      resolvedTime: resolvedTimeLabel,
      startISO: startISOOut,
      endISO: endISOOut,
      summary: result.summary,
      wasRescheduled,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message, scheduled: false }, { status: 500 });
  }
}