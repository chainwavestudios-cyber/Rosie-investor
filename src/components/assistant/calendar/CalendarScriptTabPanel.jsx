import { fillScriptTokens } from '@/components/assistant/calendar/calendarScripts';

/** A script tab the super admin added from the contact card editor. */
export default function CalendarScriptTabPanel({ tab, lead }) {
  return <section className="calendar-panel">
    <div className="mb-5">
      <h3 className="calendar-title">{tab.label}</h3>
      <p className="text-sm text-assistant-muted">Script set by the super admin — updates appear here the moment they save.</p>
    </div>
    <div className="rounded-md border border-assistant-border bg-assistant-canvas p-5 sm:p-7">
      <p className="whitespace-pre-wrap break-words text-base leading-loose text-assistant-ink sm:text-lg">{fillScriptTokens(tab.script, lead)}</p>
    </div>
  </section>;
}