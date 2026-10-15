/**
 * bookReschedule — Called from the public /reschedule page when a customer
 * selects a time slot or requests a specific time. Creates a 15-min Google
 * Calendar event, updates the lead's appointment fields, and sends a
 * confirmation email.
 *
 * Security & reliability:
 *   - POST-only
 *   - Token validation with 7-day expiration
 *   - Booking window (future, within 30 days)
 *   - Business hours enforcement (8 AM–6 PM ET, Mon–Fri)
 *   - Conflict rejection (no silent time shifting — customer gets the time
 *     they selected or a clear error)
 *   - Race-condition defense (re-check rescheduleBookedAt before DB update)
 *   - Calendar event rollback on DB failure
 *   - HTML-escaped email content
 *   - Generic public error responses
 *
 * Params:
 *   leadId      — required
 *   token       — required (must match lead.rescheduleToken)
 *   slotIndex   — index into rescheduleSlotsJson
 *   customISO   — ISO 8601 with timezone for a custom requested time
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { ET_TZ, getCalendarAuth, listEvents, hasConflict, formatInTz } from '../../shared/googleCalendarHelpers.ts';
import { buildMime } from '../../shared/emailTracking.ts';
import { getEmailSignature } from '../../shared/emailSignature.ts';

const APPT_DURATION_MIN = 15;
const BOOKING_HORIZON_DAYS = 30;
const BUSINESS_HOURS_START = 8;
const BUSINESS_HOURS_END = 18;
const TOKEN_MAX_AGE_DAYS = 7;

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function htmlEscape(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Checks that a Date falls within business hours (8 AM–6 PM ET, Mon–Fri). */
function isWithinBusinessHours(date: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TZ,
    weekday: 'short', hour: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const weekday = get('weekday');
  const hour = parseInt(get('hour'), 10) % 24;
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END;
}

export default async function (req: Request): Promise<Response> {
  try {
    // ── POST-only ──
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = await req.json();
    const { leadId, token, slotIndex, customISO } = body;
    if (!leadId || !token) return Response.json({ error: 'leadId and token are required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const lead = await base44.asServiceRole.entities.DebtLead.get(leadId);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    if (lead.rescheduleToken !== token) return Response.json({ error: 'Invalid reschedule token' }, { status: 403 });

    // ── Token expiration ──
    if (lead.rescheduleSentAt) {
      const tokenAge = Date.now() - new Date(lead.rescheduleSentAt).getTime();
      if (tokenAge > TOKEN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
        return Response.json({ error: 'This reschedule link has expired. Please contact us to reschedule.' }, { status: 410 });
      }
    }

    // Already booked?
    if (lead.rescheduleBookedAt) {
      return Response.json({ error: 'already_booked', appointmentDate: lead.appointmentDate }, { status: 409 });
    }

    // ── Determine the start time ──
    let startISO: string;
    let slotLabel: string;

    if (customISO) {
      // Strict ISO 8601 with timezone (Z or offset) — prevents runtime-dependent
      // timezone interpretation
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})$/.test(customISO)) {
        return Response.json({ error: 'Invalid date format' }, { status: 400 });
      }
      const customDate = new Date(customISO);
      if (isNaN(customDate.getTime())) {
        return Response.json({ error: 'Invalid date' }, { status: 400 });
      }
      const now = Date.now();
      if (customDate.getTime() <= now) {
        return Response.json({ error: 'Please pick a future date and time' }, { status: 400 });
      }
      if (customDate.getTime() > now + BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000) {
        return Response.json({ error: `Please pick a date within ${BOOKING_HORIZON_DAYS} days` }, { status: 400 });
      }
      startISO = customDate.toISOString();
      slotLabel = formatInTz(startISO, ET_TZ);
    } else if (slotIndex != null) {
      let slots: any[] = [];
      try { slots = JSON.parse(lead.rescheduleSlotsJson || '[]'); } catch {}
      const idx = Number(slotIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= slots.length) {
        return Response.json({ error: 'Invalid time slot' }, { status: 400 });
      }
      const slot = slots[idx];
      if (!slot?.startISO) return Response.json({ error: 'Invalid time slot' }, { status: 400 });
      // Revalidate stored slot — could be stale
      const slotDate = new Date(slot.startISO);
      if (isNaN(slotDate.getTime()) || slotDate.getTime() <= Date.now()) {
        return Response.json({ error: 'This time slot is no longer available. Please pick another time.' }, { status: 400 });
      }
      if (slotDate.getTime() > Date.now() + BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000) {
        return Response.json({ error: 'This time slot is outside the booking window. Please pick another time.' }, { status: 400 });
      }
      startISO = slot.startISO;
      slotLabel = `${slot.dayLabel} ${slot.label}`;
    } else {
      return Response.json({ error: 'Provide either slotIndex or customISO' }, { status: 400 });
    }

    const start = new Date(startISO);
    const end = new Date(start.getTime() + APPT_DURATION_MIN * 60 * 1000);

    // ── Enforce business hours ──
    if (!isWithinBusinessHours(start)) {
      return Response.json({ error: 'Appointments are available Monday–Friday, 8 AM–6 PM Eastern. Please pick a time within business hours.' }, { status: 400 });
    }

    // ── Check for calendar conflicts (narrow window around the slot) ──
    const authHeader = await getCalendarAuth(base44);
    const queryStart = new Date(start.getTime() - 60 * 60 * 1000).toISOString();
    const queryEnd = new Date(end.getTime() + 60 * 60 * 1000).toISOString();
    const events = await listEvents(authHeader, queryStart, queryEnd);

    if (hasConflict(events, start, end)) {
      return Response.json({ error: 'This time was just booked. Please select another time.' }, { status: 409 });
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
    if (!createRes.ok || !createData.id) {
      console.error('[bookReschedule] Calendar event creation failed:', createData.error?.message);
      return Response.json({ error: 'Unable to book the appointment. Please try again.' }, { status: 500 });
    }

    // ── Race-condition defense: re-check if another request booked first ──
    const freshLead = await base44.asServiceRole.entities.DebtLead.get(lead.id);
    if (freshLead?.rescheduleBookedAt) {
      // Another request won — delete our orphaned event
      try {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(createData.id)}`, {
          method: 'DELETE', headers: authHeader,
        });
      } catch (delErr) {
        console.error('[bookReschedule] Failed to clean up orphaned event after race loss:', delErr?.message);
      }
      return Response.json({ error: 'already_booked', appointmentDate: freshLead.appointmentDate }, { status: 409 });
    }

    // ── Update the lead (rollback calendar event on failure) ──
    const now = new Date().toISOString();
    try {
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
    } catch (dbErr) {
      console.error('[bookReschedule] DB update failed, rolling back calendar event:', dbErr?.message);
      try {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(createData.id)}`, {
          method: 'DELETE', headers: authHeader,
        });
      } catch (delErr) {
        console.error('[bookReschedule] CRITICAL: Failed to roll back calendar event', createData.id, delErr?.message);
      }
      return Response.json({ error: 'Unable to complete the booking. Please try again.' }, { status: 500 });
    }

    // ── Send confirmation email ──
    const apptLabel = formatInTz(start.toISOString(), ET_TZ);
    const safeFirstName = htmlEscape(lead.firstName || 'there');
    const safeApptLabel = htmlEscape(apptLabel);
    const confirmHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 36px;">
  <p style="font-size:24px;font-weight:bold;color:#0a1c42;margin:0 0 20px 0;font-family:'Playfair Display',Georgia,serif;">Great, ${safeFirstName}!</p>
  <p style="font-size:15px;line-height:1.6;color:#0d1117;margin:0 0 16px 0;">
    Your call has been rescheduled for <strong>${safeApptLabel}</strong>. I look forward to speaking with you then.
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
      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: toBase64Url(mimeMessage) }),
      });
      if (!sendRes.ok) {
        console.error('[bookReschedule] Gmail send failed:', await sendRes.text());
      }
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
    return Response.json({ error: 'Unable to process your request. Please try again or contact us.' }, { status: 500 });
  }
}