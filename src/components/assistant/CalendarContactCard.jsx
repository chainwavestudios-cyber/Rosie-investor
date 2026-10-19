import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import CalendarCardHeader from '@/components/assistant/calendar/CalendarCardHeader';
import CalendarCallBar from '@/components/assistant/calendar/CalendarCallBar';
import CalendarCardWorkspace from '@/components/assistant/calendar/CalendarCardWorkspace';
import useCalendarCall from '@/components/assistant/calendar/useCalendarCall';

export default function CalendarContactCard({ lead, username, onClose, onSave }) {
  const [expanded, setExpanded] = useState(false), [profile, setProfile] = useState(false);
  const cache = useQueryClient(), key = ['assistant-calendar-lead', lead.id];
  const record = useQuery({ queryKey: key, queryFn: () => base44.entities.DebtLead.get(lead.id) });
  const client = record.data || lead;
  const call = useCalendarCall(client, username);
  const save = updated => { cache.setQueryData(key, updated); onSave?.(updated); };
  useEffect(() => base44.entities.DebtLead.subscribe(event => { if (event.id === lead.id && event.type === 'update') cache.invalidateQueries({ queryKey: ['assistant-calendar-lead', lead.id] }); }), [lead.id, cache]);
  useEffect(() => { const original = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = original; }; }, []);
  return <div className="fixed inset-0 z-[30000] flex items-center justify-center bg-assistant-canvas/90 p-0 font-assistant antialiased sm:p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="calendar-card-name" data-calendar-card className={expanded ? 'flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-assistant-canvas text-assistant-ink' : 'flex h-[100dvh] w-full min-w-0 max-w-[1120px] flex-col overflow-hidden border border-assistant-border bg-assistant-canvas text-assistant-ink shadow-2xl sm:h-[94dvh] sm:rounded-lg'}>
      <CalendarCardHeader lead={client} profileReady={!!record.data} expanded={expanded} onExpand={() => setExpanded(p => !p)} onProfile={() => setProfile(true)} onClose={onClose} />
      <CalendarCallBar lead={client} call={call} />
      {record.isPending ? <p role="status" className="p-6 text-assistant-muted">Loading full calendar contact…</p> : record.isError ? <div role="alert" className="p-6"><p className="calendar-error">Could not load this client: {record.error.message}</p><button onClick={() => record.refetch()} className="calendar-secondary mt-3">Retry</button></div> : <CalendarCardWorkspace lead={client} username={username} call={call} onSave={save} />}
    </section>
    {profile && <div className="fixed inset-0 z-[36000] bg-assistant-canvas/90">
      <button onClick={() => setProfile(false)} className="calendar-secondary absolute left-3 top-3">Return to Calendar Contact Card</button>
      <ClientProfileModal lead={client} username={username} onClose={() => setProfile(false)} onSave={save} />
    </div>}
  </div>;
}