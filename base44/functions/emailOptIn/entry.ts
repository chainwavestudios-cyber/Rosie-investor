/**
 * emailOptIn — email consent capture.
 *
 *   subscribe  (public)  the opt-in form: stores a PENDING consent, emails the
 *                        double opt-in confirmation link.
 *   confirm    (public)  the link in that email — flips the consent to confirmed.
 *   generate   (admin)   logs consent for leads that already gave it verbally:
 *                        vault list entries and/or fronter lead records.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const MJ_KEY = Deno.env.get('MAILJET_API_KEY') || '';
const MJ_SECRET = Deno.env.get('MAILJET_API_SECRET') || '';
const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL') || '';
const MJ_FROM_NAME = Deno.env.get('MAILJET_FROM_NAME') || 'Debt Solutions';
const APP_URL = 'https://rosieai-investorpage.base44.app';

// The exact wording a person agrees to on the form — stored on every record.
const FORM_CONSENT = 'I agree to receive email updates and communications from Debt Solutions, and I understand I can withdraw my consent at any time.';
// The wording recorded for leads who consented verbally on the call.
const VERBAL_CONSENT = 'Verbal opt-in given during the qualification call: the contact agreed to receive email updates and communications from Debt Solutions.';

const isEmail = (v: any) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v || '').trim());
const clean = (v: any) => String(v ?? '').trim();

function confirmationHtml(firstName: string, link: string) {
  const greeting = firstName ? `, ${firstName}` : '';
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;">
  <tr><td style="background:#0ea5e9;padding:20px 28px;font-family:'DM Sans',Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:0.5px;color:#0d1117;">Debt Solutions</td></tr>
  <tr><td style="padding:32px 28px 10px;font-family:'Playfair Display',Georgia,serif;font-size:26px;line-height:1.25;color:#0d1117;">Confirm your email${greeting}</td></tr>
  <tr><td style="padding:0 28px;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.65;color:#0d1117;">
    You asked to receive email updates from us. Click the button below to confirm your subscription. If you did not request this, ignore this email and nothing further will be sent.
  </td></tr>
  <tr><td style="padding:24px 28px 10px;">
    <a href="${link}" style="display:inline-block;background:#0ea5e9;color:#0d1117;font-family:'DM Sans',Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:24px;">Confirm Subscription</a>
  </td></tr>
  <tr><td style="padding:6px 28px 28px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;line-height:1.6;color:#0d1117;">
    Or paste this link into your browser:<br /><span style="word-break:break-all;">${link}</span>
  </td></tr>
  <tr><td style="background:#0ea5e9;padding:16px 28px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#0d1117;">
    Debt Solutions · You can unsubscribe at any time.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendConfirmation(toEmail: string, firstName: string, link: string) {
  const auth = btoa(`${MJ_KEY}:${MJ_SECRET}`);
  const res = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      Messages: [{
        From: { Email: MJ_FROM_EMAIL, Name: MJ_FROM_NAME },
        To: [{ Email: toEmail, Name: firstName || '' }],
        Subject: 'Confirm your email subscription',
        HTMLPart: confirmationHtml(firstName, link),
        TextPart: `You asked to receive email updates from us. Confirm your subscription here: ${link}\n\nIf you did not request this, ignore this email.`,
      }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  const ok = res.ok && data?.Messages?.[0]?.Status === 'success';
  if (!ok) console.warn('[emailOptIn] Mailjet send failed:', JSON.stringify(data).slice(0, 400));
  return ok;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action) || 'subscribe';
    const db = base44.asServiceRole.entities;

    // ── SUBSCRIBE (public opt-in form) ────────────────────────────────────
    if (action === 'subscribe') {
      const email = clean(body.email).toLowerCase();
      if (!isEmail(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
      if (!body.consent) return Response.json({ error: 'Please tick the consent box to continue.' }, { status: 400 });

      const firstName = clean(body.firstName);
      const origin = /^https?:\/\//i.test(clean(body.origin)) ? clean(body.origin).replace(/\/+$/, '') : APP_URL;

      const existing = await db.EmailOptIn.filter({ email });
      const already = (existing || []).find((r: any) => r.status === 'confirmed');
      if (already) return Response.json({ ok: true, alreadyConfirmed: true });

      const token = crypto.randomUUID();
      const record = {
        email,
        firstName,
        lastName: clean(body.lastName),
        source: 'form',
        status: 'pending',
        consentText: FORM_CONSENT,
        optedInAt: new Date().toISOString(),
        confirmationSentAt: new Date().toISOString(),
        confirmationToken: token,
        ipAddress: clean((req.headers.get('x-forwarded-for') || '').split(',')[0]),
        recordedBy: 'form',
      };

      const previous = (existing || [])[0];
      if (previous) await db.EmailOptIn.update(previous.id, record);
      else await db.EmailOptIn.create(record);

      const sent = await sendConfirmation(email, firstName, `${origin}/email-optin?token=${token}`);
      if (!sent) return Response.json({ error: 'We could not send the confirmation email. Please try again.' }, { status: 500 });
      return Response.json({ ok: true, pending: true });
    }

    // ── CONFIRM (double opt-in link) ──────────────────────────────────────
    if (action === 'confirm') {
      const token = clean(body.token);
      if (!token) return Response.json({ error: 'This confirmation link is incomplete.' }, { status: 400 });
      const rows = await db.EmailOptIn.filter({ confirmationToken: token });
      const record = (rows || [])[0];
      if (!record) return Response.json({ error: 'This confirmation link is no longer valid.' }, { status: 404 });
      if (record.status !== 'confirmed') {
        await db.EmailOptIn.update(record.id, {
          status: 'confirmed',
          confirmedAt: new Date().toISOString(),
          confirmationToken: '',
        });
      }
      return Response.json({ ok: true, email: record.email });
    }

    // ── GENERATE (verbal consent already on file) ─────────────────────────
    if (action === 'generate') {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

      const includeVault = body.vault !== false;
      const includeLeads = body.fronterLeads === true;
      const recordedBy = clean(body.loggedBy) || user.email || 'admin';

      const existing = await db.EmailOptIn.list('-created_date', 5000);
      const known = new Set((existing || []).map((r: any) => clean(r.email).toLowerCase()));
      const now = new Date().toISOString();
      const created: any[] = [];

      if (includeVault) {
        const vault = await db.LeadVaultEntry.list('-created_date', 3000);
        for (const v of vault || []) {
          const email = clean(v.email).toLowerCase();
          if (!isEmail(email) || known.has(email)) continue;
          known.add(email);
          created.push({
            email, firstName: v.firstName || '', lastName: v.lastName || '', phone: v.phone || '',
            source: 'vault', status: 'confirmed', consentText: VERBAL_CONSENT,
            optedInAt: now, confirmedAt: now, vaultEntryId: v.id,
            batchLabel: v.batchLabel || '', recordedBy,
          });
        }
      }

      if (includeLeads) {
        const leads = await db.FronterLead.list('-created_date', 2000);
        for (const l of leads || []) {
          const email = clean(l.email).toLowerCase();
          if (!isEmail(email) || known.has(email)) continue;
          known.add(email);
          created.push({
            email, firstName: l.firstName || '', lastName: l.lastName || '', phone: l.phone || '',
            source: 'verbal', status: 'confirmed', consentText: VERBAL_CONSENT,
            optedInAt: now, confirmedAt: now, leadId: l.id, noticeId: l.noticeId || '', recordedBy,
          });
        }
      }

      for (let i = 0; i < created.length; i += 400) {
        await db.EmailOptIn.bulkCreate(created.slice(i, i + 400));
      }
      return Response.json({ ok: true, created: created.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[emailOptIn] failed:', (error as any)?.message);
    return Response.json({ error: (error as any)?.message || 'Opt-in failed' }, { status: 500 });
  }
}