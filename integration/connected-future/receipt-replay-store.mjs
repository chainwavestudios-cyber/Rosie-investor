/**
 * A server-side replay store for authenticated Rosie ticket receipts.
 *
 * REQUIRES review/apply of sql/receipt-replay-table.sql to an authorized
 * isolated Neon staging branch. This adapter does not create tables or deploy.
 *
 * Supply a trusted PostgreSQL Pool.query bound to the correct Core tenant
 * environment and a least-privilege gateway role, never a browser credential.
 * Each attempt uses ONE atomic INSERT .. ON CONFLICT statement.
 * Expires must remain in durable storage at least until the signed envelope
 * expiration; deleting rows before expiry would re-enable replay.
 */
const HEX_SHA256 = /^[0-9a-f]{64}$/;
const INSERT_CLAIM = `INSERT INTO rosie_ticket_lab.ticket_receipt_replay_keys
  (nonce_digest, expires_at)
SELECT $1::text, to_timestamp($2::double precision / 1000.0)
WHERE to_timestamp($2::double precision / 1000.0) > clock_timestamp()
ON CONFLICT (nonce_digest) DO NOTHING
RETURNING nonce_digest`;

export function createPostgresReplayStore({ query } = {}) {
  if (typeof query !== 'function') throw new TypeError('trusted PG query required');
  return Object.freeze({
    async claimOnce(nonceDigest, expiresAtMs) {
      if (typeof nonceDigest !== 'string' || !HEX_SHA256.test(nonceDigest) ||
          !Number.isSafeInteger(expiresAtMs) || expiresAtMs <= 0) {
        return false;
      }
      // Fail closed on any DB error; the auth boundary catches errors.
      const result = await query(INSERT_CLAIM, [nonceDigest, expiresAtMs]);
      return Array.isArray(result?.rows) && result.rows.length === 1 &&
        result.rows[0]?.nonce_digest === nonceDigest;
    },
  });
}
