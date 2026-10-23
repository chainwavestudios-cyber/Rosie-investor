/**
 * sendTemplateTest — Sends one saved email template to a test address so the
 * Marketing tabs can check any template end to end, without touching a contact
 * card or a campaign.
 *
 * Payload: { system: 'coach' | 'fronter', templateId, to, sentBy }
 * A test send never injects open/click tracking, so previewing a template can
 * never light up a real contact card's badges.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { buildMime, TRACKING_BASE } from '../../shared/emailTracking.ts';
import { sendViaGmail, normalizeEmail, assertValidEmail } from '../../shared/gmailSend.ts';
import { getEmailSignature } from '../../shared/emailSignature.ts';
import { companyMergeVars } from '../../shared/companyInfo.ts';
import { renderMarketingEmail, sendMarketingEmail } from '../../shared/fronterMarketing.ts';
import { fillMergeTags } from '../../shared/mergeTags.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const { system, templateId, to, sentBy } = await req.json();
    if (!templateId) return Response.json({ error: 'Choose a template to test.' }, { status: 400 });

    const recipient = normalizeEmail(to);
    assertValidEmail(recipient);

    const base44 = createClientFromRequest(req);
    // A deleted or wrong id must read as "template not found", not a raw SDK error.
    const loadTemplate = async (entity: string, id: string) => {
      try { return await base44.asServiceRole.entities[entity].get(id); } catch { return null; }
    };

    let name = '';
    let subject = '';
    let html = '';

    if (system === 'fronter') {
      const template = await loadTemplate('FronterEmailTemplate', templateId);
      if (!template) return Response.json({ error: 'That template no longer exists.' }, { status: 404 });
      name = template.label || '';
      // The fronter workspace renders every saved tag and puts these out through
      // the outreach account, so the test matches the live email: same render,
      // same sender, no tracking.
      const draft = { id: template.id, subject: template.subject || '', html: template.body || '' };
      const card = {
        id: 'test', firstName: 'Test', lastName: 'Contact', email: recipient,
        phone: '(555) 010-0100', state: 'CA', protofaceId: 'PF-TEST-0001', debtAmount: 20000,
      };
      if ((template.emailProvider || 'gmail') === 'smtpfast') {
        const sent = await sendMarketingEmail(base44, draft, card, { test: true });
        return Response.json({
          success: true,
          templateName: name,
          to: sent.to,
          subject: sent.subject,
          account: 'outreach (SMTPfast)',
          sentBy: sentBy || 'admin',
          sentAt: new Date().toISOString(),
        });
      }
      const rendered = await renderMarketingEmail(base44, draft, card);
      subject = rendered.subject;
      html = rendered.html;
    } else {
      const template = await loadTemplate('DebtEmailTemplate', templateId);
      if (!template) return Response.json({ error: 'That template no longer exists.' }, { status: 404 });
      name = template.name || '';

      const appointmentDate = new Date(Date.now() + 86400000).toLocaleString('en-US', {
        timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
      const samplePersonalMessage = fillMergeTags(template.personalMessageUrl || '', { leadId: 'test', firstName: 'Test' });

      const vars: Record<string, string> = {
        firstName: 'Test',
        lastName: 'Contact',
        phone: '(555) 010-0100',
        email: recipient,
        appointmentDate,
        debtAmount: '$20,000',
        confirmUrl: `${TRACKING_BASE}/confirmAppointment?leadId=test`,
        changeUrl: `${TRACKING_BASE}/requestApptChange?leadId=test`,
        ...companyMergeVars(TRACKING_BASE, { email: recipient }),
        personalMessageUrl: samplePersonalMessage,
      };

      // Templates are written by hand, so {{FirstName}} and {{firstName}} both fill.
      subject = fillMergeTags(template.subject || '', vars);
      html = fillMergeTags(template.bodyHtml || '', vars);
      if (template.includeSignature) html += getEmailSignature();
    }

    if (!subject.trim() && !html.trim()) {
      return Response.json({ error: 'That template has no subject or body to send yet.' }, { status: 400 });
    }

    await sendViaGmail(base44, recipient, buildMime(recipient, subject, html));

    return Response.json({
      success: true,
      templateName: name,
      to: recipient,
      subject,
      sentBy: sentBy || 'admin',
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[sendTemplateTest] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}