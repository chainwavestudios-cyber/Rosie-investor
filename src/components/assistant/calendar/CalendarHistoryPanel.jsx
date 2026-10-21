/**
 * CalendarHistoryPanel.jsx — Full history for the client on the calendar contact card:
 * calls with length, emails sent and opened, appointments booked, notes and status changes.
 */
import useCalendarHistory from '@/components/assistant/calendar/useCalendarHistory';
import CalendarHistoryRow from '@/components/assistant/calendar/CalendarHistoryRow';

const Stat = ({ label, value }) => <div className="rounded-md border border-assistant-border bg-assistant-canvas p-3">
  <dt className="calendar-label mb-0">{label}</dt>
  <dd className="text-lg font-semibold text-assistant-ink">{value}</dd>
</div>;

export default function CalendarHistoryPanel({ lead }) {
  const { entries, stats, isLoading, error } = useCalendarHistory(lead);
  const appointment = lead?.appointmentDate
    ? new Date(lead.appointmentDate).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })
    : '';
  return <section className="calendar-panel">
    <h3 className="calendar-title">Client history</h3>
    <p className="mb-5 text-sm leading-relaxed text-assistant-muted">Every call, email, appointment and note logged against this client, newest first.</p>
    <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Calls" value={stats.calls} />
      <Stat label="Talk time" value={`${stats.talkMin} min`} />
      <Stat label="Emails sent" value={stats.emails} />
      <Stat label="Opens & clicks" value={stats.engagement} />
    </dl>
    <div className="mb-5 rounded-md border border-assistant-border bg-assistant-canvas p-3">
      <span className="calendar-label mb-0">Appointment on file</span>
      <p className="text-sm text-assistant-ink">{appointment ? `${appointment} ET · ${lead.appointmentTitle || 'Appointment'}` : 'None booked'}</p>
      {appointment && <p className="mt-0.5 text-xs text-assistant-muted">{lead.appointmentConfirmed ? 'Confirmed by the client' : 'Not confirmed yet'}</p>}
    </div>
    {isLoading && <p className="text-assistant-muted">Loading history…</p>}
    {error && <p role="alert" className="calendar-error">Could not load history: {error.message}</p>}
    {!isLoading && !error && (entries.length === 0
      ? <p className="text-sm text-assistant-muted">Nothing logged for this client yet. Calls, emails and appointments will appear here as they happen.</p>
      : <ol className="space-y-2">{entries.map(entry => <CalendarHistoryRow key={entry.id} entry={entry} />)}</ol>)}
  </section>;
}