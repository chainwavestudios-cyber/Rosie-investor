/**
 * companyInfo.ts — Company constants every commercial email must carry.
 *
 * The postal address and the opt-out link appear in every marketing / reminder
 * email, so they live in one place and every send path fills them:
 *   - debtEmailSender.ts      (coach one-to-one sends + appointment reminders)
 *   - debtMarketingRun        (campaign sends)
 *   - sendTemplateTest        (test sends, mirroring the real thing)
 *
 * Change the address here and every template picks it up on the next send.
 */

export const COMPANY_MAILING_ADDRESS = '6863 Friars Road, Suite 200, San Diego, CA 92108';

/**
 * Public opt-out link built for one recipient. The endpoint it points at
 * (unsubscribeEmail) marks the address as unsubscribed and every send path
 * checks that before sending again.
 */
export function buildUnsubscribeUrl(
  trackingBase: string,
  opts: { leadId?: string; email?: string } = {}
): string {
  const params = new URLSearchParams();
  if (opts.leadId) params.set('leadId', opts.leadId);
  if (opts.email) params.set('email', opts.email);
  return `${trackingBase}/unsubscribeEmail?${params.toString()}`;
}

/**
 * The two values, under both spellings they are written as in templates.
 * Saved emails use {{COMPANY_MAILING_ADDRESS}} / {{UNSUBSCRIBE_URL}}; new ones
 * written by hand usually use {{companyMailingAddress}} / {{unsubscribeUrl}}.
 * Both fill, because every send path replaces tags without case sensitivity.
 */
export function companyMergeVars(
  trackingBase: string,
  opts: { leadId?: string; email?: string } = {}
): Record<string, string> {
  const unsubscribeUrl = buildUnsubscribeUrl(trackingBase, opts);
  return {
    unsubscribeUrl,
    unsubscribe_url: unsubscribeUrl,
    companyMailingAddress: COMPANY_MAILING_ADDRESS,
    company_mailing_address: COMPANY_MAILING_ADDRESS,
  };
}

/** True when this address has asked us to stop emailing. */
export async function isEmailUnsubscribed(base44: any, email: string): Promise<boolean> {
  const address = String(email || '').trim().toLowerCase();
  if (!address) return false;
  // One field per query: a combined filter can silently miss the row, which would
  // let an opted-out contact keep receiving email.
  const found = await base44.asServiceRole.entities.EmailOptIn.filter({ email: address }, { limit: 20 });
  const items = Array.isArray(found) ? found : (found?.items || []);
  // A bounced address is unmailable too: mailing it again only burns the sending domain.
  return items.some((row: any) => ['unsubscribed', 'bounced'].includes(String(row?.status || '').toLowerCase()));
}