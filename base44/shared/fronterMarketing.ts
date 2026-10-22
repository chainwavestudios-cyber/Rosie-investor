import { OUTREACH_FROM_NAME, smtpfastSend } from './smtpfastSender.ts';
import { injectTracking } from './emailTracking.ts';
import { getRateDropTemplate, resolveInboundPhone, buildMailerContext, buildMailerHtml, resolveMailerSlots } from './rateDropMailer.ts';

/**
 * fronterMarketing.ts — the froter marketing workspace's templates and sends.
 * Templates live in FronterEmailTemplate (emailProvider 'smtpfast'); every send
 * goes out through shared/smtpfastSender.ts. Google-connected email is a
 * separate path and is untouched by this module.
 */
export async function marketingUser(base44, body) {
  const platformUser = await base44.auth.me().catch(() => null);
  if (body.sessionUserId && body.sessionToken) {
    const response = await base44.functions.invoke('debtCoachAuth', { action: 'me', sessionUserId: body.sessionUserId, sessionToken: body.sessionToken });
    const user = response.data?.user;
    if (user && ['fronter', 'super_admin', 'admin'].includes(user.role)) return { ...user, canEdit: ['super_admin', 'admin'].includes(user.role) };
    throw new Error('Forbidden');
  }
  if (platformUser?.role === 'admin') return { username: platformUser.email, canEdit: true, role: 'admin' };
  throw new Error(platformUser ? 'Forbidden' : 'Unauthorized');
}

const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const decode = value => String(value || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const textOf = html => decode(String(html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const rowsOf = value => value?.items || value || [];

/** The marketing templates saved in this app, newest first. */
export async function listMarketingTemplates(base44) {
  const page = await base44.asServiceRole.entities.FronterEmailTemplate.filter({ emailProvider: 'smtpfast' }, { sort: 'sortOrder', limit: 100 });
  return rowsOf(page).map(row => ({ id: String(row.id), name: row.label || 'Marketing template' }));
}

/** One saved marketing template, ready to preview, edit or send. */
export async function readMarketingTemplate(base44, templateId) {
  const id = String(templateId || '');
  if (!id) throw new Error('Choose a marketing template.');
  const local = await base44.asServiceRole.entities.FronterEmailTemplate.get(id).catch(() => null);
  if (!local) throw new Error('That marketing template no longer exists.');
  const html = String(local.body || '');
  return { id: local.id, name: local.label || 'Marketing template', subject: local.subject || '', html, text: textOf(html), localId: local.id };
}

export async function saveMarketingTemplate(base44, id, draft, user) {
  if (!String(draft.html || '').trim() || !String(draft.subject || '').trim()) throw new Error('A subject and email body are required.');
  const local = await base44.asServiceRole.entities.FronterEmailTemplate.get(id).catch(() => null);
  if (!local) throw new Error('That marketing template no longer exists.');
  await base44.asServiceRole.entities.FronterEmailTemplate.update(local.id, {
    subject: draft.subject,
    body: String(draft.html),
    label: draft.name || local.label,
    emailProvider: 'smtpfast',
    includeSignature: false,
    updatedBy: user.username,
  });
  return await readMarketingTemplate(base44, local.id);
}

export async function renderMarketingEmail(base44, template, card) {
  const variables = { firstName: card.firstName || '', lastName: card.lastName || '', protoface_id: card.protofaceId || '', protofaceId: card.protofaceId || '', first_name: card.firstName || '', last_name: card.lastName || '', email: card.email || '', phone: card.phone || '', state: card.state || '', leadId: card.id || '', debtAmount: card.debtAmount ? `$${Number(card.debtAmount).toLocaleString()}` : '' };
  if (/mailer_html/.test(template.html)) {
    const [config, phone] = await Promise.all([getRateDropTemplate(base44), resolveInboundPhone(base44)]);
    const context = buildMailerContext(phone, config);
    const slots = resolveMailerSlots(config, card, context);
    Object.assign(variables, Object.fromEntries(Object.entries(slots).map(([key, value]) => [key, decode(value)])), { mailer_html: buildMailerHtml(config, card, context), address: decode(slots.address_line || ''), phone, document_title: config.documentTitle, notice_title: config.noticeTitle, deadline_time: config.deadlineTime });
  }
  const fill = (source, isHtml) => String(source || '').replace(/\{\{\s*(?:var:)?([\w]+)(?::"[^"]*")?\s*\}\}/gi, (token, key) => {
    const found = Object.keys(variables).find(name => name.toLowerCase() === key.toLowerCase());
    if (!found) return token;
    return isHtml && found !== 'mailer_html' ? escape(variables[found]) : String(variables[found]);
  });
  const html = fill(template.html, true);
  return { html, subject: fill(template.subject, false), text: textOf(html) };
}

export async function sendMarketingEmail(base44, template, card, { test = false } = {}) {
  const to = String(card.email || '').trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to) || /[\r\n]/.test(to)) throw new Error('Enter a valid recipient email address.');
  const rendered = await renderMarketingEmail(base44, template, { ...card, email: to });
  const sendId = crypto.randomUUID();
  // The saved template is the authoritative content; it is rendered here so each
  // contact gets their own tracked links without altering the shared copy.
  const html = !test && card.id ? injectTracking(rendered.html, card.id, sendId, template.localId || template.id, template.name) : rendered.html;
  const sent = await smtpfastSend({
    to,
    subject: rendered.subject,
    html,
    text: rendered.text,
    fromName: OUTREACH_FROM_NAME,
    category: 'marketing',
    customId: `fronter:${sendId}`,
  });
  return { to, sendId, subject: rendered.subject, messageId: sent.id, provider: 'smtpfast', templateId: template.id };
}