/**
 * CalendarHistoryRow.jsx — One line of the client history timeline.
 */
import { Phone, Mail, MailOpen, MousePointerClick, CalendarCheck, RefreshCw, Sparkles, StickyNote } from 'lucide-react';

const KINDS = {
  call: { label: 'Call', Icon: Phone },
  email: { label: 'Email', Icon: Mail },
  email_open: { label: 'Opened', Icon: MailOpen },
  email_click: { label: 'Clicked', Icon: MousePointerClick },
  appointment: { label: 'Appointment', Icon: CalendarCheck },
  status: { label: 'Status', Icon: RefreshCw },
  ai: { label: 'AI synopsis', Icon: Sparkles },
  note: { label: 'Note', Icon: StickyNote },
};

const formatWhen = (at) => new Date(at).toLocaleString('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default function CalendarHistoryRow({ entry }) {
  const { label, Icon } = KINDS[entry.kind] || KINDS.note;
  return <li className="flex items-start gap-3 rounded-md border border-assistant-border bg-assistant-canvas p-3">
    <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-assistant-muted" />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-assistant-primary">{label}</span>
        <span className="text-xs text-assistant-muted">{formatWhen(entry.at)} ET</span>
        {entry.duration && <span className="text-xs font-semibold text-assistant-info">{entry.duration}</span>}
        {entry.by && <span className="text-xs text-assistant-muted">· {entry.by}</span>}
      </div>
      <p className="mt-1 break-words text-sm leading-relaxed text-assistant-ink">{entry.text}</p>
      {entry.detail && <p className="mt-0.5 break-words text-xs text-assistant-muted">{entry.detail}</p>}
      {entry.link && <a href={entry.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-assistant-info underline">Open in Google Calendar ↗</a>}
    </div>
  </li>;
}