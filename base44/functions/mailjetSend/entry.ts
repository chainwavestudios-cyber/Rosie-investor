import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_API_KEY = Deno.env.get('MAILJET_API_KEY');
const MJ_API_SECRET = Deno.env.get('MAILJET_API_SECRET');
const FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const FROM_NAME = Deno.env.get('MAILJET_FROM_NAME') || 'Investment Team';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadId, leadEmail, leadName, leadFirstName, subject } = await req.json();
    if (!leadId || !leadEmail || !subject) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const customId = `lead_${leadId}_${Date.now()}`;
    const firstName = leadFirstName || (leadName || '').split(' ')[0] || '';

    // Send via Mailjet API v3.1 using template
    const mjRes = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${MJ_API_KEY}:${MJ_API_SECRET}`),
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: FROM_EMAIL, Name: FROM_NAME },
          To: [{ Email: leadEmail, Name: leadName || '' }],
          Subject: subject,
          TemplateID: 13933762,
          TemplateLanguage: true,
          Variables: { firstname: firstName },
          CustomID: customId,
          TrackOpens: 'enabled',
          TrackClicks: 'enabled',
        }],
      }),
    });

    const mjData = await mjRes.json();
    if (!mjRes.ok) {
      return Response.json({ error: 'Mailjet error', detail: mjData }, { status: 500 });
    }

    const msgInfo = mjData.Messages?.[0]?.To?.[0] || {};
    const messageId = String(msgInfo.MessageID || '');
    const messageUuid = msgInfo.MessageUUID || '';

    // Save the sent email record
    const emailRecord = await base44.asServiceRole.entities.LeadEmail.create({
      leadId,
      leadEmail,
      leadName: leadName || '',
      subject,
      body: `[Template 13933762] Dear ${firstName},…`,
      messageId,
      messageUuid,
      customId,
      sentAt: new Date().toISOString(),
      status: 'sent',
      openCount: 0,
      clickCount: 0,
      replies: [],
      pointsAwarded: false,
    });

    // Award 5 points to the lead on first email sent
    const allLeads = await base44.asServiceRole.entities.Lead.list();
    const targetLead = allLeads.find(l => l.id === leadId);
    if (targetLead) {
      const currentScore = targetLead.score || 0;
      await base44.asServiceRole.entities.Lead.update(leadId, { score: currentScore + 5 });

      // Log in history
      await base44.asServiceRole.entities.LeadHistory.create({
        leadId,
        type: 'note',
        content: `📧 Email sent: "${subject}" — +5 points awarded`,
        createdBy: user.email || 'admin',
      });
    }

    return Response.json({ success: true, emailId: emailRecord.id, messageId, customId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});