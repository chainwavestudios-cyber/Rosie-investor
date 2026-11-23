/**
 * Investor Debt Call Coach adapter for the Core / Commercial BOB conversation
 * policy. Only the ORIGINAL Investor application's real telephone call surface
 * uses this speaker mapping. The separate investor assistant popup and other
 * audio sources use different channel conventions and must not import this map.
 *
 * Pure classification: no provider calls, keys, recording, billing or Core I/O.
 */
import {
  ROSIE_LIVE_INTELLIGENCE_VERSION,
  assembleRosieTurns,
  classifyRosieTurn,
  planRosieLiveServices,
  rosieSettleDelay,
  rosieTextKey,
} from './rosieLiveIntelligencePolicy.js';

export const INVESTOR_CONVERSATION_POLICY_VERSION = ROSIE_LIVE_INTELLIGENCE_VERSION;

// Explicit opt-in only after staging acceptance; production legacy stays intact.
export const INVESTOR_SHARED_POLICY_ENABLED =
  String(import.meta.env?.VITE_ROSIE_INVESTOR_SHARED_POLICY || '').toLowerCase() === 'true';

/** Feature rollout is deny-by-default for EVERY user, even on a build with
 * the feature compiled in. The existing authenticated user's admin-managed
 * AI settings must explicitly opt in; this does not replace backend auth.
 */
export function investorPilotEnabled(aiSettings = {}, { buildEnabled = INVESTOR_SHARED_POLICY_ENABLED } = {}) {
  return buildEnabled === true && aiSettings?.sharedConversationV1 === true;
}

/** Only the experimental call path rejects callbacks from ended/older calls.
 * The original Investor legacy result-handling contract stays unchanged.
 * This gates UI application of a response, not cancellation of provider spend.
 */
export function investorPilotResponseCurrent({ pilotEnabled = false, requestEpoch = 0,
  currentEpoch = 0, active = false } = {}) {
  if (!pilotEnabled) return true;
  return active === true && Number.isSafeInteger(requestEpoch) &&
    requestEpoch === currentEpoch;
}

/** In DebtLiveCall, 0=local agent mic, 1=remote prospect, 2=transfer agent.
 * This is NOT the mapping used by the lead assistant popup.
 */
export function investorConversationSegments(lines = []) {
  if (!Array.isArray(lines)) return [];
  return lines.map((line) => {
    const speaker = String(line?.speaker ?? '');
    return {
      role: speaker === '0' ? 'agent' : speaker === '1' ? 'prospect' : 'unknown',
      text: line?.text ?? '',
      time: line?.time ?? line?.at,
      interim: line?.interim === true,
      final: line?.final,
    };
  });
}

/** Most recent final prospect turn; never treat agent or transfer audio as
 * prospect speech, and never charge inference on an interim preview.
 */
export function latestInvestorProspectTurn(lines = []) {
  const relevant = (Array.isArray(lines) ? lines : []).filter(
    line => line?.interim !== true && line?.final !== false &&
      String(line?.text ?? '').trim()
  );
  const last = relevant[relevant.length - 1];
  if (!last || String(last.speaker) !== '1') return null;
  // A transfer introducer starts a new conversation section; never merge across it.
  const lastTransferIndex = relevant.findLastIndex(line => String(line.speaker) === '2');
  const turns = assembleRosieTurns(
    investorConversationSegments(relevant.slice(lastTransferIndex + 1))
  );
  const turn = turns[turns.length - 1];
  if (turn?.role !== 'prospect') return null;
  // Match the original Investor trailingTurn size cap. A long monologue must
  // not bypass KB context limits or create an unbounded AI request.
  const text = turn.text.length > 1200
    ? `… ${turn.text.slice(-1200).replace(/^\S*\s*/, '')}`
    : turn.text;
  return { ...turn, text };
}

export function investorSettleDelay(text) {
  return rosieSettleDelay(text);
}

export function investorNeedsQuestionReview(turn) {
  if (!turn || turn.role !== 'prospect') return false;
  return classifyRosieTurn(turn.text).needsQuestionReview;
}

/** Decide whether a settled prospect utterance can open an automatic Q&A.
 * Manual agent Ask is separate and intentionally remains available.
 * Mirrors the Investor application's existing 11-second duplicate guard.
 */
export function investorShouldAskSettled({ turn, enabled = false, now = Date.now(),
  lastAskedText = '', lastAskedAt = 0 } = {}) {
  if (!enabled || !investorNeedsQuestionReview(turn)) return false;
  const normalized = rosieTextKey(turn.text);
  const prior = rosieTextKey(lastAskedText);
  if (!normalized) return false;
  const recentlyAsked = now - Number(lastAskedAt || 0) < 11000;
  return !(recentlyAsked && (normalized === prior ||
    (prior.startsWith(normalized) && prior.length - normalized.length < 24)));
}

export function investorPlanLiveServices({ turn, enabled = {}, now = Date.now(), state = {} } = {}) {
  return planRosieLiveServices({ turn, enabled, now, state });
}

/** Evaluate only AFTER the full customer turn settles. Never run a provider here.
 * The 45s fallback keeps the original Investor Coach cadence for non-objection
 * customer remarks, while a 20s minimum and per-turn key block duplicates.
 */
export function investorShouldCoachSettled({ turn, enabled = false, now = Date.now(),
  lastCoachAt = 0, lastCoachKey = '' } = {}) {
  if (!enabled || !turn || turn.role !== 'prospect') return false;
  const planned = investorPlanLiveServices({
    turn, enabled: { coach: true, qa: false, intent: false }, now,
    state: { lastCoachAt, lastCoachKey },
  });
  const elapsed = now - Number(lastCoachAt || 0);
  return Boolean(planned.signal.key && planned.signal.key !== lastCoachKey &&
    elapsed > 20000 && (planned.coach || elapsed > 45000));
}
