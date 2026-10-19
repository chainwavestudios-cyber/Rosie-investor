import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

export default function CalendarBookingForm({ lead, onSave, onCancel }) {
  const { user, sessionToken } = useDebtCoachAuth();
  const dt = lead.appointmentDate ? new Date(lead.appointmentDate) : null;
  const initial = dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '';
  const [when, setWhen] = useState(initial), [title, setTitle] = useState(lead.appointmentTitle || `Appointment with Chris Bongiorno — ${lead.firstName} ${lead.lastName}`);
  const [duration, setDuration] = useState(30), [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await base44.functions.invoke('googleCalendarSync', { action: 'saveLeadAppointment', leadId: lead.id, startISO: new Date(when).toISOString(), title, duration, sessionUserId: user?.id, sessionToken });
      if (data?.status !== 'success') throw new Error(data?.error || 'Could not save the appointment.');
      let emailWarning = '';
      if (sendEmail) {
        try { const page = await base44.entities.DebtEmailTemplate.filter({ name: { $regex: '^\\s*credentials\\s*$', $options: 'i' } }, { limit: 1 }); const template = page.items[0]; if (!template) throw new Error('No credentials template found.'); const result = await base44.functions.invoke('sendDebtEmail', { leadId: lead.id, templateId: template.id }); if (result.data?.error) throw new Error(result.data.error); }
        catch (err) { emailWarning = `Appointment saved, but email was not sent: ${err.message}`; }
      }
      onSave(data.lead, emailWarning || 'Appointment saved.');
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="mt-5 space-y-4 border-t border-assistant-border pt-5">
    <h4 className="font-semibold text-assistant-ink">{lead.appointmentDate ? 'Rebook appointment' : 'Book appointment'}</h4>
    <p className="text-sm text-assistant-muted">Updates the linked Google Calendar event, rather than creating a duplicate.</p>
    <label className="block"><span className="calendar-label">Appointment title</span><input required value={title} onChange={e => setTitle(e.target.value)} className="calendar-field" /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className="calendar-label">Date & time ({Intl.DateTimeFormat().resolvedOptions().timeZone})</span><input type="datetime-local" required value={when} onChange={e => setWhen(e.target.value)} className="calendar-field" /></label>
      <label><span className="calendar-label">Duration in minutes</span><input type="number" min={5} max={180} required value={duration} onChange={e => setDuration(Number(e.target.value))} className="calendar-field" /></label>
    </div>
    <label className="flex items-center gap-3 text-sm text-assistant-ink"><input type="checkbox" checked={sendEmail} disabled={!lead.email} onChange={e => setSendEmail(e.target.checked)} />Send credentials & welcome email after saving</label>
    {error && <p role="alert" className="calendar-error">{error}</p>}
    <div className="flex flex-wrap gap-2"><button disabled={busy || !when || !title.trim()} className="calendar-button">{busy ? 'Saving…' : 'Save Appointment'}</button><button type="button" onClick={onCancel} disabled={busy} className="calendar-secondary">Cancel Rebooking</button></div>
  </form>;
}