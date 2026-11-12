# Rosie Probo GRC — Staging Deployment Wrapper

This folder contains a pinned upstream Probo container wrapper and **staging-only** evidence metadata validator and tests. Production customer data is forbidden until security acceptance.

## Deployment
- Source: https://github.com/getprobo/probo
- Deploy isolated Docker service using `Dockerfile` on the `rosie-probo-grc-staging` branch.
- Set `PROBOD_PG_CA_BUNDLE_PATH=/etc/ssl/certs/ca-certificates.crt` to verify TLS for the isolated PostgreSQL connection.
- Configure `PROBOD_PG_ADDR`, `PROBOD_PG_USERNAME`, `PROBOD_PG_PASSWORD`, `PROBOD_PG_DATABASE` through protected deployment secrets.
- Configure private S3-compatible storage with `PROBOD_AWS_*` settings and scoped credentials. **Neon Storage requires `PROBOD_AWS_USE_PATH_STYLE=true`** (verified against Neon's branch storage response and Probo's `pkg/bootstrap/builder.go` support for this setting). Never commit access keys, connection strings, tenant IDs, or storage endpoints.
- Set `PROBOD_AUTH_DISABLE_SIGNUP=true` until controlled owner enrollment can be completed privately.
- Use secure and persistent `PROBOD_ENCRYPTION_KEY`, `PROBOD_AUTH_COOKIE_SECRET`, `PROBOD_AUTH_PASSWORD_PEPPER`, `PROBOD_OAUTH2_SERVER_SIGNING_KEY` and supporting settings through secret management.
- AI provider startup is restricted to a nonfunctional staging placeholder: do not perform AI-assisted compliance processing until a scoped provider is explicitly approved.
- Set the application HTTPS base URL, exact CORS origins, and port 8080.

## Evidence contract
`rosie-evidence-v1.mjs` contains a strict **pure** validator for Core/BOB staging control metadata; `rosie-evidence-v1.test.mjs` tests allowed and rejected fields. It has **no outbound network operations**. Run tests with:

```bash
node --test services/probo-grc/rosie-evidence-v1.test.mjs
```

No live Rosie Core or BOB evidence transport is enabled. Probo administrator onboarding, private bucket object round-trip, signing/authorization, vendor security review, backup restore and cross-tenant tests are mandatory before operational use.

Private infrastructure identifiers, acceptance results, and recovery instructions are tracked in restricted Rosie Core documentation, not this public repository.

Upstream security notes: https://github.com/getprobo/probo/blob/main/SECURITY_NOTES.md
