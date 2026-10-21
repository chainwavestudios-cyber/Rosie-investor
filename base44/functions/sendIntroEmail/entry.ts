/**
 * sendIntroEmail — Sends the Mailjet "INtro" template to selected leads.
 *
 * Hardened against the intermittent 500s: the request body is parsed safely,
 * every lead is fetched in ONE query, sends run in small parallel batches,
 * and every Mailjet call times out at 20s so one stalled provider call can no
 * longer hang the whole request. Failures are written to DebugLog so the real
 * reason is visible instead of an opaque 500.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const INTRO_TEMPLATE_ID = 7961149;
const INVESTORS_SITE = 'https://investors.rosieai.tech';
const CONSUMER_SITE = 'https://www.rosieai.tech';
const BATCH_SIZE = 4;
const MJ_TIMEOUT_MS = 20000;

export default async function (req: Request): Promise<Response> {
  const MJ_KEY = Deno.env.get('MAILJET_API_KEY');
  const MJ_SECRET = Deno.env.get('MAILJET_API_SECRET');
  const MJ_FROM_EMAIL = Deno.env.get('MAILJET_FROM_EMAIL');
  const MJ_FROM_NAME = Deno.env.get('MAILJET_FROM_NAME') || 'Rosie AI';

  if (!MJ_KEY || !MJ_SECRET || !MJ_FROM_EMAIL) {
    console.error('[sendIntroEmail] Missing Mailjet env vars');
    return Response.json({ error: 'Mailjet credentials not configured (MAILJET_API_KEY, MAILJET_API_SECRET, MAILJET_FROM_EMAIL)' }, { status: 500 });
  }

  try {
    const base44 = createClientFromRequest(req);

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const { leadIds, sentBy } = body || {};

    if (!Array.isArray(leadIds) || leadIds.length === 0)
      return Response.json({ error: 'Missing leadIds array' }, { status: 400 });
    if (leadIds.length > 10)
      return Response.json({ error: 'Maximum 10 leads per batch' }, { status: 400 });

    // One query for the whole selection (previously one query per lead). If any id
    // isn't a well-formed record id the query itself is rejected, so fall back to
    // per-lead lookups — one odd id can never fail the whole batch.
    let byId = new Map();
    try {
      const page: any = await base44.asServiceRole.entities.Lead.filter({ id: { $in: leadIds } }, { limit: leadIds.length });
      const leads = page?.items || page || [];
      byId = new Map(leads.map((l: any) => [l.id, l]));
    } catch (e: any) {
      console.warn('[sendIntroEmail] Bulk lead lookup rejected, using per-lead lookups:', e.message);
    }

    const results: any[] = [];
    for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
      const batch = leadIds.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map(async (leadId: string) => {
          let lead = byId.get(leadId);
          if (!lead) lead = await base44.asServiceRole.entities.Lead.get(leadId).catch(() => null);
          return sendOne(base44, lead, leadId, { MJ_KEY, MJ_SECRET, MJ_FROM_EMAIL, MJ_FROM_NAME, sentBy });
        })
      );
      settled.forEach((s, idx) => {
        if (s.status === 'fulfilled') results.push(s.value);
        else results.push({ leadId: batch[idx], success: false, error: String((s.reason as any)?.message || s.reason) });
      });
    }

    const succeeded = results.filter(r => r.success).length;
    console.log(`[sendIntroEmail] Batch complete: ${succeeded}/${leadIds.length} sent`);
    return Response.json({ success: true, sent: succeeded, total: leadIds.length, results });
  } catch (error) {
    console.error('[sendIntroEmail] Handler error:', (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function sendOne(base44: any, lead: any, leadId: string, cfg: any) {
  if (!lead) return { leadId, success: false, error: 'Lead not found' };
  if (!lead.email) return { leadId, success: false, error: 'No email address' };

  const firstName = lead.firstName || '';
  const lastName = lead.lastName || '';
  const toEmail = String(lead.email).toLowerCase().trim();
  const toName = `${firstName} ${lastName}`.trim();
  const state = lead.state || '';

  const nameSlug = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const phoneDigits = (lead.phone || '').replace(/\D/g, '').slice(-4) || '0000';
  const username = `${nameSlug}${phoneDigits}`;

  const loginUrl = `${INVESTORS_SITE}/?code=${encodeURIComponent(username)}`;
  const consumerUrl = `${CONSUMER_SITE}?ref=${username}`;

  await base44.asServiceRole.entities.Lead.update(leadId, { portalPasscode: username }).catch((e: any) =>
    console.warn(`[sendIntroEmail] portalPasscode update warning for ${leadId}:`, e.message)
  );

  let res;
  try {
    res = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${cfg.MJ_KEY}:${cfg.MJ_SECRET}`)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Messages: [{
          From: { Email: cfg.MJ_FROM_EMAIL, Name: cfg.MJ_FROM_NAME },
          To: [{ Email: toEmail, Name: toName }],
          TemplateID: INTRO_TEMPLATE_ID,
          TemplateLanguage: true,
          Variables: {
            firstname: firstName,
            first_name: firstName,
            lastname: lastName,
            last_name: lastName,
            state,
            username,
            passcode: username,
            login_url: loginUrl,
            consumer_url: consumerUrl,
            portal_url: INVESTORS_SITE,
          },
          CustomID: `${leadId}:intro`,
        }],
      }),
      signal: AbortSignal.timeout(MJ_TIMEOUT_MS),
    });
  } catch (e: any) {
    const reason = (e?.name === 'TimeoutError' || e?.name === 'AbortError')
      ? `Mailjet did not respond within ${MJ_TIMEOUT_MS / 1000}s`
      : `Could not reach Mailjet: ${e?.message || String(e)}`;
    await logFailure(base44, leadId, toEmail, reason);
    return { leadId, success: false, error: reason };
  }

  let data: any = {};
  try { data = await res.json(); } catch { data = {}; }

  const msgStatus = data.Messages?.[0]?.Status;
  const errors = data.Messages?.[0]?.Errors;

  if (!res.ok || msgStatus !== 'success') {
    const errDetail = errors ? JSON.stringify(errors) : (data.ErrorMessage || data.Message || `HTTP ${res.status}`);
    await logFailure(base44, leadId, toEmail, `Mailjet: ${errDetail}`);
    return { leadId, success: false, error: `Mailjet: ${errDetail}` };
  }

  const msgInfo = data.Messages[0];
  const messageId = String(msgInfo.To?.[0]?.MessageID || '');
  const messageUUID = msgInfo.To?.[0]?.MessageUUID || '';

  await base44.asServiceRole.entities.EmailLog.create({
    leadId, toEmail, toName,
    templateId: String(INTRO_TEMPLATE_ID),
    messageId, messageUUID,
    status: 'sent',
    sentAt: new Date().toISOString(),
    sentBy: cfg.sentBy || 'admin',
    isIntroEmail: true,
  }).catch((e: any) => console.warn('[sendIntroEmail] EmailLog create failed:', e.message));

  await base44.asServiceRole.entities.Lead.update(leadId, {
    status: 'intro_email_sent',
    engagementScore: (lead.engagementScore || 0) + 5,
  }).catch((e: any) => console.warn(`[sendIntroEmail] Lead status update failed for ${leadId}:`, e.message));

  await base44.asServiceRole.entities.LeadHistory.create({
    leadId, type: 'note',
    content: `📧 Intro email sent by ${cfg.sentBy || 'admin'} (template ${INTRO_TEMPLATE_ID}). State: ${state || 'N/A'}. Username: ${username}. +5 engagement.`,
  }).catch(() => {});

  return { leadId, success: true, messageId };
}

async function logFailure(base44: any, leadId: string, toEmail: string, reason: string) {
  console.error(`[sendIntroEmail] ❌ ${toEmail}: ${reason}`);
  await base44.asServiceRole.entities.DebugLog.create({
    title: 'Intro email failed',
    category: 'error',
    sourceComputer: 'sendIntroEmail',
    logText: `Lead ${leadId} · ${toEmail}\n${reason}\n${new Date().toISOString()}`,
  }).catch(() => {});
}