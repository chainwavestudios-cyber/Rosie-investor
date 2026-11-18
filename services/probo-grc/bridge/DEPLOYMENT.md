# Separate bridge service deployment (DO NOT deploy to upstream Probo service)
- Docker build context: repository root. Dockerfile: `services/probo-grc/bridge/Dockerfile`.
- Staging-only. This service accepts signed and allowlisted evidence metadata, stores it transactionally in the isolated bridge schema, then emits a signed **bridge-persisted** ACK. It does NOT import evidence into Probo.
- Required protected env: `CORE_BRIDGE_ENABLED=true`, `NODE_ENV=staging`, `CORE_BRIDGE_DATABASE_URL` (bridge-only database role, SSL-verified Neon), `CORE_BRIDGE_SOURCE_HMAC_KEY` (random >=32 characters), `CORE_BRIDGE_ACK_HMAC_KEY` (different random >=32 characters), `CORE_BRIDGE_SOURCE_ID`, `CORE_BRIDGE_SOURCE_ORG`, `CORE_BRIDGE_PROBO_ORG`, `CORE_BRIDGE_SOURCE_APP_KEY=core` (or bob). `PORT` optional.
- All source and target organizations must be provisioned through approved Core/Probo identity mapping. Do not fake a Probo org ID: initial Probo owner enrollment remains prerequisite.
- Terminate TLS at trusted ingress. Do not expose the bridge publicly until WAF/IP ingress restrictions, source identities, secrets, logs, and rate controls are accepted.
- Never deploy by changing the existing `rosie-probo-grc-staging` Render service Dockerfile. Provision a separate service only after credentials and network boundaries are verified.
- No live Probo evidence sync or Core sender; no release claim until two-way trace and independent checks.
