/**
 * Hard separation: Debt Call Coach Gmail is for Debt Advisors of America only.
 * Fronter / cold-outreach source templates must NEVER enter this pipeline.
 * Validation applies on the server immediately before sending, not just in UI.
 */
export const DAA_WELCOME_URL = 'https://debtsolutions.cc/welcome';

const forbidden = /\b(?:golden\s*boy|goldenboy|stephani\s+live\s+video|fronter|nb\s*tech)\b/i;
const daaIdentity = /\b(?:debt\s+advisors\s+of\s+america|debtadvisorsofamerica\.com|DAA)\b/i;
const unsupportedLink = /(?:rosieai-investorpage\.base44\.app|abitaboutme\.base44\.app)/i;

/** A template can be selected/sent through the DAA Gmail channel only if its
 * actual subject/body are DAA-identified and it is not imported from Fronter. */
export function daaTemplateIssue(template: any): string {
  if (!template) return 'Email template not found.';
  if (String(template.source || '').toLowerCase() === 'fronter') return 'Fronter templates cannot be sent from Debt Call Coach Gmail.';
  const name=String(template.name||'');
  const subject=String(template.subject||'');
  const body=String(template.bodyHtml||'');
  if (forbidden.test([name,subject,body].join(' '))) return 'This email contains non-DAA/Fronter branding. It is blocked from Debt Call Coach.';
  if (!daaIdentity.test([name,subject,body].join(' '))) return 'The email must identify Debt Advisors of America before it can be sent from Debt Call Coach Gmail.';
  if (!subject.trim() || !body.trim()) return 'A DAA subject and email body are required.';
  if (unsupportedLink.test(body)) return 'Outdated Base44 personal-message links are not allowed; use the tracked DAA welcome link.';
  return '';
}
export function isDAATemplate(template: any): boolean { return !daaTemplateIssue(template); }

/** Insert a visible audio invitation once, leaving all existing copy/layout in
 * place. Replacement uses a per-email opaque token at send time. */
export function withDAAWelcomeCTA(html: string): string {
  let body=String(html||'');
  if (/\{\{\s*personalMessageUrl\s*\}\}/i.test(body))return body;
  const cta = '<div style="max-width:560px;margin:18px auto;padding:16px 18px;border:1px solid #d7bd83;border-radius:10px;text-align:center;background:#fbf8f0;">'
    + '<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#3d3527;margin-bottom:10px;">A personal message from Debt Advisors of America</div>'
    + '<a href="{{personalMessageUrl}}" style="display:inline-block;padding:12px 19px;border-radius:7px;background:#a27d38;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;">Listen to My Personal Welcome Message</a>'
    + '</div>';
  if (/<\/body\s*>/i.test(body)) return body.replace(/<\/body\s*>/i,cta+'</body>');
  if (/<\/html\s*>/i.test(body)) return body.replace(/<\/html\s*>/i,cta+'</html>');
  return body+cta;
}
