import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY        = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET     = Deno.env.get('MAILJET_API_SECRET');
const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const MJ_FROM_NAME  = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';
const PORTAL_ACCESS_TEMPLATE_ID = 7951003;
const INVESTORS_SITE = 'https://investors.rosieai.tech';
const CONSUMER_SITE  = 'https://www.rosieai.tech';

Deno.serve(async (req) => {
  if (!MJ_KEY || !MJ_SECRET || !MJ_FROM_EMAIL) {
    return Response.json({ error: 'Mailjet credentials not configured' }, { status: 500 });
  }

  const base44 = createClientFromRequest(req);
  const body = await req.json();

  // Accepts either { leadId } or { investorId }
  const { leadId, investorId } = body;

  if (!leadId && !investorId) {
    return Response.json({ error: 'Provide leadId or investorId' }, { status: 400 });
  }

  try {
    let toEmail, toName, firstName, lastName, username, password, entityId, entityType;

    if (leadId) {
      const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
      const lead = leads?.[0];
      if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
      if (!lead.email) return Response.json({ error: 'No email address on lead' }, { status: 400 });

      firstName = lead.firstName || '';
      lastName  = lead.lastName  || '';
      toEmail   = lead.email.toLowerCase().trim();
      toName    = `${firstName} ${lastName}`.trim();
      entityId  = leadId;
      entityType = 'lead';

      // Build/use existing username
      const nameSlug    = firstName.toLowerCase().replace(/[^a-z]/g, '');
      const phoneDigits = (lead.phone || '').replace(/\D/g, '').slice(-4) || '0000';
      username = lead.portalPasscode || `${nameSlug}${phoneDigits}`;
      password = `${lastName.toLowerCase().replace(/[^a-z]/g, '')}#2026`;

      // Save passcode if not already set
      if (!lead.portalPasscode) {
        await base44.asServiceRole.entities.Lead.update(leadId, { portalPasscode: username }).catch(() => {});
      }

    } else {
      const investors = await base44.asServiceRole.entities.InvestorUser.filter({ id: investorId });
      const investor = investors?.[0];
      if (!investor) return Response.json({ error: 'Investor not found' }, { status: 404 });
      if (!investor.email) return Response.json({ error: 'No email address on investor' }, { status: 400 });

      const nameParts = (investor.name || '').split(' ');
      firstName = nameParts[0] || '';
      lastName  = nameParts.slice(1).join(' ') || '';
      toEmail   = investor.email.toLowerCase().trim();
      toName    = investor.name || toEmail;
      username  = investor.username || '';
      password  = investor.username || ''; // use username as hint
      entityId  = investorId;
      entityType = 'investor';
    }

    const loginUrl    = `${INVESTORS_SITE}/portal-login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const consumerUrl = `${CONSUMER_SITE}?ref=${username}`;
    const auth        = btoa(`${MJ_KEY}:${MJ_SECRET}`);

    const payload = {
      Messages: [{
        From:             { Email: MJ_FROM_EMAIL, Name: MJ_FROM_NAME },
        To:               [{ Email: toEmail, Name: toName }],
        TemplateID:       PORTAL_ACCESS_TEMPLATE_ID,
        TemplateLanguage: true,
        Variables: {
          firstname:    firstName,
          first_name:   firstName,
          lastname:     lastName,
          last_name:    lastName,
          username,
          passcode:     username,
          password,
          login_url:    loginUrl,
          consumer_url: consumerUrl,
          portal_url:   INVESTORS_SITE,
        },
        CustomID: `${entityId}:portal_access`,
      }],
    };

    console.log(`[sendPortalAccessEmail] Sending to ${toEmail} via template ${PORTAL_ACCESS_TEMPLATE_ID}`);

    const res  = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log(`[sendPortalAccessEmail] Mailjet response:`, JSON.stringify(data));

    const msgStatus = data.Messages?.[0]?.Status;
    const errors    = data.Messages?.[0]?.Errors;

    if (!res.ok || msgStatus !== 'success') {
      const errDetail = errors ? JSON.stringify(errors) : (data.ErrorMessage || data.Message || 'Unknown Mailjet error');
      console.error(`[sendPortalAccessEmail] ❌ ${errDetail}`);
      return Response.json({ success: false, error: `Mailjet: ${errDetail}` }, { status: 500 });
    }

    const msgInfo     = data.Messages[0];
    const messageId   = String(msgInfo.To?.[0]?.MessageID || '');
    const messageUUID = msgInfo.To?.[0]?.MessageUUID || '';

    // Log to EmailLog
    await base44.asServiceRole.entities.EmailLog.create({
      leadId:      entityType === 'lead' ? entityId : null,
      investorId:  entityType === 'investor' ? entityId : null,
      toEmail, toName,
      templateId:   String(PORTAL_ACCESS_TEMPLATE_ID),
      messageId, messageUUID,
      status:       'sent',
      sentAt:       new Date().toISOString(),
      sentBy:       'admin',
    }).catch(e => console.warn('[sendPortalAccessEmail] EmailLog failed:', e.message));

    // Log to history if lead
    if (entityType === 'lead') {
      await base44.asServiceRole.entities.LeadHistory.create({
        leadId: entityId, type: 'note',
        content: `🔑 Portal access email sent (template ${PORTAL_ACCESS_TEMPLATE_ID}). MessageID: ${messageId}.`,
      }).catch(() => {});
    }

    console.log(`[sendPortalAccessEmail] ✅ Sent to ${toEmail} — MessageID: ${messageId}`);
    return Response.json({ success: true, messageId });

  } catch (e) {
    console.error(`[sendPortalAccessEmail] ❌ Unexpected error:`, e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});