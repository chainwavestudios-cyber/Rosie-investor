-- REVIEW-ONLY migration; NOT applied by this pull request.
-- Target: isolated, authorized Neon staging branch only.
-- Requires rosie_ticket_lab schema already established by ticket-lease lab.
-- Apply only through reviewed migrations with a dedicated least-privilege DB role.
BEGIN;
CREATE TABLE IF NOT EXISTS rosie_ticket_lab.ticket_receipt_replay_keys (
  nonce_digest text PRIMARY KEY CHECK (nonce_digest ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON TABLE rosie_ticket_lab.ticket_receipt_replay_keys FROM PUBLIC;
-- Grant only INSERT and tightly limited RETURNING SELECT to a reviewed
-- dedicated gateway role (not a browser user, anon role or customer tenant).
-- No automatic DELETE policy: signed TTL must pass before any cleanup.
COMMIT;
