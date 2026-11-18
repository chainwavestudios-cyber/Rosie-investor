-- Rosie Core -> Probo sanitized evidence ingress, isolated staging bridge database ONLY.
-- Apply with reviewed migration and separate least-privilege bridge DB role.
-- Does not modify upstream Probo schema, customer data or Core finance tables.
CREATE SCHEMA IF NOT EXISTS rosie_grc_bridge;
CREATE TABLE IF NOT EXISTS rosie_grc_bridge.replay_nonce (
  replay_key text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT replay_key_size CHECK (length(replay_key) BETWEEN 16 AND 260)
);
CREATE TABLE IF NOT EXISTS rosie_grc_bridge.evidence_inbox (
  receipt_id text PRIMARY KEY,
  dedupe_key text NOT NULL UNIQUE,
  source_node text NOT NULL,
  target_probo_org text NOT NULL,
  envelope_digest char(64) NOT NULL,
  event_json jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT envelope_sha256 CHECK (envelope_digest ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS evidence_inbox_received_at_idx
ON rosie_grc_bridge.evidence_inbox (received_at DESC);
-- Retention and backup policy must be approved before operational evidence.
