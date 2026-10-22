/**
 * sendFronterMarketingEmail — Sends a fronter email template to one or more
 * Fronter contact cards (the Marketing section inside /fronter).
 *
 * The copy is a FronterEmailTemplate, so it is edited inside the fronter portal.
 * Tracking is injected exactly like the credentials email: opens and link clicks
 * land on the contact card and the Prospect Tracking tab.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sendTemplateEmail } from '../../shared/debtEmailSender.ts';

const MAX_PER_CALL = 25;

export default async function (req: Request): Promise<Response> {
  try {
    const { templateId, leadIds, sentBy } = await req.json();
    if (!templateId) return Response.json({ error: 'templateId is required' }, { status: 400 });
    const ids: string[] = Array.isArray(leadIds) ? leadIds.filter(Boolean).slice(0, MAX_PER_CALL) : [];
    if (!ids.length) return Response.json({ error: 'Pick at least one contact to email' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const template: any = await base44.asServiceRole.entities.FronterEmailTemplate.get(templateId);
    if (!template) return Response.json({ error: 'Email template not found' }, { status: 404 });

    // Fronter templates keep their copy in `body`; the shared sender reads `bodyHtml`.
    const sendable = { ...template, name: template.label, bodyHtml: template.body };

    const sent: any[] = [];
    const failed: any[] = [];

    for (const leadId of ids) {
      try {
        const lead: any = await base44.asServiceRole.entities.FronterLead.get(leadId);
        if (!lead) { failed.push({ leadId, error: 'Contact not found' }); continue; }
        if (!lead.email) { failed.push({ leadId, error: `${lead.firstName || 'This contact'} has no email address` }); continue; }

        const { sendId, subject } = await sendTemplateEmail(base44, sendable, lead);
        const now = new Date().toISOString();

        try {
          const log = JSON.parse(lead.notesLogJson || '[]');
          log.push({
            text: `📧 ${template.label} emailed to ${lead.email}`,
            timestamp: now,
            author: sentBy || 'fronter',
            type: 'marketing',
          });
          await base44.asServiceRole.entities.FronterLead.update(lead.id, { notesLogJson: JSON.stringify(log) });
        } catch {}

        await base44.asServiceRole.entities.EmailLog.create({
          leadId: lead.id,
          toEmail: lead.email,
          toName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
          subject,
          templateId: template.id,
          status: 'sent',
          sentAt: now,
          sentBy: sentBy || 'fronter',
          isCustomEmail: true,
          fromEmail: 'gmail',
        }).catch(() => {});

        sent.push({ leadId: lead.id, email: lead.email, sendId });
      } catch (e) {
        failed.push({ leadId, error: (e as Error).message });
      }
    }

    return Response.json({ success: true, templateName: template.label, sent, failed });
  } catch (error) {
    console.error('[sendFronterMarketingEmail] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}