/**
 * rateDropMailer.ts — The Rate Drop Engine's mailer builder + sender.
 *
 * One place that turns a contact card into a "DEBT Solutions" digital mailer
 * (black banner, formal serif body, bordered data box, benefits grid, big CTA
 * phone) and one place that emails it through the app's outreach sender. The
 * mailer HTML IS the email body — nothing is assembled at the provider.
 *
 * The phone printed on the mailer is the incoming line the AI agent answers
 * (AIAgentConfig.twilioLineKey), so the mailer and the scripts point at the
 * same number.
 */

import { smtpfastSend } from './smtpfastSender.ts';

export const DEFAULT_BENEFITS = [
  {
    title: 'Target 0% Interest Rates',
    text: 'Shift your monthly payments away from finance charges and directly toward principal balance reduction.',
  },
  {
    title: 'Single Monthly Payment',
    text: 'Consolidate multiple credit card obligations into one manageable monthly transfer.',
  },
  {
    title: 'Zero Upfront Fees',
    text: 'No out-of-pocket costs, application fees, or setup charges to review your custom numbers.',
  },
  {
    title: 'Flexible Resolution Timelines',
    text: 'Structured program terms ranging from 12 to 36 months.',
  },
  {
    title: 'Third-Party Collector Relief',
    text: 'Stop harassing calls and endless minimum payment cycles.',
  },
];

export const DEFAULT_ELIGIBILITY = [
  { label: 'Identified Account Type', value: 'Unsecured Credit Cards (3 Active Accounts)' },
  { label: 'Minimum Required Debt', value: '$10,000+' },
  { label: 'Estimated Balance Range', value: '~{{debt_amount}}' },
  { label: 'Upfront Fee Obligation', value: '$0.00 (Zero Out-of-Pocket)' },
  { label: 'Eligibility Window', value: 'Active until {{respond_by_date}}' },
];

export const DEFAULT_NEXT_STEPS = [
  'Locate your File Number: {{plan_number}}.',
  'Call Customer Service immediately at {{phone}}.',
  'Speak with a specialist for a 5-minute review with no cost and no obligation to enroll.',
];

export const MAILER_SLOTS = [
  { slot: 'recipient_name', label: 'Recipient Name' },
  { slot: 'address_line', label: 'Recipient Address' },
  { slot: 'state', label: 'Recipient State' },
  { slot: 'plan_number', label: 'Plan / File Number' },
  { slot: 'debt_amount', label: 'Total Past Due, Debt Amount' },
  { slot: 'reduction_to', label: 'Total Debt Reduction To' },
  { slot: 'savings_amount', label: 'Debt Reduction Savings' },
  { slot: 'notice_date', label: 'Notice Date' },
  { slot: 'respond_by_date', label: 'Respond By Date' },
  { slot: 'phone', label: 'Call-To-Action Phone' },
  { slot: 'protoface_id', label: 'Protoface ID (per-lead video token)' },
];

export const CONTACT_FIELD_SOURCES = [
  { value: 'full_name', label: 'Contact card — Full name' },
  { value: 'first_name', label: 'Contact card — First name' },
  { value: 'last_name', label: 'Contact card — Last name' },
  { value: 'full_address', label: 'Contact card — Full mailing address' },
  { value: 'address', label: 'Contact card — Street address' },
  { value: 'city', label: 'Contact card — City' },
  { value: 'state', label: 'Contact card — State' },
  { value: 'zip_code', label: 'Contact card — Zip code' },
  { value: 'notice_id', label: 'Contact card — Notice ID' },
  { value: 'protoface_id', label: 'Contact card — Protoface ID (per-lead video token)' },
  { value: 'lead_number', label: 'Contact card — Lead number' },
  { value: 'debt_amount', label: 'Contact card — Debt amount' },
  { value: 'email', label: 'Contact card — Email' },
  { value: 'card_phone', label: 'Contact card — Phone' },
  { value: 'savings_amount', label: 'Computed — Savings (debt × reduction %)' },
  { value: 'reduction_to', label: 'Computed — Reduced balance (debt − savings)' },
  { value: 'notice_date', label: 'Computed — Notice date (today)' },
  { value: 'respond_by_date', label: 'Computed — Respond-by date' },
  { value: 'inbound_line', label: 'Incoming AI agent line (from AI Agent settings)' },
];

export const DEFAULT_FIELD_MAP = {
  recipient_name: 'full_name',
  address_line: 'full_address',
  state: 'state',
  plan_number: 'notice_id',
  protoface_id: 'protoface_id',
  debt_amount: 'debt_amount',
  reduction_to: 'reduction_to',
  savings_amount: 'savings_amount',
  notice_date: 'notice_date',
  respond_by_date: 'respond_by_date',
  phone: 'inbound_line',
};

export const DEFAULT_RATE_DROP_TEMPLATE = {
  configName: 'default',
  name: 'DEBT Solutions Rate Drop Notice',
  documentTitle: 'THE DEBT SOLUTIONS RATE DROP ENGINE',
  noticeTitle: 'OFFICIAL NOTICE OF ELIGIBILITY',
  deadlineTime: '5:00 PM PST',
  addresseeStatus: 'PENDING REVIEW, UNSECURED REVOLVING CREDIT ACCOUNTS',
  overviewText:
    'Our system has flagged your file regarding active credit card accounts carrying high interest rates. You have been selected to participate in the Debt Solutions Rate Drop Engine, a program engineered to assist high-balance cardholders in {{state}} in restructuring high-interest unsecured debt. Your File Number {{plan_number}} is on record for this notice.',
  qualifyText:
    'If you are currently carrying 3 or more active credit card balances, you may qualify for immediate rate reduction strategies designed to target 0% interest terms and significantly lower your monthly outlay, with zero upfront fees.',
  benefitsJson: JSON.stringify(DEFAULT_BENEFITS),
  eligibilityJson: JSON.stringify(DEFAULT_ELIGIBILITY),
  nextStepsText:
    'Enrollment spots are limited by regional quotas in Riverside, San Bernardino, and Los Angeles counties. To lock in your eligibility and review your real numbers with a specialist:',
  nextStepsJson: JSON.stringify(DEFAULT_NEXT_STEPS),
  disclaimerText:
    'This notice is confidential and intended solely for {{recipient_name}}. Debt Solutions Inc. is a private company that negotiates directly with credit card issuers on behalf of enrolled consumers. This is not a government program, credit repair service, or loan offer. Services may not be available in all states. Savings shown are estimates based on the balances on file and are not guaranteed; individual results vary with creditor cooperation, program length and the ability to fund a dedicated account. To stop receiving mail from us, call {{phone}}.',
  savingsPercent: 60,
  respondByDays: 30,
  ctaPhoneOverride: '',
  fieldMapJson: JSON.stringify(DEFAULT_FIELD_MAP),
};

/**
 * Sample contact card for the vault's test mailer. It is never stored: the
 * preview renders the mailer from it so the field map and copy can be checked
 * before a real card exists.
 */
export const MOCK_CARD = {
  firstName: 'Sample',
  lastName: 'Homeowner',
  address: '1428 Sample Ave',
  city: 'Riverside',
  state: 'CA',
  zipCode: '92503',
  debtAmount: 20000,
  noticeId: 'NFS-99999-999',
  leadNumber: '#F0000',
  email: 'sample@example.com',
  phone: '5555555555',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function escapeHtml(value: any): string {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function money(value: any): string {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  if (!isFinite(n) || n <= 0) return '$0';
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** +16193530919 → (619) 353-0919 */
export function formatPhone(raw: any): string {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return String(raw || '');
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function formatLongDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

export function cardFullName(card: any): string {
  return [card?.firstName, card?.lastName].filter(Boolean).join(' ').trim() || 'Homeowner';
}

/** Placeholder text that must never be printed as part of a mailing address. */
const ADDRESS_PLACEHOLDER = /^(n\/?a\.?|none|unknown|-+)$/i;

function addressParts(values: any[]): string[] {
  return values
    .flatMap(v => String(v ?? '').split(','))
    .map(v => v.trim())
    .filter(v => v && !ADDRESS_PLACEHOLDER.test(v));
}

export function cardFullAddress(card: any): string {
  return addressParts([
    card?.address,
    [card?.city, card?.state].map(v => String(v || '').trim()).filter(Boolean).join(', '),
    card?.zipCode,
  ]).join(', ');
}

function cardDebt(card: any): number {
  const n = Number(card?.debtAmount);
  return isFinite(n) && n > 0 ? n : 0;
}

/**
 * A vault lead as a mailer card — the same fields distribution writes onto the
 * contact card, so previewing an undistributed vault lead matches the mailer it
 * will be issued with. Notice IDs are issued at distribution, so an
 * undistributed lead carries a placeholder instead of a number.
 */
export function vaultEntryToMailerCard(entry: any): any {
  return {
    firstName: entry?.firstName || '',
    lastName: entry?.lastName || '',
    address: addressParts([entry?.address, entry?.apt]).join(', '),
    city: entry?.city || '',
    state: entry?.state || '',
    zipCode: entry?.zipCode || '',
    debtAmount: Number(entry?.debtAmount) || Number(entry?.estimatedDebt) || 0,
    noticeId: entry?.noticeId || '(assigned at distribution)',
    leadNumber: entry?.batchLabel || '',
    email: entry?.email || '',
    phone: entry?.phoneE164 || entry?.mobilePhone || entry?.phone || '',
  };
}

/** The incoming line the AI agent answers — the number printed on the mailer. */
export async function resolveInboundPhone(base44: any): Promise<string> {
  try {
    const rows = await base44.asServiceRole.entities.AIAgentConfig.filter({ configName: 'default' });
    const cfg = (Array.isArray(rows) ? rows : rows?.items || [])[0] || {};
    const raw = (cfg.twilioLineKey && Deno.env.get(cfg.twilioLineKey)) || Deno.env.get('TWILIO_FROM_NUMBER') || '';
    return formatPhone(raw);
  } catch {
    return formatPhone(Deno.env.get('TWILIO_FROM_NUMBER') || '');
  }
}

export async function getRateDropTemplate(base44: any): Promise<any> {
  const rows = await base44.asServiceRole.entities.RateDropTemplate.filter({ configName: 'default' });
  const stored = (Array.isArray(rows) ? rows : rows?.items || [])[0];
  if (!stored) return { ...DEFAULT_RATE_DROP_TEMPLATE };
  // A blank stored value means "never set", so the built-in copy still shows in
  // the engine and in the editor instead of an empty field.
  const filled = Object.fromEntries(
    Object.entries(stored).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );
  return { ...DEFAULT_RATE_DROP_TEMPLATE, ...filled };
}

function parseList(raw: any, fallback: any[]): any[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {}
  return fallback;
}

/** Key Program Benefits as {title, text} pairs (a bare string is kept as a title). */
export function benefitsOf(template: any): { title: string; text: string }[] {
  return parseList(template?.benefitsJson, DEFAULT_BENEFITS)
    .map((b: any) =>
      typeof b === 'string'
        ? { title: b, text: '' }
        : { title: String(b?.title || ''), text: String(b?.text || '') }
    )
    .filter((b: any) => b.title || b.text);
}

/** Summary of Eligibility as {label, value} rows (values may carry {{slots}}). */
export function eligibilityOf(template: any): { label: string; value: string }[] {
  return parseList(template?.eligibilityJson, DEFAULT_ELIGIBILITY)
    .map((r: any) =>
      Array.isArray(r)
        ? { label: String(r[0] || ''), value: String(r[1] || '') }
        : { label: String(r?.label || ''), value: String(r?.value || '') }
    )
    .filter((r: any) => r.label || r.value);
}

/** Required Next Steps as numbered lines ({{slots}} allowed). */
export function nextStepsOf(template: any): string[] {
  return parseList(template?.nextStepsJson, DEFAULT_NEXT_STEPS)
    .map((s: any) => String(typeof s === 'string' ? s : s?.text || ''))
    .filter(Boolean);
}

export function fieldMapOf(template: any): Record<string, string> {
  try {
    const parsed = JSON.parse(template?.fieldMapJson || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { ...DEFAULT_FIELD_MAP, ...parsed };
  } catch {}
  return { ...DEFAULT_FIELD_MAP };
}

function resolveSource(card: any, source: string, ctx: any): any {
  const debt = cardDebt(card);
  const savings = Math.round((debt * Number(ctx.savingsPercent || 0)) / 100);
  switch (source) {
    case 'full_name': return cardFullName(card);
    case 'first_name': return card?.firstName || '';
    case 'last_name': return card?.lastName || '';
    case 'full_address': return cardFullAddress(card);
    case 'address': return card?.address || '';
    case 'city': return card?.city || '';
    case 'state': return card?.state || '';
    case 'zip_code': return card?.zipCode || '';
    case 'notice_id': return card?.noticeId || '';
    case 'protoface_id': return card?.protofaceId || '';
    case 'lead_number': return card?.leadNumber || '';
    case 'debt_amount': return money(debt);
    case 'email': return card?.email || '';
    case 'card_phone': return card?.phone || '';
    case 'savings_amount': return money(savings);
    case 'reduction_to': return money(debt - savings);
    case 'notice_date': return formatLongDate(ctx.now);
    case 'respond_by_date': return formatLongDate(addDays(ctx.now, ctx.respondByDays));
    case 'inbound_line': return ctx.phone || '';
    default: return '';
  }
}

/** Resolve every mailer slot from the contact card through the field map. */
export function resolveMailerSlots(template: any, card: any, ctx: any): Record<string, string> {
  const map = fieldMapOf(template);
  const values: Record<string, string> = {};
  for (const { slot } of MAILER_SLOTS) {
    values[slot] = escapeHtml(resolveSource(card, map[slot] || '', ctx));
  }
  const debt = cardDebt(card);
  const savings = Math.round((debt * Number(ctx.savingsPercent || 0)) / 100);
  values.savings_raw = String(savings);
  values.debt_raw = String(debt);
  values.phone_raw = ctx.phone || '';
  return values;
}

function fill(text: any, values: Record<string, string>): string {
  return String(text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key) => values[String(key).toLowerCase()] ?? '');
}

/** The black section bar that opens every block of the notice. */
function sectionHeader(title: string): string {
  return `<tr><td colspan="2" style="background:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.6px;text-transform:uppercase;text-align:center;padding:8px 10px;">${escapeHtml(title)}</td></tr>`;
}

/** Label / value rows, two to a line, inside a bordered box. */
function twoColRows(pairs: { label: string; value: string }[]): string {
  const cell = (right: boolean) =>
    `width:50%;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;padding:7px 10px;border-bottom:1px solid #000000;${right ? 'border-right:1px solid #000000;' : ''}vertical-align:top;`;
  let html = '';
  for (let i = 0; i < pairs.length; i += 2) {
    const left = pairs[i];
    const right = pairs[i + 1];
    html +=
      `<tr><td style="${cell(true)}"><b>${escapeHtml(left.label)}:</b> ${left.value}</td>` +
      (right
        ? `<td style="${cell(false)}"><b>${escapeHtml(right.label)}:</b> ${right.value}</td>`
        : `<td style="${cell(false)}">&nbsp;</td>`) +
      `</tr>`;
  }
  return html;
}

function benefitRows(benefits: { title: string; text: string }[], values: Record<string, string>): string {
  return benefits
    .map((b, i) => {
      const last = i === benefits.length - 1;
      const title = fill(b.title, values);
      return `<tr><td style="padding:9px 12px;${last ? '' : 'border-bottom:1px solid #000000;'}font-size:12px;line-height:1.55;vertical-align:top;">${title ? `<b>${title}:</b> ` : ''}${fill(b.text, values)}</td></tr>`;
    })
    .join('');
}

function eligibilityRows(rows: { label: string; value: string }[], values: Record<string, string>): string {
  const head =
    'font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;padding:6px 10px;border-bottom:1px solid #000000;';
  return (
    `<tr><td width="42%" style="${head}border-right:1px solid #000000;">Parameter</td><td style="${head}">Status / Value</td></tr>` +
    rows
      .map((r, i) => {
        const last = i === rows.length - 1;
        const border = last ? '' : 'border-bottom:1px solid #000000;';
        return `<tr><td width="42%" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;padding:7px 10px;border-right:1px solid #000000;${border}vertical-align:top;"><b>${fill(r.label, values)}</b></td><td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;padding:7px 10px;${border}vertical-align:top;">${fill(r.value, values)}</td></tr>`;
      })
      .join('')
  );
}

function nextStepRows(steps: string[], values: Record<string, string>): string {
  return steps
    .map((step, i) => {
      const last = i === steps.length - 1;
      const pad = last ? '14px' : '2px';
      return `<tr><td width="26" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;padding:4px 0 ${pad} 12px;vertical-align:top;">${i + 1}.</td><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;padding:4px 12px ${pad} 0;vertical-align:top;">${fill(step, values)}</td></tr>`;
    })
    .join('');
}

/** Builds the complete, email-safe digital notice for one contact card. */
export function buildMailerHtml(template: any, card: any, ctx: any): string {
  const values = resolveMailerSlots(template, card, ctx);
  const benefits = benefitsOf(template);
  const eligibility = eligibilityOf(template);
  const nextSteps = nextStepsOf(template);
  const phoneText = escapeHtml(String(template?.ctaPhoneOverride || '').trim() || ctx.phone || '');
  const deadline = escapeHtml(String(template?.deadlineTime || '').trim());

  const meta = [
    { label: 'Notice Date', value: values.notice_date },
    { label: 'File Number', value: values.plan_number },
    { label: 'Response Deadline', value: `${values.respond_by_date}${deadline ? ` (${deadline})` : ''}` },
    { label: 'Toll-Free Direct Line', value: values.phone },
  ];
  const addressee = [
    { label: 'Recipient', value: values.recipient_name },
    { label: 'Property / Mailing Address', value: values.address_line },
    { label: 'Account Status', value: fill(template.addresseeStatus, values) },
  ];

  const box = (inner: string) =>
    `<tr><td style="padding:16px 22px 0 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #000000;">${inner}</table></td></tr>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;margin:0;padding:0;">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="width:680px;max-width:100%;background:#ffffff;color:#000000;font-family:Georgia,'Times New Roman',serif;">
<tr><td style="background:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:0.6px;text-transform:uppercase;text-align:center;padding:13px 18px;">${escapeHtml(template.documentTitle)}</td></tr>
<tr><td style="text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:16px 22px 0 22px;">${escapeHtml(template.noticeTitle)}</td></tr>
<tr><td style="text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#444444;padding:5px 22px 0 22px;">Confidential Information. For Addressees Only.</td></tr>
${box(twoColRows(meta))}
${box(sectionHeader('Addressee Information') + twoColRows(addressee))}
${box(
    sectionHeader('Notice Details & Program Overview') +
      `<tr><td colspan="2" style="padding:10px 12px 0 12px;font-size:12px;line-height:1.6;text-align:justify;">${fill(template.overviewText, values)}</td></tr>` +
      `<tr><td colspan="2" style="padding:10px 12px 12px 12px;font-size:12px;line-height:1.6;text-align:justify;">${fill(template.qualifyText, values)}</td></tr>`
  )}
${box(sectionHeader('Key Program Benefits') + benefitRows(benefits, values))}
${box(sectionHeader('Summary Of Eligibility') + eligibilityRows(eligibility, values))}
${box(
    sectionHeader('Required Next Steps') +
      `<tr><td colspan="2" style="padding:10px 12px 2px 12px;font-size:12px;line-height:1.6;text-align:justify;">${fill(template.nextStepsText, values)}</td></tr>` +
      nextStepRows(nextSteps, values)
  )}
<tr><td style="text-align:center;padding:20px 22px 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;letter-spacing:0.5px;">${phoneText}</td></tr>
<tr><td style="text-align:center;padding:6px 22px 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Toll-Free Direct Line</td></tr>
<tr><td style="padding:16px 22px 24px 22px;font-family:Arial,Helvetica,sans-serif;font-size:9px;line-height:1.45;text-align:justify;color:#111111;"><b>CONFIDENTIALITY &amp; DISCLAIMER:</b> ${fill(template.disclaimerText, values)}</td></tr>
</table>
</td></tr>
</table>`;
}

export function buildMailerContext(phone: string, template: any, now?: Date) {
  return {
    phone,
    savingsPercent: Number(template?.savingsPercent) || 60,
    respondByDays: Number(template?.respondByDays) || 30,
    now: now || new Date(),
  };
}

/**
 * Generates and stores the digital mailer for each contact card (idempotent:
 * an existing mailer for the card is refreshed, never duplicated).
 */
export async function ensureMailers(base44: any, leadIds: string[]): Promise<{ generated: number }> {
  const ids = (leadIds || []).filter(Boolean).slice(0, 200);
  if (!ids.length) return { generated: 0 };

  const [template, phone] = await Promise.all([getRateDropTemplate(base44), resolveInboundPhone(base44)]);
  const ctx = buildMailerContext(phone, template);

  const cardsPage = await base44.asServiceRole.entities.FronterLead.filter({ id: { $in: ids } }, { limit: 200 });
  const cards = Array.isArray(cardsPage) ? cardsPage : cardsPage?.items || [];
  if (!cards.length) return { generated: 0 };

  const existingPage = await base44.asServiceRole.entities.RateDropMailer.filter({ leadId: { $in: ids } }, { limit: 500 });
  const existing = Array.isArray(existingPage) ? existingPage : existingPage?.items || [];
  const byLead = new Map<string, any>();
  for (const m of existing) byLead.set(m.leadId, m);

  const nowIso = new Date().toISOString();
  const toCreate: any[] = [];
  const toUpdate: any[] = [];

  for (const card of cards) {
    const html = buildMailerHtml(template, card, ctx);
    const debt = Number(card.debtAmount) || 0;
    const savings = Math.round((debt * ctx.savingsPercent) / 100);
    const payload = {
      leadId: card.id,
      leadNumber: card.leadNumber || '',
      noticeId: card.noticeId || '',
      recipientName: cardFullName(card),
      email: card.email || '',
      state: card.state || '',
      debtAmount: debt,
      savingsAmount: savings,
      phone,
      templateName: template.name || DEFAULT_RATE_DROP_TEMPLATE.name,
      html,
      generatedAt: nowIso,
    };
    const found = byLead.get(card.id);
    if (found) toUpdate.push({ id: found.id, ...payload });
    else toCreate.push(payload);
  }

  if (toCreate.length) await base44.asServiceRole.entities.RateDropMailer.bulkCreate(toCreate);
  if (toUpdate.length) await base44.asServiceRole.entities.RateDropMailer.bulkUpdate(toUpdate);
  return { generated: toCreate.length + toUpdate.length };
}

export async function findMailer(base44: any, leadId: string): Promise<any | null> {
  const page = await base44.asServiceRole.entities.RateDropMailer.filter({ leadId }, { limit: 1 });
  const rows = Array.isArray(page) ? page : page?.items || [];
  return rows[0] || null;
}

/** The notice subject the Rate Drop engine sends under. */
export const DEFAULT_RATE_DROP_SUBJECT = 'Debt Solutions Rate Drop Engine: Official Notice of Eligibility';

export async function sendRateDropMailer(base44: any, opts: {
  to: string;
  toName: string;
  subject?: string;
  mailer: any;
  card: any;
  template?: any;
  customId?: string;
}): Promise<{ messageId: string; messageUUID: string }> {
  // Every Rate Drop mailer goes out under this sender name; Gmail-connected sends
  // keep the Chris Bongiorno / DAAA signature (shared/emailSignature.ts) instead.
  const fromName = 'Stephani Sterling - RateDrop Credit Systems';

  const to = String(opts.to || '').trim();
  if (!to) throw new Error('No email address on the contact card.');
  const template = opts.template || DEFAULT_RATE_DROP_TEMPLATE;
  const mailerHtml = String(opts.mailer?.html || '');
  // The plain-text fallback says the same thing as the notice itself.
  const text = mailerHtml
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  const delivered = await smtpfastSend({
    to,
    subject: String(opts.subject || '').trim() || DEFAULT_RATE_DROP_SUBJECT,
    html: mailerHtml,
    text: `${text}\n\n${opts.mailer?.phone || ''}`.trim(),
    fromName,
    category: 'marketing',
    customId: opts.customId || '',
  });
  return { messageId: delivered.id, messageUUID: '' };
}