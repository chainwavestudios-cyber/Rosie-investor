/**
 * sendDebtEmail — Sends a DebtEmailTemplate to a DebtLead via Gmail with tracking.
 * Used by contact card buttons (manual sends) and Activity tab test send buttons.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sendTemplateEmail } from '../../shared/debtEmailSender.ts';
import { PROTOFACE_ID_RE, formatProtofaceId } from '../../shared/protofaceId.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { templateId, leadId, testMode, forceTemplateType } = body;

    if (!leadId) return Response.json({ error: 'leadId is required' }, { status: 400 });

    const base44 = createClientFromRequest(req);

    const lead = await base44.asServiceRole.entities.DebtLead.get(leadId);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    if (!lead.email) return Response.json({ error: 'Lead has no email address' }, { status: 400 });

    let template: any = null;
    if (templateId) {
      template = await base44.asServiceRole.entities.DebtEmailTemplate.get(templateId);
    } else if (forceTemplateType) {
      const page = await base44.asServiceRole.entities.DebtEmailTemplate.filter(
        { templateType: forceTemplateType, enabled: true },
        { sort: 'sortOrder', limit: 1 }
      );
      const items = (page as any)?.items || page || [];
      template = items[0] || null;
    }
    if (!template) return Response.json({ error: 'Template not found' }, { status: 404 });

    // The AI invitation email carries this card's video token. Mint it here so one
    // click on the card's Send AI Invite button also creates the token — no need to
    // press the AI invitation-links button first.
    if (/\{\{\s*protoface_?id\s*\}\}/i.test(String(template.bodyHtml || '')) && !PROTOFACE_ID_RE.test(String(lead.protofaceId || ''))) {
      const protofaceId = formatProtofaceId();
      await base44.asServiceRole.entities.DebtLead.update(lead.id, { protofaceId });
      lead.protofaceId = protofaceId;
    }

    const { sendId } = await sendTemplateEmail(base44, template, lead);

    // Update lead tracking fields based on template type
    const now = new Date().toISOString();
    const leadUpdates: any = {};
    if (template.templateType === 'night_before') {
      leadUpdates.nightBeforeReminderSentAt = now;
      leadUpdates.apptNightBeforeSendId = sendId;
    } else if (template.templateType === 'hour_before') {
      leadUpdates.hourBeforeReminderSentAt = now;
      leadUpdates.apptHourBeforeSendId = sendId;
    }
    if (Object.keys(leadUpdates).length > 0) {
      await base44.asServiceRole.entities.DebtLead.update(lead.id, leadUpdates);
    }

    // Log activity
    try {
      await base44.asServiceRole.entities.DebtLeadActivity.create({
        leadId: lead.id,
        leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        activityType: 'note',
        activityText: `📧 Sent email: ${template.name}${testMode ? ' (TEST)' : ''}`,
        createdBy: 'email_automation',
        metadataJson: JSON.stringify({ templateId: template.id, templateName: template.name, sendId }),
      });
    } catch {}

    return Response.json({ success: true, sendId, templateName: template.name, templateType: template.templateType, sentAt: now });
  } catch (error) {
    console.error('[sendDebtEmail] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}