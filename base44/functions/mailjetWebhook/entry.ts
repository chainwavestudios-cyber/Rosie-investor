import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  let events = [];
  try {
    let body = await req.json();
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
    events = Array.isArray(body) ? body : [body];
  } catch { return new Response('OK', { status: 200 }); }

  console.log(`[Mailjet] Received ${events.length} event(s):`, JSON.stringify(events[0] || {}));

  const base44 = createClientFromRequest(req);

  // Process in background — respond immediately so Mailjet doesn't timeout
  (async () => {
    for (const evt of events) {
      const { event, email, MessageID, CustomID, url, time } = evt;
      console.log(`[Mailjet] Processing: event=${event} CustomID=${CustomID} email=${email}`);

      if (!CustomID) { console.log('[Mailjet] No CustomID — skipping'); continue; }

      const leadId    = CustomID;
      const messageId = String(MessageID || '');
      const eventTime = time ? new Date(time * 1000).toISOString() : new Date().toISOString();

      try {
        // ── Update EmailLog ───────────────────────────────────────────────
        const logs = await base44.asServiceRole.entities.EmailLog.filter({ leadId });
        const log  = logs.find((l: any) => l.messageId === messageId) || logs[logs.length - 1];

        // ── Find Lead ─────────────────────────────────────────────────────
        const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
        const lead  = leads[0];

        // ── Find InvestorUser if lead was migrated ────────────────────────
        let investorUser: any = null;
        if (lead?.convertedToInvestorUserId) {
          const ius = await base44.asServiceRole.entities.InvestorUser.filter({ id: lead.convertedToInvestorUserId });
          investorUser = ius[0] || null;
        }

        const writeInvestorNote = async (content: string, type = 'email') => {
          if (!investorUser) return;
          await base44.asServiceRole.entities.ContactNote.create({
            investorId:    investorUser.id,
            investorEmail: investorUser.email,
            type,
            content,
            createdAt:     eventTime,
            createdBy:     'mailjet_webhook',
          });
          // Stamp lastActivityAt so tabs can highlight
          await base44.asServiceRole.entities.InvestorUser.update(investorUser.id, {
            lastActivityAt: eventTime,
          });
        };

        // ── Handle each event type ────────────────────────────────────────
        if (event === 'open') {
          if (log) await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'opened', openedAt: eventTime });

          if (lead && !lead.badgeEmailOpened) {
            await base44.asServiceRole.entities.Lead.update(leadId, {
              badgeEmailOpened: true,
              engagementScore:  (lead.engagementScore || 0) + 10,
            });
            await base44.asServiceRole.entities.LeadHistory.create({
              leadId, type: 'note',
              content: `📬 Email opened (Mailjet webhook). +10 engagement points.`,
            });
          }

          // Also write to InvestorUser history if migrated
          await writeInvestorNote(`📬 Email opened · ${eventTime ? new Date(eventTime).toLocaleString() : ''}`);
          console.log(`[Mailjet] ✅ Open recorded for lead ${leadId}`);

        } else if (event === 'click') {
          if (log) await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'clicked', clickedAt: eventTime, clickedUrl: url || '' });

          if (lead) {
            const updates: any = {};
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

          await writeInvestorNote(`🔗 Email link clicked: ${url || 'unknown'}`);
          console.log(`[Mailjet] ✅ Click recorded for lead ${leadId}`);

        } else if (event === 'sent') {
          if (log) await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'delivered' });
          console.log(`[Mailjet] ✅ Delivered for lead ${leadId}`);

        } else if (event === 'bounce') {
          if (log) await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'bounced' });
          await writeInvestorNote(`⚠️ Email bounced — delivery failed`, 'note');
          console.log(`[Mailjet] ✅ Bounced for lead ${leadId}`);

        } else if (event === 'spam') {
          if (log) await base44.asServiceRole.entities.EmailLog.update(log.id, { status: 'spam' });
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