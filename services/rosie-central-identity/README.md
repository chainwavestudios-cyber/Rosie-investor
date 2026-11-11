# Rosie Central Identity — isolated MFA staging

Staging-only self-hosted Better Auth + OAuth 2.1/OIDC + TOTP, in Chris's Render workspace and the dedicated \`rosie_identity_mfa_staging\` Neon database. This is independent of **Neon's managed Better Auth issuer**, whose MFA support is still on its roadmap. Do not migrate existing auth users, activate BOB SSO, or modify Abracadabra keys until the staging acceptance criteria pass.

## Endpoints

- \`/health\`: database and staging status.
- \`/login\`, \`/signup\`, \`/setup-mfa\`, \`/two-factor\`, \`/consent\`, \`/account\`: same-origin identity UI.
- \`/api/auth/.well-known/openid-configuration\`: OAuth discovery.
- \`/api/identity/consent-context\`: signed-authorization metadata; verifies session and MFA.
- \`/api/identity/config\`: public staging flags, never secret material.

## Configuration (Render secret environment only)

- \`DATABASE_URL\` — **dedicated** Neon staging database; never production/managed-auth tables.
- \`BETTER_AUTH_SECRET\` — random 32+ character secret; never in source or client bundle.
- \`ROSIE_IDENTITY_ORIGIN\` — exactly the service HTTPS origin.
- \`ROSIE_STAGING_SIGNUP_ENABLED\` — defaults false. Only true if SMTP configured and email delivery verified.
- \`ROSIE_SMTP_HOST\`, \`ROSIE_SMTP_PORT\`, \`ROSIE_SMTP_USER\`, \`ROSIE_SMTP_PASSWORD\`, \`ROSIE_SMTP_FROM\` — verified transactional email provider.
- \`PORT\` — assigned by Render.

The Better Auth provider must use \`/api/auth\` as the issuer path. OAuth client metadata/secret must be freshly registered under this self-hosted issuer; the credentials from the managed Neon Auth client cannot be reused. The old Base44 SSO setup form must **NOT** be enabled with the old discovery/issuer.

## Acceptance gates (do not skip)

1. Running Postgres migrations, /health 200, OIDC discovery/JWKS valid and issuer exact.
2. SMTP delivery + verified email, TOTP enrollment, backup code recovery, sign-in challenge, lockout.
3. New confidential BOB client registered server-side, callback URI exact, PKCE S256; consent verifies signed request and exact client.
4. Verified end-to-end Base44 SSO callback on isolated test environment, stable OIDC sub mapping, no email-only tenant link.
5. Cross-tenant negative tests, expired/stolen/unsigned token rejection, session termination, recovery tests.
6. Only then enable BOB SSO on production app, with rollback ready. Keep live BOB billing unchanged.

Use \`npm install\`, \`npm run build\`, \`npm run migrate\`, \`npm test\`, \`npm start\`.
