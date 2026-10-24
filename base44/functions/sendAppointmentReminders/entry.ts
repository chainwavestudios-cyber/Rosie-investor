/**
 * sendAppointmentReminders — Scans DebtLeads for upcoming appointments and sends
 * reminder emails via Gmail using DebtEmailTemplate records from the database.
 *
 *   1. Night-before email: sent when appointment is within 18-36 hours
 *   2. Hour-before email: sent when appointment is within 50-70 minutes
 *
 * Respects per-lead nightBeforeReminderEnabled / hourBeforeReminderEnabled flags.
 * Falls back to DEFAULT_NIGHT_BEFORE / DEFAULT_HOUR_BEFORE if no templates exist.
 * Called by the "Appointment Reminders" workflow every 15 minutes.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { automationGate } from '../../shared/automationRules.ts';
import { sendTemplateEmail, DEFAULT_NIGHT_BEFORE, DEFAULT_HOUR_BEFORE } from '../../shared/debtEmailSender.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const gate = await automationGate(base44, 'appointment_reminders');
    if (!gate.run) return Response.json({ skipped: true, automation: 'appointment_reminders', reason: gate.reason });
    const now = new Date();

    // Load templates from the database
    const [nbPage, hbPage] = await Promise.all([
      base44.asServiceRole.entities.DebtEmailTemplate.filter(
        { templateType: 'night_before', enabled: true },
        { sort: 'sortOrder', limit: 1 }
      ),
      base44.asServiceRole.entities.DebtEmailTemplate.filter(
        { templateType: 'hour_before', enabled: true },
        { sort: 'sortOrder', limit: 1 }
      ),
    ]);
    const nbItems = (nbPage as any)?.items || nbPage || [];
    const hbItems = (hbPage as any)?.items || hbPage || [];
    const nightBeforeTemplate = nbItems[0] || DEFAULT_NIGHT_BEFORE;
    const hourBeforeTemplate = hbItems[0] || DEFAULT_HOUR_BEFORE;

    // Find all DebtLeads with a future appointmentDate
    const raw = await base44.asServiceRole.entities.DebtLead.filter(
      { appointmentDate: { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() }, deletedAt: { $exists: false } },
      { sort: 'appointmentDate', limit: 200 }
    );
    const leads = Array.isArray(raw) ? raw : (raw?.items || []);

    const results = { nightBefore: 0, hourBefore: 0, skipped: 0 };

    for (const lead of leads) {
      if (!lead.email) { results.skipped++; continue; }
      const apptDate = new Date(lead.appointmentDate);
      if (isNaN(apptDate.getTime())) { results.skipped++; continue; }

      const hoursUntilAppt = (apptDate.getTime() - now.getTime()) / (60 * 60 * 1000);

      // Night-before: check enabled flag, not already sent, within 18-36 hours
      if (lead.nightBeforeReminderEnabled !== false && !lead.nightBeforeReminderSentAt && hoursUntilAppt > 0 && hoursUntilAppt <= 36) {
        try {
          const { sendId } = await sendTemplateEmail(base44, nightBeforeTemplate, lead);
          await base44.asServiceRole.entities.DebtLead.update(lead.id, {
            nightBeforeReminderSentAt: new Date().toISOString(),
            apptNightBeforeSendId: sendId,
          });
          results.nightBefore++;
        } catch (e) {
          console.error(`[sendAppointmentReminders] Night-before failed for ${lead.id}:`, (e as Error).message);
        }
      }

      // Hour-before: check enabled flag, not already sent, within 50-70 minutes
      const minsUntilAppt = (apptDate.getTime() - now.getTime()) / (60 * 1000);
      if (lead.hourBeforeReminderEnabled !== false && !lead.hourBeforeReminderSentAt && minsUntilAppt > 0 && minsUntilAppt <= 70) {
        try {
          const { sendId } = await sendTemplateEmail(base44, hourBeforeTemplate, lead);
          await base44.asServiceRole.entities.DebtLead.update(lead.id, {
            hourBeforeReminderSentAt: new Date().toISOString(),
            apptHourBeforeSendId: sendId,
          });
          results.hourBefore++;
        } catch (e) {
          console.error(`[sendAppointmentReminders] Hour-before failed for ${lead.id}:`, (e as Error).message);
        }
      }
    }

    return Response.json({ success: true, ...results, total: leads.length });
  } catch (error) {
    console.error('[sendAppointmentReminders] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}