/**
 * sendAppointmentReminders — Scans DebtLeads for upcoming appointments and sends
 * reminder emails via Gmail:
 *   1. Night-before email: sent at ~6pm ET the day before the appointment
 *   2. Hour-before email: sent 1 hour before the appointment
 *
 * Both emails include tracking pixels and link tracking via injectTracking.
 * The night-before email includes confirm/change appointment links.
 * Called by the "Appointment Reminders" workflow every 15 minutes.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { injectTracking, buildMime } from '../../shared/emailTracking.ts';
import { getEmailSignature } from '../../shared/emailSignature.ts';

const TRACKING_BASE = 'https://rosieai-investorpage.base44.app/functions';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Find all DebtLeads with a future appointmentDate that haven't been soft-deleted
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

      // ── Night-before reminder: send if appointment is within 18-36 hours ──
      const hoursUntilAppt = (apptDate.getTime() - now.getTime()) / (60 * 60 * 1000);
      if (!lead.nightBeforeReminderSentAt && hoursUntilAppt > 0 && hoursUntilAppt <= 36) {
        try {
          await sendNightBeforeEmail(base44, lead, apptDate);
          results.nightBefore++;
        } catch (e) {
          console.error(`[sendAppointmentReminders] Night-before failed for ${lead.id}:`, (e as Error).message);
        }
      }

      // ── Hour-before reminder: send if appointment is within 50-70 minutes ──
      const minsUntilAppt = (apptDate.getTime() - now.getTime()) / (60 * 1000);
      if (!lead.hourBeforeReminderSentAt && minsUntilAppt > 0 && minsUntilAppt <= 70) {
        try {
          await sendHourBeforeEmail(base44, lead, apptDate);
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

// ── Night-before email ──
async function sendNightBeforeEmail(base44: any, lead: any, apptDate: Date) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

  const timeStr = apptDate.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  const confirmUrl = `${TRACKING_BASE}/confirmAppointment?leadId=${lead.id}`;
  const changeUrl = `${TRACKING_BASE}/requestApptChange?leadId=${lead.id}`;

  const signature = getEmailSignature();

  const html = buildNightBeforeHtml(lead.firstName || '', timeStr, confirmUrl, changeUrl, signature);

  const sendId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const trackedHtml = injectTracking(html, lead.id, sendId);
  const subject = `Reminder: Your call tomorrow at ${timeStr}`;
  const mimeMessage = buildMime(lead.email, subject, trackedHtml);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: toBase64Url(mimeMessage) }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API error: ${errorText}`);
  }

  await base44.asServiceRole.entities.DebtLead.update(lead.id, {
    nightBeforeReminderSentAt: new Date().toISOString(),
    apptNightBeforeSendId: sendId,
  });
}

// ── Hour-before email ──
async function sendHourBeforeEmail(base44: any, lead: any, apptDate: Date) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

  const signature = getEmailSignature();
  const html = buildHourBeforeHtml(lead.firstName || '', signature);

  const sendId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const trackedHtml = injectTracking(html, lead.id, sendId);
  const subject = `Reminder: Your call in 1 hour`;
  const mimeMessage = buildMime(lead.email, subject, trackedHtml);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: toBase64Url(mimeMessage) }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API error: ${errorText}`);
  }

  await base44.asServiceRole.entities.DebtLead.update(lead.id, {
    hourBeforeReminderSentAt: new Date().toISOString(),
    apptHourBeforeSendId: sendId,
  });
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildNightBeforeHtml(firstName: string, timeStr: string, confirmUrl: string, changeUrl: string, signature: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 36px;">
  <p style="font-size:24px;font-weight:bold;color:#0a1c42;margin:0 0 20px 0;">Good evening ${firstName},</p>
  <p style="font-size:15px;line-height:1.6;color:#0d1117;margin:0 0 16px 0;">Just wanted to remind you of our scheduled phone call tomorrow at <strong>${timeStr}</strong>.</p>
  <p style="font-size:15px;line-height:1.6;color:#0d1117;margin:0 0 20px 0;">I look forward to helping you explore options to get debt free and eliminate your high interest rates, and any future interest.</p>
  <div style="background:#f0f7ff;padding:20px;border-radius:8px;margin:0 0 24px 0;">
    <p style="font-size:14px;font-weight:bold;color:#0a1c42;margin:0 0 10px 0;">Below are links to our company website, the BBB and our Trust Pilot Reviews:</p>
    <p style="font-size:15px;line-height:2;margin:0;">
      <a href="https://www.trustpilot.com/review/debtadvisorsofamerica.com" style="color:#10b981;text-decoration:underline;font-weight:bold;">Trust Pilot Reviews - Debt Advisors of America</a><br>
      <a href="https://www.bbb.org/us/ca/san-diego/profile/debt-relief-services/debt-advisors-of-america-1126-1000064078" style="color:#10b981;text-decoration:underline;font-weight:bold;">BBB Credentials: Better Business Bureau - Debt Advisors of America</a><br>
      <a href="https://www.debtadvisorsofamerica.com/" style="color:#10b981;text-decoration:underline;font-weight:bold;">Our website: Debt Advisors of America Website</a>
    </p>
  </div>
  <div style="margin:0 0 24px 0;">
    <a href="${confirmUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;font-size:15px;margin-right:10px;">Confirm Appointment</a>
    <a href="${changeUrl}" style="display:inline-block;background:#6b7280;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;font-size:15px;">Change Appointment Time</a>
  </div>
  ${signature}
</div></body></html>`;
}

function buildHourBeforeHtml(firstName: string, signature: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 36px;">
  <p style="font-size:24px;font-weight:bold;color:#0a1c42;margin:0 0 20px 0;">Hello ${firstName},</p>
  <p style="font-size:15px;line-height:1.6;color:#0d1117;margin:0 0 24px 0;">Just wanted to remind you of our phone appointment in 1 hour. I hope you got a chance to review our credentials from my last email. Hope you having a great day!</p>
  ${signature}
</div></body></html>`;
}