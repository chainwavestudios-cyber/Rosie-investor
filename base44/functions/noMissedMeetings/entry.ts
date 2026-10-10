/**
 * noMissedMeetings — Scans call transcripts for follow-up/callback requests
 * and compares them to actual Google Calendar events to find missed meetings.
 *
 * Input: { dateFrom, dateTo, todayOnly }
 * Output: { missed: [{ leadName, leadId, requestedTime, transcriptId, callDate, summary }], totalRequests, matchedCount, missedCount }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ET_TZ = 'America/New_York';

async function getCalendarAuth(base44: any) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

async function listEvents(authHeader: any, timeMin: string, timeMax: string): Promise<any[]> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=250&orderBy=startTime`;
  const res = await fetch(url, { headers: authHeader });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
}

// Check if a calendar event matches a requested follow-up.
// An event only matches if it's SPECIFICALLY for this lead — the event title
// or description must contain the lead's first name (or the lead ID in description).
// A random event on the same day does NOT count as a match.
function eventMatchesRequest(ev: any, requestedISO: string, leadName: string, leadId: string): boolean {
  const evTitle = (ev.summary || '').toLowerCase();
  const evDesc = (ev.description || '').toLowerCase();
  const firstName = leadName ? leadName.toLowerCase().split(' ')[0] : '';
  // Must reference this lead by first name in title, or lead ID in description
  const titleMatch = firstName && firstName.length > 1 && evTitle.includes(firstName);
  const descLeadIdMatch = leadId && evDesc.includes(leadId);
  if (!titleMatch && !descLeadIdMatch) return false;
  // Same calendar day as the requested follow-up
  const evStart = new Date(ev.start?.dateTime || ev.start?.date || '');
  const reqStart = new Date(requestedISO);
  const evDay = evStart.toLocaleDateString('en-US', { timeZone: ET_TZ });
  const reqDay = reqStart.toLocaleDateString('en-US', { timeZone: ET_TZ });
  // Allow same day OR within 1 day (follow-up may have been moved)
  const diffHours = Math.abs(evStart.getTime() - reqStart.getTime()) / (1000 * 60 * 60);
  return evDay === reqDay || diffHours <= 24;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { todayOnly, dateFrom, dateTo, action, missedMeetings } = body;

    // ── SET ALL MISSED: create calendar events for each missed meeting ──
    if (action === 'setAllMissed') {
      const authHeader = await getCalendarAuth(base44);
      const created: any[] = [];
      const failed: any[] = [];

      for (const m of (missedMeetings || [])) {
        try {
          const start = new Date(m.requestedISO);
          const end = new Date(start.getTime() + 30 * 60 * 1000);
          const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none', {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({
              summary: `Follow-up Call — ${m.leadName || 'Client'}`,
              start: { dateTime: start.toISOString() },
              end: { dateTime: end.toISOString() },
              description: `Lead ID: ${m.leadId || ''}\nTranscript ID: ${m.transcriptId || ''}\n\n${m.summary || ''}`,
            }),
          });
          const createData = await createRes.json();
          if (createRes.ok) {
            created.push({ leadName: m.leadName, eventId: createData.id, htmlLink: createData.htmlLink });
          } else {
            failed.push({ leadName: m.leadName, error: createData.error?.message || 'Unknown error' });
          }
        } catch (e: any) {
          failed.push({ leadName: m.leadName, error: e.message || String(e) });
        }
      }

      return Response.json({ created, failed, createdCount: created.length, failedCount: failed.length });
    }


    // Determine date range
    let start: Date, end: Date;
    if (todayOnly) {
      start = new Date(); start.setHours(0, 0, 0, 0);
      end = new Date(); end.setHours(23, 59, 59, 999);
    } else if (dateFrom && dateTo) {
      start = new Date(dateFrom); start.setHours(0, 0, 0, 0);
      end = new Date(dateTo); end.setHours(23, 59, 59, 999);
    } else {
      // Default: last 7 days
      start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); start.setHours(0, 0, 0, 0);
      end = new Date(); end.setHours(23, 59, 59, 999);
    }

    // Step 1: Get all transcripts in the date range
    const transcripts = await base44.asServiceRole.entities.DebtCallTranscript.list('-callDate', 500);
    const inRange = (transcripts || []).filter((t: any) => {
      const cd = new Date(t.callDate);
      return cd >= start && cd <= end;
    });

    if (inRange.length === 0) {
      return Response.json({ missed: [], totalRequests: 0, matchedCount: 0, missedCount: 0, message: 'No transcripts in date range' });
    }

    // Step 2: Get calendar events covering the range + 7 days buffer (for follow-ups scheduled ahead)
    const calTimeMin = start.toISOString();
    const calTimeMax = new Date(end.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const authHeader = await getCalendarAuth(base44);
    const events = await listEvents(authHeader, calTimeMin, calTimeMax);

    // Step 3: For each transcript, use LLM to detect follow-up requests
    const missed: any[] = [];
    let totalRequests = 0;
    let matchedCount = 0;

    // Process in batches of 5 to stay within LLM limits
    for (let i = 0; i < inRange.length; i += 5) {
      const batch = inRange.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(async (t: any) => {
        let lines: any[] = [];
        try { lines = JSON.parse(t.transcriptJson || '[]'); } catch { return null; }
        if (lines.length === 0) return null;

        const transcriptText = lines.map((l: any) => `${l.speaker === 0 ? 'Agent' : 'Customer'}: ${l.text}`).join('\n').substring(0, 4000);

        try {
          const result = await base44.integrations.Core.InvokeLLM({
            prompt: `Analyze this call transcript for any callback, follow-up, or meeting requests from the customer. Look for phrases like "call me back", "follow up", "schedule a meeting", "let's talk next week", "try me tomorrow", etc.

Current datetime: ${new Date().toLocaleString('en-US', { timeZone: ET_TZ })} (America/New_York)

If a follow-up was requested, determine the target date/time in America/New_York:
- "morning"/"AM" → 10:00 AM, "afternoon"/"PM" → 2:00 PM, "evening" → 5:00 PM
- "tomorrow" = next calendar day
- Convert to ISO UTC

Return JSON:
- hasCallbackRequest: boolean
- startISO: ISO datetime in UTC or null
- summary: 1-sentence summary of the request

Transcript:
${transcriptText}`,
            response_json_schema: {
              type: 'object',
              properties: {
                hasCallbackRequest: { type: 'boolean' },
                startISO: { type: 'string' },
                summary: { type: 'string' },
              },
            },
          });

          if (!result?.hasCallbackRequest || !result.startISO) return null;

          // Check if any calendar event matches this request
          const matched = events.some((ev: any) => eventMatchesRequest(ev, result.startISO, t.leadName || '', t.leadId || ''));
          return {
            leadName: t.leadName || 'Unknown',
            leadId: t.leadId || '',
            transcriptId: t.id || '',
            callDate: t.callDate,
            requestedISO: result.startISO,
            requestedTimeLabel: new Date(result.startISO).toLocaleString('en-US', { timeZone: ET_TZ, dateStyle: 'medium', timeStyle: 'short' }),
            summary: result.summary || '',
            matched,
          };
        } catch { return null; }
      }));

      for (const r of batchResults) {
        if (!r) continue;
        totalRequests++;
        if (r.matched) { matchedCount++; }
        else { missed.push(r); }
      }
    }

    return Response.json({
      missed,
      totalRequests,
      matchedCount,
      missedCount: missed.length,
      dateRange: { from: start.toISOString(), to: end.toISOString() },
      totalTranscriptsScanned: inRange.length,
      totalCalendarEvents: events.length,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}