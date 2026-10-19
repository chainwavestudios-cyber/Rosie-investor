import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import CalendarBookingForm from '@/components/assistant/calendar/CalendarBookingForm';
import { appointmentLabel } from '@/components/assistant/calendar/calendarScripts';

export default function CalendarAppointmentPanel({ lead, onSave, onTab }) {
  const [booking, setBooking] = useState(false), [message, setMessage] = useState('');
  const confirm = useMutation({ mutationFn: () => base44.entities.DebtLead.update(lead.id, { appointmentConfirmed: true, appointmentConfirmedAt: new Date().toISOString(), appointmentChangeRequested: false }), onSuccess: updated => { onSave(updated); setMessage('Appointment confirmed.'); } });
  return <section className="calendar-panel">
    <h3 className="calendar-title">Appointment & follow-up</h3>
    <div className="mb-5 rounded-md border border-assistant-primary/30 bg-assistant-primary/5 p-4">
      <p className="calendar-label">Appointment with Chris Bongiorno</p>
      <p className="text-lg font-semibold text-assistant-ink">{appointmentLabel(lead.appointmentDate)}</p>
      <p className="mt-2 text-sm text-assistant-muted">{lead.appointmentTitle || 'No appointment title'} · <span className={lead.appointmentConfirmed ? 'text-assistant-primary' : 'text-assistant-warning'}>{lead.appointmentConfirmed ? 'Confirmed' : 'Not confirmed'}</span></p>
      {lead.appointmentChangeRequested && <p className="mt-2 text-sm text-assistant-warning">Client requested a time change.</p>}
      {lead.callbackAt && <p className="mt-2 text-sm text-assistant-info">Callback: {appointmentLabel(lead.callbackAt)}</p>}
      {lead.isHotLead && <p className="mt-2 text-sm text-assistant-warning">Hot lead · priority follow-up</p>}
    </div>
    <div className="flex flex-wrap gap-3">
      <button onClick={() => setBooking(true)} className="calendar-button">{lead.appointmentDate ? 'Rebook Appointment' : 'Book Appointment'}</button>
      {lead.appointmentDate && !lead.appointmentConfirmed && <button onClick={() => confirm.mutate()} disabled={confirm.isPending} className="calendar-secondary">{confirm.isPending ? 'Confirming…' : 'Confirm Appointment'}</button>}
      <button onClick={() => onTab('emails')} className="calendar-secondary">Credentials & Welcome Email</button>
      <button onClick={() => onTab('notes')} className="calendar-secondary">Add Follow-up Note</button>
      {lead.appointmentEventHtmlLink && <a href={lead.appointmentEventHtmlLink} target="_blank" rel="noreferrer" className="calendar-secondary">Open Google Calendar</a>}
    </div>
    {message && <p role="status" className="mt-4 text-sm text-assistant-primary">{message}</p>}
    {confirm.isError && <p role="alert" className="calendar-error mt-4">{confirm.error.message}</p>}
    {booking && <CalendarBookingForm lead={lead} onSave={(updated, notice) => { onSave(updated); setMessage(notice); setBooking(false); }} onCancel={() => setBooking(false)} />}
    <div className="mt-6 border-t border-assistant-border pt-5 text-sm leading-relaxed text-assistant-muted"><p><strong className="text-assistant-info">1 hour before:</strong> Call the client using the reminder script, verify they reviewed the email and welcome message, and resend if needed.</p><p className="mt-3"><strong className="text-assistant-primary">At appointment time:</strong> Read the connection script, then use Call & Transfer to reach Chris while the client hears the welcome / hold audio.</p></div>
  </section>;
}