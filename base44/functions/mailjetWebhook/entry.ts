import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  let events = [];
  try {
    const body = await req.json();
    events = Array.isArray(body) ? body : [body];
  } catch {
    return new Response('OK', { status: 200 });
  }

  console.log(`[Mailjet] Received ${events.length} event(s)`);
  console.log(`[Mailjet] First event:`, JSON.stringify(events[0] || {}));

  const base44 = createClientFromRequest(req);

  for (const evt of events) {
    const { event, email, MessageID, CustomID, url, time } = evt;
    console.log(`[Mailjet] Processing: event=${event} CustomID=${CustomID} email=${email}`);

    if (!CustomID) {
      console.log('[Mailjet] No CustomID — skipping');
      continue;
    }

    const leadId = CustomID;
    const messageId = String(MessageID || '');
    const eventTime = time ? new Date(time * 1000).toISOString() : new Date().toISOString();

    try {
      console.log(`[Mailjet] Fetching EmailLog for leadId=${leadId}`);
      const logs = await base44.asServiceRole.entities.EmailLog.filter({ leadId });
      console.log(`[Mailjet] Found ${logs.length} email log(s)`);
      const log = logs.find(l => l.messageId === messageId) || logs[logs.length - 1];

      if (event === 'open') {
        if (log) {
          console.log(`[Mailjet] Updating EmailLog ${log.id} to opened`);
          await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'opened', openedAt: eventTime });
        }
        const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
        const lead = leads[0];
        if (lead && !lead.badgeEmailOpened) {
          await base44.asServiceRole.entities.Lead.update(leadId, {
            badgeEmailOpened: true,
            engagementScore: (lead.engagementScore || 0) + 10,
          });
          await base44.asServiceRole.entities.LeadHistory.create({
            leadId, type: 'note',
            content: `📬 Email opened (verified via Mailjet). +10 engagement points.`,
          });
        }
        console.log(`[Mailjet] ✅ Open recorded for lead ${leadId}`);

      } else if (event === 'click') {
        if (log) await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'clicked', clickedAt: eventTime, clickedUrl: url || '' });
        const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
        const lead = leads[0];
        if (lead) {
          const updates = {};
          const lowerUrl = (url || '').toLowerCase();
          if (!lead.badgeConsumerWebsite && (lowerUrl.includes('consumer') || lowerUrl.includes('www.'))) updates.badgeConsumerWebsite = true;
          if (!lead.badgeInvestorPage && (lowerUrl.includes('investor') || lowerUrl.includes('portal'))) updates.badgeInvestorPage = true;
          if (Object.keys(updates).length > 0) await base44.asServiceRole.entities.Lead.update(leadId, updates);
          await base44.asServiceRole.entities.Lead.update(leadId, { engagementScore: (lead.engagementScore || 0) + 5 });
          await base44.asServiceRole.entities.LeadHistory.create({
            leadId, type: 'note',
            content: `🔗 Email link clicked: ${url || 'unknown'}. +5 engagement points.`,
          });
        }
        console.log(`[Mailjet] ✅ Click recorded for lead ${leadId}`);

      } else if (event === 'sent') {
        if (log) await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'delivered' });
      } else if (event === 'bounce') {
        if (log) await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'bounced' });
      } else if (event === 'spam') {
        if (log) await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'spam' });
      }

    } catch (e) {
      console.error(`[Mailjet] ❌ Error processing ${event} for ${leadId}:`, e.message);
    }
  }

  return new Response('OK', { status: 200 });
});