export default async function saveCalendarAppointment(base44, body, authHeader, actor) {
  const { leadId, startISO, title, duration = 30 } = body;
  if (!leadId || !startISO || !title?.trim()) return Response.json({ error: 'Client, title, and appointment time are required.' }, { status: 400 });
  const start = new Date(startISO), minutes = Number(duration);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now() || !Number.isInteger(minutes) || minutes < 5 || minutes > 180) return Response.json({ error: 'Choose a future appointment and a duration between 5 and 180 minutes.' }, { status: 400 });
  const lead = await base44.asServiceRole.entities.DebtLead.get(leadId);
  if (!lead) return Response.json({ error: 'Client not found.' }, { status: 404 });
  const end = new Date(start.getTime() + minutes * 60000);
  const root = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const request = (url, init = {}) => fetch(url, { ...init, headers: authHeader, signal: AbortSignal.timeout(10000) });
  let pageToken = '';
  do {
    const query = new URLSearchParams({ timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: 'true', maxResults: '100', ...(pageToken ? { pageToken } : {}) });
    const response = await request(`${root}?${query}`), result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Could not check availability.');
    if ((result.items || []).some(e => e.id !== lead.appointmentEventId && e.status !== 'cancelled' && e.transparency !== 'transparent' && start < new Date(e.end?.dateTime || e.end?.date) && end > new Date(e.start?.dateTime || e.start?.date))) return Response.json({ error: 'That time overlaps another calendar event. Choose a different time.' }, { status: 409 });
    pageToken = result.nextPageToken || '';
  } while (pageToken);
  let previous = null;
  if (lead.appointmentEventId) {
    const response = await request(`${root}/${encodeURIComponent(lead.appointmentEventId)}`);
    if (response.ok) previous = await response.json();
    else if (response.status !== 404 && response.status !== 410) throw new Error('Could not load the existing calendar appointment.');
  }
  const url = previous ? `${root}/${encodeURIComponent(previous.id)}?sendUpdates=none` : `${root}?sendUpdates=none`;
  const event = { summary: title.trim(), start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, ...(!previous ? { description: `Lead: ${lead.firstName} ${lead.lastName}\nPhone: ${lead.phone || ''}\nEmail: ${lead.email || ''}` } : {}) };
  const response = await request(url, { method: previous ? 'PATCH' : 'POST', body: JSON.stringify(event) }), saved = await response.json();
  if (!response.ok || !saved.id) throw new Error(saved.error?.message || 'Could not save the calendar event.');
  let updated;
  try {
    updated = await base44.asServiceRole.entities.DebtLead.update(lead.id, { appointmentDate: start.toISOString(), appointmentTitle: title.trim(), appointmentEventId: saved.id, appointmentEventHtmlLink: saved.htmlLink || null, appointmentConfirmed: false, appointmentConfirmedAt: null, appointmentChangeRequested: false, appointmentChangeRequestedAt: null, nightBeforeReminderSentAt: null, hourBeforeReminderSentAt: null, apptEmailOpenedAt: null, apptHourReminderOpenedAt: null, rescheduleToken: null, rescheduleSlotsJson: '[]', rescheduleSentAt: null, rescheduleBookedAt: null });
  } catch (error) {
    const rollback = await request(previous ? `${root}/${encodeURIComponent(previous.id)}?sendUpdates=none` : `${root}/${encodeURIComponent(saved.id)}?sendUpdates=none`, { method: previous ? 'PATCH' : 'DELETE', ...(previous ? { body: JSON.stringify({ summary: previous.summary, start: previous.start, end: previous.end }) } : {}) });
    if (!rollback.ok) throw new Error('Client save failed and the calendar change could not be rolled back. Please review the calendar before retrying.');
    throw error;
  }
  await base44.asServiceRole.entities.DebtLeadActivity.create({ leadId: lead.id, leadName: `${lead.firstName} ${lead.lastName}`, activityType: 'calendar_event', activityText: `${previous ? 'Rebooked' : 'Scheduled'} appointment: ${start.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET`, createdBy: actor, metadataJson: JSON.stringify({ scope: 'assistant_calendar', eventId: saved.id, htmlLink: saved.htmlLink, startISO: start.toISOString() }) });
  return Response.json({ status: 'success', lead: updated });
}