/**
 * dataRoomAccessRequest
 * GET  → linked directly from Mailjet email button, returns HTML thank-you page
 * POST → called from frontend (legacy)
 * 
 * Button URL in Mailjet template:
 *   https://<function-url>/dataRoomAccessRequest?email={{var:email}}&name={{var:name}}&lead_id={{var:lead_id}}
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY      = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET   = Deno.env.get('MAILJET_API_SECRET');
const ADMIN_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const FROM_NAME   = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';

const THANK_YOU_HTML = (firstName, email) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Request Received · Rosie AI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; background: #080f1c; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: Georgia, serif; }
    .card { max-width: 480px; width: 100%; text-align: center; }
    .brand { color: #b8933a; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 40px; opacity: 0.8; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { color: #e8e0d0; font-size: 26px; font-weight: normal; margin-bottom: 12px; line-height: 1.3; }
    p { color: #8a9ab8; font-size: 15px; line-height: 1.7; margin-bottom: 32px; }
    .note { background: rgba(184,147,58,0.08); border: 1px solid rgba(184,147,58,0.2); border-radius: 6px; padding: 16px 20px; color: #b8933a; font-size: 13px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">Newport Beach Tech Investor Relations</div>
    <div class="icon">✅</div>
    <h1>Request Received</h1>
    <p>Thank you${firstName ? `, ${firstName}` : ''}! Our team has been notified of your interest in accessing the data room. You will receive an email shortly with access. When would be a good time for an introduction call?</p>
    <iframe src="https://calendly.com/investors-rosieai/newport-beach-tech-pre-ipo-investor-introduction?month=2026-05" width="100%" height="600" frameborder="0" style="border: none; border-radius: 6px; margin-top: 24px;"></iframe>
  </div>
</body>
</html>`;

async function processRequest(base44, email, name, leadId) {
  const displayName = name || email;
  const now = new Date().toISOString();

  if (leadId) {
    await base44.asServiceRole.entities.Lead.update(leadId, {
      leadType: 'nb_data',
      leadPipelineStage: 'data_room_request',
      badgeInvestorPage: true,
      badgeDataRoomRequest: true,
    }).catch(() => {});

    await base44.asServiceRole.entities.LeadHistory.create({
      leadId,
      type: 'note',
      content: `🔐 Data Room Access Requested by ${displayName} (${email}) — clicked email button. Lead type set to NB Data, moved to Data Room Request pipeline stage.`,
      createdBy: 'system',
    }).catch(() => {});

    const investors = await base44.asServiceRole.entities.InvestorUser.filter({ leadId }).catch(() => []);
    if (investors && investors.length > 0) {
      await base44.asServiceRole.entities.ContactNote.create({
        investorId: investors[0].id,
        investorEmail: email,
        type: 'note',
        content: `🔐 Data Room Access Requested — clicked email button`,
        createdAt: now,
        createdBy: 'system',
      }).catch(() => {});
    }
  }

  await base44.asServiceRole.entities.AdminChat.create({
    sender: 'system',
    type: 'alert',
    content: `🔐 DATA ROOM ACCESS REQUEST\n${displayName} (${email}) clicked the data room button in your marketing email and is requesting access.`,
    isAlert: true,
    alertDismissedBy: '[]',
    sentAt: now,
  }).catch(() => {});

  if (MJ_KEY && MJ_SECRET && ADMIN_EMAIL) {
    const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);
    const html = `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px;background:#f9f8f6;border-radius:8px;">
        <div style="color:#b8933a;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:24px;">Rosie AI · Investor Relations</div>
        <h2 style="color:#0d1b2a;font-size:22px;font-weight:normal;margin-bottom:16px;">🔐 Data Room Access Request</h2>
        <p style="color:#4a5568;font-size:15px;line-height:1.7;">A lead has clicked the <strong>Request Access</strong> button in your marketing email:</p>
        <div style="background:#fff;border:1px solid #e2e0da;border-left:4px solid #b8933a;border-radius:4px;padding:16px 20px;margin:20px 0;">
          <div style="font-size:16px;font-weight:bold;color:#0d1b2a;margin-bottom:4px;">${displayName}</div>
          <div style="color:#4a5568;font-size:14px;">${email}</div>
          ${leadId ? `<div style="color:#8a9ab8;font-size:12px;margin-top:6px;">Lead ID: ${leadId}</div>` : ''}
        </div>
        <p style="color:#4a5568;font-size:14px;line-height:1.6;">Log in to the admin dashboard to review this lead and grant data room access if appropriate.</p>
      </div>
    `;
    await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Messages: [{
          From: { Email: ADMIN_EMAIL, Name: FROM_NAME },
          To: [{ Email: ADMIN_EMAIL, Name: 'Admin' }],
          Subject: `🔐 Data Room Access Request — ${displayName}`,
          HTMLPart: html,
          TextPart: `Data Room Access Request from ${displayName} (${email})`,
        }],
      }),
    }).catch(() => {});
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);

  // ── GET: direct link from email button ───────────────────────────────────
  if (req.method === 'GET') {
    const email  = url.searchParams.get('email')   || '';
    const name   = url.searchParams.get('name')    || '';
    const leadId = url.searchParams.get('lead_id') || '';

    if (!email) {
      return new Response('<h1>Invalid link</h1>', { status: 400, headers: { 'Content-Type': 'text/html' } });
    }

    const firstName = name ? name.split(' ')[0] : '';

    // Fire-and-forget background processing
    processRequest(base44, email, name, leadId).catch(() => {});

    return new Response(THANK_YOU_HTML(firstName, email), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // ── POST: called from frontend ────────────────────────────────────────────
  const { email, name, leadId } = await req.json();
  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  await processRequest(base44, email, name, leadId);
  return Response.json({ success: true });
});