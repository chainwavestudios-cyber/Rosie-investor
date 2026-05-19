/**
 * dataRoomAccessRequest
 * Called when a lead clicks "Request Access to Data Room" in a Mailjet email.
 * 1. Creates / updates a LeadHistory note on the lead
 * 2. Sends an admin notification email
 * 3. Posts an alert message to AdminChat so it pops up in the dashboard
 * 
 * Mailjet button URL:
 *   https://investors.rosieai.tech/request-access?email=[[var:email]]&name=[[var:name]]&lead_id=[[var:lead_id]]
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY    = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET = Deno.env.get('MAILJET_API_SECRET');
const ADMIN_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL'); // notify this address
const FROM_NAME   = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { email, name, leadId } = await req.json();

  if (!email) {
    return Response.json({ error: 'Missing email' }, { status: 400 });
  }

  const displayName = name || email;
  const now = new Date().toISOString();

  // ── 1. Log to LeadHistory if we have a leadId ─────────────────────────────
  if (leadId) {
    await base44.asServiceRole.entities.LeadHistory.create({
      leadId,
      type: 'note',
      content: `🔐 Data Room Access Requested by ${displayName} (${email}) — clicked email button`,
      createdBy: 'system',
    }).catch(() => {});

    // Also bump engagement score / badge
    await base44.asServiceRole.entities.Lead.update(leadId, {
      badgeInvestorPage: true,
    }).catch(() => {});
  }

  // ── 2. Log to ContactNote if investor record exists ───────────────────────
  if (leadId) {
    // Try to find an InvestorUser linked to this lead
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

  // ── 3. Post alert to AdminChat ────────────────────────────────────────────
  await base44.asServiceRole.entities.AdminChat.create({
    sender: 'system',
    type: 'alert',
    content: `🔐 DATA ROOM ACCESS REQUEST\n${displayName} (${email}) clicked the data room button in your marketing email and is requesting access.`,
    isAlert: true,
    alertDismissedBy: '[]',
    sentAt: now,
  }).catch(() => {});

  // ── 4. Send admin notification email via Mailjet ──────────────────────────
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
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e0da;color:#8a9ab8;font-size:11px;">
          This notification was triggered automatically when the lead clicked the data room button.
        </div>
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

  return Response.json({ success: true });
});