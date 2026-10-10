import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ET_TZ = 'America/New_York';

// Compute the two training session times in America/New_York.
// Training A: tonight at 8:30 PM ET. Training B: tomorrow at 1:00 PM ET.
function getTrainingTimes() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;

  // Tomorrow in ET
  const tomorrow = new Date(`${y}-${m}-${d}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ty = tomorrow.getFullYear();
  const tm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const td = String(tomorrow.getDate()).padStart(2, '0');

  return {
    A: {
      name: 'Debt Solutions Training A',
      start: `${y}-${m}-${d}T20:30:00`,
      end: `${y}-${m}-${d}T21:30:00`,
      label: 'Tonight at 8:30 PM EST',
    },
    B: {
      name: 'Debt Solutions Training B',
      start: `${ty}-${tm}-${td}T13:00:00`,
      end: `${ty}-${tm}-${td}T14:00:00`,
      label: 'Tomorrow at 1:00 PM EST',
    },
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { sessionType, attendees, addedBy } = body;

    if (!sessionType || !attendees || !Array.isArray(attendees) || attendees.length === 0) {
      return Response.json({ error: 'Missing sessionType or attendees' }, { status: 400 });
    }

    const times = getTrainingTimes();
    const session = times[sessionType];
    if (!session) return Response.json({ error: 'Invalid session type (use A or B)' }, { status: 400 });

    // Get calendar auth token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    // Search for an existing event with this name (from today forward)
    const timeMin = new Date();
    timeMin.setHours(0, 0, 0, 0);
    const listUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodeURIComponent(session.name)}&singleEvents=true&maxResults=50&timeMin=${encodeURIComponent(timeMin.toISOString())}`;
    const listRes = await fetch(listUrl, { headers: authHeader });
    const listData = await listRes.json();
    const existingEvent = (listData.items || []).find(ev => ev.summary === session.name);

    const calendarAttendees = attendees.map(a => ({ email: a.email, displayName: a.name }));

    let eventId: string | undefined;
    let eventLink: string | undefined;

    if (existingEvent) {
      // Merge new attendees with existing ones (avoid duplicates by email)
      const existingAttendees = (existingEvent.attendees || []).map((a: any) => ({
        email: a.email,
        displayName: a.displayName || '',
      }));
      const merged = [...existingAttendees];
      for (const newAtt of calendarAttendees) {
        if (!merged.some(a => a.email.toLowerCase() === newAtt.email.toLowerCase())) {
          merged.push(newAtt);
        }
      }

      const updateRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEvent.id}?sendUpdates=all`,
        {
          method: 'PUT',
          headers: authHeader,
          body: JSON.stringify({
            ...existingEvent,
            attendees: merged,
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 60 },
                { method: 'popup', minutes: 15 },
              ],
            },
          }),
        }
      );
      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        return Response.json({ error: updateData.error?.message || 'Failed to update calendar event' }, { status: 500 });
      }
      eventId = existingEvent.id;
      eventLink = updateData.htmlLink;
    } else {
      // Create a new event
      const createRes = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
        {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            summary: session.name,
            description: 'Debt Solutions Training Session. A Zoom link will be provided before the training.',
            start: { dateTime: session.start, timeZone: ET_TZ },
            end: { dateTime: session.end, timeZone: ET_TZ },
            attendees: calendarAttendees,
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 60 },
                { method: 'popup', minutes: 15 },
              ],
            },
          }),
        }
      );
      const createData = await createRes.json();
      if (!createRes.ok) {
        return Response.json({ error: createData.error?.message || 'Failed to create calendar event' }, { status: 500 });
      }
      eventId = createData.id;
      eventLink = createData.htmlLink;
    }

    // Send email reminders to each new attendee
    for (const attendee of attendees) {
      try {
        await base44.integrations.Core.SendEmail({
          to: attendee.email,
          subject: `Training Reminder: ${session.name} — ${session.label}`,
          html: `<div style="font-family:Georgia,serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
<h2 style="color:#10b981;">Training Reminder: ${session.name}</h2>
<p>Hi ${attendee.name},</p>
<p>You have been added to a training session:</p>
<p><strong>Session:</strong> ${session.name}<br/>
<strong>Time:</strong> ${session.label}</p>
<p>A calendar invitation has been sent to your email with the event details. A Zoom link will be provided before the training.</p>
<p>Please make sure to attend. If you have any questions, contact your manager.</p>
<p style="color:#6b7280;font-size:12px;">Rosie AI Team</p>
</div>`,
        });
      } catch (e) {
        console.warn('Email failed for', attendee.email, e?.message);
      }
    }

    // Create TrainingAttendee records
    const records = attendees.map(a => ({
      sessionType,
      fronterUsername: a.username || '',
      fronterName: a.name,
      fronterEmail: a.email,
      addedBy: addedBy || '',
      addedAt: new Date().toISOString(),
    }));
    try {
      await base44.asServiceRole.entities.TrainingAttendee.bulkCreate(records);
    } catch (e) {
      console.warn('Failed to create TrainingAttendee records:', e?.message);
    }

    return Response.json({
      success: true,
      eventId,
      eventLink,
      sessionName: session.name,
      sessionTime: session.label,
      attendeeCount: attendees.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}