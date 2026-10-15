/**
 * verifyTwilioSignature.ts — Validates Twilio webhook request signatures.
 *
 * Twilio signs each request with HMAC-SHA1 over (URL + raw body) using the
 * auth token. This prevents forged callbacks from initiating calls or
 * mutating lead records.
 *
 * Returns true when:
 *   - The signature matches
 *   - No TWILIO_AUTH_TOKEN is configured (dev/preview mode — skip silently)
 *
 * Returns false when:
 *   - A token is configured but the X-Twilio-Signature header is missing
 *   - The computed HMAC does not match the header
 */
import { secrets } from 'base44:runtime';

export async function verifyTwilioSignature(req: Request, rawBody: string): Promise<boolean> {
  const authToken = secrets.get('TWILIO_AUTH_TOKEN') || '';
  if (!authToken) return true; // dev/preview — no token configured

  const twilioSignature = req.headers.get('X-Twilio-Signature') || '';
  if (!twilioSignature) return false;

  // Twilio signs: full URL + raw POST body
  const data = new TextEncoder().encode(req.url + rawBody);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
  let binary = '';
  for (let i = 0; i < sigBytes.length; i++) binary += String.fromCharCode(sigBytes[i]);
  const computed = btoa(binary);

  return computed === twilioSignature;
}