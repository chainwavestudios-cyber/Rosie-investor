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

const THANK_YOU_HTML = (firstName, email, leadId) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Request Received · Rosie AI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; background: #080f1c; padding: 24px; font-family: Georgia, serif; color: #e8e0d0; }
    .brand { color: #b8933a; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; text-align: center; margin-bottom: 32px; opacity: 0.8; }
    .layout { display: flex; gap: 32px; align-items: flex-start; justify-content: center; flex-wrap: wrap; max-width: 1100px; margin: 0 auto; }
    .left { flex: 0 0 420px; max-width: 420px; }
    .right { flex: 1 1 500px; min-width: 320px; }
    .check { font-size: 56px; text-align: center; margin-bottom: 16px; }
    h1 { color: #e8e0d0; font-size: 26px; font-weight: normal; text-align: center; margin-bottom: 10px; line-height: 1.3; }
    .sub { color: #8a9ab8; font-size: 14px; line-height: 1.7; text-align: center; margin-bottom: 20px; }
    .note { background: rgba(184,147,58,0.08); border: 1px solid rgba(184,147,58,0.2); border-radius: 6px; padding: 14px 18px; color: #b8933a; font-size: 13px; line-height: 1.6; margin-bottom: 24px; }
    .sms-box { background: rgba(74,222,128,0.06); border: 1px solid rgba(74,222,128,0.25); border-radius: 10px; padding: 20px 22px; }
    .sms-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .sms-title { color: #4ade80; font-size: 13px; font-weight: bold; letter-spacing: 0.5px; }
    .sms-sub { color: #6b7280; font-size: 12px; margin-top: 2px; }
    .sms-row { display: flex; gap: 8px; }
    .sms-input { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(74,222,128,0.3); border-radius: 6px; padding: 11px 14px; color: #e8e0d0; font-size: 14px; outline: none; font-family: Georgia, serif; }
    .sms-input::placeholder { color: #4a5568; }
    .sms-btn { background: linear-gradient(135deg,#4ade80,#22c55e); color: #000; border: none; border-radius: 6px; padding: 11px 20px; cursor: pointer; font-size: 12px; font-weight: bold; letter-spacing: 1px; white-space: nowrap; }
    .sms-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sms-legal { color: #4a5568; font-size: 10px; margin: 10px 0 0; line-height: 1.5; }
    .sms-done { color: #4ade80; font-size: 14px; text-align: center; padding: 10px 0; }
    .sms-err { color: #ef4444; font-size: 12px; margin-top: 8px; }
    .cal-label { color: #b8933a; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px; text-align: center; }
    #sms-status { display: none; }
  </style>
</head>
<body>
  <div class="brand">Newport Beach Tech · Investor Relations</div>
  <div class="layout">

    <!-- LEFT: confirmation + SMS opt-in -->
    <div class="left">
      <div class="check">✅</div>
      <h1>Request Received</h1>
      <p class="sub">Thank you${firstName ? `, ${firstName}` : ''}! Our team has been notified of your interest in the NB Tech data room. You'll receive an email shortly with access instructions.</p>
      <div class="note">📧 Confirmation noted for <strong>${email}</strong></div>

      <!-- SMS Opt-In -->
      <div class="sms-box">
        <div class="sms-head">
          <img src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/9febafab0_Untitled313x313px.png" alt="SMS" style="width:52px;height:52px;object-fit:contain;flex-shrink:0;" />
          <div>
            <div class="sms-title">Stay in the Loop via Text</div>
            <div class="sms-sub">Get up to the minute important updates on your exclusive access to our upcoming Nasdaq IPO. We never share your information, and send limited messages per month.</div>
          </div>
        </div>
        <div id="sms-form">
          <div class="sms-row">
            <input id="sms-phone" class="sms-input" type="tel" placeholder="(555) 555-5555" />
            <button class="sms-btn" onclick="doOptIn()">Opt In</button>
          </div>
          <div id="sms-err" class="sms-err" style="display:none;">Something went wrong. Please try again.</div>
        </div>
        <div id="sms-done" class="sms-done" style="display:none;">✅ You're opted in! We'll text you updates.</div>
        <p class="sms-legal">By opting in you agree to receive SMS messages. Reply STOP at any time to unsubscribe. Msg &amp; data rates may apply.</p>
      </div>
    </div>

    <!-- RIGHT: Calendly -->
    <div class="right">
      <div class="cal-label">📅 Schedule an Introduction Call</div>
      <iframe src="https://calendly.com/investors-rosieai/newport-beach-tech-pre-ipo-investor-introduction" width="100%" height="650" frameborder="0" style="border:none;border-radius:10px;background:#fff;"></iframe>
    </div>

  </div>

  <script>
    async function doOptIn() {
      const phone = document.getElementById('sms-phone').value.trim();
      if (!phone) return;
      const btn = document.querySelector('.sms-btn');
      btn.disabled = true;
      btn.textContent = '⏳';
      try {
        await fetch('/api/functions/smsOptIn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, firstName: '${firstName || 'Investor'}', email: '${email}', leadId: '${leadId}' }),
        });
        document.getElementById('sms-form').style.display = 'none';
        document.getElementById('sms-done').style.display = 'block';
      } catch(e) {
        btn.disabled = false;
        btn.textContent = 'Opt In';
        document.getElementById('sms-err').style.display = 'block';
      }
    }
    document.getElementById('sms-phone').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doOptIn();
    });
  </script>
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

    return new Response(THANK_YOU_HTML(firstName, email, leadId), {
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