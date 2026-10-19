import { Phone, GitMerge, Mail } from 'lucide-react';
import { REMINDER_SCRIPT, TRANSFER_SCRIPT } from '@/components/assistant/calendar/calendarScripts';

export default function CalendarScriptPanel({ lead, reminder, call, onMerge, onEmails, outcome }) {
  return <section className="calendar-panel">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="calendar-title">{reminder ? '1-Hour Reminder Call Script' : 'Appointment Call & Transfer'}</h3><p className="text-sm text-assistant-muted">{reminder ? 'Call one hour before the appointment.' : 'Call at appointment time, then connect the client with Chris Bongiorno.'}</p></div>
      <button onClick={() => call.dial()} disabled={call.active || call.loading || !call.lineKey || !lead.phone} className="calendar-button"><Phone size={16} />{reminder ? 'Call for Reminder' : 'Call Client for Appointment'}</button>
    </div>
    <div className="rounded-md border border-assistant-border bg-assistant-canvas p-5 sm:p-7">
      {!reminder && <p className="mb-4 text-sm italic text-assistant-muted">(ring ring)</p>}
      <p className="whitespace-pre-wrap break-words text-base leading-loose text-assistant-ink sm:text-lg">{reminder ? REMINDER_SCRIPT(lead) : TRANSFER_SCRIPT}</p>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {reminder ? <button onClick={onEmails} className="calendar-secondary"><Mail size={16} />Resend Credentials & Welcome Email</button> : <button onClick={onMerge} disabled={call.status !== 'connected' || !call.callSid} className="calendar-button"><GitMerge size={17} />Open Merge & Transfer</button>}
      {!reminder && call.status !== 'connected' && <p className="text-sm text-assistant-muted">Connect with the client first. Then use the same transfer popup as the lead card.</p>}
    </div>
    {outcome && <p role="status" className="mt-4 text-sm text-assistant-primary">{outcome}</p>}
  </section>;
}