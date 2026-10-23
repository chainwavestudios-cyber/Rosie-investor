/**
 * sendFronterCredsEmail — Sends the Debt Call Coach "Creds and Welcome Message"
 * email to a Fronter prospect in one tap (no compose box).
 *
 * The email body is the Debt Call Coach template itself, so the two are always
 * the same copy. Tracking is injected, so the card and the Prospect Tracking tab
 * light up on: email opened, welcome-message link, BBB, Trustpilot, website.
 *
 * It leaves through SMTPfast, never the company Gmail account: everything a
 * fronter sends is outreach, and no fronter email goes out of Gmail.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sendTemplateEmail } from '../../shared/debtEmailSender.ts';

const CONFIG_KEY = 'default';
const FALLBACK_SUBJECT = 'Our Credentials - Debt Advisors of America';
// The welcome / personal message link in the Debt Call Coach email.
const WELCOME_ANCHOR = /<a\b[^>]*href="\{\{\s*personalMessageUrl\s*\}\}"[^>]*>([\s\S]*?)<\/a>/gi;

export default async function (req: Request): Promise<Response> {
  try {
    const { leadId, sentBy } = await req.json();
    if (!leadId) return Response.json({ error: 'leadId is required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    let lead: any = null;
    try { lead = await base44.asServiceRole.entities.FronterLead.get(leadId); } catch { lead = null; }
    if (!lead) return Response.json({ error: 'Contact not found' }, { status: 404 });
    if (!lead.email) return Response.json({ error: 'This contact has no email address yet — add one to the card first.' }, { status: 400 });

    // Same template Debt Call Coach sends: "Creds and Welcome Message".
    const page = await base44.asServiceRole.entities.DebtEmailTemplate.filter(
      { name: { $regex: 'cred', $options: 'i' } },
      { limit: 5 }
    );
    const items = (page as any)?.items || page || [];
    const template = items.find((t: any) => /creds and welcome/i.test(t.name || '')) || items[0];
    if (!template) {
      return Response.json({ error: 'The Credentials & Welcome Message email is missing from Debt Call Coach.' }, { status: 404 });
    }

    // The welcome message link — the super admin's master, else the template's own.
    const configRows = await base44.asServiceRole.entities.SuperAdminConfig.filter({ configName: CONFIG_KEY });
    const config = (Array.isArray(configRows) ? configRows[0] : (configRows as any)?.items?.[0]) || null;
    const welcomeUrl = String(config?.welcomeMessageUrl || template.personalMessageUrl || '').trim();

    // No welcome link configured — send the email without a dead link in it.
    const bodyHtml = welcomeUrl
      ? template.bodyHtml
      : String(template.bodyHtml || '').replace(WELCOME_ANCHOR, '$1');

    const { sendId } = await sendTemplateEmail(base44, {
      ...template,
      subject: template.subject || FALLBACK_SUBJECT,
      bodyHtml,
      personalMessageUrl: welcomeUrl,
      trackingEnabled: true,
    }, lead, { transport: 'smtpfast' });

    const now = new Date().toISOString();
    const updates: any = { credsSentAt: now, credsSentTemplate: template.name };
    // Sending the credentials graduates a prospect to a lead.
    if (lead.status === 'prospect') updates.status = 'lead';
    try {
      const log = JSON.parse(lead.notesLogJson || '[]');
      log.push({
        text: `📧 Credentials & welcome message emailed to ${lead.email}`,
        timestamp: now,
        author: sentBy || 'fronter',
        type: 'creds',
      });
      updates.notesLogJson = JSON.stringify(log);
    } catch {}
    await base44.asServiceRole.entities.FronterLead.update(lead.id, updates);

    await base44.asServiceRole.entities.EmailLog.create({
      leadId: lead.id,
      toEmail: lead.email,
      subject: template.subject || FALLBACK_SUBJECT,
      templateId: template.id,
      status: 'sent',
      sentAt: now,
      sentBy: sentBy || 'fronter',
      isCustomEmail: true,
      fromEmail: 'smtpfast',
    }).catch(() => {});

    return Response.json({
      success: true,
      sendId,
      templateName: template.name,
      to: lead.email,
      welcomeLink: welcomeUrl || null,
    });
  } catch (error) {
    console.error('[sendFronterCredsEmail] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}