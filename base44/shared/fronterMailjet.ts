import { secrets } from 'base44:runtime';
import { MAILJET_FROM_NAME } from './mailjetSender.ts';
import { injectTracking } from './emailTracking.ts';
import { getRateDropTemplate, resolveInboundPhone, buildMailerContext, buildMailerHtml, resolveMailerSlots } from './rateDropMailer.ts';

// This workspace deliberately has no account selector or account-one fallback.
export async function mailjet2(path, method = 'GET', payload = undefined) {
  const key = secrets.get('MAILJET_2_API_KEY');
  const secret = secrets.get('MAILJET_2_API_SECRET');
  if (!key || !secret) throw new Error('Mailjet account 2 is not configured.');
  const response = await fetch(`https://api.mailjet.com${path}`, {
    method, headers: { Authorization: `Basic ${btoa(`${key}:${secret}`)}`, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Mailjet account 2: ${data.ErrorMessage || JSON.stringify(data).slice(0, 300)}`);
  return data;
}

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

export async function readMarketingTemplate(base44, templateId) {
  const id = Number(templateId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Choose a Mailjet account 2 template.');
  const [meta, content, linked] = await Promise.all([
    mailjet2(`/v3/REST/template/${id}`), mailjet2(`/v3/REST/template/${id}/detailcontent`),
    base44.asServiceRole.entities.FronterEmailTemplate.filter({ mailjetTemplateId: String(id), emailProvider: 'mailjet' }, { limit: 1 }),
  ]);
  const html = content.Data?.[0]?.['Html-part'] || '';
  const local = rowsOf(linked)[0];
  return { id: String(id), name: meta.Data?.[0]?.Name || 'Mailjet template', subject: local?.subject || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || meta.Data?.[0]?.Name || '', html, text: content.Data?.[0]?.['Text-part'] || '', localId: local?.id || '' };
}

export async function saveMarketingTemplate(base44, id, draft, user) {
  if (!String(draft.html || '').trim() || !String(draft.subject || '').trim()) throw new Error('A subject and email body are required.');
  let html = String(draft.html);
  const title = `<title>${escape(draft.subject)}</title>`;
  html = /<title\b/i.test(html) ? html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, title) : `<html><head>${title}</head><body>${html}</body></html>`;
  await mailjet2(`/v3/REST/template/${id}`, 'PUT', { Name: draft.name, Purposes: ['marketing', 'transactional'] });
  await mailjet2(`/v3/REST/template/${id}/detailcontent`, 'POST', { 'Html-part': html, 'Text-part': textOf(html) });
  if (draft.localId) await base44.asServiceRole.entities.FronterEmailTemplate.update(draft.localId, { body: html, subject: draft.subject, emailProvider: 'mailjet', mailjetTemplateId: String(id), includeSignature: false, updatedBy: user.username });
  return await readMarketingTemplate(base44, id);
}

export async function renderMarketingEmail(base44, template, card) {
  const variables = { firstName: card.firstName || '', lastName: card.lastName || '', first_name: card.firstName || '', last_name: card.lastName || '', email: card.email || '', phone: card.phone || '', state: card.state || '', leadId: card.id || '', debtAmount: card.debtAmount ? `$${Number(card.debtAmount).toLocaleString()}` : '' };
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

export async function sendMarketingEmail(base44, template, card, { test = false, sandbox = false } = {}) {
  const to = String(card.email || '').trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to) || /[\r\n]/.test(to)) throw new Error('Enter a valid recipient email address.');
  const from = secrets.get('MAILJET_2_FROM_EMAIL');
  if (!from) throw new Error('Mailjet account 2 sender address is not configured.');
  const rendered = await renderMarketingEmail(base44, template, { ...card, email: to });
  const sendId = crypto.randomUUID();
  const html = !test && card.id ? injectTracking(rendered.html, card.id, sendId, template.localId || template.id, template.name) : rendered.html;
  // The saved account-two template is the authoritative content; render it here
  // so each contact gets their own tracked links without altering the shared copy.
  const data = await mailjet2('/v3.1/send', 'POST', { SandboxMode: !!sandbox, Messages: [{ From: { Email: from, Name: MAILJET_FROM_NAME }, To: [{ Email: to, Name: `${card.firstName || ''} ${card.lastName || ''}`.trim() }], Subject: rendered.subject, HTMLPart: html, TextPart: rendered.text, CustomID: `fronter:${sendId}`, TrackOpens: test ? 'disabled' : 'enabled', TrackClicks: test ? 'disabled' : 'enabled' }] });
  const info = data.Messages?.[0];
  if (info?.Status !== 'success') throw new Error(`Mailjet account 2: ${JSON.stringify(info?.Errors || data).slice(0, 300)}`);
  return { to, sendId, subject: rendered.subject, messageId: String(info.To?.[0]?.MessageID || ''), from, sandbox: !!sandbox, provider: 'mailjet', account: 2, templateId: template.id };
}