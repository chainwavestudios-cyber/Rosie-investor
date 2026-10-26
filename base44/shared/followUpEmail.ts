/**
 * followUpEmail.ts — the one place the automatic follow-up email is sent from.
 *
 * Two callers share it: processEmailTrackingEvent, the moment a click completes
 * the 2-of-3 condition, and sendQueuedFollowUps, which releases the follow-ups
 * that qualified before their eight business hours had passed.
 */
import { sendTrackedEmail } from './emailMessageEngine.ts';
import { fillMergeTags } from './mergeTags.ts';

export async function sendFollowUpEmail(base44: any, lead: any, noteText?: string) {
  const raw = await base44.asServiceRole.entities.FronterEmailTemplate.filter(
    { label: { $regex: 'follow', $options: 'i' } },
    'sortOrder',
    10
  );
  const templates = Array.isArray(raw) ? raw : (raw?.items || []);
  const template = templates[0];
  if (!template) throw new Error('No follow-up email template found');
  if (template.enabled === false) throw new Error('Follow-up template is disabled');

  // {{FirstName}} and {{firstName}} both resolve.
  const vars = { firstName: lead.firstName || '', email: lead.email || '' };
  const subject = fillMergeTags(template.subject || '', vars);
  const html = fillMergeTags(template.body || '', vars);

  // One tracked send through the shared engine — the follow-up's opens and clicks
  // land on this contact's Email Activity timeline like every other email.
  const sent = await sendTrackedEmail(base44, {
    to: lead.email,
    subject,
    html,
    contactId: lead.id,
    contactKind: 'fronter_lead',
    contactName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
    templateId: template.id,
    templateName: template.name,
    sentBy: 'auto_followup',
    source: 'automation',
  });

  const now = new Date().toISOString();
  await base44.asServiceRole.entities.FronterLead.update(lead.id, {
    followUpEmailSentAt: now,
    followUpSendId: sent.sendId,
    // Sent is out of the queue: no later tick may pick it up again.
    followUpQueued: false,
  });

  // Add to notes log
  try {
    const log = JSON.parse(lead.notesLogJson || '[]');
    log.push({
      text: noteText || `📨 Auto follow-up email sent to ${lead.email} (opened email + clicked 2/3 links)`,
      timestamp: now,
      author: 'auto_followup',
      type: 'followup',
    });
    await base44.asServiceRole.entities.FronterLead.update(lead.id, { notesLogJson: JSON.stringify(log) });
  } catch {}

  await base44.asServiceRole.entities.EmailLog.create({
    leadId: lead.id,
    toEmail: lead.email,
    subject,
    templateId: 'follow_up',
    status: 'sent',
    sentAt: now,
    sentBy: 'auto_followup',
    isCustomEmail: true,
    fromEmail: 'gmail',
  }).catch(() => {});

  return sent;
}