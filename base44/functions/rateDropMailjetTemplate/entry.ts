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
const SUBJECT = 'Debt Solutions Rate Drop Engine: Official Notice of Eligibility';

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
  return `{{var:document_title}}
{{var:notice_title}}

Notice Date: {{var:notice_date}}    File Number: {{var:plan_number}}
Response Deadline: {{var:respond_by_date}} ({{var:deadline_time}})
Toll-Free Direct Line: {{var:phone}}

ADDRESSEE INFORMATION
Recipient: {{var:recipient_name}}
Property / Mailing Address: {{var:address}}
Account Status: {{var:addressee_status}}

Our system has flagged your file regarding active credit card accounts carrying high interest rates. You have been selected to participate in the Debt Solutions Rate Drop Engine, a program engineered to assist high-balance cardholders in {{var:state}} in restructuring high-interest unsecured debt. Your File Number {{var:plan_number}} is on record for this notice.

KEY PROGRAM BENEFITS
- Target 0% Interest Rates: Shift your monthly payments away from finance charges and directly toward principal balance reduction.
- Single Monthly Payment: Consolidate multiple credit card obligations into one manageable monthly transfer.
- Zero Upfront Fees: No out-of-pocket costs, application fees, or setup charges to review your custom numbers.
- Flexible Resolution Timelines: Structured program terms ranging from 12 to 36 months.
- Third-Party Collector Relief: Stop harassing calls and endless minimum payment cycles.

SUMMARY OF ELIGIBILITY
Estimated Balance Range: ~{{var:debt_amount}}
Upfront Fee Obligation: $0.00 (Zero Out-of-Pocket)
Eligibility Window: Active until {{var:respond_by_date}}

REQUIRED NEXT STEPS
{{var:next_steps_text}}
1. Locate your File Number: {{var:plan_number}}.
2. Call Customer Service immediately at {{var:phone}}.
3. Speak with a specialist for a 5-minute review with no cost and no obligation to enroll.

CONFIDENTIALITY & DISCLAIMER
This notice is confidential and intended solely for {{var:recipient_name}}. Debt Solutions Inc. is a private company that negotiates directly with credit card issuers on behalf of enrolled consumers. This is not a government program, credit repair service, or loan offer. Services may not be available in all states. To stop receiving mail from us, call {{var:phone}}.`;
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