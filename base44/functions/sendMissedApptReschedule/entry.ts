/**
 * sendMissedApptReschedule — Sends a "we missed you" email to a lead whose
 * appointment was missed. The email includes 3 time slots for today, 3 for
 * tomorrow (15-min each), and a link to request a specific time. Slots are
 * stored on the lead so the public /reschedule page can book them.
 *
 * Called from the Hot Leads tab "Reschedule" button on missed appointments.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { ET_TZ } from '../../shared/googleCalendarHelpers.ts';
import { sendTrackedEmail } from '../../shared/emailMessageEngine.ts';
import { getEmailSignature } from '../../shared/emailSignature.ts';

const APP_BASE = 'https://rosieai-investorpage.base44.app';

function etToUTC(dateStr: string, timeStr: string): Date {
  const utcInput = new Date(`${dateStr}T${timeStr}:00.000Z`);
  const etStr = utcInput.toLocaleString('en-US', { timeZone: ET_TZ });
  const utcStr = utcInput.toLocaleString('en-US', { timeZone: 'UTC' });
  const etDate = new Date(etStr);
  const utcDate = new Date(utcStr);
  const offsetMs = utcDate.getTime() - etDate.getTime();
  return new Date(utcInput.getTime() + offsetMs);
}

function getETDateStr(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ET_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

function getETHour(date: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: ET_TZ, hour: '2-digit', hour12: false }).format(date));
}

function generateTimeSlots(): Array<{ startISO: string; label: string; dayLabel: string }> {
  const slots: Array<{ startISO: string; label: string; dayLabel: string }> = [];
  const now = new Date();

  // ── Today's slots: start from next hour, spaced 2 hours apart, until 6pm ET ──
  const etHour = getETHour(now);
  const etDateStr = getETDateStr(now);
  let todayStartHour = etHour + 1;
  if (todayStartHour < 9) todayStartHour = 9;

  let todayCount = 0;
  for (let h = todayStartHour; h < 18 && todayCount < 3; h += 2) {
    const timeStr = `${String(h).padStart(2, '0')}:00`;
    const utcStart = etToUTC(etDateStr, timeStr);
    if (utcStart.getTime() > now.getTime() + 10 * 60 * 1000) {
      const label = new Intl.DateTimeFormat('en-US', { timeZone: ET_TZ, hour: 'numeric', minute: '2-digit' }).format(utcStart);
      slots.push({ startISO: utcStart.toISOString(), label, dayLabel: 'Today' });
      todayCount++;
    }
  }

  // ── Tomorrow's slots: 10am, 1pm, 4pm ET ──
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDateStr = getETDateStr(tomorrow);
  for (const h of [10, 13, 16]) {
    const timeStr = `${String(h).padStart(2, '0')}:00`;
    const utcStart = etToUTC(tomorrowDateStr, timeStr);
    const label = new Intl.DateTimeFormat('en-US', { timeZone: ET_TZ, hour: 'numeric', minute: '2-digit' }).format(utcStart);
    slots.push({ startISO: utcStart.toISOString(), label, dayLabel: 'Tomorrow' });
  }

  return slots;
}

function buildEmailHtml(lead: any): string {
  // Google Calendar appointment scheduler — customer picks a time directly
  const bookingLink = 'https://calendar.app.google/c9kk3wXrzPH21ARW7';

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 36px;">
  <p style="font-size:24px;font-weight:bold;color:#0a1c42;margin:0 0 20px 0;font-family:'Playfair Display',Georgia,serif;">Dear ${lead.firstName || 'there'},</p>
  <p style="font-size:15px;line-height:1.6;color:#0d1117;margin:0 0 16px 0;">
    Looks like we did not connect today at our arranged time, are you free later today or tomorrow. I really would a chance to connect about helping you eliminate all future interest on your unsecured debts, reduce your payments by 30-40% and get you debt free in the next few years. Our program has zero up front fees and we don't get paid until we settle all of your debts fully. We also do not handle your monies, as all payments made by consumers who enroll in our program specifically goto a escrow account that you control. There is no early termination or program exit fee's either, as a consumer you can choose to leave the program and withdraw your funds at any time without penalty. I look forward to showing you options to becoming debt free.
  </p>

  <p style="font-size:16px;font-weight:bold;color:#0a1c42;margin:24px 0 16px 0;">Pick a time that works for you:</p>

  <div style="text-align:center;margin:0 0 24px 0;">
    <a href="${bookingLink}" style="display:inline-block;background:#0ea5e9;color:#000000;text-decoration:none;font-weight:bold;padding:16px 40px;border-radius:8px;font-size:17px;font-family:'DM Sans',Arial,Helvetica,sans-serif;">📅 Book Your New Time</a>
  </div>

  <p style="font-size:14px;margin:0 0 0 0;color:#6b7280;">
    Or call us at <a href="tel:+16193530919" style="color:#0ea5e9;text-decoration:none;font-weight:bold;">(619) 353-0919</a> and we'll get you scheduled right away.
  </p>

  <p style="font-size:15px;margin:24px 0 0 0;color:#0d1117;">Best Regards,</p>
  ${getEmailSignature()}
</div></body></html>`;
}

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
    const { leadId } = body;
    if (!leadId) return Response.json({ error: 'leadId is required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const lead = await base44.asServiceRole.entities.DebtLead.get(leadId);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    if (!lead.email) return Response.json({ error: 'Lead has no email address' }, { status: 400 });

    // Build + send the email
    const subject = "We missed connecting today - let's reschedule your free consultation";
    let html = buildEmailHtml(lead);

    const sendResult = await sendTrackedEmail(base44, {
      to: lead.email,
      subject,
      html,
      contactId: lead.id,
      contactKind: 'debt_lead',
      contactName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
      templateName: 'Missed appointment reschedule',
      sentBy: 'automation',
      source: 'automation',
    });
    const sendId = sendResult.sendId;

    // Mark reschedule email as sent
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.DebtLead.update(lead.id, {
      rescheduleSentAt: now,
      rescheduleBookedAt: null,
    });

    // Log activity
    try {
      await base44.asServiceRole.entities.DebtLeadActivity.create({
        leadId: lead.id,
        leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        activityType: 'note',
        activityText: '📧 Sent missed-appointment reschedule email with Google Calendar booking link',
        createdBy: 'email_automation',
        metadataJson: JSON.stringify({ sendId }),
      });
    } catch {}

    return Response.json({
      success: true,
      sendId,
      sentAt: now,
    });
  } catch (error) {
    console.error('[sendMissedApptReschedule] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}