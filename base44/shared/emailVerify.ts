import { secrets } from 'base44:runtime';

// ── BounceVerify (Apify actor) — real SMTP mailbox verification ──────────────
// Answers "does this mailbox actually exist?" for any domain, including the
// free providers (Gmail, Yahoo, AOL) that format/MX checks can never tell apart.
// Returns null when the check itself could not run, so callers can hold instead
// of sending blind.

export type EmailVerdict = {
  valid: boolean;
  score: number;
  reason: string;
  isDisposable: boolean;
  isCatchAll: boolean;
};

const ACTOR_URL = 'https://api.apify.com/v2/acts/bounceverify~bounceverify-email-verifier/run-sync-get-dataset-items';

export async function verifyEmails(addresses: string[]): Promise<Map<string, EmailVerdict> | null> {
  const token = secrets.get('APIFY_API_TOKEN') || '';
  const unique = Array.from(
    new Set(
      (addresses || [])
        .map((a) => String(a || '').trim().toLowerCase())
        .filter((a) => a.includes('@')),
    ),
  );
  const out = new Map<string, EmailVerdict>();
  if (!unique.length) return out;
  if (!token) return null;

  try {
    const res = await fetch(`${ACTOR_URL}?token=${token}&timeout=120`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: unique }),
      signal: AbortSignal.timeout(110000),
    });
    if (!res.ok) return null;
    const items: any = await res.json().catch(() => []);
    for (const item of Array.isArray(items) ? items : []) {
      const address = String(item?.email || '').trim().toLowerCase();
      if (!address) continue;
      const status = String(item?.status || '').toLowerCase();
      out.set(address, {
        valid: status === 'valid' || item?.smtp_valid === true,
        score: Number(item?.score ?? 0),
        reason: String(item?.reason || status || '').trim(),
        isDisposable: item?.is_disposable === true,
        isCatchAll: item?.is_catch_all === true,
      });
    }
    return out;
  } catch {
    return null;
  }
}

// A failed check must never be read as "bad address" — the two are different.
export function isBadAddress(verdict?: EmailVerdict): boolean {
  if (!verdict || verdict.valid) return false;
  return verdict.isDisposable === true || verdict.isCatchAll !== true;
}

/** Puts an address the verifier judged undeliverable on the do-not-mail list. */
export async function suppressAddress(base44: any, address: string, reason: string) {
  const email = String(address || '').trim().toLowerCase();
  if (!email) return;
  const detail = reason || 'Mailbox verification found this address undeliverable.';
  const now = new Date().toISOString();

  const found = await base44.asServiceRole.entities.EmailOptIn.filter({ email }, { limit: 5 }).catch(() => null);
  const current = (found?.items || [])[0];
  if (current) {
    // An unsubscribe stays an unsubscribe; the verdict is recorded alongside it.
    const patch: any = { bounceReason: detail };
    if (String(current.status || '').toLowerCase() !== 'unsubscribed') {
      patch.status = 'bounced';
      patch.bouncedAt = now;
    }
    await base44.asServiceRole.entities.EmailOptIn.update(current.id, patch).catch(() => {});
    return;
  }

  await base44.asServiceRole.entities.EmailOptIn.create({
    email,
    source: 'bounce',
    status: 'bounced',
    bouncedAt: now,
    bounceReason: detail,
    recordedBy: 'BounceVerify (pre-send)',
    consentText: 'Suppressed automatically: mailbox verification found this address undeliverable.',
  }).catch(() => {});
}