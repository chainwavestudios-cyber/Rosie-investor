/**
 * bookReschedule — Called from the public /reschedule page when a customer
 * selects a time slot or requests a specific time. Creates a 15-min Google
 * Calendar event, updates the lead's appointment fields, and sends a
 * confirmation email.
 *
 * Params:
 *   leadId      — required
 *   token       — required (must match lead.rescheduleToken)
 *   slotIndex   — index into rescheduleSlotsJson (0-5)
 *   customISO   — ISO string for a custom requested time (overrides slotIndex)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { ET_TZ, getCalendarAuth, listEvents, hasConflict, formatInTz } from '../../shared/googleCalendarHelpers.ts';
import { buildMime } from '../../shared/emailTracking.ts';
import { getEmailSignature } from '../../shared/emailSignature.ts';

const APPT_DURATION_MIN = 15;

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { leadId, token, slotIndex, customISO } = body;
    if (!leadId || !token) return Response.json({ error: 'leadId and token are required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const lead = await base44.asServiceRole.entities.DebtLead.get(leadId);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    if (lead.rescheduleToken !== token) return Response.json({ error: 'Invalid reschedule token' }, { status: 403 });

    // Already booked?
    if (lead.rescheduleBookedAt) {
      return Response.json({ error: 'already_booked', appointmentDate: lead.appointmentDate }, { status: 409 });
    }

    // ── Determine the start time ──
    let startISO: string;
    let slotLabel: string;

    if (customISO) {
      const customDate = new Date(customISO);
      if (isNaN(customDate.getTime()) || customDate.getTime() < Date.now()) {
        return Response.json({ error: 'Please pick a future date and time' }, { status: 400 });
      }
      startISO = customDate.toISOString();
      slotLabel = formatInTz(startISO, ET_TZ);
    } else if (slotIndex != null) {
      let slots: any[] = [];
      try { slots = JSON.parse(lead.rescheduleSlotsJson || '[]'); } catch {}
      const slot = slots[Number(slotIndex)];
      if (!slot) return Response.json({ error: 'Invalid time slot' }, { status: 400 });
      startISO = slot.startISO;
      slotLabel = `${slot.dayLabel} ${slot.label}`;
    } else {
      return Response.json({ error: 'Provide either slotIndex or customISO' }, { status: 400 });
    }

    const start = new Date(startISO);
    const end = new Date(start.getTime() + APPT_DURATION_MIN * 60 * 1000);

    // ── Check for calendar conflicts ──
    const authHeader = await getCalendarAuth(base44);
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const events = await listEvents(authHeader, timeMin, timeMax);

    if (hasConflict(events, start, end)) {
      // Move 15 min forward until no conflict (up to 8 attempts)
      let attempts = 0;
      while (hasConflict(events, start, end) && attempts < 8) {
        start.setTime(start.getTime() + 15 * 60 * 1000);
        end.setTime(end.getTime() + 15 * 60 * 1000);
        attempts++;
      }
      startISO = start.toISOString();
      slotLabel = formatInTz(startISO, ET_TZ);
    }

    // ── Create the Google Calendar event ──
    const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Client';
    const title = `Follow-up Call — ${leadName}${lead.phone ? ` — ${lead.phone}` : ''}`;
    const description = `Rescheduled by customer via missed-appointment email.\nLead: ${leadName}\nPhone: ${lead.phone || '—'}\nEmail: ${lead.email || '—'}`;

    const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        summary: title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        description,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      return Response.json({ error: createData.error?.message || 'Failed to create calendar event' }, { status: 500 });
    }

    // ── Update the lead ──
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.DebtLead.update(lead.id, {
      appointmentDate: start.toISOString(),
      appointmentEventId: createData.id,
      appointmentEventHtmlLink: createData.htmlLink || null,
      appointmentConfirmed: false,
      appointmentConfirmedAt: null,
      appointmentChangeRequested: false,
      appointmentChangeRequestedAt: null,
      nightBeforeReminderSentAt: null,
      hourBeforeReminderSentAt: null,
      apptEmailOpenedAt: null,
      apptHourReminderOpenedAt: null,
      rescheduleBookedAt: now,
    });

    // ── Send confirmation email ──
    const apptLabel = formatInTz(start.toISOString(), ET_TZ);
    let confirmHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 36px;">
  <p style="font-size:24px;font-weight:bold;color:#0a1c42;margin:0 0 20px 0;font-family:'Playfair Display',Georgia,serif;">Great, ${lead.firstName || 'there'}!</p>
  <p style="font-size:15px;line-height:1.6;color:#0d1117;margin:0 0 16px 0;">
    Your call has been rescheduled for <strong>${apptLabel}</strong>. I look forward to speaking with you then.
  </p>
  <p style="font-size:15px;line-height:1.6;color:#0d1117;margin:0 0 16px 0;">
    If you need to change the time again, just reply to this email or call me at (619) 353-0919.
  </p>
  <p style="font-size:15px;margin:24px 0 0 0;color:#0d1117;">Best Regards,</p>
  ${getEmailSignature()}
</div></body></html>`;

    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const mimeMessage = buildMime(lead.email, `Your call is rescheduled — ${apptLabel}`, confirmHtml);
      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: toBase64Url(mimeMessage) }),
      });
    } catch (e) {
      console.warn('[bookReschedule] Confirmation email failed:', (e as Error).message);
    }

    // ── Log activity ──
    try {
      await base44.asServiceRole.entities.DebtLeadActivity.create({
        leadId: lead.id,
        leadName,
        activityType: 'note',
        activityText: `📅 Appointment rescheduled by customer to ${apptLabel}`,
        createdBy: 'reschedule_page',
      });
    } catch {}

    return Response.json({
      success: true,
      appointmentDate: start.toISOString(),
      appointmentLabel: apptLabel,
      eventId: createData.id,
      htmlLink: createData.htmlLink || null,
    });
  } catch (error) {
    console.error('[bookReschedule] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}