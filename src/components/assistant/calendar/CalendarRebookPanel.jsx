import { useState } from 'react';
import { CalendarClock, Phone } from 'lucide-react';
import CalendarBookingForm from '@/components/assistant/calendar/CalendarBookingForm';
import { REBOOK_SCRIPT, appointmentLabel, fillScriptTokens } from '@/components/assistant/calendar/calendarScripts';
import useSuperAdminConfig, { contactCardValues } from '@/hooks/useSuperAdminConfig';

export default function CalendarRebookPanel({ lead, call, onSave }) {
  const [rebooking, setRebooking] = useState(false), [message, setMessage] = useState('');
  // The super admin masters this script; a saved edit reaches this card live.
  const { config } = useSuperAdminConfig();
  const master = contactCardValues(config);
  const script = fillScriptTokens(master.rebookScript || REBOOK_SCRIPT(lead), lead);
  return <section className="calendar-panel">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="calendar-title">Rebook Appointment</h3><p className="text-sm text-assistant-muted">Use this whenever the client needs a different time. Read the script, then move the appointment.</p></div>
      <button onClick={() => call.dial()} disabled={call.active || call.loading || !call.lineKey || !lead.phone} className="calendar-button"><Phone size={16} />Call Client</button>
    </div>
    <div className="rounded-md border border-assistant-border bg-assistant-canvas p-5 sm:p-7">
      <p className="mb-4 text-sm italic text-assistant-muted">(ring ring)</p>
      <p className="whitespace-pre-wrap break-words text-base leading-loose text-assistant-ink sm:text-lg">{script}</p>
    </div>
    <div className="mt-5 rounded-md border border-assistant-primary/30 bg-assistant-primary/5 p-4">
      <p className="calendar-label">Appointment on the calendar now</p>
      <p className="text-lg font-semibold text-assistant-ink">{appointmentLabel(lead.appointmentDate)}</p>
      <p className="mt-1 text-sm text-assistant-muted">Client's timezone time, Eastern display time</p>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button onClick={() => setRebooking(true)} className="calendar-button"><CalendarClock size={16} />Rebook Appointment</button>
      {lead.appointmentEventHtmlLink && <a href={lead.appointmentEventHtmlLink} target="_blank" rel="noreferrer" className="calendar-secondary">Open Google Calendar</a>}
    </div>
    <p className="mt-4 text-sm leading-relaxed text-assistant-muted">Saving a new date and time updates the existing calendar invite — it never creates a duplicate, and the client keeps the same appointment.</p>
    {message && <p role="status" className="mt-4 text-sm text-assistant-primary">{message}</p>}
    {rebooking && <CalendarBookingForm lead={lead} onSave={(updated, notice) => { onSave(updated); setMessage(notice); setRebooking(false); }} onCancel={() => setRebooking(false)} />}
  </section>;
}