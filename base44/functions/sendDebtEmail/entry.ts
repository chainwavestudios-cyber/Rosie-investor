/**
 * sendDebtEmail — Sends a DebtEmailTemplate to a DebtLead via Gmail with tracking.
 * Used by contact card buttons (manual sends) and Activity tab test send buttons.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sendTemplateEmail } from '../../shared/debtEmailSender.ts';
import { daaTemplateIssue } from '../../shared/daaEmailPolicy.ts';
import debtCoachGmailReport from '../../shared/debtCoachGmailReport.ts';
import legacyCoachEmailReport from '../../shared/legacyCoachEmailReport.ts';
import { welcomeEngagement } from '../../shared/welcomeEngagement.ts';
import { PROTOFACE_ID_RE, formatProtofaceId } from '../../shared/protofaceId.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    // Existing, deployed Debt Call Coach endpoint: use the authenticated,
    // strictly read-only Gmail reporting action rather than a new function route.
    if (body.action === 'gmailReport') return debtCoachGmailReport(base44, body);
    if (body.action === 'legacyGmailReport') return legacyCoachEmailReport(base44, body);
    if (body.action === 'welcomeEngagement') return welcomeEngagement(base44, body);
    // Test-send any DAA template to a typed address without creating or
    // modifying a lead. These are tracked Gmail tests using the real welcome
    // player, but never count as a contact-card send.
    if (body.action === 'testTemplate') {
      const tester=await base44.asServiceRole.entities.DebtCoachUser.get(String(body.sessionUserId||'')).catch(()=>null);
      if (!tester?.isActive || !body.sessionToken || tester.sessionToken !== body.sessionToken ||
        !['admin','super_admin','super_manager','manager'].includes(tester.role))
        return Response.json({error:'Only a signed-in Debt Call Coach manager may send template tests.'},{status:403});
      const testEmail=String(body.testEmail||'').trim().toLowerCase();
      if (testEmail.length>254 || /[\r\n]/.test(testEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail))
        return Response.json({error:'Enter a valid test recipient email address.'},{status:400});
      const template=await base44.asServiceRole.entities.DebtEmailTemplate.get(String(body.templateId||'')).catch(()=>null);
      const issue=daaTemplateIssue(template);
      if (issue) return Response.json({error:issue},{status:403});
      const name=String(body.testFirstName||'Test').replace(/[<>\r\n]/g,'').slice(0,60)||'Test';
      const testLead={id:'',email:testEmail,firstName:name,lastName:'',appointmentDate:null};
      const sent=await sendTemplateEmail(base44,template,testLead,{testSend:true});
      return Response.json({success:true,to:testEmail,tracked:true,sendId:sent.sendId,templateName:template.name});
    }
    const { templateId, leadId, testMode, forceTemplateType } = body;

    if (!leadId) return Response.json({ error: 'leadId is required' }, { status: 400 });

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
    const issue=daaTemplateIssue(template);
    if(issue) return Response.json({error:issue},{status:403});

    // The AI invitation email carries this card's video token. Mint it here so one
    // click on the card's Send AI Invite button also creates the token — no need to
    // press the AI invitation-links button first. The invitation's two buttons carry
    // that same token, so a body with either of those links needs it just as much.
    const needsVideoToken = /\{\{\s*protoface_?id\s*\}\}/i.test(String(template.bodyHtml || ''))
      || /\{\{\s*(rosie|chris)invitelink\s*\}\}/i.test(String(template.bodyHtml || ''));
    if (needsVideoToken && !PROTOFACE_ID_RE.test(String(lead.protofaceId || ''))) {
      const protofaceId = formatProtofaceId();
      await base44.asServiceRole.entities.DebtLead.update(lead.id, { protofaceId });
      lead.protofaceId = protofaceId;
    }

    const { sendId, duplicate } = await sendTemplateEmail(base44, template, lead);
    // An accidental repeat click reuses the earlier Gmail send. Do not write a
    // second "sent email" activity or re-stamp reminder fields for that no-op.
    if (duplicate) return Response.json({ success: true, skippedDuplicate: true, sendId, templateName: template.name });

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