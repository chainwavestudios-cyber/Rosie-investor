/**
 * verifyTwilioSignature.ts — Validates Twilio webhook request signatures.
 *
 * Twilio signs form webhooks with HMAC-SHA1 over URL plus alphabetically
 * sorted form parameters (not the raw request body) using the auth token. This prevents forged callbacks from initiating calls or
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

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  const sign = async (input: string) => {
    const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input)));
    let binary = '';
    for (let i = 0; i < sigBytes.length; i++) binary += String.fromCharCode(sigBytes[i]);
    return btoa(binary);
  };
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(rawBody);
    const names = [...new Set([...params.keys()])].sort();
    const canonical = req.url + names.map(name => params.getAll(name).sort().map(value => name + value).join('')).join('');
    if (await sign(canonical) === twilioSignature) return true;
  }
  // Non-form endpoints and backwards compatibility with previous callback signing.
  return await sign(req.url + rawBody) === twilioSignature;
}