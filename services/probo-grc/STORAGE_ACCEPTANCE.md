# Private evidence storage — staging acceptance checklist

**Status: configuration corrected, round-trip not yet executed.** This document is not evidence of a successful upload.

- Neon project: `frosty-wave-45975958`, branch `br-winter-river-bdw497pg`, private bucket `rosie-probo-evidence-staging`.
- Probo Render service: `srv-dbqc9661egvs73bouom0`; set `PROBOD_AWS_USE_PATH_STYLE=true` on 2026-11-11 after verifying Neon Storage's `force_path_style=true` and the upstream Probo config flag.
- Render deployment `dep-dbqgivlbedkc73dhtgr0` confirmed LIVE after the configuration change.
- Probo's native client path needs direct acceptance testing: an application upload must land in Neon, a Probo download must match the SHA-256 digest, and an unauthorized caller must be denied.
- The bucket has been observed empty; do not describe storage as validated until the test below is run.

## Test sequence (authorized operator)

1. Confirm scoped storage credential belongs only to the isolated staging bucket/project. Do not paste it into notes or GitHub.
2. Use only synthetic content with no customer PII; include a generated random test object key and expected SHA-256 locally.
3. Log in as the approved and verified Probo staging administrator when onboarding is complete.
4. Upload the synthetic evidence file through the **Probo application** and verify its existence via Neon bucket listing. This establishes the actual app-to-object-store client behavior, rather than only presigned-S3 capability.
5. Download through the authorized Probo API, compare byte hash, and verify that a logged-out / cross-org request cannot access the same object.
6. Delete the synthetic object through the supported application workflow, then verify Neon no longer lists it.
7. Record a test report containing only timestamps, digest, result, actor role and synthetic object ID. Never store passwords, storage credentials, signed URLs, customer recordings or raw transcripts.
8. If the test fails, keep Rosie Core evidence transport OFF. Restore service configuration only after reviewing S3 addressing, content-type, CORS/CSP and credentials.

## Additional gates

- Admin login and SMTP still unverified. Primary administrator designation: `compliance@rosieai.tech`.
- No direct Probo native UI upload/download can be exercised without a validated admin login. This is a dependency, not an indication that object storage is broken.
- Neon automatic snapshot schedule is not enabled for this project; baseline manual snapshot exists, but restore testing remains open.
- Never enable BOB/Core live evidence writes merely because this checklist or static dashboard exists.
