import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY        = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET     = Deno.env.get('MAILJET_API_SECRET');
const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const MJ_FROM_NAME  = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';
const TEMPLATE_ID   = 7949342;
const INVESTORS_SITE = 'https://investors.rosieai.tech';
const CONSUMER_SITE  = 'https://www.rosieai.tech';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { leadId, toEmail, toName, firstName, customVariables } = await req.json();
  if (!toEmail || !leadId) return Response.json({ error: 'Missing toEmail or leadId' }, { status: 400 });

  // ── Build username: firstname + last4 of phone ──────────────────────
  let phoneDigits = '0000';
  let leadData = null;
  try {
    const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
    leadData = leads?.[0];
    phoneDigits = (leadData?.phone || '').replace(/\D/g, '').slice(-4) || '0000';
  } catch {}
  const nameSlug = (firstName || 'user').toLowerCase().replace(/[^a-z]/g, '');
  const username = `${nameSlug}${phoneDigits}`;

  console.log(`[sendLeadEmail] Generating username: ${username} for ${toEmail}`);

  // ── Save username on lead only — NO InvestorUser creation ──────────
  // InvestorUser is only created when admin clicks "🔐 Portal Access"
  // The username stored here is just for tracking and the investor site access code
  try {
    await base44.asServiceRole.entities.Lead.update(leadId, { portalPasscode: username });
    console.log(`[sendLeadEmail] portalPasscode saved on lead: ${username}`);
  } catch (e) {
    console.warn('[sendLeadEmail] Could not save portalPasscode:', e.message);
  }

  // ── Build URLs ────────────────────────────────────────────────────────
  // login_url = investor INFO site with personal access code (NOT the portal)
  const loginUrl    = `${INVESTORS_SITE}/?code=${encodeURIComponent(username)}`;
  const consumerUrl = `${CONSUMER_SITE}?ref=${username}`;

  const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);

  const payload = {
    Messages: [{
      From: { Email: MJ_FROM_EMAIL, Name: MJ_FROM_NAME },
      To: [{ Email: toEmail, Name: toName || firstName || '' }],
      TemplateID: TEMPLATE_ID,
      TemplateLanguage: true,
      Variables: {
        firstname:      firstName || '',
        username:       username,
        passcode:       username,
        login_url:      loginUrl,
        consumer_url:   consumerUrl,
        portal_url:     INVESTORS_SITE,
        ...(customVariables || {}),
      },
      CustomID: leadId,
    }]
  };

  const res = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || data.Messages?.[0]?.Status !== 'success') {
    return Response.json({ error: 'Mailjet send failed', details: data }, { status: 500 });
  }

  const msgInfo    = data.Messages[0];
  const messageId  = String(msgInfo.To?.[0]?.MessageID || '');
  const messageUUID = msgInfo.To?.[0]?.MessageUUID || '';

  // Log to EmailLog
  await base44.asServiceRole.entities.EmailLog.create({
    leadId, toEmail,
    toName: toName || firstName || '',
    templateId: String(TEMPLATE_ID),
    messageId, messageUUID,
    status: 'sent',
    sentAt: new Date().toISOString(),
    sentBy: 'admin',
  }).catch(() => {});

  // Update lead score
  try {
    const lead = leadData || (await base44.asServiceRole.entities.Lead.filter({ id: leadId }))?.[0];
    if (lead) {
      await base44.asServiceRole.entities.Lead.update(leadId, {
        engagementScore: (lead.engagementScore || 0) + 5,
      });
      await base44.asServiceRole.entities.LeadHistory.create({
        leadId, type: 'note',
        content: `📧 Email sent. Username: ${username}. Consumer link: ${consumerUrl}. +5 engagement.`,
      });
    }
  } catch {}

  return Response.json({ success: true, messageId, messageUUID, username, loginUrl });
});