import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY        = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET     = Deno.env.get('MAILJET_API_SECRET');
const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const MJ_FROM_NAME  = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';
const TEMPLATE_ID   = 7951003;
const PORTAL_URL    = 'https://investors.rosieai.tech';

Deno.serve(async (req) => {
  if (!MJ_KEY || !MJ_SECRET || !MJ_FROM_EMAIL) {
    return Response.json({ error: 'Mailjet credentials not configured' }, { status: 500 });
  }

  const base44 = createClientFromRequest(req);
  const { leadId, investorId, toEmail, toName, firstName, username, password, loginUrl } = await req.json();

  if (!toEmail || !username) {
    return Response.json({ error: 'Missing toEmail or username' }, { status: 400 });
  }

  // Build auto-login URL for portal (username + password pre-filled)
  const portalLoginUrl = loginUrl || `${PORTAL_URL}/portal-login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password || '')}`;

  console.log(`[sendPortalAccessEmail] Sending to ${toEmail} username: ${username}`);

  const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);

  const payload = {
    Messages: [{
      From: { Email: MJ_FROM_EMAIL, Name: MJ_FROM_NAME },
      To:   [{ Email: toEmail, Name: toName || firstName || '' }],
      TemplateID: TEMPLATE_ID,
      TemplateLanguage: true,
      Variables: {
        firstname:  firstName || toName?.split(' ')[0] || '',
        username,
        passcode:   password || '',
        login_url:  portalLoginUrl,
        portal_url: PORTAL_URL,
      },
      CustomID: leadId || investorId || '',
    }],
  };

  const res  = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log(`[sendPortalAccessEmail] Mailjet response:`, JSON.stringify(data));

  const msgStatus = data.Messages?.[0]?.Status;
  if (!res.ok || msgStatus !== 'success') {
    const err = JSON.stringify(data.Messages?.[0]?.Errors || data.ErrorMessage || data);
    console.error(`[sendPortalAccessEmail] Failed: ${err}`);
    return Response.json({ error: `Mailjet failed: ${err}` }, { status: 500 });
  }

  const messageId = String(data.Messages[0].To?.[0]?.MessageID || '');

  // Log to EmailLog
  try {
    await base44.asServiceRole.entities.EmailLog.create({
      leadId:       leadId || '',
      investorId:   investorId || '',
      toEmail, toName: toName || '',
      templateId:   String(TEMPLATE_ID),
      messageId,
      status:       'sent',
      sentAt:       new Date().toISOString(),
      sentBy:       'admin',
    });
  } catch {}

  // Log to history
  if (leadId) {
    try {
      await base44.asServiceRole.entities.LeadHistory.create({
        leadId, type: 'email',
        content: `📧 Portal access email sent. Username: ${username}`,
      });
    } catch {}
  }
  if (investorId) {
    try {
      await base44.asServiceRole.entities.ContactNote.create({
        investorId, investorEmail: toEmail,
        type: 'email',
        content: `📧 Portal access email sent. Username: ${username}`,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      });
    } catch {}
  }

  return Response.json({ success: true, messageId });
});