/**
 * importCalendarEvents.js — Pulls the assistant's calendar events (client appointments and
 * callbacks) into the task list as workable lines: client, when it is, and a link back to
 * the calendar contact card. Already-imported events are skipped via their source key.
 */
import { base44 } from '@/api/base44Client';

const LEAD_FIELDS = ['firstName', 'lastName', 'phone', 'appointmentDate', 'appointmentTitle', 'appointmentConfirmed', 'callbackAt', 'status'];
const PAST_DAYS = 120;
const FUTURE_DAYS = 60;

export const SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'missed', label: 'Missed' },
  { id: 'completed', label: 'Completed' },
];

const whenLabel = (date) => date.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
// Matches how the calendar itself decides an appointment is done.
const isDone = (lead) => lead.status === 'completed' || (lead.appointmentConfirmed && new Date(lead.appointmentDate) < new Date());

export async function importCalendarEvents(scope, username, existingTasks) {
  const [apptPage, cbPage] = await Promise.all([
    base44.entities.DebtLead.filter({ appointmentDate: { $ne: null } }, { limit: 400, fields: LEAD_FIELDS }),
    base44.entities.DebtLead.filter({ callbackAt: { $ne: null } }, { limit: 400, fields: LEAD_FIELDS }),
  ]);
  const now = Date.now(), from = now - PAST_DAYS * 86400000, to = now + FUTURE_DAYS * 86400000;
  const events = [];

  for (const l of (apptPage?.items || [])) {
    const at = new Date(l.appointmentDate);
    if (isNaN(at.getTime()) || at.getTime() < from || at.getTime() > to) continue;
    const done = isDone(l);
    if (scope === 'missed' && (done || at.getTime() > now)) continue;
    if (scope === 'completed' && !done) continue;
    events.push({ key: `${l.id}-appt`, lead: l, at, done, kind: 'appointment' });
  }

  // Callbacks have no missed/completed state — they only come in with the full import.
  if (scope === 'all') {
    for (const l of (cbPage?.items || [])) {
      const at = new Date(l.callbackAt);
      if (isNaN(at.getTime()) || at.getTime() < from || at.getTime() > to) continue;
      events.push({ key: `${l.id}-cb`, lead: l, at, done: false, kind: 'callback' });
    }
  }

  const already = new Set((existingTasks || []).map(t => t.sourceKey).filter(Boolean));
  const fresh = events.filter(e => !already.has(e.key));
  if (fresh.length === 0) return { imported: 0, skipped: events.length };

  await base44.entities.AssistantTask.bulkCreate(fresh.map(({ key, lead, at, done, kind }) => {
    const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Client';
    const label = kind === 'callback' ? 'Callback' : (lead.appointmentTitle || 'Appointment');
    return {
      title: `${kind === 'callback' ? '📞' : '📅'} ${name} — ${label}`,
      description: [
        `${kind === 'callback' ? 'Callback' : 'Appointment'}: ${whenLabel(at)} ET`,
        lead.phone ? `Phone: ${lead.phone}` : '',
        kind === 'appointment' ? (done ? 'Marked completed on the calendar' : at.getTime() < now ? 'Missed — not marked completed' : 'Scheduled') : '',
      ].filter(Boolean).join('\n'),
      status: 'todo',
      priority: at.getTime() < now ? 'high' : 'medium',
      category: 'appointment',
      dueDate: at.toISOString(),
      assignedTo: username,
      relatedLeadId: lead.id,
      relatedLeadName: name,
      sourceKey: key,
      createdBy: username,
    };
  }));

  return { imported: fresh.length, skipped: events.length - fresh.length };
}