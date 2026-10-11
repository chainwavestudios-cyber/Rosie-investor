/**
 * appointmentVoiceHandler — Twilio <Gather> callback handler for the hold queue.
 *
 * When a customer is on hold (via merge), they hear the hold audio on their own
 * call leg (per-caller restart) while a <Gather> listens for speech. If the
 * customer says "appointment", a Flex voice (Deepgram Aura2) guides them through
 * booking an appointment on Google Calendar. Email reminders (day before + 30
 * min before) are scheduled via the existing FronterMeeting reminder workflow.
 *
 * Steps:
 *   hold    — Play hold audio in a loop inside <Gather> (listening for "appointment")
 *   detect  — Check if "appointment" was said; if yes, switch to booking flow
 *   collect — Parse date/time from speech, book on Google Calendar, confirm
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { ET_TZ, getCalendarAuth, listEvents, hasConflict, formatInTz } from '../../shared/googleCalendarHelpers.ts';

const DG_API_KEY = Deno.env.get('DEEPGRAM_API_KEY') || '';
const FLEX_VOICE = 'flux-hannah-en';
const BASE_URL = 'https://rosieai-investorpage.base44.app';

// ── Fetch the active hold audio URL (fresh signed URL each call) ──
async function getHoldAudioUrl(req: Request): Promise<string> {
  try {
    const base44 = createClientFromRequest(req).asServiceRole;
    const activeAudio = await base44.entities.FronterHoldAudio.filter({ isActive: true }, '-uploadedAt', 1);
    if (activeAudio?.[0]?.fileUri) {
      const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: activeAudio[0].fileUri, expires_in: 3600 });
      return signed?.signed_url || '';
    }
  } catch {}
  return '';
}

// ── Generate Flex voice TTS via Deepgram and return a public URL ──
async function generateFlexTTS(text: string, base44: any): Promise<string> {
  if (!DG_API_KEY) return '';

  try {
    // Try Deepgram /v1/speak with voice in body
    let res = await fetch('https://api.deepgram.com/v1/speak', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice: FLEX_VOICE, encoding: 'mp3' }),
    });

    // Fallback: try with model query param
    if (!res.ok) {
      res = await fetch(`https://api.deepgram.com/v1/speak?model=${FLEX_VOICE}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DG_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
    }

    // Fallback: try aura-2 voice format
    if (!res.ok) {
      const auraVoice = FLEX_VOICE.replace('flux-', 'aura-2-');
      res = await fetch('https://api.deepgram.com/v1/speak', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DG_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice: auraVoice, encoding: 'mp3' }),
      });
    }

    if (!res.ok) return '';

    const audioBuffer = await res.arrayBuffer();
    const file = new File([audioBuffer], `tts-${Date.now()}.mp3`, { type: 'audio/mpeg' });
    const upRes = await base44.integrations.Core.UploadPublicFile({ file });
    return upRes?.file_url || '';
  } catch {
    return '';
  }
}

// ── Build hold + <Gather> TwiML (per-caller audio restart) ──
function holdGatherTwiML(holdAudioUrl: string, actionUrl: string): string {
  if (holdAudioUrl) {
    return `<Response><Gather input="speech" action="${actionUrl}" timeout="300" speechTimeout="auto" hints="appointment" language="en-US"><Play loop="0">${holdAudioUrl}</Play></Gather><Redirect>${actionUrl}&timeout=1</Redirect></Response>`;
  }
  // No hold audio — periodic voice prompt + listen
  return `<Response><Gather input="speech" action="${actionUrl}" timeout="60" speechTimeout="auto" hints="appointment" language="en-US"><Say voice="Polly.Joanna-Neural">Please wait. Say appointment to schedule an appointment.</Say></Gather><Redirect>${actionUrl}&timeout=1</Redirect></Response>`;
}

// ── Build TTS TwiML (Flex voice via <Play>, fallback to <Say>) ──
function ttsTwiML(ttsUrl: string, fallbackText: string): string {
  if (ttsUrl) return `<Play>${ttsUrl}</Play>`;
  return `<Say voice="Polly.Joanna-Neural">${fallbackText}</Say>`;
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const step = url.searchParams.get('step') || 'hold';
    const leadId = url.searchParams.get('leadId') || '';
    const isTimeout = url.searchParams.get('timeout') === '1';

    // Parse form-encoded body (Twilio <Gather> callback)
    const contentType = req.headers.get('content-type') || '';
    let speechResult = '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      speechResult = (form.get('SpeechResult') as string) || '';
    }

    const actionBase = `${BASE_URL}/functions/appointmentVoiceHandler`;

    // ── STEP: hold — play hold audio + listen for "appointment" ──
    if (step === 'hold') {
      const holdAudioUrl = await getHoldAudioUrl(req);
      const gatherUrl = `${actionBase}?step=detect&leadId=${encodeURIComponent(leadId)}`;
      return new Response(holdGatherTwiML(holdAudioUrl, gatherUrl), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // ── STEP: detect — check if "appointment" was said ──
    if (step === 'detect') {
      const holdAudioUrl = await getHoldAudioUrl(req);
      const gatherUrl = `${actionBase}?step=detect&leadId=${encodeURIComponent(leadId)}`;

      // Timeout or no speech — loop back to hold
      if (isTimeout || !speechResult) {
        return new Response(holdGatherTwiML(holdAudioUrl, gatherUrl), {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      const lowerSpeech = speechResult.toLowerCase();

      // Check if "appointment" was said
      if (lowerSpeech.includes('appointment')) {
        // Switch to booking flow — ask for date/time with Flex voice
        const ttsText = "I'd be happy to schedule an appointment for you. What day and time works best for you?";
        const ttsUrl = await generateFlexTTS(ttsText, base44);
        const collectUrl = `${actionBase}?step=collect&leadId=${encodeURIComponent(leadId)}`;

        return new Response(
          `<Response>${ttsTwiML(ttsUrl, ttsText)}<Gather input="speech" action="${collectUrl}" timeout="30" speechTimeout="auto" language="en-US"><Say voice="Polly.Joanna-Neural">Please say your preferred day and time after the prompt.</Say></Gather><Redirect>${collectUrl}&timeout=1</Redirect></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      // Not "appointment" — back to hold
      return new Response(holdGatherTwiML(holdAudioUrl, gatherUrl), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // ── STEP: collect — parse date/time, book on Google Calendar ──
    if (step === 'collect') {
      const holdAudioUrl = await getHoldAudioUrl(req);
      const gatherUrl = `${actionBase}?step=detect&leadId=${encodeURIComponent(leadId)}`;
      const collectUrl = `${actionBase}?step=collect&leadId=${encodeURIComponent(leadId)}`;

      // Timeout or no speech — ask again
      if (isTimeout || !speechResult) {
        const ttsText = "I didn't catch that. What day and time works best for you?";
        const ttsUrl = await generateFlexTTS(ttsText, base44);
        return new Response(
          `<Response>${ttsTwiML(ttsUrl, ttsText)}<Gather input="speech" action="${collectUrl}" timeout="30" speechTimeout="auto" language="en-US"><Say voice="Polly.Joanna-Neural">Please say your preferred day and time.</Say></Gather><Redirect>${collectUrl}&timeout=1</Redirect></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      // Parse date/time using LLM
      const nowET = new Date().toLocaleString('en-US', { timeZone: ET_TZ });
      const parseResult: any = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a scheduling assistant. The current datetime is: ${nowET} (America/New_York timezone).

The customer said: "${speechResult}"

Parse this into a specific date and time in America/New_York timezone.
- "morning" or "AM" -> 10:00 AM
- "afternoon" or "PM" -> 2:00 PM
- "evening" -> 5:00 PM
- "tomorrow" -> next calendar day
- Day of week -> next occurrence of that day
- If no time specified, default to 10:00 AM
- Only suggest future dates (not in the past)

Return JSON:
- success: boolean
- startISO: ISO datetime string in UTC
- timeLabel: human-readable time (e.g., "Thursday, October 15 at 2:00 PM ET")
- error: string (if parsing failed)`,
        response_json_schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            startISO: { type: 'string' },
            timeLabel: { type: 'string' },
            error: { type: 'string' },
          },
        },
      });

      if (!parseResult?.success || !parseResult?.startISO) {
        // Parsing failed — ask again
        const ttsText = "I'm sorry, I couldn't understand that. Could you please say something like Tuesday at 2 PM?";
        const ttsUrl = await generateFlexTTS(ttsText, base44);
        return new Response(
          `<Response>${ttsTwiML(ttsUrl, ttsText)}<Gather input="speech" action="${collectUrl}" timeout="30" speechTimeout="auto" language="en-US"><Say voice="Polly.Joanna-Neural">Please say your preferred day and time.</Say></Gather><Redirect>${collectUrl}&timeout=1</Redirect></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      // ── Book on Google Calendar ──
      let start = new Date(parseResult.startISO);
      let end = new Date(start.getTime() + 30 * 60 * 1000);

      // Check for conflicts — move 30 min forward if conflict
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

      // Get lead info
      let leadName = 'Customer';
      let leadEmail = '';
      let leadPhone = '';
      let leadAddress = '';
      try {
        const lead = await base44.asServiceRole.entities.FronterLead.get(leadId);
        if (lead) {
          leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Customer';
          leadEmail = lead.email || '';
          leadPhone = lead.phone || '';
          leadAddress = lead.address || '';
        }
      } catch {}

      // Create Google Calendar event
      let eventCreated = false;
      let eventId = '';
      try {
        const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            summary: `Appointment — ${leadName}`,
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
            description: `Booked via voice agent during hold queue.\nLead: ${leadName}\nPhone: ${leadPhone}\nEmail: ${leadEmail}`,
          }),
        });
        const createData = await createRes.json();
        if (createRes.ok) {
          eventCreated = true;
          eventId = createData.id;
        }
      } catch {}

      if (!eventCreated) {
        // Calendar booking failed — apologize and return to hold
        const ttsText = "I'm sorry, I couldn't book the appointment right now. Please stay on the line and an agent will be with you shortly.";
        const ttsUrl = await generateFlexTTS(ttsText, base44);
        return new Response(
          `<Response>${ttsTwiML(ttsUrl, ttsText)}<Redirect>${gatherUrl}</Redirect></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      // Create FronterMeeting record for reminders (day before + 30 min before)
      const resolvedTime = formatInTz(start.toISOString(), ET_TZ);
      try {
        await base44.asServiceRole.entities.FronterMeeting.create({
          leadId,
          leadName,
          leadPhone,
          leadEmail,
          leadAddress,
          fronterUsername: 'voice_agent',
          meetingStartISO: start.toISOString(),
          meetingEndISO: end.toISOString(),
          customerTimezone: ET_TZ,
          customerReminder: true,
          nightBeforeReminderSent: false,
          hourBeforeReminderSent: false,
          eventId,
          meetingNotes: `Booked via voice agent during hold queue. Customer said: "${speechResult}"`,
          status: 'scheduled',
        });
      } catch {}

      // Generate confirmation TTS with Flex voice
      const confirmText = wasRescheduled
        ? `Great! I've scheduled your appointment for ${resolvedTime}. That time was taken so I moved it to the next available slot. We'll send a reminder to your email. Please stay on the line and an agent will be with you shortly.`
        : `Great! I've scheduled your appointment for ${resolvedTime}. We'll send a reminder to your email. Please stay on the line and an agent will be with you shortly.`;
      const ttsUrl = await generateFlexTTS(confirmText, base44);

      // Return to hold after confirmation
      return new Response(
        `<Response>${ttsTwiML(ttsUrl, confirmText)}<Redirect>${gatherUrl}</Redirect></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    return new Response('<Response><Say>Invalid step.</Say></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    return new Response(`<Response><Say>An error occurred.</Say></Response>`, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});