import { useState } from 'react';
import { Phone, GitMerge, CalendarPlus, StickyNote } from 'lucide-react';
import { fillScriptTokens } from '@/components/assistant/calendar/calendarScripts';
import CalendarBookingForm from '@/components/assistant/calendar/CalendarBookingForm';
import CalendarFollowUpNotes from '@/components/assistant/calendar/CalendarFollowUpNotes';
import CalendarCredentialsButton from '@/components/assistant/calendar/CalendarCredentialsButton';

/**
 * A script tab the super admin added from the contact card editor. Any of the
 * five actions (book, credentials, follow-up note, call client, merge & transfer)
 * can sit on any tab, even when that action already lives on a built-in tab.
 */
export default function CalendarScriptTabPanel({ tab, lead, call, onMerge, onSave, username }) {
  const [booking, setBooking] = useState(false), [notes, setNotes] = useState(false), [notice, setNotice] = useState('');
  const notConnected = !call || call.status !== 'connected' || !call.callSid;
  const actions = tab.callClient || tab.bookAppointment || tab.credentials || tab.followUpNote || tab.merge;

  return <section className="calendar-panel">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="calendar-title">{tab.label}</h3>
        <p className="text-sm text-assistant-muted">Script set by the super admin — updates appear here the moment they save.</p>
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-3">
        {tab.callClient && <button onClick={() => call?.dial()} disabled={!call || call.active || call.loading || !call.lineKey || !lead?.phone} className="calendar-button"><Phone size={16} />Call Client</button>}
        {tab.bookAppointment && <button onClick={() => setBooking((open) => !open)} className="calendar-button"><CalendarPlus size={16} />{lead?.appointmentDate ? 'Rebook Appointment' : 'Book Appointment'}</button>}
        {tab.credentials && <CalendarCredentialsButton lead={lead} />}
        {tab.followUpNote && <button onClick={() => setNotes((open) => !open)} className="calendar-secondary"><StickyNote size={16} />Add Follow-up Note</button>}
        {tab.merge && <button onClick={onMerge} disabled={notConnected} className="calendar-button"><GitMerge size={17} />Merge &amp; Transfer</button>}
      </div>}
    </div>
    {tab.merge && notConnected && <p className="mb-5 text-sm text-assistant-muted">Connect with the client first. Then use the same transfer popup as the lead card.</p>}
    {booking && <CalendarBookingForm lead={lead} onSave={(updated, note) => { setBooking(false); setNotice(note || 'Appointment saved.'); onSave?.(updated, note); }} onCancel={() => setBooking(false)} />}
    {notice && <p role="status" className="mt-4 text-sm text-assistant-primary">{notice}</p>}
    {String(tab.script || '').trim() ? (
      <div className="mt-5 rounded-md border border-assistant-border bg-assistant-canvas p-5 sm:p-7">
        <p className="whitespace-pre-wrap break-words text-base leading-loose text-assistant-ink sm:text-lg">{fillScriptTokens(tab.script, lead)}</p>
      </div>
    ) : null}
    {notes && <div className="mt-6 border-t border-assistant-border pt-5"><CalendarFollowUpNotes lead={lead} username={username} /></div>}
  </section>;
}