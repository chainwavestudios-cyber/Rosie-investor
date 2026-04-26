import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY        = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET     = Deno.env.get('MAILJET_API_SECRET');
const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const MJ_FROM_NAME  = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';
const INTRO_TEMPLATE_ID = 7961149;
const INVESTORS_SITE = 'https://investors.rosieai.tech';
const CONSUMER_SITE  = 'https://www.rosieai.tech';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { leadIds } = await req.json();
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return Response.json({ error: 'Missing leadIds array' }, { status: 400 });
  }
  if (leadIds.length > 10) {
    return Response.json({ error: 'Maximum 10 leads per batch' }, { status: 400 });
  }

  const results = [];

  for (const leadId of leadIds) {
    try {
      // Fetch lead data
      const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
      const lead = leads?.[0];
      if (!lead) { results.push({ leadId, success: false, error: 'Lead not found' }); continue; }
      if (!lead.email) { results.push({ leadId, success: false, error: 'No email address' }); continue; }

      const firstName   = lead.firstName || '';
      const lastName    = lead.lastName  || '';
      const toEmail     = lead.email.toLowerCase().trim();
      const toName      = `${firstName} ${lastName}`.trim();
      const state       = lead.state || '';

      // Build username for tracking
      const nameSlug    = firstName.toLowerCase().replace(/[^a-z]/g, '');
      const phoneDigits = (lead.phone || '').replace(/\D/g, '').slice(-4) || '0000';
      const username    = `${nameSlug}${phoneDigits}`;
      const lastNameSlug = lastName.toLowerCase().replace(/[^a-z]/g, '');
      const password    = `${lastNameSlug}#2026`;

      // Create/update InvestorUser for tracking
      try {
        const hashRes = await fetch(
          `${INVESTORS_SITE}/api/apps/69cd2741578c9b5ce655395b/functions/hashPassword`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hash', password }) }
        );
        const hashData  = await hashRes.json();
        const hashedPassword = hashData?.hash || password;

        const existing = await base44.asServiceRole.entities.InvestorUser.filter({ username });
        if (existing?.length > 0) {
          await base44.asServiceRole.entities.InvestorUser.update(existing[0].id, {
            email: toEmail, name: toName, password: hashedPassword, leadId,
          });
        } else {
          await base44.asServiceRole.entities.InvestorUser.create({
            username, email: toEmail, name: toName, password: hashedPassword,
            role: 'investor', status: 'prospect', siteAccess: 'info_only', leadId,
          });
        }
        // Save username on lead
        await base44.asServiceRole.entities.Lead.update(leadId, { portalPasscode: username });
      } catch (e) {
        console.warn(`[sendIntroEmail] Could not create InvestorUser for ${leadId}:`, e.message);
      }

      // Build tracking URLs
      const loginUrl    = `${INVESTORS_SITE}/portal-login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      const consumerUrl = `${CONSUMER_SITE}?ref=${username}`;

      const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);

      const payload = {
        Messages: [{
          From: { Email: MJ_FROM_EMAIL, Name: MJ_FROM_NAME },
          To: [{ Email: toEmail, Name: toName }],
          TemplateID: INTRO_TEMPLATE_ID,
          TemplateLanguage: true,
          Variables: {
            firstname:    firstName,
            state:        state,
            username,
            passcode:     username,
            login_url:    loginUrl,
            consumer_url: consumerUrl,
            portal_url:   INVESTORS_SITE,
          },
          CustomID: `${leadId}:intro`,  // prefix so webhook can identify as intro email
        }]
      };

      const res = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.Messages?.[0]?.Status !== 'success') {
        results.push({ leadId, success: false, error: 'Mailjet send failed' });
        continue;
      }

      const msgInfo     = data.Messages[0];
      const messageId   = String(msgInfo.To?.[0]?.MessageID || '');
      const messageUUID = msgInfo.To?.[0]?.MessageUUID || '';

      // Log to EmailLog with isIntroEmail flag
      await base44.asServiceRole.entities.EmailLog.create({
        leadId, toEmail, toName,
        templateId: String(INTRO_TEMPLATE_ID),
        messageId, messageUUID,
        status: 'sent',
        sentAt: new Date().toISOString(),
        sentBy: 'admin',
        isIntroEmail: true,
      }).catch(() => {});

      // Tag lead as intro_email_sent and update score (+5 pts for email sent)
      await base44.asServiceRole.entities.Lead.update(leadId, {
        status: 'intro_email_sent',
        engagementScore: (lead.engagementScore || 0) + 5,
      });

      // Log history
      await base44.asServiceRole.entities.LeadHistory.create({
        leadId, type: 'note',
        content: `📧 Intro email sent (template ${INTRO_TEMPLATE_ID}). State: ${state || 'N/A'}. Username: ${username}. +5 engagement.`,
      }).catch(() => {});

      results.push({ leadId, success: true });

    } catch (e) {
      console.error(`[sendIntroEmail] ❌ Error for lead ${leadId}:`, e.message);
      results.push({ leadId, success: false, error: e.message });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  return Response.json({ success: true, sent: succeeded, total: leadIds.length, results });
});