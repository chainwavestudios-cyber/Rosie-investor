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


## Google, Facebook and Microsoft / Outlook registration

The customer account signup and login pages now include all three identity
providers. The buttons automatically expose the real sign-in flow only if the
matching client ID and secret are configured in **Render private environment**.
No client secrets are embedded in JavaScript, Base44 entities or GitHub.

| Identity method | Developer console | HTTPS callback URL (exact) |
|---|---|---|
| Google account | https://console.cloud.google.com/apis/credentials | https://rosie-central-identity-staging.onrender.com/api/auth/callback/google |
| Facebook account | https://developers.facebook.com/apps/ | https://rosie-central-identity-staging.onrender.com/api/auth/callback/facebook |
| Microsoft / Outlook / Hotmail / Microsoft 365 | https://entra.microsoft.com/ | https://rosie-central-identity-staging.onrender.com/api/auth/callback/microsoft |

**Render environment names (write-only secrets):**

- \`GOOGLE_CLIENT_ID\`, \`GOOGLE_CLIENT_SECRET\`
- \`FACEBOOK_CLIENT_ID\`, \`FACEBOOK_CLIENT_SECRET\`
- \`MICROSOFT_CLIENT_ID\`, \`MICROSOFT_CLIENT_SECRET\`
- \`ROSIE_STAGING_SOCIAL_SIGNUP_ENABLED\` = \`false\` until all outbound
  identity verification and MFA enrollment tests succeed.
  Set \`true\` only for the approved staging rollout.
- \`ROSIE_STAGING_SIGNUP_ENABLED\` controls email/password registration
  **separately** and still requires verified SMTP settings.

For Microsoft, configure Entra **Supported account types** to include personal
Microsoft accounts (Outlook.com/Hotmail) and organizations if desired; the
Better Auth social provider uses \`tenantId:'common'\`.

**Customer privacy/security policies:**

- Identity provider login only requests basic account/profile/email scopes; it
  does **not** grant Gmail, Outlook mail, Facebook Pages, Ads or CRM permissions.
  Those are separate per-tenant product integrations with independent consent.
- \`account.accountLinking.disableImplicitLinking=true\` prevents joining
  different provider accounts just because their email strings match. Users
  can explicitly link more providers from \`/account\` when signed in.
- The built-in Better Auth TOTP plugin supports social-only customer accounts
  via \`allowPasswordless:true\`; users with an email/password account still
  need their existing password to manage their authenticator.
- Facebook sometimes returns no usable email address. Never invent, guess or
  trust an arbitrary Facebook email to identify another account.
- An enrolled TOTP authenticator does **NOT** prove a fresh second-factor
  challenge during Google/Facebook/Microsoft OAuth sign-in. Better Auth's built-
  in 2FA plugin does not automatically challenge social-provider logins.
  **Product ID-token issuance deliberately fails closed** with
  \`oidc_mfa_stepup_acceptance_pending\` until per-session TOTP step-up
  and token-issuance attestation are implemented and accepted.
- Keep production BOB SSO disabled. This staging project is not a launch-ready
  identity provider until real provider callbacks, verified-email,
  fresh-MFA, account recovery and Base44 callback acceptance pass.


## Acceptance gates (do not skip)

1. Running Postgres migrations, /health 200, OIDC discovery/JWKS valid and issuer exact.
2. SMTP delivery + verified email, TOTP enrollment, backup code recovery, sign-in challenge, lockout.
3. New confidential BOB client registered server-side, callback URI exact, PKCE S256; consent verifies signed request and exact client.
4. Verified end-to-end Base44 SSO callback on isolated test environment, stable OIDC sub mapping, no email-only tenant link.
5. Cross-tenant negative tests, expired/stolen/unsigned token rejection, session termination, recovery tests.
6. Only then enable BOB SSO on production app, with rollback ready. Keep live BOB billing unchanged.

Use \`npm install\`, \`npm run build\`, \`npm run migrate\`, \`npm test\`, \`npm start\`.
