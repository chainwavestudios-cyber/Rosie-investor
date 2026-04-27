import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY        = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET     = Deno.env.get('MAILJET_API_SECRET');
const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const MJ_FROM_NAME  = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';
const INTRO_TEMPLATE_ID = 7961149;
const INVESTORS_SITE = 'https://investors.rosieai.tech';
const CONSUMER_SITE  = 'https://www.rosieai.tech';

Deno.serve(async (req) => {
  // Guard: check env vars first so we fail fast with a clear error
  if (!MJ_KEY || !MJ_SECRET || !MJ_FROM_EMAIL) {
    console.error('[sendIntroEmail] ❌ Missing Mailjet env vars:', { MJ_KEY: !!MJ_KEY, MJ_SECRET: !!MJ_SECRET, MJ_FROM_EMAIL });
    return Response.json({ error: 'Mailjet credentials not configured (MAILJET_API_KEY, MAILJET_API_SECRET, MAILJET_FROM_EMAIL)' }, { status: 500 });
  }

  const base44 = createClientFromRequest(req);
  const { leadIds } = await req.json();

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0)
    return Response.json({ error: 'Missing leadIds array' }, { status: 400 });
  if (leadIds.length > 10)
    return Response.json({ error: 'Maximum 10 leads per batch' }, { status: 400 });

  const results = [];

  for (const leadId of leadIds) {
    try {
      // Fetch lead
      const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
      const lead  = leads?.[0];
      if (!lead)         { results.push({ leadId, success: false, error: 'Lead not found' }); continue; }
      if (!lead.email)   { results.push({ leadId, success: false, error: 'No email address' }); continue; }

      const firstName    = lead.firstName || '';
      const lastName     = lead.lastName  || '';
      const toEmail      = lead.email.toLowerCase().trim();
      const toName       = `${firstName} ${lastName}`.trim();
      const state        = lead.state || '';

      // Build username
      const nameSlug     = firstName.toLowerCase().replace(/[^a-z]/g, '');
      const phoneDigits  = (lead.phone || '').replace(/\D/g, '').slice(-4) || '0000';
      const username     = `${nameSlug}${phoneDigits}`;
      const lastNameSlug = lastName.toLowerCase().replace(/[^a-z]/g, '');
      const password     = `${lastNameSlug}#2026`;

      console.log(`[sendIntroEmail] Processing lead ${leadId}: ${toName} <${toEmail}>`);

      // Save the username as portalPasscode on the lead (for tracking URLs only)
      await base44.asServiceRole.entities.Lead.update(leadId, { portalPasscode: username }).catch(e =>
        console.warn(`[sendIntroEmail] portalPasscode update warning for ${leadId}:`, e.message)
      );

      // Build URLs — login_url goes to investor INFO site, not portal
      const loginUrl    = `${INVESTORS_SITE}/?code=${encodeURIComponent(username)}`;
      const consumerUrl = `${CONSUMER_SITE}?ref=${username}`;

      const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);

      const payload = {
        Messages: [{
          From:            { Email: MJ_FROM_EMAIL, Name: MJ_FROM_NAME },
          To:              [{ Email: toEmail, Name: toName }],
          TemplateID:      INTRO_TEMPLATE_ID,
          TemplateLanguage: true,
          Variables: {
            firstname:    firstName,
            first_name:   firstName,   // try both naming conventions
            lastname:     lastName,
            last_name:    lastName,
            state,
            username,
            passcode:     username,
            login_url:    loginUrl,
            consumer_url: consumerUrl,
            portal_url:   INVESTORS_SITE,
          },
          CustomID: `${leadId}:intro`,
        }],
      };

      console.log(`[sendIntroEmail] Sending to ${toEmail} via Mailjet template ${INTRO_TEMPLATE_ID}`);

      const res  = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // Log full Mailjet response for debugging
      console.log(`[sendIntroEmail] Mailjet response for ${toEmail}:`, JSON.stringify(data));

      const msgStatus = data.Messages?.[0]?.Status;
      const errors    = data.Messages?.[0]?.Errors;

      if (!res.ok || msgStatus !== 'success') {
        const errDetail = errors ? JSON.stringify(errors) : (data.ErrorMessage || data.Message || 'Unknown Mailjet error');
        console.error(`[sendIntroEmail] ❌ Mailjet rejected send to ${toEmail}: ${errDetail}`);
        results.push({ leadId, success: false, error: `Mailjet: ${errDetail}` });
        continue;
      }

      const msgInfo     = data.Messages[0];
      const messageId   = String(msgInfo.To?.[0]?.MessageID || '');
      const messageUUID = msgInfo.To?.[0]?.MessageUUID || '';

      console.log(`[sendIntroEmail] ✅ Delivered to ${toEmail} — MessageID: ${messageId}`);

      // Log to EmailLog
      await base44.asServiceRole.entities.EmailLog.create({
        leadId, toEmail, toName,
        templateId:   String(INTRO_TEMPLATE_ID),
        messageId, messageUUID,
        status:       'sent',
        sentAt:       new Date().toISOString(),
        sentBy:       'admin',
        isIntroEmail: true,
      }).catch(e => console.warn('[sendIntroEmail] EmailLog create failed:', e.message));

      // Update lead status and score
      await base44.asServiceRole.entities.Lead.update(leadId, {
        status:          'intro_email_sent',
        engagementScore: (lead.engagementScore || 0) + 5,
      });

      // Log history
      await base44.asServiceRole.entities.LeadHistory.create({
        leadId, type: 'note',
        content: `📧 Intro email sent (template ${INTRO_TEMPLATE_ID}). State: ${state || 'N/A'}. Username: ${username}. MessageID: ${messageId}. +5 engagement.`,
      }).catch(() => {});

      results.push({ leadId, success: true, messageId });

    } catch (e) {
      console.error(`[sendIntroEmail] ❌ Unexpected error for lead ${leadId}:`, e.message);
      results.push({ leadId, success: false, error: e.message });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  console.log(`[sendIntroEmail] Batch complete: ${succeeded}/${leadIds.length} sent`);
  return Response.json({ success: true, sent: succeeded, total: leadIds.length, results });
});