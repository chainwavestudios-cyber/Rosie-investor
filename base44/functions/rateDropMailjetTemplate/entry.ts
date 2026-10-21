/**
 * rateDropMailjetTemplate — Puts the Rate Drop mailer's Mailjet template into the
 * Mailjet account, so a campaign has somewhere to inject each prospect's notice.
 *
 * The template holds the injection slot ({{var:mailer_html}}) plus the subject and
 * a plain-text fallback. The notice itself is built and injected per prospect at
 * send time by the campaign engine, so the same template serves every prospect.
 *
 * Action:
 *   push → creates the template the first time and updates that same template
 *          afterwards, stores its ID on the Rate Drop template config, and
 *          confirms the injection slot landed in the stored content.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const MJ_BASE = 'https://api.mailjet.com/v3/REST';
const DEFAULT_TEMPLATE_NAME = 'Debt Solutions Rate Drop Mailer';
const SUBJECT = 'Debt Solutions Rate Drop Engine — Please Review Your Notice';

const clean = (v: any) => String(v ?? '').trim();

async function mjFetch(auth: string, path: string, init?: any): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${MJ_BASE}${path}`, {
      ...(init || {}),
      headers: { Authorization: auth, 'Content-Type': 'application/json', ...((init || {}).headers || {}) },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e: any) {
    throw new Error(`Could not reach Mailjet: ${e?.message || String(e)}`);
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mailjet ${res.status}: ${JSON.stringify(data?.ErrorMessage || data).slice(0, 300)}`);
  return data;
}

/** The template shell: subject, the mailer slot, and a plain-text fallback. */
function templateHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
{{var:mailer_html}}
</body>
</html>`;
}

function templateText(): string {
  return `DEBT SOLUTIONS RATE DROP ENGINE

{{var:recipient_name}}
{{var:address}}

Your file number {{var:plan_number}} has been included in The Debt Solutions Rate Drop Engine. Our records show {{var:debt_amount}} in past-due credit card balances, and your preapproved reduction savings total {{var:savings_amount}}.

Call customer service immediately at {{var:phone}} to take advantage of the Rate Drop Engine. Enrollment is limited and no further notices will be sent.

To stop receiving mail from us, call {{var:phone}}.`;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Portal users sign in through DebtCoachAuth, so the platform session check is
    // best-effort; a signed-in non-admin is refused.
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // The Rate Drop mailers have their own Mailjet account, separate from the
    // account the rest of the app's email sends through.
    const key = Deno.env.get('MAILJET_2_API_KEY');
    const secret = Deno.env.get('MAILJET_2_API_SECRET');
    if (!key || !secret) return Response.json({ error: 'Rate Drop Mailjet credentials not configured (MAILJET_2_API_KEY, MAILJET_2_API_SECRET)' }, { status: 500 });
    const auth = `Basic ${btoa(`${key}:${secret}`)}`;

    const rows = await base44.asServiceRole.entities.RateDropTemplate.filter({ configName: 'default' });
    const config = (Array.isArray(rows) ? rows : rows?.items || [])[0] || null;
    const templateName = clean(config?.name) || DEFAULT_TEMPLATE_NAME;

    let templateId = clean(config?.mailjetTemplateId);
    let created = false;

    // A stored ID can belong to the other Mailjet account (or have been deleted),
    // so reuse it only when this account really holds that template.
    if (templateId) {
      const probe = await fetch(`${MJ_BASE}/template/${templateId}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(15000) });
      if (probe.status === 404) {
        console.log(`[rateDropMailjetTemplate] template ${templateId} is not in this account — creating a new one`);
        templateId = '';
      } else if (!probe.ok) {
        throw new Error(`Mailjet ${probe.status} while checking template ${templateId}`);
      }
    }

    // Mailjet hides templates without a purpose from its template galleries.
    const purposes = ['marketing', 'transactional'];
    if (!templateId) {
      const made = await mjFetch(auth, '/template', { method: 'POST', body: JSON.stringify({ Name: templateName, Purposes: purposes }) });
      templateId = clean(made?.Data?.[0]?.ID);
      if (!templateId) throw new Error('Mailjet did not return a template ID');
      created = true;
    } else {
      await mjFetch(auth, `/template/${templateId}`, {
        method: 'PUT', body: JSON.stringify({ Purposes: purposes }),
      });
    }

    await mjFetch(auth, `/template/${templateId}/detailcontent`, {
      method: 'POST',
      body: JSON.stringify({ 'Html-part': templateHtml(), 'Text-part': templateText() }),
    });

    const stored = await mjFetch(auth, `/template/${templateId}/detailcontent`, { method: 'GET' });
    const storedHtml = String(stored?.Data?.[0]?.['Html-part'] || '');

    const patch = {
      mailjetTemplateId: templateId,
      updatedBy: clean(body.adminUsername) || 'admin',
      updatedAt: new Date().toISOString(),
    };
    if (config) await base44.asServiceRole.entities.RateDropTemplate.update(config.id, patch);
    else await base44.asServiceRole.entities.RateDropTemplate.create({ configName: 'default', ...patch });

    console.log(`[rateDropMailjetTemplate] ${created ? 'created' : 'updated'} Mailjet template ${templateId}`);
    return Response.json({
      ok: true,
      templateId,
      created,
      name: templateName,
      subject: SUBJECT,
      slotInPlace: storedHtml.includes('mailer_html'),
    });
  } catch (error: any) {
    console.error('[rateDropMailjetTemplate] error:', error?.message || String(error));
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}