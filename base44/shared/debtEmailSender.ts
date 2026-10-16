/**
 * debtEmailSender.ts — Shared logic for sending a DebtEmailTemplate to a DebtLead.
 * Used by both sendDebtEmail (manual/test sends) and sendAppointmentReminders (automation).
 *
 * Handles variable substitution, signature injection, tracking, and Gmail sending.
 */
import { injectTracking, buildMime, TRACKING_BASE } from './emailTracking.ts';
import { getEmailSignature } from './emailSignature.ts';

export interface SendResult {
  sendId: string;
  subject: string;
}

export async function sendTemplateEmail(
  base44: any,
  template: any,
  lead: any
): Promise<SendResult> {
  if (!lead.email) throw new Error('Lead has no email address');

  const apptDateStr = lead.appointmentDate
    ? new Date(lead.appointmentDate).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '';

  // Build the personal message URL (substitute variables in the template's personalMessageUrl)
  let personalMessageUrl = template.personalMessageUrl || '';
  if (personalMessageUrl) {
    for (const [key, val] of Object.entries({
      leadId: lead.id || '',
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      phone: lead.phone || '',
      email: lead.email || '',
    })) {
      personalMessageUrl = personalMessageUrl.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    }
  }

  const vars: Record<string, string> = {
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    phone: lead.phone || '',
    email: lead.email || '',
    appointmentDate: apptDateStr,
    debtAmount: lead.debtAmount ? '$' + Number(lead.debtAmount).toLocaleString() : '',
    confirmUrl: `${TRACKING_BASE}/confirmAppointment?leadId=${lead.id}`,
    changeUrl: `${TRACKING_BASE}/requestApptChange?leadId=${lead.id}`,
    personalMessageUrl,
  };

  let subject = template.subject || '';
  let html = template.bodyHtml || '';
  for (const [key, val] of Object.entries(vars)) {
    subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  }

  if (template.includeSignature) {
    html += getEmailSignature();
  }

  const sendId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let trackedHtml = html;
  if (template.trackingEnabled) {
    trackedHtml = injectTracking(html, lead.id, sendId, template.id);
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
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

  return { sendId, subject };
}

/** Default templates — used when no DebtEmailTemplate records exist yet */
export const DEFAULT_NIGHT_BEFORE = {
  name: 'Night-Before Reminder',
  templateType: 'night_before',
  subject: 'Reminder: Your call tomorrow at {{appointmentDate}}',
  bodyHtml: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 36px;">
  <p style="font-size:24px;font-weight:bold;color:#0a1c42;margin:0 0 20px 0;">Good evening {{firstName}},</p>
  <p style="font-size:15px;line-height:1.6;color:#0d1117;margin:0 0 16px 0;">Just wanted to remind you of our scheduled phone call tomorrow at <strong>{{appointmentDate}}</strong>.</p>
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
    <a href="{{confirmUrl}}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;font-size:15px;margin-right:10px;">Confirm Appointment</a>
    <a href="{{changeUrl}}" style="display:inline-block;background:#6b7280;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;font-size:15px;">Change Appointment Time</a>
  </div>
</div></body></html>`,
  triggerOffsetHours: -18,
  enabled: true,
  trackingEnabled: true,
  includeSignature: true,
  attachToContactCard: false,
  sortOrder: 1,
};

export const DEFAULT_HOUR_BEFORE = {
  name: '1-Hour Reminder',
  templateType: 'hour_before',
  subject: 'Reminder: Your call in 1 hour',
  bodyHtml: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 36px;">
  <p style="font-size:24px;font-weight:bold;color:#0a1c42;margin:0 0 20px 0;">Hello {{firstName}},</p>
  <p style="font-size:15px;line-height:1.6;color:#0d1117;margin:0 0 24px 0;">Just wanted to remind you of our phone appointment in 1 hour. I hope you got a chance to review our credentials from my last email. Hope you having a great day!</p>
</div></body></html>`,
  triggerOffsetHours: -1,
  enabled: true,
  trackingEnabled: true,
  includeSignature: true,
  attachToContactCard: false,
  sortOrder: 2,
};

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}