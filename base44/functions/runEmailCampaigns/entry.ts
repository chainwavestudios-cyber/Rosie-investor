/**
 * runEmailCampaigns
 * Called by a scheduled automation every 5 minutes.
 * Checks all active campaigns and fires batches that are due.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY    = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET = Deno.env.get('MAILJET_API_SECRET');
const FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const FROM_NAME  = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';

async function sendNbtechBatch(base44, campaign, leadsToSend) {
  const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);
  let sentCount = 0;
  const sentIds = [];

  for (const lead of leadsToSend) {
    if (!lead || !lead.email) continue;
    try {
      const payload = {
        Messages: [{
          To: [{ Email: lead.email, Name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() }],
          TemplateID: campaign.templateId,
          TemplateLanguage: true,
          Variables: {
            firstname: lead.firstName || '',
            lastname: lead.lastName || '',
            name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
            state: lead.state || '',
            email: lead.email || '',
            lead_id: lead.id,
            request_access_url: `https://investors.rosieai.tech/request-access?email=${encodeURIComponent(lead.email)}&name=${encodeURIComponent(`${lead.firstName || ''} ${lead.lastName || ''}`.trim())}&lead_id=${encodeURIComponent(lead.id)}`,
          },
          CustomID: `${lead.id}:nbtech`,
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
        sentIds.push(lead.id);
        sentCount++;
        await base44.entities.Lead.update(lead.id, { badgeNbtechEmail: true }).catch(() => {});
        await base44.entities.LeadHistory.create({
          leadId: lead.id,
          type: 'note',
          content: `📧 NB Tech email sent via campaign "${campaign.name}" (template #${campaign.templateId})`,
          createdBy: campaign.createdBy || 'campaign',
        }).catch(() => {});
        await base44.entities.EmailLog.create({
          leadId: lead.id,
          toEmail: lead.email,
          toName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
          subject: 'NB Tech Email',
          templateId: String(campaign.templateId),
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentBy: campaign.createdBy || 'campaign',
        }).catch(() => {});
      }
    } catch (e) {
      console.error(`[runEmailCampaigns] Error sending to lead ${lead.id}:`, e.message);
    }
  }

  return { sentCount, sentIds };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req).asServiceRole;
    const now = new Date();
    const nowISO = now.toISOString();
    const currentHour = now.getUTCHours(); // Will be adjusted below per campaign timezone
    const currentDay = now.getUTCDay(); // 0=Sun

    // Use Eastern Time offset for hour checks (UTC-4 in EDT, UTC-5 in EST)
    // Simple approximation: use UTC-4 (EDT) as default
    const etOffsetHours = 4;
    const etHour = (now.getUTCHours() - etOffsetHours + 24) % 24;
    const etDay = etHour < (now.getUTCHours() - etOffsetHours < 0 ? 1 : 0) 
      ? (currentDay - 1 + 7) % 7 
      : currentDay;

    console.log(`[runEmailCampaigns] Starting. ET hour=${etHour}, day=${etDay}, time=${nowISO}`);

    // Load all active campaigns
    const campaigns = await base44.entities.EmailCampaign.filter({ status: 'active' }).catch(() => []);
    console.log(`[runEmailCampaigns] Found ${campaigns.length} active campaigns`);

    for (const campaign of campaigns) {
      try {
        // Check if campaign has expired
        if (campaign.endsAt && new Date(campaign.endsAt) < now) {
          await base44.entities.EmailCampaign.update(campaign.id, { status: 'completed' });
          console.log(`[runEmailCampaigns] Campaign "${campaign.name}" expired, marking completed`);
          continue;
        }

        // Check remaining leads
        let remainingIds = [];
        try { remainingIds = JSON.parse(campaign.leadIds || '[]'); } catch {}
        if (remainingIds.length === 0) {
          await base44.entities.EmailCampaign.update(campaign.id, { status: 'completed' });
          console.log(`[runEmailCampaigns] Campaign "${campaign.name}" has no leads left, marking completed`);
          continue;
        }

        // Check day of week
        let allowedDays = [0,1,2,3,4,5,6];
        try { allowedDays = JSON.parse(campaign.daysOfWeek || '[0,1,2,3,4,5,6]'); } catch {}
        if (!allowedDays.includes(etDay)) {
          console.log(`[runEmailCampaigns] Campaign "${campaign.name}" skipping, day ${etDay} not in schedule`);
          continue;
        }

        // Check time window
        const startH = campaign.startHour ?? 8;
        const endH = campaign.endHour ?? 17;
        if (etHour < startH || etHour >= endH) {
          console.log(`[runEmailCampaigns] Campaign "${campaign.name}" skipping, ET hour ${etHour} outside ${startH}-${endH}`);
          continue;
        }

        // Check if enough time has passed since last send
        if (campaign.nextSendAt && new Date(campaign.nextSendAt) > now) {
          console.log(`[runEmailCampaigns] Campaign "${campaign.name}" not due yet, next send at ${campaign.nextSendAt}`);
          continue;
        }

        // Determine how many to send
        const batchSize = Math.min(campaign.emailsPerSend || 2, remainingIds.length);
        const batchIds = remainingIds.slice(0, batchSize);
        const newRemainingIds = remainingIds.slice(batchSize);

        // Fetch lead records
        const leadFetches = await Promise.all(
          batchIds.map(id => base44.entities.Lead.filter({ id }).then(r => r?.[0]).catch(() => null))
        );
        const leadsToSend = leadFetches.filter(Boolean);

        console.log(`[runEmailCampaigns] Campaign "${campaign.name}" sending batch of ${leadsToSend.length} leads`);

        const { sentCount, sentIds } = await sendNbtechBatch(base44, campaign, leadsToSend);

        // Update sent lead IDs
        let sentLeadIds = [];
        try { sentLeadIds = JSON.parse(campaign.sentLeadIds || '[]'); } catch {}
        sentLeadIds = [...sentLeadIds, ...sentIds];

        // Calculate next send time
        const freqMs = (campaign.frequencyMinutes || 30) * 60 * 1000;
        const nextSend = new Date(now.getTime() + freqMs).toISOString();

        const updates = {
          leadIds: JSON.stringify(newRemainingIds),
          sentLeadIds: JSON.stringify(sentLeadIds),
          lastSentAt: nowISO,
          nextSendAt: nextSend,
          totalSent: (campaign.totalSent || 0) + sentCount,
        };

        if (newRemainingIds.length === 0) {
          updates.status = 'completed';
          console.log(`[runEmailCampaigns] Campaign "${campaign.name}" completed all leads`);
        }

        await base44.entities.EmailCampaign.update(campaign.id, updates);
        console.log(`[runEmailCampaigns] Campaign "${campaign.name}" sent ${sentCount}, ${newRemainingIds.length} remaining`);

      } catch (e) {
        console.error(`[runEmailCampaigns] Error processing campaign ${campaign.id}:`, e.message);
      }
    }

    return Response.json({ ok: true, processed: campaigns.length, time: nowISO });
  } catch (e) {
    console.error('[runEmailCampaigns] Fatal error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});