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
} from './rosieLiveIntelligencePolicy.js';

export const INVESTOR_CONVERSATION_POLICY_VERSION = ROSIE_LIVE_INTELLIGENCE_VERSION;

// Explicit opt-in only after staging acceptance; production legacy stays intact.
export const INVESTOR_SHARED_POLICY_ENABLED =
  String(import.meta.env?.VITE_ROSIE_INVESTOR_SHARED_POLICY || '').toLowerCase() === 'true';

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
  return turn?.role === 'prospect' ? turn : null;
}

export function investorSettleDelay(text) {
  return rosieSettleDelay(text);
}

export function investorNeedsQuestionReview(turn) {
  if (!turn || turn.role !== 'prospect') return false;
  return classifyRosieTurn(turn.text).needsQuestionReview;
}

export function investorPlanLiveServices({ turn, enabled = {}, now = Date.now(), state = {} } = {}) {
  return planRosieLiveServices({ turn, enabled, now, state });
}
