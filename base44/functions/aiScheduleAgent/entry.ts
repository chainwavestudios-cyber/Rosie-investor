/**
 * aiScheduleAgent — Twilio <Gather> speech callback for the AI Scheduling Agent.
 *
 * When Chris is on another call and a caller reaches voicemail, instead of
 * recording a voicemail, this agent has a conversation to schedule a 15-minute
 * follow-up call. It checks Chris's Google Calendar for conflicts and proposes
 * alternative times if needed.
 *
 * Security: Twilio signature verification, business-hours enforcement,
 * 14-day booking horizon, idempotent booking, per-call state that preserves
 * existing lead notes, and validated LLM output.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { xmlEscape } from '../../shared/twilioHelpers.ts';
import { ET_TZ, listEvents, hasConflict } from '../../shared/googleCalendarHelpers.ts';
import { verifyTwilioSignature } from '../../shared/verifyTwilioSignature.ts';

const BASE_URL = 'https://rosieai-investorpage.base44.app';
const APPOINTMENT_DURATION_MIN = 15;
const BUSINESS_HOURS_START = 8;  // 8 AM ET
const BUSINESS_HOURS_END = 18;   // 6 PM ET
const MAX_RETRIES = 2;
const MAX_BOOKING_HORIZON_DAYS = 14;
const VALID_INTENTS = ['provide_time', 'not_today', 'yes', 'no', 'pick_alternative', 'another_day', 'unclear'];

// State delimiters — scheduling state is stored at the end of the notes field,
// preserving any existing human-authored notes above it.
const STATE_DELIM_START = '\n---SCHEDULE_STATE---\n';
const STATE_DELIM_END = '\n---END_SCHEDULE_STATE---\n';

// ── TwiML helpers ──────────────────────────────────────────────────
function twimlResponse(twiml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${twiml}`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

function gatherSay(agentMsg: string, respondUrl: string, fallbackMsg = "I didn't catch that. I'll try again later. Have a great day!"): Response {
  return twimlResponse(`<Response>
  <Say voice="Polly.Joanna-Neural">${xmlEscape(agentMsg)}</Say>
  <Gather input="speech" speechTimeout="auto" action="${respondUrl}" method="POST" language="en-US" enhanced="true" speechModel="conversational" />
  <Say voice="Polly.Joanna-Neural">${xmlEscape(fallbackMsg)}</Say>
  <Hangup/>
</Response>`);
}

function goodbye(msg = "No problem, we'll try again another time. Have a great day!"): Response {
  return twimlResponse(`<Response><Say voice="Polly.Joanna-Neural">${xmlEscape(msg)}</Say><Hangup/></Response>`);
}

// ── DST-aware timezone conversion ─────────────────────────────────
// Uses Intl.DateTimeFormat with timeZone: 'America/New_York' to compute
// the UTC offset for any given ET wall-clock time, correctly handling
// daylight-saving transitions. Business hours (8 AM–6 PM) never overlap
// with the 2 AM DST transition, so this is safe for scheduling.

function etToUTC(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Create a UTC instant representing the intended ET wall-clock time
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // Use Intl to find what ET actually shows for this UTC instant
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = etFormatter.formatToParts(wallClock);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');

  // What ET thinks this UTC instant is (as a UTC value for comparison)
  const etAsUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));

  // Offset = how far off our guess was from the intended ET time
  const offset = wallClock.getTime() - etAsUTC;

  // Corrected UTC instant
  return new Date(wallClock.getTime() + offset);
}

function getETDate(offsetDays = 0): string {
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = etFormatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;

  if (offsetDays === 0) return dateStr;

  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

function getETNow(): Date {
  // Current time in ET as a Date (for comparison purposes)
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = etFormatter.formatToParts(now);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')));
}

// ── Validation helpers ──────────────────────────────────────────────
function isValidDateStr(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)));
  return date.getUTCFullYear() === parseInt(y) && date.getUTCMonth() === parseInt(m) - 1 && date.getUTCDate() === parseInt(d);
}

function isValidTimeStr(timeStr: string): boolean {
  const match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const [, h, m] = match;
  return parseInt(h) >= 0 && parseInt(h) < 24 && parseInt(m) >= 0 && parseInt(m) < 60;
}

function isWeekend(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return true; // invalid date — treat as non-bookable
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

function isWithinBusinessHours(dateStr: string, timeStr: string): boolean {
  if (!isValidDateStr(dateStr) || !isValidTimeStr(timeStr)) return false;
  const [hour] = timeStr.split(':').map(Number);
  if (hour < BUSINESS_HOURS_START || hour >= BUSINESS_HOURS_END) return false;
  if (isWeekend(dateStr)) return false;
  return true;
}

function isWithinBookingHorizon(dateStr: string): boolean {
  if (!isValidDateStr(dateStr)) return false;
  const target = new Date(dateStr + 'T00:00:00Z');
  const etNow = getETNow();
  const maxDate = new Date(etNow);
  maxDate.setUTCDate(maxDate.getUTCDate() + MAX_BOOKING_HORIZON_DAYS);
  return target <= maxDate;
}

function validateParsedSpeech(parsed: any): any {
  const intent = typeof parsed?.intent === 'string' && VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'unclear';
  const date_str = typeof parsed?.date_str === 'string' && isValidDateStr(parsed.date_str) ? parsed.date_str : null;
  const time_str = typeof parsed?.time_str === 'string' && isValidTimeStr(parsed.time_str) ? parsed.time_str : null;
  const picked_slot_index = typeof parsed?.picked_slot_index === 'number' && parsed.picked_slot_index > 0 ? Math.floor(parsed.picked_slot_index) : null;
  return { intent, date_str, time_str, picked_slot_index };
}

// ── State management (preserves existing notes) ────────────────────
function extractScheduleState(notes: string): { state: any; prefix: string } {
  if (!notes) return { state: null, prefix: '' };
  const startIdx = notes.indexOf(STATE_DELIM_START);
  if (startIdx === -1) return { state: null, prefix: notes };
  const endIdx = notes.indexOf(STATE_DELIM_END, startIdx);
  if (endIdx === -1) return { state: null, prefix: notes };
  const json = notes.substring(startIdx + STATE_DELIM_START.length, endIdx).trim();
  const prefix = notes.substring(0, startIdx);
  try {
    const state = JSON.parse(json);
    if (state?.type === 'schedule_conversation') return { state, prefix };
    return { state: null, prefix: notes };
  } catch {
    return { state: null, prefix: notes };
  }
}

function buildNotesWithState(prefix: string, state: any): string {
  const cleanPrefix = prefix.replace(/\n+$/, '');
  const stateJson = JSON.stringify(state);
  return `${cleanPrefix}${STATE_DELIM_START}${stateJson}${STATE_DELIM_END}`;
}

// ── Idempotency: check for existing meeting ─────────────────────────
async function findExistingMeeting(base44: any, leadId: string, startISO: string): Promise<any | null> {
  try {
    const results = await base44.entities.FronterMeeting.filter({ leadId, meetingStartISO: startISO });
    const items = results?.items || (Array.isArray(results) ? results : []);
    return items[0] || null;
  } catch {
    return null;
  }
}

// ── Calendar helpers ───────────────────────────────────────────────
function getDayLabel(dateStr: string): string {
  const today = getETDate(0);
  const tomorrow = getETDate(1);
  if (dateStr === today) return 'today';
  if (dateStr === tomorrow) return 'tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

function formatTimeLabel(timeStr: string): string {
  const [hour, min] = timeStr.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${String(min).padStart(2, '0')} ${period}`;
}

function findFreeSlots(events: any[], dateStr: string, maxSlots = 3): Array<{ start: Date; end: Date; timeStr: string }> {
  const slots: Array<{ start: Date; end: Date; timeStr: string }> = [];
  const now = Date.now();
  for (let hour = BUSINESS_HOURS_START; hour < BUSINESS_HOURS_END; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const start = etToUTC(dateStr, timeStr);
      const end = new Date(start.getTime() + APPOINTMENT_DURATION_MIN * 60 * 1000);
      if (start.getTime() < now) continue;
      if (!hasConflict(events, start, end)) {
        slots.push({ start, end, timeStr });
        if (slots.length >= maxSlots) return slots;
      }
    }
  }
  return slots;
}

// ── LLM speech parsing ─────────────────────────────────────────────
async function parseSpeech(base44: any, speech: string, previousQuestion: string, proposedSlots: any[]): Promise<any> {
  const nowET = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TZ,
    dateStyle: 'full', timeStyle: 'short',
  }).format(new Date());

  const slotsDesc = proposedSlots.length > 0
    ? `\nThe proposed alternative times were: ${proposedSlots.map((s, i) => `(${i + 1}) ${formatTimeLabel(s.timeStr)}`).join(', ')}`
    : '';

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a scheduling assistant parsing a phone caller's response during a phone call. Current datetime: ${nowET} (America/New_York timezone).

The caller was asked: "${previousQuestion}"${slotsDesc}

The caller's response: "${speech}"

Parse the caller's intent and extract any date/time mentioned.

Intent categories:
- "provide_time": The caller mentioned a specific time (e.g., "2pm", "3:30", "morning", "afternoon", "noon")
- "not_today": The caller said they're not available today or suggested another day
- "yes": The caller agreed to a suggestion (e.g., "yes", "sure", "that works", "sounds good")
- "no": The caller declined or wants to end the call (e.g., "no", "never mind", "forget it", "not interested")
- "pick_alternative": The caller picked one of the proposed alternative times (e.g., "the first one", "2pm works", "I'll take 3")
- "another_day": The caller mentioned a different day (e.g., "Monday", "next week", "Wednesday")
- "unclear": The response was unclear or didn't match any category

If a time was mentioned, determine the target date and time in America/New_York timezone:
- "morning" or "AM" → 10:00 AM
- "afternoon" or "PM" → 2:00 PM
- "evening" → 5:00 PM
- "noon" → 12:00 PM
- specific time → use it
- "tomorrow" → next calendar day
- day of week → next occurrence of that day
- If no day specified and the question was about today, use today
- If no day specified and the question was about tomorrow, use tomorrow

If the caller picked an alternative, include picked_slot_index (1-based) in the response.

Return JSON:
- intent: one of the categories above
- date_str: date in YYYY-MM-DD format (ET), or null
- time_str: time in HH:MM format (24-hour, ET), or null
- picked_slot_index: 1-based index of the picked alternative, or null`,
    response_json_schema: {
      type: 'object',
      properties: {
        intent: { type: 'string' },
        date_str: { type: 'string' },
        time_str: { type: 'string' },
        picked_slot_index: { type: 'number' },
      },
    },
  });
  return result;
}

// ── Booking ────────────────────────────────────────────────────────
async function bookAppointment(base44: any, start: Date, leadName: string, leadId: string, leadPhone: string, leadEmail: string): Promise<{ eventId: string; start: Date; end: Date }> {
  const end = new Date(start.getTime() + APPOINTMENT_DURATION_MIN * 60 * 1000);
  const startISO = start.toISOString();

  // ── Idempotency: return existing meeting if one exists for this slot ──
  const existing = await findExistingMeeting(base44, leadId, startISO);
  if (existing?.eventId) {
    console.log('[aiScheduleAgent] Idempotent: existing meeting found for', leadId, startISO);
    return { eventId: existing.eventId, start, end };
  }

  const { accessToken } = await base44.connectors.getConnection('googlecalendar');
  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const title = `Follow-up Call — ${leadName || 'Client'}`;
  const description = `Auto-scheduled by AI Scheduling Agent\nLead ID: ${leadId}\nLead Phone: ${leadPhone}\nLead Email: ${leadEmail || 'N/A'}`;

  // ── Recheck availability immediately before creating the event ──
  const timeMin = new Date(start.getTime() - 60 * 60 * 1000).toISOString();
  const timeMax = new Date(end.getTime() + 60 * 60 * 1000).toISOString();
  const events = await listEvents(authHeader, timeMin, timeMax);
  if (hasConflict(events, start, end)) {
    throw new Error('SLOT_TAKEN');
  }

  // ── Create the Google Calendar event ──
  const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      summary: title,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      description,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(createData.error?.message || 'Failed to create event');
  }

  // ── Store meeting record for reminders (with retry) ──
  let meetingRecord: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      meetingRecord = await base44.entities.FronterMeeting.create({
        leadId,
        leadName,
        leadPhone,
        leadEmail,
        fronterUsername: 'ai_schedule_agent',
        meetingStartISO: start.toISOString(),
        meetingEndISO: end.toISOString(),
        customerTimezone: ET_TZ,
        customerReminder: true,
        nightBeforeReminderSent: false,
        hourBeforeReminderSent: false,
        eventId: createData.id,
        meetingNotes: 'Auto-scheduled by AI Scheduling Agent when Chris was on another call',
        status: 'scheduled',
      });
      break;
    } catch (e) {
      console.error(`[aiScheduleAgent] Meeting record creation attempt ${attempt} failed:`, e?.message);
      if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  if (!meetingRecord) {
    // Calendar event exists but meeting record failed — log prominently
    console.error(`[aiScheduleAgent] CRITICAL: Calendar event ${createData.id} created but FronterMeeting record failed for lead ${leadId}. Reminders will NOT fire.`);
  }

  return { eventId: createData.id, start, end };
}

// ── Save state (preserves existing notes) ──────────────────────────
async function saveState(base44: any, leadId: string, currentNotes: string, state: any) {
  try {
    const { prefix } = extractScheduleState(currentNotes);
    const newNotes = buildNotesWithState(prefix, state);
    await base44.entities.FronterLead.update(leadId, { notes: newNotes });
  } catch (e) {
    console.warn('[aiScheduleAgent] Failed to save state:', e?.message);
  }
}

// ── Main handler ───────────────────────────────────────────────────
export default async function(req: Request): Promise<Response> {
  try {
    // ── Read raw body once for signature verification ──
    const rawBody = await req.text();

    // ── Verify Twilio signature ──
    if (!await verifyTwilioSignature(req, rawBody)) {
      console.warn('[aiScheduleAgent] Twilio signature verification failed');
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const leadIdParam = url.searchParams.get('leadId') || '';

    // ── Parse body (form-encoded for Twilio, JSON for tests) ──
    let speechResult = '';
    let fromNumber = '';
    let callSid = '';
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = JSON.parse(rawBody);
        speechResult = (body.SpeechResult || body.speechResult || '').toString().trim();
        fromNumber = (body.From || body.from || '').toString();
        callSid = (body.CallSid || body.callSid || '').toString();
      } catch {}
    } else {
      try {
        const form = new URLSearchParams(rawBody);
        speechResult = (form.get('SpeechResult') || '').toString().trim();
        fromNumber = (form.get('From') || '').toString();
        callSid = (form.get('CallSid') || '').toString();
      } catch {}
    }

    console.log('[aiScheduleAgent] leadId:', leadIdParam, 'from:', fromNumber, 'callSid:', callSid, 'speech:', speechResult);

    const base44 = createClientFromRequest(req).asServiceRole;

    const getAuthHeader = async () => {
      const { accessToken } = await base44.connectors.getConnection('googlecalendar');
      return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    };

    // ── Resolve or create lead ──
    let lead: any = null;
    if (leadIdParam) {
      try { lead = await base44.entities.FronterLead.get(leadIdParam); } catch {}
    }
    if (!lead && fromNumber) {
      try {
        const results = await base44.entities.FronterLead.filter({ phone: fromNumber });
        const items = Array.isArray(results) ? results : (results?.items || []);
        if (items[0]) lead = items[0];
      } catch {}
    }
    if (!lead && fromNumber) {
      try {
        const countRes = await base44.entities.FronterLead.list('-created_date', 1);
        const countItems = Array.isArray(countRes) ? countRes : (countRes?.items || []);
        const num = countItems[0]?.leadNumber ? parseInt(countItems[0].leadNumber.replace(/\D/g, '')) + 1 : 1;
        lead = await base44.entities.FronterLead.create({
          leadNumber: `#F${String(num).padStart(4, '0')}`,
          firstName: 'Unknown',
          lastName: '',
          phone: fromNumber,
          status: 'prospect',
          assignedTo: 'ai_schedule_agent',
          assignedAt: new Date().toISOString(),
          assignedBy: 'ai_schedule_agent',
          uploadedBy: 'ai_schedule_agent',
          notes: '',
        });
      } catch (e) {
        console.error('[aiScheduleAgent] Failed to create lead:', e?.message);
      }
    }

    if (!lead) {
      return goodbye("I'm sorry, there was an error. Goodbye.");
    }

    const currentLeadId = lead.id;
    const respondUrl = `${BASE_URL}/functions/aiScheduleAgent?leadId=${encodeURIComponent(currentLeadId)}`;
    const leadNotes = lead.notes || '';

    // ── Load conversation state (preserves existing notes) ──
    let state: any = { type: 'schedule_conversation', step: 'ask_today', history: [], retryCount: 0, proposedSlots: [], callSid };
    const { state: savedState } = extractScheduleState(leadNotes);
    if (savedState) state = { ...savedState, callSid };

    // ── If no speech (Gather timed out), retry or say goodbye ──
    if (!speechResult) {
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      await saveState(base44, currentLeadId, leadNotes, { ...state, retryCount: (state.retryCount || 0) + 1 });
      return gatherSay("Are you still there?", respondUrl);
    }

    // ── Determine the previous question ──
    const lastAgentMsg = [...(state.history || [])].reverse().find((m: any) => m.role === 'agent');
    const previousQuestion = lastAgentMsg?.content || "What time today would be a good time to follow up?";

    // ── Parse and validate the caller's speech ──
    let parsed: any;
    try {
      const rawParsed = await parseSpeech(base44, speechResult, previousQuestion, state.proposedSlots || []);
      parsed = validateParsedSpeech(rawParsed);
    } catch (e) {
      console.error('[aiScheduleAgent] LLM parse error:', e?.message);
      parsed = { intent: 'unclear', date_str: null, time_str: null, picked_slot_index: null };
    }

    console.log('[aiScheduleAgent] parsed intent:', parsed?.intent, 'date:', parsed?.date_str, 'time:', parsed?.time_str);

    // Add caller's speech to history
    state.history = [...(state.history || []), { role: 'caller', content: speechResult }].slice(-20);

    const step = state.step;

    // ── Helper: validate slot, check calendar, book or propose ──
    async function tryBookOrPropose(dateStr: string, timeStr: string): Promise<Response> {
      // ── Validate date and time formats ──
      if (!isValidDateStr(dateStr) || !isValidTimeStr(timeStr)) {
        console.warn('[aiScheduleAgent] Invalid date/time:', dateStr, timeStr);
        return await proposeAlternatives(getETDate(0));
      }

      // ── Enforce business hours (8 AM–6 PM ET, Mon–Fri) ──
      if (!isWithinBusinessHours(dateStr, timeStr)) {
        const [hour] = timeStr.split(':').map(Number);
        if (isWeekend(dateStr)) {
          const agentMsg = "I'm sorry, we're only available Monday through Friday. Could we schedule a time during the business week?";
          state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
          state.step = 'ask_another_day';
          state.retryCount = 0;
          await saveState(base44, currentLeadId, leadNotes, state);
          return gatherSay(agentMsg, respondUrl);
        }
        if (hour < BUSINESS_HOURS_START) {
          const agentMsg = "I'm sorry, the earliest we can schedule is 8 AM. Could you pick a time between 8 AM and 6 PM?";
          state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
          state.retryCount = 0;
          await saveState(base44, currentLeadId, leadNotes, state);
          return gatherSay(agentMsg, respondUrl);
        }
        const agentMsg = "I'm sorry, the latest we can schedule is 6 PM. Could you pick a time between 8 AM and 6 PM?";
        state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
        state.retryCount = 0;
        await saveState(base44, currentLeadId, leadNotes, state);
        return gatherSay(agentMsg, respondUrl);
      }

      // ── Enforce 14-day booking horizon ──
      if (!isWithinBookingHorizon(dateStr)) {
        const agentMsg = `I'm sorry, I can only schedule up to ${MAX_BOOKING_HORIZON_DAYS} days out. Could we pick a sooner date?`;
        state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_another_day';
        state.retryCount = 0;
        await saveState(base44, currentLeadId, leadNotes, state);
        return gatherSay(agentMsg, respondUrl);
      }

      const start = etToUTC(dateStr, timeStr);

      // ── Reject past times ──
      if (start.getTime() < Date.now()) {
        return await proposeAlternatives(dateStr);
      }

      try {
        // ── Query calendar covering the requested date ──
        const authHeader = await getAuthHeader();
        const queryStart = new Date(start.getTime() - 60 * 60 * 1000);
        const queryEnd = new Date(start.getTime() + APPOINTMENT_DURATION_MIN * 60 * 1000 + 60 * 60 * 1000);
        const events = await listEvents(authHeader, queryStart.toISOString(), queryEnd.toISOString());

        if (!hasConflict(events, start, new Date(start.getTime() + APPOINTMENT_DURATION_MIN * 60 * 1000))) {
          // ── Slot is free — book it (idempotent) ──
          const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Client';
          await bookAppointment(base44, start, leadName, currentLeadId, fromNumber, lead.email || '');
          const dayLabel = getDayLabel(dateStr);
          const timeLabel = formatTimeLabel(timeStr);

          // ── Only mention email reminder if lead has an email ──
          const hasEmail = lead.email && lead.email.includes('@');
          const reminderMsg = hasEmail ? ' An email reminder will be sent as well.' : '';

          await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
          try { await base44.entities.FronterLead.update(currentLeadId, { lastCallResult: 'appointment_scheduled' }); } catch {}
          return twimlResponse(`<Response><Say voice="Polly.Joanna-Neural">Great, I've scheduled your follow-up call with Chris for ${dayLabel} at ${timeLabel}.${reminderMsg} Have a great day!</Say><Hangup/></Response>`);
        } else {
          return await proposeAlternatives(dateStr);
        }
      } catch (e: any) {
        if (e?.message === 'SLOT_TAKEN') {
          return await proposeAlternatives(dateStr);
        }
        console.error('[aiScheduleAgent] Calendar check/booking failed:', e?.message);
        return await proposeAlternatives(dateStr);
      }
    }

    // ── Helper: propose alternative times ──
    async function proposeAlternatives(dateStr: string): Promise<Response> {
      try {
        const authHeader = await getAuthHeader();
        const timeMin = new Date().toISOString();
        const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const events = await listEvents(authHeader, timeMin, timeMax);

        let slots = findFreeSlots(events, dateStr, 3);
        let proposedDate = dateStr;

        if (slots.length === 0) {
          const tomorrow = getETDate(1);
          slots = findFreeSlots(events, tomorrow, 3);
          proposedDate = tomorrow;
        }
        if (slots.length === 0) {
          const dayAfter = getETDate(2);
          slots = findFreeSlots(events, dayAfter, 3);
          proposedDate = dayAfter;
        }

        if (slots.length === 0) {
          await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
          return goodbye("I'm sorry, Chris's schedule is full for the next few days. We'll reach out to you soon to find a time. Have a great day!");
        }

        const slotTimes = slots.map(s => formatTimeLabel(s.timeStr));
        const slotList = slotTimes.length === 1 ? slotTimes[0] : slotTimes.slice(0, -1).join(', ') + ' or ' + slotTimes[slotTimes.length - 1];
        const dayLabel = getDayLabel(proposedDate);

        const agentMsg = `I'm sorry, that time doesn't work. Chris is available ${dayLabel} at ${slotList}. Which of those works for you?`;
        state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'propose_alternatives';
        state.proposedSlots = slots.map(s => ({ dateStr: proposedDate, timeStr: s.timeStr, startISO: s.start.toISOString() }));
        state.retryCount = 0;

        await saveState(base44, currentLeadId, leadNotes, state);
        return gatherSay(agentMsg, respondUrl);
      } catch (e) {
        console.error('[aiScheduleAgent] proposeAlternatives failed:', e?.message);
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye("I'm sorry, I'm having trouble accessing Chris's calendar right now. We'll call you back soon to schedule. Have a great day!");
      }
    }

    // ── Step: ask_today ──
    if (step === 'ask_today') {
      if (parsed.intent === 'provide_time' && parsed.date_str && parsed.time_str) {
        return await tryBookOrPropose(parsed.date_str, parsed.time_str);
      }
      if (parsed.intent === 'not_today') {
        const agentMsg = "Is tomorrow a better time?";
        state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_tomorrow';
        state.retryCount = 0;
        await saveState(base44, currentLeadId, leadNotes, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      if (parsed.intent === 'another_day' && parsed.date_str && parsed.time_str) {
        return await tryBookOrPropose(parsed.date_str, parsed.time_str);
      }
      if (parsed.intent === 'another_day' && parsed.date_str) {
        const dayLabel = getDayLabel(parsed.date_str);
        const agentMsg = `What time on ${dayLabel} works best for you?`;
        state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_another_day_time';
        state.targetDate = parsed.date_str;
        state.retryCount = 0;
        await saveState(base44, currentLeadId, leadNotes, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      const agentMsg = "I'm sorry, I didn't catch that. What time today would work for a follow-up call?";
      state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, leadNotes, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // ── Step: ask_tomorrow ──
    if (step === 'ask_tomorrow') {
      if (parsed.intent === 'yes') {
        const agentMsg = "What time works best for you tomorrow?";
        state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_tomorrow_time';
        state.retryCount = 0;
        await saveState(base44, currentLeadId, leadNotes, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if (parsed.intent === 'no') {
        const agentMsg = "What day works best for you then?";
        state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_another_day';
        state.retryCount = 0;
        await saveState(base44, currentLeadId, leadNotes, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if (parsed.intent === 'provide_time' && parsed.date_str && parsed.time_str) {
        return await tryBookOrPropose(parsed.date_str, parsed.time_str);
      }
      if (parsed.intent === 'another_day' && parsed.date_str && parsed.time_str) {
        return await tryBookOrPropose(parsed.date_str, parsed.time_str);
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      const agentMsg = "I'm sorry, I didn't catch that. Is tomorrow a better time for a follow-up call?";
      state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, leadNotes, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // ── Step: ask_tomorrow_time ──
    if (step === 'ask_tomorrow_time') {
      if (parsed.intent === 'provide_time' && parsed.date_str && parsed.time_str) {
        return await tryBookOrPropose(parsed.date_str, parsed.time_str);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      const agentMsg = "I'm sorry, I didn't catch that. What time tomorrow works best for you?";
      state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, leadNotes, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // ── Step: ask_another_day ──
    if (step === 'ask_another_day') {
      if ((parsed.intent === 'another_day' || parsed.intent === 'provide_time') && parsed.date_str && parsed.time_str) {
        return await tryBookOrPropose(parsed.date_str, parsed.time_str);
      }
      if (parsed.intent === 'another_day' && parsed.date_str) {
        const dayLabel = getDayLabel(parsed.date_str);
        const agentMsg = `What time on ${dayLabel} works best for you?`;
        state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_another_day_time';
        state.targetDate = parsed.date_str;
        state.retryCount = 0;
        await saveState(base44, currentLeadId, leadNotes, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      const agentMsg = "I'm sorry, I didn't catch that. What day works best for a follow-up call?";
      state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, leadNotes, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // ── Step: ask_another_day_time ──
    if (step === 'ask_another_day_time') {
      if (parsed.intent === 'provide_time' && parsed.time_str) {
        const dateStr = state.targetDate || getETDate(0);
        return await tryBookOrPropose(dateStr, parsed.time_str);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      const dayLabel = state.targetDate ? getDayLabel(state.targetDate) : 'that day';
      const agentMsg = `I'm sorry, I didn't catch that. What time on ${dayLabel} works best for you?`;
      state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, leadNotes, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // ── Step: propose_alternatives ──
    if (step === 'propose_alternatives') {
      if (parsed.intent === 'pick_alternative' && parsed.picked_slot_index && state.proposedSlots?.[parsed.picked_slot_index - 1]) {
        const slot = state.proposedSlots[parsed.picked_slot_index - 1];
        return await tryBookOrPropose(slot.dateStr, slot.timeStr);
      }
      if (parsed.intent === 'provide_time' && parsed.time_str) {
        const match = state.proposedSlots?.find((s: any) => s.timeStr === parsed.time_str);
        if (match) {
          return await tryBookOrPropose(match.dateStr, match.timeStr);
        }
        if (parsed.date_str) {
          return await tryBookOrPropose(parsed.date_str, parsed.time_str);
        }
      }
      if (parsed.intent === 'yes' && state.proposedSlots?.[0]) {
        const slot = state.proposedSlots[0];
        return await tryBookOrPropose(slot.dateStr, slot.timeStr);
      }
      if (parsed.intent === 'another_day' && parsed.date_str) {
        if (parsed.time_str) {
          return await tryBookOrPropose(parsed.date_str, parsed.time_str);
        }
        const dayLabel = getDayLabel(parsed.date_str);
        const agentMsg = `What time on ${dayLabel} works best for you?`;
        state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_another_day_time';
        state.targetDate = parsed.date_str;
        state.retryCount = 0;
        await saveState(base44, currentLeadId, leadNotes, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
        return goodbye();
      }
      const slotTimes = (state.proposedSlots || []).map((s: any) => formatTimeLabel(s.timeStr));
      const slotList = slotTimes.length === 1 ? slotTimes[0] : slotTimes.slice(0, -1).join(', ') + ' or ' + slotTimes[slotTimes.length - 1];
      const dayLabel = state.proposedSlots?.[0] ? getDayLabel(state.proposedSlots[0].dateStr) : 'today';
      const agentMsg = `I'm sorry, I didn't catch that. Chris is available ${dayLabel} at ${slotList}. Which works for you?`;
      state.history = [...(state.history || []), { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, leadNotes, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // Default — say goodbye
    await saveState(base44, currentLeadId, leadNotes, { ...state, step: 'done' });
    return goodbye("Thank you for calling. Have a great day!");

  } catch (error) {
    console.error('[aiScheduleAgent] Fatal error:', error?.message);
    return goodbye("I'm sorry, there was an error. Goodbye.");
  }
}