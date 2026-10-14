/**
 * aiScheduleAgent — Twilio <Gather> speech callback for the AI Scheduling Agent.
 *
 * When Chris is on another call and a caller reaches voicemail, instead of
 * recording a voicemail, this agent has a conversation to schedule a 15-minute
 * follow-up call. It checks Chris's Google Calendar for conflicts and proposes
 * alternative times if needed.
 *
 * Conversation flow:
 *   1. "Chris is currently on another call, what time today works for a follow-up?"
 *   2. If not today → "Is tomorrow better?" → "What time?"
 *   3. If time given → check calendar → book or propose alternatives
 *   4. "An email reminder will be sent. Have a great day!"
 *
 * Appointments are 15 minutes. The duration is never mentioned to the caller.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { xmlEscape } from '../../shared/twilioHelpers.ts';
import { ET_TZ, listEvents, hasConflict } from '../../shared/googleCalendarHelpers.ts';

const BASE_URL = 'https://rosieai-investorpage.base44.app';
const APPOINTMENT_DURATION_MIN = 15;
const BUSINESS_HOURS_START = 8;
const BUSINESS_HOURS_END = 18;
const MAX_RETRIES = 2;

function twimlResponse(twiml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${twiml}`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

// Convert an ET date+time string to UTC Date
function etToUTC(dateStr: string, timeStr: string): Date {
  const utcInput = new Date(`${dateStr}T${timeStr}:00.000Z`);
  const etStr = utcInput.toLocaleString('en-US', { timeZone: ET_TZ });
  const utcStr = utcInput.toLocaleString('en-US', { timeZone: 'UTC' });
  const etDate = new Date(etStr);
  const utcDate = new Date(utcStr);
  const offsetMs = utcDate.getTime() - etDate.getTime();
  return new Date(utcInput.getTime() + offsetMs);
}

// Get today's date in ET as YYYY-MM-DD
function getETDate(offsetDays = 0): string {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: ET_TZ });
  const etDate = new Date(etStr);
  etDate.setDate(etDate.getDate() + offsetDays);
  return etDate.toISOString().split('T')[0];
}

// Get the day label for a date (e.g., "today", "tomorrow", "Monday")
function getDayLabel(dateStr: string): string {
  const today = getETDate(0);
  const tomorrow = getETDate(1);
  if (dateStr === today) return 'today';
  if (dateStr === tomorrow) return 'tomorrow';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

// Format a time string (e.g., "14:00") to a human-readable label (e.g., "2:00 PM")
function formatTimeLabel(timeStr: string): string {
  const [hour, min] = timeStr.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${String(min).padStart(2, '0')} ${period}`;
}

// Find free 15-minute slots on a given date
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

// Parse caller's speech using LLM
async function parseSpeech(base44: any, speech: string, previousQuestion: string, proposedSlots: any[]): Promise<any> {
  const nowET = new Date().toLocaleString('en-US', { timeZone: ET_TZ });
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

// Book a 15-minute appointment on Google Calendar
async function bookAppointment(base44: any, start: Date, leadName: string, leadId: string, leadPhone: string, leadEmail: string) {
  const end = new Date(start.getTime() + APPOINTMENT_DURATION_MIN * 60 * 1000);
  const { accessToken } = await base44.connectors.getConnection('googlecalendar');
  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const title = `Follow-up Call — ${leadName || 'Client'}`;
  const description = `Auto-scheduled by AI Scheduling Agent\nLead ID: ${leadId}\nLead Phone: ${leadPhone}\nLead Email: ${leadEmail || 'N/A'}`;

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

  // Store meeting for reminders
  try {
    await base44.entities.FronterMeeting.create({
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
  } catch (e) {
    console.warn('[aiScheduleAgent] Failed to store meeting:', e?.message);
  }

  return { eventId: createData.id, start, end };
}

// Save conversation state to lead
async function saveState(base44: any, leadId: string, state: any) {
  try {
    await base44.entities.FronterLead.update(leadId, { notes: JSON.stringify(state) });
  } catch (e) {
    console.warn('[aiScheduleAgent] Failed to save state:', e?.message);
  }
}

// Build a Gather TwiML response
function gatherSay(agentMsg: string, respondUrl: string, fallbackMsg = "I didn't catch that. I'll try again later. Have a great day!"): Response {
  return twimlResponse(`<Response>
  <Say voice="Polly.Joanna-Neural">${xmlEscape(agentMsg)}</Say>
  <Gather input="speech" speechTimeout="auto" action="${respondUrl}" method="POST" language="en-US" enhanced="true" speechModel="conversational" />
  <Say voice="Polly.Joanna-Neural">${xmlEscape(fallbackMsg)}</Say>
  <Hangup/>
</Response>`);
}

// Goodbye TwiML
function goodbye(msg = "No problem, we'll try again another time. Have a great day!"): Response {
  return twimlResponse(`<Response><Say voice="Polly.Joanna-Neural">${xmlEscape(msg)}</Say><Hangup/></Response>`);
}

export default async function(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const leadIdParam = url.searchParams.get('leadId') || '';

    // Twilio sends form-encoded SpeechResult; tests send JSON
    let speechResult = '';
    let fromNumber = '';
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = await req.json();
        speechResult = (body.SpeechResult || body.speechResult || '').toString().trim();
        fromNumber = (body.From || body.from || '').toString();
      } catch {}
    } else {
      try {
        const form = await req.formData();
        speechResult = (form.get('SpeechResult') || '').toString().trim();
        fromNumber = (form.get('From') || '').toString();
      } catch {}
    }

    console.log('[aiScheduleAgent] leadId:', leadIdParam, 'from:', fromNumber, 'speech:', speechResult);

    const base44 = createClientFromRequest(req).asServiceRole;

    // Calendar auth — base44 is already the service role, so access connectors directly
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
          notes: JSON.stringify({ type: 'schedule_conversation', step: 'ask_today', history: [], retryCount: 0, proposedSlots: [] }),
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

    // ── Load conversation state ──
    let state: any = { type: 'schedule_conversation', step: 'ask_today', history: [], retryCount: 0, proposedSlots: [] };
    try {
      const parsed = JSON.parse(lead.notes || '{}');
      if (parsed?.type === 'schedule_conversation') state = parsed;
    } catch {}

    // ── If no speech (Gather timed out), retry or say goodbye ──
    if (!speechResult) {
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      await saveState(base44, currentLeadId, { ...state, retryCount: (state.retryCount || 0) + 1 });
      return gatherSay("Are you still there?", respondUrl);
    }

    // ── Determine the previous question ──
    const lastAgentMsg = [...(state.history || [])].reverse().find((m: any) => m.role === 'agent');
    const previousQuestion = lastAgentMsg?.content || "What time today would be a good time to follow up?";

    // ── Parse the caller's speech ──
    let parsed: any;
    try {
      parsed = await parseSpeech(base44, speechResult, previousQuestion, state.proposedSlots || []);
    } catch (e) {
      console.error('[aiScheduleAgent] LLM parse error:', e?.message);
      parsed = { intent: 'unclear' };
    }

    console.log('[aiScheduleAgent] parsed intent:', parsed?.intent, 'date:', parsed?.date_str, 'time:', parsed?.time_str);

    // Add caller's speech to history
    state.history = [...(state.history || []), { role: 'caller', content: speechResult }].slice(-20);

    const step = state.step;

    // ── Helper: check calendar and book or propose alternatives ──
    async function tryBookOrPropose(dateStr: string, timeStr: string): Promise<Response> {
      const start = etToUTC(dateStr, timeStr);
      const end = new Date(start.getTime() + APPOINTMENT_DURATION_MIN * 60 * 1000);

      if (start.getTime() < Date.now()) {
        return await proposeAlternatives(dateStr);
      }

      try {
        const authHeader = await getAuthHeader();
        const timeMin = new Date().toISOString();
        const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const events = await listEvents(authHeader, timeMin, timeMax);

        if (!hasConflict(events, start, end)) {
          // Slot is free — book it
          const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Client';
          await bookAppointment(base44, start, leadName, currentLeadId, fromNumber, lead.email || '');
          const dayLabel = getDayLabel(dateStr);
          const timeLabel = formatTimeLabel(timeStr);
          await saveState(base44, currentLeadId, { ...state, step: 'done' });
          try { await base44.entities.FronterLead.update(currentLeadId, { lastCallResult: 'appointment_scheduled' }); } catch {}
          return twimlResponse(`<Response><Say voice="Polly.Joanna-Neural">Great, I've scheduled your follow-up call with Chris for ${dayLabel} at ${timeLabel}. An email reminder will be sent as well. Have a great day!</Say><Hangup/></Response>`);
        } else {
          return await proposeAlternatives(dateStr);
        }
      } catch (e) {
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
          await saveState(base44, currentLeadId, { ...state, step: 'done' });
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

        await saveState(base44, currentLeadId, state);
        return gatherSay(agentMsg, respondUrl);
      } catch (e) {
        console.error('[aiScheduleAgent] proposeAlternatives failed:', e?.message);
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
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
        state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_tomorrow';
        state.retryCount = 0;
        await saveState(base44, currentLeadId, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      if (parsed.intent === 'another_day' && parsed.date_str && parsed.time_str) {
        return await tryBookOrPropose(parsed.date_str, parsed.time_str);
      }
      if (parsed.intent === 'another_day' && parsed.date_str) {
        const dayLabel = getDayLabel(parsed.date_str);
        const agentMsg = `What time on ${dayLabel} works best for you?`;
        state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_another_day_time';
        state.targetDate = parsed.date_str;
        state.retryCount = 0;
        await saveState(base44, currentLeadId, state);
        return gatherSay(agentMsg, respondUrl);
      }
      // Unclear — repeat
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      const agentMsg = "I'm sorry, I didn't catch that. What time today would work for a follow-up call?";
      state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // ── Step: ask_tomorrow ──
    if (step === 'ask_tomorrow') {
      if (parsed.intent === 'yes') {
        const agentMsg = "What time works best for you tomorrow?";
        state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_tomorrow_time';
        state.retryCount = 0;
        await saveState(base44, currentLeadId, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if (parsed.intent === 'no') {
        const agentMsg = "What day works best for you then?";
        state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_another_day';
        state.retryCount = 0;
        await saveState(base44, currentLeadId, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if (parsed.intent === 'provide_time' && parsed.date_str && parsed.time_str) {
        return await tryBookOrPropose(parsed.date_str, parsed.time_str);
      }
      if (parsed.intent === 'another_day' && parsed.date_str && parsed.time_str) {
        return await tryBookOrPropose(parsed.date_str, parsed.time_str);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      const agentMsg = "I'm sorry, I didn't catch that. Is tomorrow a better time for a follow-up call?";
      state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // ── Step: ask_tomorrow_time ──
    if (step === 'ask_tomorrow_time') {
      if (parsed.intent === 'provide_time' && parsed.date_str && parsed.time_str) {
        return await tryBookOrPropose(parsed.date_str, parsed.time_str);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      const agentMsg = "I'm sorry, I didn't catch that. What time tomorrow works best for you?";
      state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, state);
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
        state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_another_day_time';
        state.targetDate = parsed.date_str;
        state.retryCount = 0;
        await saveState(base44, currentLeadId, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      const agentMsg = "I'm sorry, I didn't catch that. What day works best for a follow-up call?";
      state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // ── Step: ask_another_day_time ──
    if (step === 'ask_another_day_time') {
      if (parsed.intent === 'provide_time' && parsed.time_str) {
        const dateStr = state.targetDate || getETDate(0);
        return await tryBookOrPropose(dateStr, parsed.time_str);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      const dayLabel = state.targetDate ? getDayLabel(state.targetDate) : 'that day';
      const agentMsg = `I'm sorry, I didn't catch that. What time on ${dayLabel} works best for you?`;
      state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // ── Step: propose_alternatives ──
    if (step === 'propose_alternatives') {
      // Caller picks one of the proposed alternatives
      if (parsed.intent === 'pick_alternative' && parsed.picked_slot_index && state.proposedSlots?.[parsed.picked_slot_index - 1]) {
        const slot = state.proposedSlots[parsed.picked_slot_index - 1];
        return await tryBookOrPropose(slot.dateStr, slot.timeStr);
      }
      if (parsed.intent === 'provide_time' && parsed.time_str) {
        // Try to match the time to one of the proposed slots
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
        state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
        state.step = 'ask_another_day_time';
        state.targetDate = parsed.date_str;
        state.retryCount = 0;
        await saveState(base44, currentLeadId, state);
        return gatherSay(agentMsg, respondUrl);
      }
      if (parsed.intent === 'no') {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      if ((state.retryCount || 0) >= MAX_RETRIES) {
        await saveState(base44, currentLeadId, { ...state, step: 'done' });
        return goodbye();
      }
      // Repeat the alternatives
      const slotTimes = (state.proposedSlots || []).map((s: any) => formatTimeLabel(s.timeStr));
      const slotList = slotTimes.length === 1 ? slotTimes[0] : slotTimes.slice(0, -1).join(', ') + ' or ' + slotTimes[slotTimes.length - 1];
      const dayLabel = state.proposedSlots?.[0] ? getDayLabel(state.proposedSlots[0].dateStr) : 'today';
      const agentMsg = `I'm sorry, I didn't catch that. Chris is available ${dayLabel} at ${slotList}. Which works for you?`;
      state.history = [...state.history, { role: 'agent', content: agentMsg }].slice(-20);
      state.retryCount = (state.retryCount || 0) + 1;
      await saveState(base44, currentLeadId, state);
      return gatherSay(agentMsg, respondUrl);
    }

    // Default — say goodbye
    await saveState(base44, currentLeadId, { ...state, step: 'done' });
    return goodbye("Thank you for calling. Have a great day!");

  } catch (error) {
    console.error('[aiScheduleAgent] Fatal error:', error?.message);
    return goodbye("I'm sorry, there was an error. Goodbye.");
  }
}