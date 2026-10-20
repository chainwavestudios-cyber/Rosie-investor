import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { CHRIS_OFFICE, CHRIS_CELL } from '@/components/assistant/ChrisFastDial';
import useSuperAdminConfig, { contactCardValues } from '@/hooks/useSuperAdminConfig';

export default function CalendarCallBar({ lead, call }) {
  // Fast-dial numbers are mastered by the super admin and update live.
  const { config } = useSuperAdminConfig();
  const master = contactCardValues(config);
  const office = master.chrisOfficePhone || CHRIS_OFFICE;
  const cell = master.chrisCellPhone || CHRIS_CELL;
  const time = `${Math.floor(call.seconds / 60).toString().padStart(2, '0')}:${(call.seconds % 60).toString().padStart(2, '0')}`;
  return <section aria-label="Twilio dialer" className="shrink-0 border-b border-assistant-border bg-assistant-elevated px-5 py-3 sm:px-7">
    <div className="flex flex-wrap items-center gap-3 sm:gap-5">
      <div className="min-w-0 flex-1">
        <div className="calendar-label">Client phone</div>
        <div className="break-words text-xl font-semibold tracking-wide text-assistant-info">{lead.phone || 'No phone on file'}</div>
        <div className="mt-1 break-all text-xs text-assistant-muted">{lead.email || 'No email on file'}</div>
      </div>
      <label className="w-full sm:w-56"><span className="calendar-label">Twilio outbound line</span>
        <select aria-label="Twilio outbound line" value={call.lineKey} onChange={e => call.setLineKey(e.target.value)} disabled={call.active || call.loading} className="calendar-field">
          {!call.lines.length && <option value="">{call.loading ? 'Loading lines…' : 'No lines available'}</option>}
          {call.lines.map(l => <option key={l.key} value={l.key}>{l.number} · {l.label || 'Unassigned'}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {call.active && <span role="status" className="text-sm font-semibold text-assistant-primary">{call.status} · {time}</span>}
        {!call.active ? <>
          <button onClick={() => call.dial()} disabled={!lead.phone || call.loading || !call.lineKey} className="calendar-button"><Phone size={16} />Call Client</button>
          <button onClick={() => call.dialNumber(office)} disabled={call.loading || !call.lineKey} className="calendar-secondary"><Phone size={15} />Chris · Office</button>
          <button onClick={() => call.dialNumber(cell)} disabled={call.loading || !call.lineKey} className="calendar-secondary"><Phone size={15} />Chris · Cell</button>
        </> : <>
          {call.status === 'connected' && <button onClick={call.toggleMute} className="calendar-secondary">{call.muted ? <MicOff size={16} /> : <Mic size={16} />}{call.muted ? 'Unmute' : 'Mute'}</button>}
          <button onClick={call.hangup} className="calendar-secondary text-assistant-danger"><PhoneOff size={16} />Hang Up</button>
        </>}
      </div>
    </div>
    {call.error && <p role="alert" className="calendar-error mt-2">{call.error}</p>}
  </section>;
}