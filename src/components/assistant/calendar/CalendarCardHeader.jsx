import { CalendarDays, Maximize2, Minimize2, UserRound, X } from 'lucide-react';

export default function CalendarCardHeader({ lead, expanded, onExpand, onProfile, onClose }) {
  return <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-assistant-border px-5 py-4 sm:px-7">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-assistant-primary/15 text-lg font-bold text-assistant-primary">{lead.firstName?.[0]}{lead.lastName?.[0]}</div>
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-assistant-primary"><CalendarDays size={14} />Calendar Contact Card</div>
        <h2 id="calendar-card-name" className="break-words text-xl font-semibold text-assistant-ink sm:text-2xl">{lead.firstName} {lead.lastName}</h2>
        <p className="mt-1 text-xs text-assistant-muted">Assistant workspace · {lead.leadNumber || lead.status || 'Client'}</p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={onProfile} className="calendar-secondary"><UserRound size={16} />Lead Contact Card</button>
      <button onClick={onExpand} aria-label={expanded ? 'Restore card size' : 'Expand card'} className="calendar-secondary hidden sm:flex">{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      <button onClick={onClose} aria-label="Close calendar contact card" className="calendar-secondary"><X size={18} /></button>
    </div>
  </header>;
}