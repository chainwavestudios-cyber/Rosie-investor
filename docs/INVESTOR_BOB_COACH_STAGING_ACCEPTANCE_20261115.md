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

## Pilot call lifecycle / async AI response hardening
- **Risk found in source:** `stopCall()` awaited dialer-session and recorder work before clearing Q&A timers, and prior `liveAssistantAI` promises could still paint Q&A or Coach cards after teardown or on a later call.
- **Staging-only correction:** added `sharedCallEpochRef` and `sharedCallActiveRef` in original Investor `DebtLiveCall.jsx`. Each call start and stop advances the epoch; stop invalidates it synchronously **before any await**, clears scheduled pilot auto-Q&A/Coach timers and buffers, and guards pending manual Agent Question invocation. Pilot `handleQa` / `handleCoach` verify the captured epoch and active call before submitting and when resolving a provider promise. A prior call's success/failure cannot update the next call's UI in the staged pilot.
- **Usage fix:** staged Agent Question flush logs estimated Q&A usage only for the legacy path. The pilot logs once in `handleQa` when a request is actually initiated, rather than double-logging when an agent speaks a question.
- **Startup cleanup:** audio permission errors and missing Deepgram key invalidate the staged call epoch and deactivate the pilot gate; no fallback audio source is invented.
- **Proof scope:** four new synthetic/source-contract tests validate epoch truth table, legacy-path compatibility, stale response rejection and synchronous stop order. Combined targeted suite **53/53 pass** (41 BOB/Investor tests plus 12 founder-override tests), targeted ESLint exit 0, feature-enabled Vite build exit 0. Not a live phone/provider or billing confirmation.
- **Remaining:** independently verify browser call start/stop and authenticated admin pilot persistence, provider-side request cancellation/usage (UI suppression does **not** refund already-issued inference), cross-tenant negative authorization and customer-consent policies.

## Blocking backend authorization review — source inspected
- The original Investor `base44/functions/liveAssistantAI/entry.ts` constructs a direct paid-LLM / InvokeLLM response from a JSON request body, including browser-provided `kbEntries`, `question`, `transcript`, and `_ctx` usage metadata. The request handler itself does not visibly validate a DebtCoachUser session token, per-tenant organization, or an approved server-side KB record before invoking its Q&A or Coach models. The Base44 execution platform may enforce separate access controls, but **this has not been verified here**.
- The new **frontend** build flag + per-user pilot flag and call-epoch safeguards must NOT be described as provider/tenant authorization, source-provenance enforcement, or billing controls. No existing backend inference endpoint, app API key, or customer tenant was modified during this staging unit.
- **Required before any customer pilot**: independent endpoint authorization/threat review, verified tenant-to-Core link and RLS, authenticated user and lead ownership at the server, approved KB retrieval rather than client-trusted knowledge, server-owned usage IDs/receipts and idempotent metering, controlled provider error/credit handling, and explicit release approval. Do not attempt a paid end-to-end call against the existing unverified endpoint.



