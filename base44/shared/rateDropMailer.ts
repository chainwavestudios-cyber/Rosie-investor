/**
 * rateDropMailer.ts — The Rate Drop Engine's mailer builder + sender.
 *
 * One place that turns a contact card into a "DEBT Solutions" digital mailer
 * (black banner, formal serif body, bordered data box, benefits grid, big CTA
 * phone) and one place that emails it through Mailjet. The mailer HTML is
 * injected into the campaign's Mailjet template as the `mailer_html` variable,
 * never attached.
 *
 * The phone printed on the mailer is the incoming line the AI agent answers
 * (AIAgentConfig.twilioLineKey), so the mailer and the scripts point at the
 * same number.
 */

export const DEFAULT_BENEFITS = [
  'Reduce Overall Debt by up to 60%',
  'Avoid Costly Debt Management Programs',
  'Alternative To Bankruptcy',
  'Avoid Negative Public Record',
  'Immediate Reduction of Payments up to 60%',
  'Settle Credit Card Debt 12 to 36 Months',
  'Make Only 1 Payment per Month',
  'Minimize Harassing Calls From Collectors',
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
  debt_amount: 'debt_amount',
  reduction_to: 'reduction_to',
  savings_amount: 'savings_amount',
  notice_date: 'notice_date',
  respond_by_date: 'respond_by_date',
  phone: 'inbound_line',
};

export const DEFAULT_RATE_DROP_TEMPLATE = {
  configName: 'default',
  name: 'DEBT Solutions Rate Drop Mailer',
  companyName: 'DEBT SOLUTIONS',
  headerBanner:
    'DEBT SOLUTIONS RATE DROP ENGINE — DELINQUENT CREDIT CARD ACCOUNT ASSISTANCE. PLEASE REVIEW ENTIRE DOCUMENT.',
  introText:
    'Your File Number {{plan_number}} has been included to participate in The Debt Solutions Rate Drop Engine due to the recent delinquent payments filed against you and shown on your tri-bureau credit report. It is imperative that you contact Customer Service Immediately at {{phone}} to take advantage of The Rate Drop Engine. Respond by {{respond_by_date}} by 5PM to ensure eligibility into one of the four available hardship programs.',
  importantNotice:
    'Enrollment is limited. To ensure your eligibility status, you must call now. No further notices will be sent.',
  summaryBanner: 'RDE Debt Benefits and Savings of {{savings_amount}} exclusively for {{recipient_name}}',
  benefitsJson: JSON.stringify(DEFAULT_BENEFITS),
  warningText: 'FAILURE TO RESPOND TO THIS NOTICE WILL AFFECT YOUR ELIGIBILITY',
  bottomTitle: 'The Debt Solutions Rate Drop Engine',
  legalText:
    'This notice is a debt relief program solicitation and is not a guarantee of results. Debt Solutions is not a law firm and does not provide legal, tax or accounting advice. Savings shown are estimates based on the balances on file and the program range, and are not guaranteed; individual results vary based on creditor cooperation, program length and the ability to fund a dedicated account. Please read and understand all program materials before enrolling. To stop receiving mail from us, call {{phone}}.',
  savingsPercent: 60,
  respondByDays: 30,
  ctaPhoneOverride: '',
  fieldMapJson: JSON.stringify(DEFAULT_FIELD_MAP),
  mailjetTemplateId: '',
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

export function cardFullAddress(card: any): string {
  const cityState = [card?.city, card?.state].filter(Boolean).join(', ');
  return [card?.address, cityState, card?.zipCode].filter(Boolean).join(', ');
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
    address: [entry?.address, entry?.apt].filter(Boolean).join(', '),
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
  return { ...DEFAULT_RATE_DROP_TEMPLATE, ...stored };
}

export function benefitsOf(template: any): string[] {
  try {
    const parsed = JSON.parse(template?.benefitsJson || '[]');
    if (Array.isArray(parsed) && parsed.length) return parsed.map((b: any) => String(b));
  } catch {}
  return DEFAULT_BENEFITS;
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

function benefitRows(benefits: string[]): string {
  const cell = (text: string, last: boolean, right: boolean) =>
    `<td width="50%" style="border-right:${right ? '1px solid #000000' : 'none'};border-bottom:${last ? 'none' : '1px solid #000000'};padding:8px 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.35;vertical-align:top;">${escapeHtml(text)}</td>`;
  let html = '';
  for (let i = 0; i < benefits.length; i += 2) {
    const isLast = i + 2 >= benefits.length;
    const left = benefits[i] || '';
    const right = benefits[i + 1];
    html +=
      `<tr>${cell(left, isLast, true)}` +
      (right !== undefined
        ? cell(right, isLast, false)
        : `<td width="50%" style="border-bottom:none;padding:8px 10px;">&nbsp;</td>`) +
      `</tr>`;
  }
  return html;
}

/** Builds the complete, email-safe digital mailer for one contact card. */
export function buildMailerHtml(template: any, card: any, ctx: any): string {
  const values = resolveMailerSlots(template, card, ctx);
  const benefits = benefitsOf(template);
  const phoneText = escapeHtml(String(template?.ctaPhoneOverride || '').trim() || ctx.phone || '');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;margin:0;padding:0;">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="width:680px;max-width:100%;background:#ffffff;color:#000000;font-family:Georgia,'Times New Roman',serif;">
<tr><td style="background:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:0.4px;text-transform:uppercase;text-align:center;padding:14px 18px;">${escapeHtml(template.headerBanner)}</td></tr>
<tr><td style="padding:14px 22px 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000000;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="left">Notice Date: ${values.notice_date}</td>
<td align="right">Confidential Information. For Addressees Only</td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 22px 0 22px;font-size:15px;">${values.recipient_name}</td></tr>
<tr><td style="padding:10px 22px 0 22px;font-size:13px;line-height:1.55;text-align:justify;">${fill(template.introText, values)}</td></tr>
<tr><td style="padding:12px 22px 0 22px;font-size:13px;line-height:1.5;"><span style="font-weight:bold;text-decoration:underline;">Important Notice:</span> <span style="font-style:italic;">${escapeHtml(template.importantNotice)}</span></td></tr>
<tr><td style="padding:18px 22px 0 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #000000;">
<tr><td style="background:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;text-align:center;padding:9px 10px;">${fill(template.summaryBanner, values)}</td></tr>
<tr><td style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="50%" style="border-right:1px solid #000000;border-bottom:1px solid #000000;padding:8px 10px;font-size:12px;">RDE Benefits Recipient: ${values.recipient_name}</td>
<td width="50%" style="border-bottom:1px solid #000000;padding:8px 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;">RDE PLAN NUMBER: ${values.plan_number}</td>
</tr>
<tr>
<td style="border-right:1px solid #000000;border-bottom:1px solid #000000;padding:8px 10px;font-size:12px;">Recipient Address: ${values.address_line}</td>
<td style="border-bottom:1px solid #000000;padding:8px 10px;font-size:12px;">Recipient State: ${values.state}</td>
</tr>
<tr>
<td style="border-right:1px solid #000000;padding:8px 10px;font-size:12px;">Total Past Due, Debt Amount: ${values.debt_amount}</td>
<td style="padding:8px 10px;font-size:12px;">Total Debt Reduction To: ${values.reduction_to}</td>
</tr>
</table>
</td></tr>
<tr><td style="background:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;text-align:center;padding:9px 10px;">RDE Preapproved Debt Reduction Savings: ${values.savings_amount}</td></tr>
</table>
</td></tr>
<tr><td style="padding:18px 22px 0 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #000000;">
<tr><td colspan="2" style="background:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;text-align:center;padding:9px 10px;">RDE Benefits for ${values.recipient_name}</td></tr>
${benefitRows(benefits)}
</table>
</td></tr>
<tr><td style="text-align:center;padding:22px 22px 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:bold;letter-spacing:0.5px;">${phoneText}</td></tr>
<tr><td style="text-align:center;padding:10px 22px 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;">${escapeHtml(template.warningText)}</td></tr>
<tr><td style="text-align:center;padding:10px 22px 0 22px;font-size:19px;font-weight:bold;">${escapeHtml(template.bottomTitle)}</td></tr>
<tr><td style="padding:16px 22px 24px 22px;font-size:9px;line-height:1.45;text-align:justify;color:#111111;">${fill(template.legalText, values)}</td></tr>
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

/**
 * Sends one digital mailer through Mailjet: the campaign's template carries the
 * layout and the mailer HTML is injected as the `mailer_html` variable.
 */
export async function sendRateDropMailer(base44: any, opts: {
  to: string;
  toName: string;
  mailjetTemplateId: string | number;
  mailer: any;
  card: any;
  customId?: string;
}): Promise<{ messageId: string; messageUUID: string }> {
  // Rate Drop mailers send from their own Mailjet account; the rest of the app's
  // email keeps using the original one.
  const key = Deno.env.get('MAILJET_2_API_KEY');
  const secret = Deno.env.get('MAILJET_2_API_SECRET');
  const fromEmail = Deno.env.get('MAILJET_2_FROM_EMAIL');
  // Mailjet sends only — every Rate Drop mailer goes out under this sender name.
  // Gmail-connected sends keep the Chris Bongiorno / DAAA signature (shared/emailSignature.ts).
  const fromName = 'Stephani Sterling - RateDrop Credit Systems';
  if (!key || !secret || !fromEmail) throw new Error('Rate Drop Mailjet credentials not configured (MAILJET_2_API_KEY, MAILJET_2_API_SECRET, MAILJET_2_FROM_EMAIL)');

  const message: any = {
    From: { Email: fromEmail, Name: fromName },
    To: [{ Email: opts.to, Name: opts.toName || '' }],
    TemplateID: Number(opts.mailjetTemplateId),
    TemplateLanguage: true,
    Variables: {
      mailer_html: opts.mailer?.html || '',
      notice_id: opts.mailer?.noticeId || '',
      plan_number: opts.mailer?.noticeId || '',
      first_name: opts.card?.firstName || '',
      last_name: opts.card?.lastName || '',
      recipient_name: opts.mailer?.recipientName || '',
      address: cardFullAddress(opts.card),
      state: opts.card?.state || '',
      debt_amount: money(opts.card?.debtAmount),
      savings_amount: money(opts.mailer?.savingsAmount),
      phone: opts.mailer?.phone || '',
    },
  };
  if (opts.customId) message.CustomID = opts.customId;

  const res = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${key}:${secret}`)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Messages: [message] }),
    signal: AbortSignal.timeout(20000),
  });

  const data: any = await res.json().catch(() => ({}));
  const info = data?.Messages?.[0];
  if (!res.ok || info?.Status !== 'success') {
    throw new Error(`Mailjet: ${JSON.stringify(info?.Errors || data).slice(0, 300)}`);
  }
  return {
    messageId: String(info?.To?.[0]?.MessageID || ''),
    messageUUID: info?.To?.[0]?.MessageUUID || '',
  };
}