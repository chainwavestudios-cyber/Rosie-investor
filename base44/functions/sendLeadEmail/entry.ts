import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY        = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET     = Deno.env.get('MAILJET_API_SECRET');
const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const MJ_FROM_NAME  = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';
const TEMPLATE_ID   = 7949342;
const PORTAL_URL    = Deno.env.get('INVESTOR_PORTAL_URL') || 'https://investors.rosieai.tech';

// Generate a random 6-character alphanumeric passcode
function generatePasscode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { leadId, toEmail, toName, firstName, passcode: providedPasscode, customVariables } = await req.json();
  if (!toEmail || !leadId) return Response.json({ error: 'Missing toEmail or leadId' }, { status: 400 });

  // Generate passcode if not provided
  // Build passcode: firstname + last 4 of phone (e.g. "john3324")
  // Fetch the lead to get phone number
  let phoneDigits = '0000';
  try {
    const lead = await base44.asServiceRole.entities.Lead.get(leadId);
    phoneDigits = (lead?.phone || '').replace(/\D/g, '').slice(-4) || '0000';
  } catch {}
  const nameSlug = (firstName || 'user').toLowerCase().replace(/[^a-z]/g, '');
  const passcode = providedPasscode || `${nameSlug}${phoneDigits}`;

  const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);

  const payload = {
    Messages: [{
      From: { Email: MJ_FROM_EMAIL, Name: MJ_FROM_NAME },
      To: [{ Email: toEmail, Name: toName || firstName || '' }],
      TemplateID: TEMPLATE_ID,
      TemplateLanguage: true,
      Variables: {
        firstname:      firstName || '',
        passcode:       passcode,
        portal_url:     PORTAL_URL,
        login_url:      `${PORTAL_URL}?email=${encodeURIComponent(toEmail)}&code=${passcode}`,
        consumer_url:   `https://rosieai.tech?ref=${passcode}`,
        // Spread any additional custom variables passed from frontend
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

  // Save passcode on the lead so portal login can verify it
  try {
    await base44.asServiceRole.entities.Lead.update(leadId, { portalPasscode: passcode });
  } catch {}

  // Log to EmailLog entity
  const logEntry = await base44.asServiceRole.entities.EmailLog.create({
    leadId, toEmail,
    toName: toName || firstName || '',
    templateId: String(TEMPLATE_ID),
    messageId, messageUUID,
    status: 'sent',
    sentAt: new Date().toISOString(),
    sentBy: 'admin',
    pointsAwarded: false,
  });

  // Award initial 5 points to the lead
  try {
    const lead = await base44.asServiceRole.entities.Lead.get(leadId);
    if (lead) {
      await base44.asServiceRole.entities.Lead.update(leadId, {
        engagementScore: (lead.engagementScore || 0) + 5,
      });
      await base44.asServiceRole.entities.LeadHistory.create({
        leadId, type: 'note',
        content: `📧 Email sent. Passcode: ${passcode}. +5 engagement points.`,
      });
    }
  } catch (e) {
    console.warn('[sendLeadEmail] Could not update lead score:', e.message);
  }

  return Response.json({ success: true, messageId, messageUUID, logId: logEntry.id, passcode });
});