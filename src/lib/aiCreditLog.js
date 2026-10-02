import { base44 } from '@/api/base44Client';

// Estimated integration credits per AI call type. The platform does not expose
// exact per-call credit costs for InvokeLLM, so these are rough proxies keyed to
// the response size of each call type (larger analyses cost more). 1 credit ≈
// one short InvokeLLM call; multi-thousand-token analyses scale up.
export const CREDIT_ESTIMATES = {
  qa: 1, coach: 1, intent: 1, profile: 1, contact: 1, handoff: 1,
  hardship: 1, cosigners: 1, credit: 1, budget: 1, debt_extract: 1,
  cold_call_name: 1, consolidate: 1, smalltalk: 1,
  extract_facts: 2, research: 2, briefing: 2, compliance: 2,
  intent_final: 3, full_report: 4, call_analysis: 5,
};

// Fire-and-forget: logs one AI call to the AICreditUsage entity so the super-admin
// AI Credits tab can break usage down by agent and by client. Never throws into
// the live call flow. Now accepts real token counts from Anthropic usage data.
export async function logAIUsage({ agentUsername, leadId, leadName, leadNumber, transcriptId, callType, model = 'automatic', estimatedCredits = 1, inputTokens = 0, outputTokens = 0, cacheReadTokens = 0 }) {
  try {
    await base44.entities.AICreditUsage.create({
      agentUsername: agentUsername || '',
      leadId: leadId || '',
      leadName: leadName || '',
      leadNumber: leadNumber || '',
      transcriptId: transcriptId || '',
      callType: callType || 'unknown',
      model,
      estimatedCredits,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      calledAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('AI credit log failed:', e);
  }
}