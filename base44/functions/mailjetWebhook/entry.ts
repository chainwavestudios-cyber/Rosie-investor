import { createClient } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  let events = [];
  try {
    let body = await req.json();
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
    events = Array.isArray(body) ? body : [body];
  } catch { return new Response('OK', { status: 200 }); }

  console.log(`[Mailjet] Received ${events.length} event(s):`, JSON.stringify(events[0] || {}));

  const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID') || '',
    serviceToken: Deno.env.get('BASE44_SERVICE_TOKEN') || '',
  });

  // Process in background — respond immediately so Mailjet doesn't timeout
  (async () => {
    for (const evt of events) {
      const { event, email, MessageID, CustomID, url, time } = evt;
      console.log(`[Mailjet] Processing: event=${event} CustomID=${CustomID} email=${email}`);

      if (!CustomID) { console.log('[Mailjet] No CustomID — skipping'); continue; }

      // CustomID format: "leadId:intro", "leadId:nbtech", or just "leadId"
      const customParts = (CustomID || '').split(':');
      const leadId      = customParts[0];
      const emailType   = customParts[1] || '';
      const isIntroEmail = emailType === 'intro';
      const messageId = String(MessageID || '');
      const eventTime = time ? new Date(parseInt(time) * 1000).toISOString() : new Date().toISOString();

      try {
        const sr = base44.asServiceRole;

        // ── Update EmailLog ───────────────────────────────────────────────
        const logs = await sr.entities.EmailLog.filter({ leadId });
        const log  = logs.find(l => l.messageId === messageId) || logs[logs.length - 1];

        // ── Find Lead ─────────────────────────────────────────────────────
        const leads = await sr.entities.Lead.filter({ id: leadId });
        const lead  = leads[0];

        // ── Find InvestorUser if lead was migrated ────────────────────────
        let investorUser = null;
        if (lead?.convertedToInvestorUserId) {
          const ius = await sr.entities.InvestorUser.filter({ id: lead.convertedToInvestorUserId });
          investorUser = ius[0] || null;
        }

        const writeInvestorNote = async (content, type = 'email') => {
          if (!investorUser) return;
          await sr.entities.ContactNote.create({
            investorId:    investorUser.id,
            investorEmail: investorUser.email,
            type,
            content,
            createdAt:     eventTime,
            createdBy:     'mailjet_webhook',
          });
          await sr.entities.InvestorUser.update(investorUser.id, { lastActivityAt: eventTime });
        };

        // ── Handle each event type ────────────────────────────────────────
        if (event === 'open') {
          if (log) await sr.entities.EmailLog.update(log.id, { status: 'opened', openedAt: eventTime });

          if (lead) {
            const updates = { engagementScore: (lead.engagementScore || 0) + 10 };
            if (!lead.badgeEmailOpened) updates.badgeEmailOpened = true;
            if (isIntroEmail && lead.status !== 'opened_intro_email') {
              updates.status = 'opened_intro_email';
              updates.badgeIntroEmailOpened = true;
            }
            await sr.entities.Lead.update(leadId, updates);
            const historyContent = isIntroEmail
              ? `📬 Intro email opened (Mailjet webhook). +10 engagement points.`
              : `📬 Email opened (Mailjet webhook). +10 engagement points.`;
            await sr.entities.LeadHistory.create({
              leadId, type: 'note', content: historyContent, createdBy: 'mailjet_webhook',
            });
          }

          await writeInvestorNote(`📬 Email opened · ${eventTime ? new Date(eventTime).toLocaleString() : ''}`);
          console.log(`[Mailjet] ✅ Open recorded for lead ${leadId}`);

        } else if (event === 'click') {
          if (log) await sr.entities.EmailLog.update(log.id, { status: 'clicked', clickedAt: eventTime, clickedUrl: url || '' });

          if (lead) {
            const updates = {};
            const lowerUrl = (url || '').toLowerCase();
            if (!lead.badgeConsumerWebsite && (lowerUrl.includes('consumer') || lowerUrl.includes('www.'))) updates.badgeConsumerWebsite = true;
            if (!lead.badgeInvestorPage && (lowerUrl.includes('investor') || lowerUrl.includes('portal'))) updates.badgeInvestorPage = true;
            if (Object.keys(updates).length > 0) await sr.entities.Lead.update(leadId, updates);
            await sr.entities.Lead.update(leadId, { engagementScore: (lead.engagementScore || 0) + 5 });
            await sr.entities.LeadHistory.create({
              leadId, type: 'note',
              content: `🔗 Email link clicked: ${url || 'unknown'}. +5 engagement points.`,
              createdBy: 'mailjet_webhook',
            });
          }

          await writeInvestorNote(`🔗 Email link clicked: ${url || 'unknown'}`);
          console.log(`[Mailjet] ✅ Click recorded for lead ${leadId}`);

        } else if (event === 'sent') {
          if (log) await sr.entities.EmailLog.update(log.id, { status: 'delivered' });
          console.log(`[Mailjet] ✅ Delivered for lead ${leadId}`);

        } else if (event === 'bounce') {
          if (log) await sr.entities.EmailLog.update(log.id, { status: 'bounced' });
          await writeInvestorNote(`⚠️ Email bounced — delivery failed`, 'note');
          console.log(`[Mailjet] ✅ Bounced for lead ${leadId}`);

        } else if (event === 'spam') {
          if (log) await sr.entities.EmailLog.update(log.id, { status: 'spam' });
          await writeInvestorNote(`🚫 Email marked as spam`, 'note');
          console.log(`[Mailjet] ✅ Spam for lead ${leadId}`);
        }

      } catch (e: any) {
        console.error(`[Mailjet] ❌ Error processing ${event} for ${leadId}:`, e.message);
      }
    }
  })();

  return new Response('OK', { status: 200 });
});