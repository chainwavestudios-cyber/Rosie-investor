import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  // Mailjet sends POST with array of events
  let events = [];
  try {
    const body = await req.json();
    events = Array.isArray(body) ? body : [body];
  } catch {
    return new Response('OK', { status: 200 });
  }

  const base44 = createClientFromRequest(req);

  for (const evt of events) {
    const { event, email, MessageID, CustomID, url, time } = evt;
    if (!CustomID) continue; // CustomID = leadId

    const leadId = CustomID;
    const messageId = String(MessageID || '');
    const eventTime = time ? new Date(time * 1000).toISOString() : new Date().toISOString();

    try {
      // Find the EmailLog by messageId or leadId
      const logs = await base44.asServiceRole.entities.EmailLog.filter({ leadId });
      const log = logs.find(l => l.messageId === messageId) || logs[logs.length - 1];

      if (event === 'open') {
        if (log) {
          await base44.asServiceRole.entities.EmailLog.update(log.id, {
            status: 'opened',
            openedAt: eventTime,
          });
        }

        // Fetch lead and award points + badge (only once)
        const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
        const lead = leads[0];
        if (lead && !lead.badgeEmailOpened) {
          const currentScore = lead.engagementScore || 0;
          await base44.asServiceRole.entities.Lead.update(leadId, {
            badgeEmailOpened: true,
            engagementScore: currentScore + 10,
          });
          await base44.asServiceRole.entities.LeadHistory.create({
            leadId,
            type: 'note',
            content: `📬 Email opened (verified via Mailjet webhook). +10 engagement points.`,
          });
        }

      } else if (event === 'click') {
        if (log) {
          await base44.asServiceRole.entities.EmailLog.update(log.id, {
            status: 'clicked',
            clickedAt: eventTime,
            clickedUrl: url || '',
          });
        }

        // Check if clicked URL suggests consumer or investor page
        const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
        const lead = leads[0];
        if (lead) {
          const updates = {};
          const lowerUrl = (url || '').toLowerCase();
          if (!lead.badgeConsumerWebsite && lowerUrl.includes('consumer') || lowerUrl.includes('www.')) {
            updates.badgeConsumerWebsite = true;
          }
          if (!lead.badgeInvestorPage && (lowerUrl.includes('investor') || lowerUrl.includes('portal') || lowerUrl.includes('/portal'))) {
            updates.badgeInvestorPage = true;
          }
          if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.Lead.update(leadId, updates);
          }
          // +5 for click
          await base44.asServiceRole.entities.Lead.update(leadId, {
            engagementScore: (lead.engagementScore || 0) + 5,
          });
          await base44.asServiceRole.entities.LeadHistory.create({
            leadId,
            type: 'note',
            content: `🔗 Email link clicked: ${url || 'unknown'}. +5 engagement points.`,
          });
        }

      } else if (event === 'sent') {
        if (log) {
          await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'delivered' });
        }
      } else if (event === 'bounce') {
        if (log) {
          await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'bounced' });
        }
      } else if (event === 'spam') {
        if (log) {
          await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'spam' });
        }
      }
    } catch (e) {
      console.error('Webhook error for event', event, e.message);
    }
  }

  return new Response('OK', { status: 200 });
});