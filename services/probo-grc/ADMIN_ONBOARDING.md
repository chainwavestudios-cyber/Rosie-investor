# Probo Staging — Secure Primary Administrator Onboarding

Primary designated operator: `compliance@rosieai.tech`.

## Verified 2026-11-12
- Probo Render staging and dedicated Neon are isolated from BOB and Rosie Core.
- As of last read-only database check, zero Probo organizations, zero memberships and zero registered controls exist.
- `PROBOD_AUTH_DISABLE_SIGNUP=true` is configured; upstream `pkg/iam/auth_service.go` blocks password self-registration under this flag.
- Upstream `pkg/server/api/connect/v1/organization_resolvers.go` further prohibits an account with no membership from creating its first organization when signup is disabled. Consequently, **social sign-in alone cannot bootstrap a new Probo organization**.
- The Rosie Core Hostinger sending readiness check returned `configured=false`; this is a Core sender check, not a Probo SMTP authentication result.
- Probo upstream `pkg/bootstrap/builder.go` supports `PROBOD_SMTP_ADDR`, `PROBOD_SMTP_USER`, `PROBOD_SMTP_PASSWORD`, `PROBOD_SMTP_TLS_REQUIRED`, `PROBOD_MAILER_SENDER_EMAIL`, `PROBOD_MAILER_SENDER_NAME`.
- Non-secret **Probo-specific** SMTP settings have been configured on Render: Hostinger endpoint `smtp.hostinger.com:587`, TLS required, sender/username `compliance@rosieai.tech`. The SMTP password is not set or verified. Hostinger's official instructions specify port 587 with STARTTLS, or port 465 with SSL, for Hostinger Email accounts; validate the mailbox is actually hosted by Hostinger before use.

## Required secure user-side secret installation
1. In Hostinger hPanel > Emails, verify the mailbox `compliance@rosieai.tech` exists and can receive mail. Confirm Connect Apps & Devices lists Hostinger SMTP for this domain.
2. Open the Probo staging Render service environment settings (not BOB/Core) and set `PROBOD_SMTP_PASSWORD` to that **mailbox's SMTP password**. Never put the value into GitHub, this runbook, or ChatGPT.
3. After deployment, perform a properly authenticated SMTP test and verify receipt at `compliance@rosieai.tech`. Do not claim delivery before an actual test.
4. For initial Probo first-owner creation, use a reviewed **private** enrollment path: restricted ingress to an approved operator network during a brief activation window, temporary signup enabled only during that window, email verification and first organization creation, immediately return signup-disabled, restore intended ingress, test closed registration, then test login/role/owner boundaries. A supported vendor bootstrap command may be substituted if independently verified.
5. Do not use direct raw SQL identity inserts, temporary default passwords, an unlocked public signup window, or disable verification to bypass Probo's auth model.
6. Verify login, authorized organization, logout, password reset and MFA/SSO policy. No customer data or Core/BOB evidence until these gates pass.

## Security checks / limits
- Never confuse a declared admin email with a created account.
- When controlled enrollment cannot be completed, leave signup disabled. This is a safe **blocker**, not a reason to expose registration publicly.
- This runbook does **not** authorize changes to shared Rosie identity, billing, BOB data or production.
- Before using compliance evidence, independently verify S3 native upload/download, access denial, retention/deletion, backup restoration and monitoring.
