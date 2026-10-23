/**
 * gmailSend.ts — Single implementation of "send a raw MIME message through Gmail".
 * Used by sendGmailEmail (custom sends) and by shared/debtEmailSender.ts
 * (template sends from the contact card + appointment automation), so both paths
 * behave identically and report the same clear errors.
 */

/** Pull the plain address out of "Name <addr>" / "mailto:addr" / " addr ". */
export function normalizeEmail(raw) {
  const s = String(raw || '').trim();
  const inside = s.match(/<([^>]+)>/);
  return (inside ? inside[1] : s).replace(/^mailto:/i, '').trim().toLowerCase();
}

export function assertValidEmail(addr) {
  if (!addr || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr)) {
    throw new Error(`Invalid recipient email address: "${addr || '(empty)'}"`);
  }
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function gmailAccessToken(base44) {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    if (!accessToken) throw new Error('no access token returned');
    return accessToken;
  } catch (e) {
    const msg = String(e?.message || e);
    if (/expired|not connected|no active connector|reconnect/i.test(msg)) {
      throw new Error('The Gmail connection has expired — reconnect Gmail (Integrations) to resume sending.');
    }
    throw new Error(`Gmail is not connected — reconnect it in Integrations. (${msg})`);
  }
}

/**
 * Sends one already-built RFC 2822 message. Normalizes/validates the recipient,
 * times the call out at 20s so a stalled Gmail call can never hang the request,
 * and turns every provider failure into a plain-language, actionable error.
 */
export async function sendViaGmail(base44, to, rawMime) {
  const recipient = normalizeEmail(to);
  assertValidEmail(recipient);

  const accessToken = await gmailAccessToken(base44);

  let response;
  try {
    response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: toBase64Url(rawMime) }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      throw new Error('Gmail did not respond within 20 seconds — the message was not sent. Try again.');
    }
    throw new Error(`Could not reach Gmail: ${e?.message || String(e)}`);
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    if (response.status === 401 || response.status === 403) {
      throw new Error('Gmail rejected the send (connection expired or permission missing) — reconnect Gmail in Integrations.');
    }
    if (response.status === 429) {
      throw new Error('Gmail daily sending limit reached — stop sending for today or use another account.');
    }
    if (response.status === 400 || response.status === 422) {
      throw new Error(`Gmail rejected the message for ${recipient}: ${detail || 'invalid recipient or message'}`);
    }
    throw new Error(`Gmail send failed (${response.status}): ${detail || 'no details returned'}`);
  }

  const data = await response.json().catch(() => ({}));
  return { messageId: data.id || '', recipient };
}

/**
 * The address of the Gmail account actually doing the sending (so every recorded
 * send can name it). Resolved once per running function instance.
 */
let cachedGmailIdentity = '';

export async function getGmailIdentity(base44): Promise<string> {
  if (cachedGmailIdentity) return cachedGmailIdentity;
  try {
    const accessToken = await gmailAccessToken(base44);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      cachedGmailIdentity = data.emailAddress || '';
    }
  } catch (e) {
    console.warn('[gmailSend] Could not read the sending address:', e?.message || String(e));
  }
  return cachedGmailIdentity;
}