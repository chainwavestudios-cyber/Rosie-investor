# Commercial BOB × Original Investor Debt Call Coach — Staging Acceptance
Date: 2026-11-15
Scope: Original RoieAI-Investor embedded Debt Call Coach only; standalone Commercial BOB policy source. **Settlement IQ excluded.**

## Code review and replay findings
- Core policy `rosie.live_intelligence.v1` remains the canonical deterministic turn classifier. The Investor local adapter references it; neither app calls a paid provider from the policy.
- Original Investor `trailingTurn` includes transfer speaker 2 in the caller's trailing speech. The staged adapter explicitly excludes transfer and unknown speakers and resets when a transfer takes place.
- **Found and corrected during synthetic replay:** fixed 1300 ms interim silence handling could flush an unfinished customer question before Deepgram emitted the remaining final words. The staged path now uses `max(1300,investorSettleDelay(interimText))`; incomplete words use the longer BOB-style settling window.
- **Found and corrected:** automatic Q&A might flush after its operator toggle was switched off. Staged `flushCustomerBuffer` now checks the latest `qaActiveRef` before creating an automatic request; manual Ask remains distinct.
- Extracted a deterministic `investorShouldAskSettled` helper to require genuine question cues, preserve the 11-second duplicate guard, retain corrected/longer utterances and avoid routine statement-related provider calls.
- Capped outgoing assembled customer turn to the legacy 1200-character budget, preventing long transcript bursts from bypassing original context bounds.
- Coach still waits for completed turns; agent handoff flushes, interim speech delays, transfer or ended call cancels, and a 20-second cooldown with 45-second neutral fallback remains.

## Verifiable test evidence — synthetic only
- `node --test tests/investorConversationAdapter.test.mjs tests/investorConversationReplay.test.mjs`: **35 passed, 0 failed**.
- Targeted ESLint of staged adapter, original Investor component and replay tests: **exit 0**.
- `npm run build`: **exit 0** with feature flag default off.
- `VITE_ROSIE_INVESTOR_SHARED_POLICY=true npm run build`: **exit 0**.
- Replay is a **pure simulation** of STT final/interim events using the actual pure adapter functions; it does not invoke the React browser call component, Deepgram, live Twilio audio, customers, approved KB provider inference, or Stripe/Neon wallets.
- The original Investor application's main branch and telephony integration were **not edited or published**.

## Release blockers / next verified gate
1. Consent-scoped **staging** dual-channel phone/WebRTC recording with known mic/caller labels, including transfer and microphone bleed.
2. Review of finished Q&A accuracy/knowledge provenance, Coach usefulness, Current/History/Common and script-panel usability, and manual-Ask behavior.
3. Two-tenant negative tests, per-product authorization, signed Core tenant/organization link, AI provider cost receipts and cancel-off call validation.
4. Independent security review and explicit human production acceptance before feature activation/branch merge.
5. The Core work plan and any candidate receipt are **not** verified War Room ticket leases or release approval.

## Identifiers
- Branch: `rosie-bob-investor-coach-staging-20261115`
- App: `69cd2741578c9b5ce655395b`
- Document: `rosie-investor-bob-coach-v1`
- Plan: `rosie-investor-bob-coach-best-of-both-v1`

## Controlled pilot rollout gate — stage only
- Staging branch was synced to Investor main on 2026-11-15, importing its media stream relay and founder override updates. Sync status was clean, with no production merge. Restore checkpoint for sync: `6afa30b2a339ef0ba40f4f71`.
- A feature-enabled Vite build **does not activate the shared conversation policy for every agent**. `investorPilotEnabled` now requires BOTH `VITE_ROSIE_INVESTOR_SHARED_POLICY=true` at build time and the authenticated Investor user's `aiSettingsJson.sharedConversationV1 === true`.
- Investor `AdminFlagsTab.jsx` exposes the explicit per-user pilot setting. It defaults false, and All ON / All OFF bulk actions forcibly leave it false to prevent accidental mass rollout.
- The original authenticated `debtCoachAuth/entry.ts` admin API had a strict `ADMIN_FLAG_KEYS` allowlist; it was updated to include `sharedConversationV1`. Existing `updateUser` session validation, role checks, boolean-only validation, DB persistence, and post-write UI verification remain in place.
- **Important boundary:** this is a client rollout guard, not a replacement for the server's tenant/entitlement or paid-provider authorization. A client can never be trusted to grant tenant permissions. No live user was opted in and no environment flag was changed.
- Staged deterministic tests (including double-gate matrix and source-contract checks): **37/37 pass**; lint 0; builds both with flag on and flag off exit 0. No live UI or authenticated server persistence is claimed.
- Next gate still requires authorized staging account, consented dual-channel call and independent tenant/KB/provider checks before any release.

