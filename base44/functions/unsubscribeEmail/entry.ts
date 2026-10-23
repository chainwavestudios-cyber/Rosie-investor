/**
 * unsubscribeEmail — Public opt-out endpoint linked from every marketing email
 * (see shared/companyInfo.ts). Anyone holding the link can open it: it records
 * the opt-out against the recipient's address, stops that contact's appointment
 * reminders, and shows a plain confirmation page.
 *
 * Every send path checks isEmailUnsubscribed() before sending, so one click here
 * takes the address out of coach sends, reminders and marketing campaigns.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const PHONE = '(619) 353-0919';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const leadId = url.searchParams.get('leadId') || '';
    let email = (url.searchParams.get('email') || '').trim().toLowerCase();

    let lead: any = null;
    if (leadId) {
      lead = await base44.asServiceRole.entities.DebtLead.get(leadId).catch(() => null);
      if (lead?.email) email = String(lead.email).trim().toLowerCase();
    }

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return htmlResponse(
        'We could not read the email address on that link.',
        `Please reply to the email you received, or call us at ${PHONE}, and we will take you off the list.`
      );
    }

    const now = new Date().toISOString();

    // Record the opt-out so no send path emails this address again.
    const found = await base44.asServiceRole.entities.EmailOptIn
      .filter({ email }, { limit: 1 })
      .catch(() => null);
    const existing = (Array.isArray(found) ? found : (found?.items || []))[0];

    if (existing) {
      if (existing.status !== 'unsubscribed') {
        await base44.asServiceRole.entities.EmailOptIn.update(existing.id, {
          status: 'unsubscribed',
          unsubscribedAt: now,
        });
      }
    } else {
      await base44.asServiceRole.entities.EmailOptIn.create({
        email,
        firstName: lead?.firstName || '',
        lastName: lead?.lastName || '',
        phone: lead?.phone || '',
        source: 'manual',
        status: 'unsubscribed',
        unsubscribedAt: now,
        recordedBy: 'unsubscribe_link',
        consentText: 'Asked to stop receiving email through the unsubscribe link.',
      });
    }

    // Stop this contact's appointment reminders too.
    if (lead) {
      await base44.asServiceRole.entities.DebtLead
        .update(lead.id, { nightBeforeReminderEnabled: false, hourBeforeReminderEnabled: false })
        .catch(() => {});
      await base44.asServiceRole.entities.DebtLeadActivity.create({
        leadId: lead.id,
        leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        activityType: 'note',
        activityText: '🚫 Contact unsubscribed from email',
        createdBy: 'email_automation',
      }).catch(() => {});
    }

    return htmlResponse('You have been unsubscribed.', `We will not email ${email} again. If this was a mistake, call us at ${PHONE}.`);
  } catch (e) {
    return htmlResponse('Please try that link again.', `If it still does not work, call us at ${PHONE}.`);
  }
}

function htmlResponse(title: string, message: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email Preferences</title></head>
<body style="margin:0;background:#eae7e1;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
    <div style="background:#ffffff;border-top:3px solid #cda75e;padding:40px 32px;text-align:center;">
      <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#866126;font-weight:bold;">Debt Advisors of America</div>
      <h1 style="font-size:26px;color:#0a1c42;margin:20px 0 12px 0;">${title}</h1>
      <p style="font-size:15px;line-height:1.6;color:#333333;margin:0;">${message}</p>
    </div>
  </div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}