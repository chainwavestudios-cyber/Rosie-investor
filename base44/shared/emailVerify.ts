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

// The actor answers one run per request, so a whole uploaded list is split into
// batches that are checked side by side — a 500-row list is scanned in full
// without any single request running past its timeout.
const BATCH_SIZE = 100;

async function askVerifier(token: string, batch: string[]): Promise<any[] | null> {
  try {
    const res = await fetch(`${ACTOR_URL}?timeout=120`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emails: batch }),
      signal: AbortSignal.timeout(110000),
    });
    if (!res.ok) return null;
    const items = await res.json().catch(() => null);
    return Array.isArray(items) ? items : null;
  } catch {
    return null;
  }
}

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

  const batchCount = Math.ceil(unique.length / BATCH_SIZE);
  const batches: string[][] = Array.from({ length: batchCount }, (_, k) => unique.slice(k * BATCH_SIZE, (k + 1) * BATCH_SIZE));

  const results = await Promise.all(batches.map((batch) => askVerifier(token, batch)));
  // One failed batch means the list was not scanned in full — the caller must
  // treat the whole check as failed rather than mail the part it never saw.
  if (results.some((items) => items === null)) return null;

  for (const items of results) {
    for (const item of items || []) {
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
  }
  return out;
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