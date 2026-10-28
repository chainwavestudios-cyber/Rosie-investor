/**
 * emailCampaign.ts — the engine behind the Email Campaign Manager.
 *
 * One place decides, for a CSV row, whether it may be emailed and what it looks
 * like when it is: the address is normalized and validated, opt-outs are honored,
 * a contact card is matched (never merged on a phone number alone), an invitation
 * token is minted, and the email is rendered with that recipient's own values —
 * so one recipient's data or invitation token can never reach another inbox.
 *
 * The visual design stays in the template; this module only fills it.
 */
import { fillMergeTags } from './mergeTags.ts';
import { formatProtofaceId, PROTOFACE_ID_RE, qualifyLink } from './protofaceId.ts';
import { assistantList, loadConfig } from './videoQualify.ts';
import { normalizeEmail } from './gmailSend.ts';
import { companyMergeVars, isEmailUnsubscribed } from './companyInfo.ts';
import { TRACKING_BASE } from './emailTracking.ts';

export { isEmailUnsubscribed };

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Fields a CSV row may write onto a contact card. */
export const CARD_FIELDS = ['firstName', 'lastName', 'phone', 'address', 'city', 'state', 'zip', 'email'];

/** Fields the recipient row keeps for its own display and personalization. */
export const RECIPIENT_FIELDS = ['firstName', 'lastName', 'phone', 'company', 'city', 'state', 'source', 'debtAmount', 'leadDate', 'status'];

export function clean(value: unknown): string {
  return String(value ?? '').trim();
}

/** A lowercased, deliverable address, or an empty string when it is not one. */
export function normalizeAddress(raw: unknown): string {
  const value = normalizeEmail(String(raw ?? ''));
  return EMAIL_RE.test(value) ? value : '';
}

/** Text going into an HTML body is escaped, so a CSV cell can never inject markup. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The faces a visitor can be invited to meet (rosie, chris, …). */
export async function campaignAssistants(base44: any): Promise<Array<{ key: string; name: string }>> {
  const cfg = await loadConfig(base44).catch(() => null);
  return assistantList(cfg).map((a: any) => ({ key: String(a.key), name: String(a.name) }));
}

export function inviteLinks(token: string, assistants: Array<{ key: string; name: string }>) {
  const links: Record<string, string> = {};
  for (const a of assistants || []) {
    if (!token) break;
    links[`${a.key}InviteLink`] = qualifyLink(token, a.key);
  }
  return links;
}

/** True when this card already carries a usable invitation token. */
export function existingToken(card: any): string {
  const value = clean(card?.protofaceId);
  return PROTOFACE_ID_RE.test(value) ? value : '';
}

export function newToken(): string {
  return formatProtofaceId();
}

/**
 * The values one recipient's email is written with: their own columns, their own
 * invitation links, and the company/opt-out values every commercial email carries.
 */
export function recipientVars(recipient: any, assistants: Array<{ key: string; name: string }>): Record<string, string> {
  const email = clean(recipient?.email).toLowerCase();
  const first = clean(recipient?.firstName);
  const last = clean(recipient?.lastName);
  const token = clean(recipient?.inviteToken);
  const vars: Record<string, string> = {
    firstName: first,
    firstname: first,
    lastName: last,
    lastname: last,
    fullName: `${first} ${last}`.trim() || 'there',
    email,
    phone: clean(recipient?.phone),
    company: clean(recipient?.company),
    city: clean(recipient?.city),
    state: clean(recipient?.state),
    source: clean(recipient?.source),
    status: clean(recipient?.status),
    debtAmount: amountOf(recipient) ? String(amountOf(recipient)) : '',
    leadDate: clean(recipient?.leadDate),
    leadId: clean(recipient?.leadId),
    inviteToken: token,
    inviteLink: token ? qualifyLink(token) : '',
  };
  Object.assign(vars, inviteLinks(token, assistants));
  try {
    const custom = JSON.parse(clean(recipient?.customJson) || '{}');
    for (const [key, value] of Object.entries(custom || {})) {
      if (!(key in vars)) vars[key] = String(value ?? '');
    }
  } catch {
    // A malformed extra-columns blob simply contributes nothing.
  }
  Object.assign(vars, companyMergeVars(TRACKING_BASE, { leadId: vars.leadId, email }));
  // The per-send opaque token is minted and attached by emailMessageEngine.
  vars.personalMessageUrl = 'https://debtsolutions.cc/welcome';
  return vars;
}

/** Every {{tag}} a template uses. */
export function templateTags(source: string): string[] {
  const found = new Set<string>();
  for (const match of String(source || '').matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) found.add(match[1]);
  return [...found];
}

function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(?:p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * One recipient's finished email. The subject and plain text keep raw values
 * (an apostrophe must not arrive as an entity); the HTML body gets escaped
 * values, so nothing a CSV contained can become markup or a script.
 */
export function renderEmail(template: any, vars: Record<string, string>) {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) safe[key] = escapeHtml(value);

  const subject = fillMergeTags(String(template?.subject || ''), vars).replace(/\s+/g, ' ').trim();
  const html = fillMergeTags(String(template?.bodyHtml || ''), safe);
  const rawText = String(template?.bodyText || '').trim();
  const text = rawText ? fillMergeTags(rawText, vars) : stripHtml(html);

  const tags = templateTags(`${template?.subject || ''}\n${template?.bodyHtml || ''}\n${template?.bodyText || ''}`);
  const lower = new Set(Object.keys(vars).map((key) => key.toLowerCase()));
  const missing = tags.filter((tag) => !lower.has(tag.toLowerCase()));

  return { subject, html, text, tags, missing, images: (html.match(/<img\b/gi) || []).length, links: (html.match(/<a\s+[^>]*href=/gi) || []).length };
}

/** The debt amount on a row as a number, or 0 when the cell holds no figure. */
export function amountOf(row: any): number {
  const number = Number(String(row?.debtAmount ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

/** A lead-date cell as YYYY-MM-DD — ISO, US "10/01/2026", "October 1, 2026" — or the text as typed. */
export function normalizeLeadDate(value: unknown): string {
  const text = clean(value);
  if (!text) return '';
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const us = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(text);
  if (us) {
    let year = Number(us[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return `${year}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return text;
}

/** A card's own empty fields, filled from the row — never overwriting what is there. */
export function cardPatchFor(card: any, row: any): Record<string, any> {
  const patch: Record<string, any> = {};
  for (const field of CARD_FIELDS) {
    const incoming = clean(row?.[field]);
    const existing = clean(card?.[field]);
    if (incoming && !existing) patch[field] = incoming;
  }
  const amount = amountOf(row);
  if (amount && !Number(clean(card?.debtAmount) || 0)) patch.debtAmount = amount;
  return patch;
}

/** The card a brand-new contact is created from. */
export function cardForRow(row: any, listName: string) {
  const amount = amountOf(row);
  return {
    firstName: clean(row?.firstName) || 'Contact',
    lastName: clean(row?.lastName),
    email: clean(row?.email).toLowerCase(),
    phone: clean(row?.phone),
    address: clean(row?.address),
    city: clean(row?.city),
    state: clean(row?.state),
    zip: clean(row?.zip),
    ...(amount ? { debtAmount: amount } : {}),
    status: 'new',
    cardType: 'campaign',
    notes: `Added by the Email Campaign Manager${listName ? ` (list: ${listName})` : ''}.`,
  };
}

/** Minutes past midnight for "HH:MM". */
function minutesOfDay(value: string, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clean(value));
  if (!match) return fallback;
  return Math.min(23, Number(match[1])) * 60 + Math.min(59, Number(match[2]));
}

function zoneParts(timezone: string, at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'America/New_York',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute') };
}

/** The instant the current day began in the campaign's timezone. */
export function zonedDayStart(timezone: string, now: Date = new Date()): Date {
  const tz = timezone || 'America/New_York';
  const today = zoneParts(tz, now);
  const guess = Date.UTC(today.year, today.month - 1, today.day, 0, 0, 0);
  // The offset at that guessed instant, applied once, lands on the real local midnight.
  const atGuess = zoneParts(tz, new Date(guess));
  const offset = Date.UTC(atGuess.year, atGuess.month - 1, atGuess.day, atGuess.hour, atGuess.minute) - guess;
  return new Date(guess - offset);
}

/** Is the queue allowed to send right now, and what time is it there? */
export function sendingWindow(campaign: any, now: Date = new Date()) {
  const tz = clean(campaign?.timezone) || 'America/New_York';
  const local = zoneParts(tz, now);
  const minutes = local.hour * 60 + local.minute;
  const start = minutesOfDay(clean(campaign?.windowStart), 8 * 60);
  const end = minutesOfDay(clean(campaign?.windowEnd), 20 * 60);
  const clock = `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
  const open = start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
  return { open, clock, timezone: tz, start: clean(campaign?.windowStart) || '08:00', end: clean(campaign?.windowEnd) || '20:00' };
}