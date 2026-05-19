/**
 * sendNbtechEmail
 * Sends Mailjet template #8032819 to a list of leads.
 * Sets badgeNbtechEmail = true on each lead after sending.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY    = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET = Deno.env.get('MAILJET_API_SECRET');
const FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const FROM_NAME  = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';
const TEMPLATE_ID = 8032819;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { leadIds, sentBy } = await req.json();
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return Response.json({ error: 'leadIds array required' }, { status: 400 });
  }

  const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);
  const results = [];

  for (const leadId of leadIds) {
    let lead;
    try {
      const found = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
      lead = found?.[0];
    } catch {}

    if (!lead || !lead.email) {
      results.push({ leadId, success: false, error: 'Lead not found or no email' });
      continue;
    }

    try {
      const payload = {
        Messages: [{
          From: { Email: FROM_EMAIL, Name: FROM_NAME },
          To: [{ Email: lead.email, Name: `${lead.firstName} ${lead.lastName}`.trim() }],
          TemplateID: TEMPLATE_ID,
          TemplateLanguage: true,
          Variables: {
            first_name: lead.firstName || '',
            last_name: lead.lastName || '',
            name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
            state: lead.state || '',
            email: lead.email || '',
            lead_id: leadId,
          },
          CustomID: `${leadId}:nbtech`,
        }],
      };

      const res = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const msgResult = data.Messages?.[0];

      if (msgResult?.Status === 'success') {
        // Set the badge on the lead
        await base44.asServiceRole.entities.Lead.update(leadId, { badgeNbtechEmail: true }).catch(() => {});
        // Log to lead history
        await base44.asServiceRole.entities.LeadHistory.create({
          leadId,
          type: 'note',
          content: `📧 NB Tech email sent (template #${TEMPLATE_ID}) by ${sentBy || 'admin'}`,
          createdBy: sentBy || 'admin',
        }).catch(() => {});
        // Log to EmailLog
        await base44.asServiceRole.entities.EmailLog.create({
          leadId,
          toEmail: lead.email,
          toName: `${lead.firstName} ${lead.lastName}`.trim(),
          subject: 'NB Tech Email',
          templateId: String(TEMPLATE_ID),
          messageId: String(msgResult.To?.[0]?.MessageID || ''),
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentBy: sentBy || 'admin',
        }).catch(() => {});
        results.push({ leadId, success: true });
      } else {
        const errMsg = msgResult?.Errors?.[0]?.ErrorMessage || 'Unknown error';
        results.push({ leadId, success: false, error: errMsg });
      }
    } catch (e) {
      results.push({ leadId, success: false, error: e.message });
    }
  }

  const sent = results.filter(r => r.success).length;
  return Response.json({ sent, total: leadIds.length, results });
});