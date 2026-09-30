import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    if (action === 'createEvent') {
      const { title, startISO, endISO, description } = body;
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          summary: title,
          start: { dateTime: startISO },
          end: { dateTime: endISO },
          description: description || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Failed to create event' }, { status: 500 });
      return Response.json({ eventId: data.id, htmlLink: data.htmlLink, status: 'success' });
    }

    if (action === 'syncEvents') {
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=100&orderBy=startTime`;
      const res = await fetch(url, { headers: authHeader });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Failed to sync events' }, { status: 500 });
      return Response.json({ events: data.items || [], status: 'success' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}