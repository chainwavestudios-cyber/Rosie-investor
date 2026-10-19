import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function CalendarFollowUpNotes({ lead, username }) {
  const [text, setText] = useState('');
  const cache = useQueryClient(), key = ['calendar-followup-notes', lead.id];
  const notes = useInfiniteQuery({ queryKey: key, initialPageParam: undefined, queryFn: ({ pageParam }) => base44.entities.DebtLeadActivity.filter({ leadId: lead.id, activityType: 'note', metadataJson: { $regex: '"scope":"assistant_calendar"' } }, { sort: '-created_date', limit: 25, cursor: pageParam }), getNextPageParam: p => p.has_more ? p.next_cursor : undefined });
  const save = useMutation({ mutationFn: () => base44.entities.DebtLeadActivity.create({ leadId: lead.id, leadName: `${lead.firstName} ${lead.lastName}`, activityType: 'note', activityText: text.trim(), createdBy: username, metadataJson: JSON.stringify({ scope: 'assistant_calendar', appointmentDate: lead.appointmentDate || null }) }), onSuccess: () => { setText(''); cache.invalidateQueries({ queryKey: key }); } });
  return <section className="calendar-panel">
    <h3 className="calendar-title">Calendar follow-up notes</h3>
    <p className="mb-4 text-sm text-assistant-muted">Assistant notes for reminder calls, email follow-ups, rebooking, and appointment handoffs. Separate from the client’s main notes.</p>
    <form onSubmit={e => { e.preventDefault(); if (text.trim()) save.mutate(); }} className="mb-6 space-y-3">
      <label className="calendar-label" htmlFor="calendar-followup-note">New follow-up note</label>
      <textarea id="calendar-followup-note" value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Document the calendar follow-up…" className="calendar-field resize-y" />
      <button disabled={!text.trim() || save.isPending} className="calendar-button">{save.isPending ? 'Saving…' : 'Save Follow-up Note'}</button>
      {save.isError && <p role="alert" className="calendar-error">Could not save: {save.error.message}</p>}
    </form>
    {notes.isPending && <p className="text-assistant-muted">Loading notes…</p>}
    {notes.isError && <p role="alert" className="calendar-error">Could not load notes: {notes.error.message}</p>}
    {notes.data?.pages[0]?.items.length === 0 && <p className="text-sm text-assistant-muted">No calendar follow-up notes yet.</p>}
    <div className="space-y-3">{notes.data?.pages.flatMap(p => p.items).map(note => <article key={note.id} className="rounded-md border border-assistant-border bg-assistant-canvas p-4">
      <p className="mb-2 text-xs text-assistant-muted">{note.createdBy || 'Assistant'} · {new Date(note.created_date).toLocaleString()}</p>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-assistant-ink">{note.activityText}</p>
    </article>)}</div>
    {notes.hasNextPage && <button onClick={() => notes.fetchNextPage()} disabled={notes.isFetchingNextPage} className="calendar-secondary mt-4">{notes.isFetchingNextPage ? 'Loading…' : 'Load more notes'}</button>}
  </section>;
}