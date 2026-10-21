/**
 * useCalendarHistory.js — Chronological history for one client, newest first.
 * Merges the activity log (calls with length, emails sent, appointments, AI synopsis,
 * status changes), tracked emails, email opens/clicks, and the client's own
 * appointment & reminder milestones into a single timeline.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const KIND_BY_ACTIVITY = {
  call: 'call',
  ai_synopsis: 'ai',
  calendar_event: 'appointment',
  lead_assigned: 'appointment',
  status_change: 'status',
};

// Client-field milestones that never reach the activity log.
const MILESTONES = [
  ['appointmentConfirmedAt', 'appointment', 'Appointment confirmed by the client'],
  ['appointmentChangeRequestedAt', 'appointment', 'Client requested an appointment change'],
  ['nightBeforeReminderSentAt', 'email', 'Night-before reminder email sent'],
  ['hourBeforeReminderSentAt', 'email', '1-hour reminder email sent'],
  ['apptEmailOpenedAt', 'email_open', 'Reminder email opened'],
  ['apptHourReminderOpenedAt', 'email_open', '1-hour reminder opened'],
  ['apptBbbClickedAt', 'email_click', 'BBB link clicked in the reminder email'],
  ['apptTrustpilotClickedAt', 'email_click', 'Trustpilot link clicked in the reminder email'],
  ['apptWebsiteClickedAt', 'email_click', 'Website link clicked in the reminder email'],
  ['rescheduleSentAt', 'email', 'Rebooking link emailed'],
  ['rescheduleBookedAt', 'appointment', 'Client rebooked a new appointment time'],
  ['personalMessageClickedAt', 'email_click', 'Personal message link clicked'],
  ['personalMessageAudioPlayedAt', 'email_click', 'Personal message played'],
];

const parseMeta = (json) => {
  try { return json ? JSON.parse(json) : null; } catch { return null; }
};

async function loadHistory(leadId) {
  const [activity, emails, tracked] = await Promise.all([
    base44.entities.DebtLeadActivity.filter({ leadId }, { sort: '-created_date', limit: 200 }),
    base44.entities.EmailLog.filter({ leadId }, { sort: '-sentAt', limit: 100 }),
    base44.entities.EmailTrackingEvent.filter({ leadId }, { sort: '-trackedAt', limit: 200 }),
  ]);
  return { activity, emails, tracked };
}

export default function useCalendarHistory(lead) {
  const query = useQuery({
    queryKey: ['calendar-history', lead?.id],
    enabled: !!lead?.id,
    queryFn: async () => {
      const { activity, emails, tracked } = await loadHistory(lead.id);
      const entries = [];

      for (const a of activity?.items || []) {
        const meta = parseMeta(a.metadataJson);
        const emailed = a.activityType === 'note' && /sent email|📧/.test(a.activityText || '');
        entries.push({
          id: a.id,
          kind: KIND_BY_ACTIVITY[a.activityType] || (emailed ? 'email' : 'note'),
          at: new Date(a.created_date),
          text: a.activityText || '',
          duration: a.activityType === 'call' && meta?.durationMin ? `${meta.durationMin} min` : '',
          by: a.createdBy || '',
          link: meta?.htmlLink || '',
        });
      }

      for (const e of emails?.items || []) {
        entries.push({ id: 'mail-' + e.id, kind: 'email', at: new Date(e.sentAt || e.created_date), text: `Email sent: ${e.subject || 'no subject'}`, by: e.sentBy || '', detail: e.toEmail || '' });
      }

      for (const t of tracked?.items || []) {
        const clicked = t.eventType === 'click';
        entries.push({ id: 'track-' + t.id, kind: clicked ? 'email_click' : 'email_open', at: new Date(t.trackedAt || t.created_date), text: `${t.templateName || 'Email'} ${clicked ? 'link clicked' : 'opened'}`, detail: clicked ? (t.url || '') : '' });
      }

      for (const [field, kind, text] of MILESTONES) {
        if (lead[field]) entries.push({ id: field, kind, at: new Date(lead[field]), text });
      }

      // The same moment arrives from more than one source — keep one entry per kind per minute.
      const seen = new Set();
      const timeline = entries
        .filter(e => !isNaN(e.at.getTime()))
        .sort((a, b) => b.at - a.at)
        .filter(e => {
          const key = `${e.kind}:${Math.round(e.at.getTime() / 60000)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      return {
        entries: timeline,
        stats: {
          calls: timeline.filter(e => e.kind === 'call').length,
          talkMin: timeline.filter(e => e.kind === 'call').reduce((sum, e) => sum + (parseInt(e.duration, 10) || 0), 0),
          emails: timeline.filter(e => e.kind === 'email').length,
          engagement: timeline.filter(e => e.kind === 'email_open' || e.kind === 'email_click').length,
        },
      };
    },
  });

  return {
    entries: query.data?.entries || [],
    stats: query.data?.stats || { calls: 0, talkMin: 0, emails: 0, engagement: 0 },
    isLoading: query.isPending,
    error: query.error,
  };
}