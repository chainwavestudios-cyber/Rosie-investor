import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MJ_KEY        = Deno.env.get('MAILJET_API_KEY');
const MJ_SECRET     = Deno.env.get('MAILJET_API_SECRET');
const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
const MJ_FROM_NAME  = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';
const TEMPLATE_ID   = 7951003;
const PORTAL_URL    = 'https://investors.rosieai.tech';

const hashPassword = async (pw) => {
  const salt = crypto.randomUUID().replace(/-/g, '');
  const enc  = new TextEncoder();
  const buf  = await crypto.subtle.digest('SHA-256', enc.encode(salt + pw));
  const hex  = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hex}`;
};

Deno.serve(async (req) => {
  if (!MJ_KEY || !MJ_SECRET || !MJ_FROM_EMAIL) {
    return Response.json({ error: 'Mailjet credentials not configured' }, { status: 500 });
  }

  const base44 = createClientFromRequest(req);
  const { leadId, investorId, toEmail, toName, firstName, username, password, loginUrl } = await req.json();

  if (!toEmail || !username || !password) {
    return Response.json({ error: 'Missing toEmail, username, or password' }, { status: 400 });
  }

  const fullName = toName || firstName || username;

  // ── Upsert InvestorUser ──────────────────────────────────────────────────
  // IMPORTANT: if user already exists, preserve all their data (engagement, history, etc.)
  // Only create a new record if they truly don't exist yet.
  let iu = null;
  try {
    const existing = await base44.asServiceRole.entities.InvestorUser.filter({ username });

    if (existing?.length > 0) {
      // User already exists — just resend the email, do NOT overwrite password or engagement data
      iu = existing[0];
      console.log(`[sendPortalAccessEmail] Existing InvestorUser found (${username}) — resending credentials only, preserving all data.`);
    } else {
      // New user — create with hashed password
      // Also fetch the Lead's portalPasscode (investor site access code) to store as siteAccessCode
      let siteAccessCode = '';
      if (leadId) {
        try {
          const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
          siteAccessCode = leads?.[0]?.portalPasscode || '';
        } catch {}
      }

      const hashedPw = await hashPassword(password);
      iu = await base44.asServiceRole.entities.InvestorUser.create({
        username,
        name:            fullName,
        email:           toEmail,
        password:        hashedPw,
        role:            'investor',
        status:          'prospect',
        pipelineStage:   'reviewing',
        leadId:          leadId || null,
        migratedAt:      new Date().toISOString(),
        lastActivityAt:  new Date().toISOString(),
        ...(siteAccessCode ? { siteAccessCode } : {}),
      });
      console.log(`[sendPortalAccessEmail] Created new InvestorUser: ${username}, siteAccessCode: ${siteAccessCode || 'none'}`);
    }
  } catch (e) {
    console.error(`[sendPortalAccessEmail] InvestorUser upsert failed:`, e.message);
    return Response.json({ error: 'Failed to create/update investor account: ' + e.message }, { status: 500 });
  }

  const iuId = iu?.id;

  // ── If a leadId was provided and not yet migrated, run full migration ──
  // Skip migration if lead is already converted (resend scenario)
  let leadAlreadyMigrated = false;
  if (leadId) {
    try {
      const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
      if (leads?.[0]?.migratedToPortal || leads?.[0]?.status === 'converted') {
        leadAlreadyMigrated = true;
        console.log(`[sendPortalAccessEmail] Lead ${leadId} already migrated — skipping migration, resending email only.`);
      }
    } catch {}
  }

  if (leadId && iuId && !leadAlreadyMigrated) {
    console.log(`[sendPortalAccessEmail] Running full migration for lead ${leadId} → investor ${iuId}`);

    // 1. Migrate LeadHistory → ContactNotes
    try {
      const history = await base44.asServiceRole.entities.LeadHistory.filter({ leadId });
      for (const h of (history || [])) {
        try {
          const noteType = ['call','connected'].includes(h.type) ? 'call'
            : h.type === 'sms' ? 'sms'
            : h.type === 'voicemail' ? 'voicemail'
            : (h.type === 'email' || (h.content||'').includes('Email sent')) ? 'email'
            : 'note';
          const label = (h.type||'note').replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase());
          await base44.asServiceRole.entities.ContactNote.create({
            investorId:    iuId,
            investorEmail: toEmail,
            type:          noteType,
            content:       `[Lead History · ${label}] ${h.content || ''}`,
            createdAt:     h.created_date,
            createdBy:     h.createdBy || 'admin',
          });
        } catch {}
      }
    } catch (e) { console.warn('[migrate] history:', e.message); }

    // 2. Migrate EmailLogs
    try {
      const logs = await base44.asServiceRole.entities.EmailLog.filter({ leadId });
      for (const log of (logs || [])) {
        try {
          await base44.asServiceRole.entities.EmailLog.update(log.id, { investorId: iuId });
          await base44.asServiceRole.entities.ContactNote.create({
            investorId:    iuId,
            investorEmail: toEmail,
            type:          'email',
            content:       `[Email Log] ${log.status}${log.openedAt ? ' · Opened ' + new Date(log.openedAt).toLocaleDateString() : ''}`,
            createdAt:     log.sentAt,
            createdBy:     log.sentBy || 'admin',
          });
        } catch {}
      }
    } catch (e) { console.warn('[migrate] email logs:', e.message); }

    // 3. Migrate Appointments
    try {
      const appts = await base44.asServiceRole.entities.Appointment.filter({ investorId: leadId });
      for (const a of (appts || [])) {
        try {
          await base44.asServiceRole.entities.Appointment.update(a.id, { investorId: iuId, investorEmail: toEmail, investorName: fullName });
        } catch {}
      }
    } catch (e) { console.warn('[migrate] appointments:', e.message); }

    // 4. Migrate SiteVisits
    try {
      const visits = await base44.asServiceRole.entities.SiteVisit.filter({ leadId });
      for (const v of (visits || [])) {
        try { await base44.asServiceRole.entities.SiteVisit.update(v.id, { investorId: iuId }); } catch {}
      }
    } catch (e) { console.warn('[migrate] site visits:', e.message); }

    // 5. Archive the lead
    try {
      await base44.asServiceRole.entities.Lead.update(leadId, {
        status:                    'converted',
        migratedToPortal:          true,
        convertedToInvestorUserId: iuId,
      });
      await base44.asServiceRole.entities.LeadHistory.create({
        leadId,
        type:    'status_change',
        content: `✅ Migrated to CRM via portal access email. Username: ${username}. Pipeline: Reviewing Info.`,
      });
      await base44.asServiceRole.entities.ContactNote.create({
        investorId:    iuId,
        investorEmail: toEmail,
        type:          'note',
        content:       `✅ Migrated from lead pipeline. Portal access email sent. Stage: Reviewing Info.`,
        createdAt:     new Date().toISOString(),
        createdBy:     'system',
      });
    } catch (e) { console.warn('[migrate] archive lead:', e.message); }

    console.log(`[sendPortalAccessEmail] Migration complete for lead ${leadId}`);
  }

  // ── Send Email ───────────────────────────────────────────────────────────
  const portalLoginUrl = loginUrl || `${PORTAL_URL}/portal-login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  console.log(`[sendPortalAccessEmail] Sending to ${toEmail} username: ${username}`);

  const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);

  const payload = {
    Messages: [{
      From: { Email: MJ_FROM_EMAIL, Name: MJ_FROM_NAME },
      To:   [{ Email: toEmail, Name: fullName }],
      TemplateID: TEMPLATE_ID,
      TemplateLanguage: true,
      Variables: {
        firstname:  firstName || fullName.split(' ')[0] || '',
        username,
        passcode:   password,
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
      leadId:     leadId || '',
      investorId: iuId || investorId || '',
      toEmail,    toName: fullName,
      templateId: String(TEMPLATE_ID),
      messageId,
      status:     'sent',
      sentAt:     new Date().toISOString(),
      sentBy:     'admin',
    });
  } catch {}

  // Log note on investor
  if (iuId) {
    try {
      await base44.asServiceRole.entities.ContactNote.create({
        investorId: iuId, investorEmail: toEmail,
        type: 'email',
        content: `📧 Portal access email sent. Username: ${username}`,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      });
    } catch {}
  }

  return Response.json({ success: true, messageId, investorId: iuId });
});