# Rosie Core → Probo signed evidence gateway: staging only

The isolated branch adds a **transport-neutral** HMAC authorization gateway, plus a Postgres adapter and SQL schema. It is **NOT** automatically loaded into the pinned upstream Probo container; no live connector exists until the HTTPS receiver and Core sender are deployed, machine credentials are provisioned, and Probo's supported authenticated API is verified.

## Existing pieces
- `rosie-evidence-v1.mjs`: strictly allowlisted sanitized evidence contract for Core and BOB.
- `evidence-admission.mjs`: authorized tenant matching, freshness, and caller scope.
- `core-evidence-gateway.mjs`: HMAC-SHA256 payload and envelope verification, replay/freshness checks; fail closed without durable adapter.
- `postgres-evidence-adapter.mjs`: transactional nonce and evidence uniqueness in a **separate bridge schema**, no Core financial tables or Probo-managed tables.
- `sql/001_evidence_gateway.sql`: proposed schema, **not executed** on Neon.

## Live integration still required
1. Securely onboard `compliance@rosieai.tech` via supported Probo first-owner process and verified SMTP. Never expose signup publicly.
2. Provision an isolated least-privilege Postgres role and approved new staging bridge database/schema; apply reviewed SQL migration.
3. Build/host a TLS-only authenticated bridge endpoint, with strict request method, size, rate and source limits. Load secret keys only via a secret manager and reject startup if missing. Never log payloads or secrets.
4. Provision real Core outbound sender and service-to-service identity; verify Probo's real GRC API auth and controlled evidence import. No direct writes into Probo-managed tables.
5. Add a **separate signed ACK** with receipt identity/status/digest and durable Core inbox acknowledgment; provide retry/dead-letter and independent evidence. Current gateway response is not signed.
6. Run two-tenant negative probes, invalid-signature/replay test, live Probo create/read evidence, object storage roundtrip, backup restore and telemetry acceptance. Independent release only.

No customer evidence, production mutation, certification claim or status promotion before all live checks pass.
