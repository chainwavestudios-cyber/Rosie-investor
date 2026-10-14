import { secrets } from 'base44:runtime';
import { toE164 } from './twilioHelpers.ts';

async function signingKey() {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secrets.get('TWILIO_AUTH_TOKEN')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createCallCutoffOverride(phone) {
  const payload = btoa(JSON.stringify({ phone: toE164(phone), expires: Date.now() + 120000 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const bytes = await crypto.subtle.sign('HMAC', await signingKey(), new TextEncoder().encode(payload));
  const signature = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  return `${payload}.${signature}`;
}

export async function verifyCallCutoffOverride(token, phone) {
  try {
    const [payload, signature, extra] = String(token || '').split('.');
    if (!payload || !/^[a-f0-9]{64}$/.test(signature || '') || extra) return false;
    const bytes = new Uint8Array(signature.match(/../g).map(byte => parseInt(byte, 16)));
    if (!await crypto.subtle.verify('HMAC', await signingKey(), bytes, new TextEncoder().encode(payload))) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const grant = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return grant.phone === toE164(phone) && Number.isFinite(grant.expires) && grant.expires > Date.now() && grant.expires <= Date.now() + 120000;
  } catch {
    return false;
  }
}