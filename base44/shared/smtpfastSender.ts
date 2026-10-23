/**
 * smtpfastSender.ts — the one transport every outreach email leaves through.
 *
 * Gmail-connected sends are a separate path and keep the Chris Bongiorno
 * signature (shared/emailSignature.ts); nothing here touches them.
 *
 * The provider is Resend-compatible: POST /emails with a Bearer key. Opens and
 * clicks stay this app's own (shared/emailTracking.ts rewrites the links and
 * injects the pixel). Outreach marketing sends instead let the provider track
 * opens and clicks (providerTracking) — a message is never counted twice, and a
 * link marked data-smtpfast-track="off" is left exactly as it was written.
 */
import { secrets } from 'base44:runtime';

const API = 'https://smtpfa.st/api/v1';

/** The identity the campaign engines send under. */
export const OUTREACH_FROM_NAME = 'Stephani Sterling - RateDrop Credit Systems';

export type SmtpfastAttachment = {
  filename: string;
  content: string;
  content_type?: string;
  content_id?: string;
};

type SendOptions = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  /** Transactional mail still reaches people who opted out of marketing. */
  category?: 'marketing' | 'transactional';
  /** Kept as a provider tag so a send can be traced back to its record. */
  customId?: string;
  /** Lets SMTPfast track opens and clicks for this send (outreach marketing). */
  providerTracking?: boolean;
  attachments?: SmtpfastAttachment[];
};

/** Sends one email and returns the provider's message id. */
export async function smtpfastSend(opts: SendOptions): Promise<{ id: string; to: string | string[] }> {
  const key = secrets.get('SMTPFAST_API_KEY');
  if (!key) throw new Error('SMTPfast is not configured (SMTPFAST_API_KEY).');
  const from = opts.from || secrets.get('SMTPFAST_FROM_EMAIL');
  if (!from) throw new Error('SMTPfast sender address is not configured (SMTPFAST_FROM_EMAIL).');
  const fromName = opts.fromName || secrets.get('SMTPFAST_FROM_NAME') || '';

  const payload: Record<string, unknown> = {
    from: fromName ? `${fromName} <${from}>` : from,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    category: opts.category || 'marketing',
    track_opens: !!opts.providerTracking,
    track_clicks: !!opts.providerTracking,
  };
  if (opts.html) payload.html = opts.html;
  if (opts.text) payload.text = opts.text;
  if (!payload.html && !payload.text) payload.text = ' ';
  if (opts.replyTo) payload.reply_to = opts.replyTo;
  if (opts.customId) payload.tags = [{ name: 'custom_id', value: String(opts.customId) }];
  if (opts.attachments && opts.attachments.length) payload.attachments = opts.attachments;

  let response: Response;
  try {
    response = await fetch(`${API}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });
  } catch (error: any) {
    throw new Error(`Could not reach SMTPfast: ${error?.message || String(error)}`);
  }
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || !data?.id) {
    throw new Error(`SMTPfast: ${data?.error || `send failed (${response.status})`}`);
  }
  return { id: String(data.id), to: opts.to };
}

/** Mailjet's attachment shape (Name / ContentType / Base64Content) as SMTPfast's. */
export function toSmtpfastAttachments(
  rows: { Name?: string; name?: string; ContentType?: string; mime?: string; Base64Content?: string; base64?: string }[]
): SmtpfastAttachment[] {
  return (rows || []).filter(Boolean).map((row) => ({
    filename: String(row.Name || row.name || 'attachment'),
    content: String(row.Base64Content || row.base64 || ''),
    ...(row.ContentType || row.mime ? { content_type: String(row.ContentType || row.mime) } : {}),
  }));
}