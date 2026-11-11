# Rosie Probo GRC staging deployment

**Status:** deployment wrapper only; do not mark operational until startup, authentication, storage and isolation checks pass.

## Source and deployment
- Upstream: https://github.com/getprobo/probo
- Pinned upstream container: `artifact.probo.inc/probo/probo:v0.340.0`; verify upstream signature and advisories before production.
- Render workspace: `tea-db8481rncjis73eigoqg`; region Ohio; Docker runtime; Dockerfile path `services/probo-grc/Dockerfile`; Docker context `.`.
- Source branch: `rosie-probo-grc-staging`. Disable automatic release updates.
- Isolated Neon PostgreSQL 18 project: `frosty-wave-45975958`, database `probo`.
- Private object bucket: `rosie-probo-evidence-staging` on branch `br-winter-river-bdw497pg`.

## Prerequisites before public exposure
1. Generate and persist random secrets in Render secret environment (never in Git):
   `PROBOD_ENCRYPTION_KEY` (32 random bytes base64), `PROBOD_AUTH_COOKIE_SECRET`, `PROBOD_AUTH_PASSWORD_PEPPER`, `PROBOD_TRUST_AUTH_TOKEN_SECRET` (strong random bytes), `PROBOD_OAUTH2_SERVER_SIGNING_KEY` (RSA private key). Never rotate encryption key without backed-up migration.
2. Obtain Neon database connection details through authorized secret tooling: `PROBOD_PG_ADDR`, `PROBOD_PG_USERNAME`, `PROBOD_PG_PASSWORD`, `PROBOD_PG_DATABASE=probo`. Enforce TLS, dedicated restricted role, network constraints. Avoid exposing raw URL or password in logs or tickets.
3. Obtain service credentials for private, S3-compatible bucket; configure `PROBOD_AWS_REGION=us-east-2`, `PROBOD_AWS_BUCKET=rosie-probo-evidence-staging`, `PROBOD_AWS_ENDPOINT=https://br-winter-river-bdw497pg.storage.c-8.us-east-2.aws.neon.tech`, `PROBOD_AWS_ACCESS_KEY_ID`, `PROBOD_AWS_SECRET_ACCESS_KEY`. Confirm this endpoint and auth mechanism are compatible with Probo's S3 client in staging.
4. Set `PROBOD_BASE_URL` to Render's actual HTTPS URL, `PROBOD_API_ADDR=0.0.0.0:8080`, `PROBOD_AUTH_COOKIE_SECURE=true`, `PROBOD_API_CORS_ALLOWED_ORIGINS` to exact HTTPS origin, and email delivery configuration for sign-in.
5. Configure Render ingress allowlist or upstream SSO/zero-trust control. No external trust center, customer files, secrets, payment details, or production tenant exports.
6. Verify health endpoint and sign-in, tenant isolation, role escalation protections, GraphQL request limits, object upload/download, email, backup and restore before enabling any Core-to-Probo synchronization.
7. Keep the `rosie.grc.evidence.v1` link **disabled** until least-privilege service auth, idempotency and redaction checks pass.

## Security and support
Probo self-hosting docs: https://www.probo.com/docs/deployment/self-hosting
Probo security notes: https://github.com/getprobo/probo/blob/main/SECURITY_NOTES.md

This branch must remain independent of active Rosie/BOB production deployments.
