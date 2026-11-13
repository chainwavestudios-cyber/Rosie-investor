# Rosie Probo — Agent Ownership and Integration Handoff

**Ownership:** The Probo agent owns only `services/probo-grc/`, isolated Probo Render service, and isolated Probo Neon project. Other agents own their code, staging, and deployments.

## Other teams (do not edit)
- BOB / Rosie Core: centralized identity, billing, AI credits, shared event contracts, tenant authorization / Abracadabra and common infrastructure.
- Zoho / Salesforce: customer-installable native CRM intelligence plugins.
- PagePixels / UI Kit: shared UI design system and screenshot/visual testing.
- Direct D: Direct D app, investors/issuers, subscriptions, dialers, launch.

## Probo-side scope
- Compliance control definitions and proposed SOC 2 / ISO 27001 mapping.
- Probo-only isolated staging deployment and evidence storage.
- Service-side validation of sanitized control results; assessment dashboards.
- Audit-readiness workflows and access controls within Probo only.
- Validate all upstream claims independently. Never claim certification, completed tests, or approved policies when unverified.

## Required requests to BOB / Rosie Core agent
1. **Identity:** Provide supported Rosie central identity integration contract (issuer, audience, JWKS/JWT verification, subject mapping, invitation, logout, MFA and role claims). Probo must validate this against its native membership scope; no token alone grants tenant access. No ad hoc OAuth/SSO modifications here.
2. **Evidence:** Expose a versioned, authenticated, least-privilege, read-only evidence feed through Core's existing adapter, without Probo reaching into BOB tenant databases. Draft event metadata schema is `rosie.grc.evidence.v1` in this directory. Core owns transport, signing, durable inbox/outbox, retries and replay semantics. Probo validates and stores only once approvals exist.
3. **Authorization:** Confirm source-side organization grant, control ID, capture time, review status, provider attestation, redaction and data retention. No audio, transcripts, customer details, billing details, passwords, API keys, encryption keys or raw personally identifiable information in Probo feed.
4. **Operations:** Provide reproducible synthetic test fixture IDs and failure cases, shared runbook references, revocation and rotation behavior.
5. **UI:** Request PagePixels components through its agent; do not modify shared UI kit.

## Operational guardrails
- Do not edit central identity, BOB/Core source, billing or production.
- Do not switch on evidence sync until authenticated service identity, Probo admin, private object round-trip, negative authorization tests, audit logs and a restoration drill are verified.
- Control catalog `controls/catalog.v1.json` is a **draft candidate** only. Framework hints are for assessor review, not a SOC 2 report or ISO certification.
- Administrator designated: compliance@rosieai.tech. As last checked, Probo has zero organizations/memberships; mail delivery and administrator setup are unverified.
- Database is isolated Neon and app is isolated Render. Never leak credentials into this repository.
- No schedule or automatic deployment should change without Probo authorization.

## Additional Probo-side admission guard — November 13, 2026
- `evidence-admission.mjs` is a pure, fail-closed **prototype**, not a deployed endpoint and not cryptographic verification. It requires independently validated identity claims, expected issuer and audience, exact app/environment, a write scope, organization grants and a five-minute event window.
- `evidence-admission.test.mjs` adds negative synthetic tests for cross-organization, bad scopes, stale events, expired claims and sensitive fields. No customer data is present.
- A returned `dedupeKey` is only a candidate: live transport must enforce a unique durable inbox constraint and signed, audited acknowledgement in the Core/BOB-owned adapter. In-memory or static code does not provide replay protection by itself.
- Core team must supply a stable mapping from authorized source organization IDs to Probo-native organization IDs. Never accept unsigned request-body organization IDs as evidence of membership.
- Do not permit the synthetic `verified: true` fixture to be used as authentication in production; only a real cryptographic verifier may construct verified claims.
