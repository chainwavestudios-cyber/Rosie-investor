import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('OK', { status: 200 });

    const base44 = createClientFromRequest(req);
    const events = await req.json();
    const eventList = Array.isArray(events) ? events : [events];

    for (const evt of eventList) {
      const { event, CustomID, email, url, time } = evt;
      if (!CustomID || !CustomID.startsWith('lead_')) continue;

      const eventTime = time ? new Date(time * 1000).toISOString() : new Date().toISOString();

      // Find the email record by customId
      const emailRecords = await base44.asServiceRole.entities.LeadEmail.filter({ customId: CustomID });
      const emailRecord = emailRecords[0];
      if (!emailRecord) continue;

      const leadId = emailRecord.leadId;
      const allLeads = await base44.asServiceRole.entities.Lead.list();
      const leadRecords = allLeads.filter(l => l.id === leadId);
      const lead = leadRecords[0];

      if (event === 'open') {
        const newOpenCount = (emailRecord.openCount || 0) + 1;
        const updates = {
          status: 'opened',
          openedAt: emailRecord.openedAt || eventTime,
          openCount: newOpenCount,
        };
        await base44.asServiceRole.entities.LeadEmail.update(emailRecord.id, updates);

        // Update lead — badge + score bump on first open
        if (lead && !lead.emailOpened) {
          const newScore = (lead.score || 0) + 3;
          await base44.asServiceRole.entities.Lead.update(leadId, {
            emailOpened: true,
            score: newScore,
          });
          await base44.asServiceRole.entities.LeadHistory.create({
            leadId,
            type: 'note',
            content: `📬 Email opened: "${emailRecord.subject}" — +3 points`,
          });
        }

      } else if (event === 'click') {
        const newClickCount = (emailRecord.clickCount || 0) + 1;
        await base44.asServiceRole.entities.LeadEmail.update(emailRecord.id, {
          status: 'clicked',
          clickedAt: emailRecord.clickedAt || eventTime,
          clickedUrl: url || emailRecord.clickedUrl,
          clickCount: newClickCount,
        });

        if (lead && !lead.emailClicked) {
          const newScore = (lead.score || 0) + 5;
          await base44.asServiceRole.entities.Lead.update(leadId, {
            emailClicked: true,
            score: newScore,
          });
          await base44.asServiceRole.entities.LeadHistory.create({
            leadId,
            type: 'note',
            content: `🖱️ Link clicked in email: "${emailRecord.subject}" — +5 points`,
          });
        }

      } else if (event === 'sent') {
        await base44.asServiceRole.entities.LeadEmail.update(emailRecord.id, { status: 'delivered' });
      } else if (event === 'bounce') {
        await base44.asServiceRole.entities.LeadEmail.update(emailRecord.id, { status: 'bounced' });
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return new Response('OK', { status: 200 }); // Always return 200 to Mailjet
  }
});