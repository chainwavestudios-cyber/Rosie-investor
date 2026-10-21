import { Phone, GitMerge } from 'lucide-react';
import { fillScriptTokens } from '@/components/assistant/calendar/calendarScripts';

/** A script tab the super admin added from the contact card editor. */
export default function CalendarScriptTabPanel({ tab, lead, call, onMerge }) {
  const notConnected = !call || call.status !== 'connected' || !call.callSid;
  return <section className="calendar-panel">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="calendar-title">{tab.label}</h3>
        <p className="text-sm text-assistant-muted">Script set by the super admin — updates appear here the moment they save.</p>
      </div>
      {tab.callClient && <button onClick={() => call?.dial()} disabled={!call || call.active || call.loading || !call.lineKey || !lead?.phone} className="calendar-button"><Phone size={16} />Call Client</button>}
    </div>
    {String(tab.script || '').trim() ? (
      <div className="rounded-md border border-assistant-border bg-assistant-canvas p-5 sm:p-7">
        <p className="whitespace-pre-wrap break-words text-base leading-loose text-assistant-ink sm:text-lg">{fillScriptTokens(tab.script, lead)}</p>
      </div>
    ) : null}
    {tab.merge && <div className="mt-5 flex flex-wrap items-center gap-3">
      <button onClick={onMerge} disabled={notConnected} className="calendar-button"><GitMerge size={17} />Merge &amp; Transfer</button>
      {notConnected && <p className="text-sm text-assistant-muted">Connect with the client first. Then use the same transfer popup as the lead card.</p>}
    </div>}
  </section>;
}