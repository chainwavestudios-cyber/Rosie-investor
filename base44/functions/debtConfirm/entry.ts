/**
 * DebtConfirm — AI function that reviews the transcript to confirm the
 * customer's debt type, total debt amount, AND per-type (blended) amounts
 * in a single pass.
 *
 * Looks for [[AI:debtAmount]], [[AI:debtTypesJson]], and [[AI:debtAmountsJson]]
 * tags in the script to know where to look, then extracts the confirmed
 * values from the transcript.
 *
 * Returns: { confirmed, debtAmount, debtTypes, debtTypesJson, debtAmountsJson, summary }
 *   - debtAmount: total dollar amount
 *   - debtTypes: array of type strings ("Unsecured Credit Card", "Unsecured Loans")
 *   - debtAmounts: array of { type, amount } — per-type breakdown (may be empty
 *     if the customer only stated a total)
 */
import { callLLM } from '../../shared/llmHelper.ts';
import { formatTranscriptLines, chunkTranscript, runChunks } from '../../shared/transcriptAnalysis.ts';

// Merges the per-chunk confirmations, oldest chunk first. A later chunk that
// states a debt figure overrides an earlier one (the customer's latest word wins),
// and a chunk that found nothing never erases what an earlier chunk confirmed.
function mergeConfirmResults(results: any[]) {
  let confirmed = false;
  let debtAmount: number | null = null;
  let debtTypes: string[] = [];
  let debtAmounts: Array<{ type: string; amount: number }> = [];
  let lastSummary = '';
  let confirmedSummary = '';

  for (const result of results) {
    if (!result) continue;
    if (result.summary) lastSummary = result.summary;

    if (result.confirmed) {
      confirmed = true;
      if (result.summary) confirmedSummary = result.summary;
      if (result.debtAmount != null) debtAmount = result.debtAmount;
      if (result.debtTypes?.length) debtTypes = result.debtTypes;
      if (result.debtAmounts?.length) debtAmounts = result.debtAmounts;
    } else {
      if (debtAmount == null && result.debtAmount != null) debtAmount = result.debtAmount;
      if (debtTypes.length === 0 && result.debtTypes?.length) debtTypes = result.debtTypes;
      if (debtAmounts.length === 0 && result.debtAmounts?.length) debtAmounts = result.debtAmounts;
    }
  }

  if (!confirmed && debtAmount == null && debtTypes.length === 0) return null;

  if (debtTypes.length === 0 && debtAmounts.length > 0) debtTypes = debtAmounts.map((a) => a.type);

  return {
    confirmed: confirmed || debtAmount != null || debtTypes.length > 0,
    debtAmount,
    debtTypes,
    debtTypesJson: debtTypes.length > 0 ? JSON.stringify(debtTypes) : null,
    debtAmountsJson: debtAmounts.length > 0 ? JSON.stringify(debtAmounts) : null,
    // The latest part of the call that actually confirmed the debt, so the note
    // describes the same figures the card was just updated with.
    summary: confirmedSummary || lastSummary,
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { transcript, currentLeadData, scriptContent } = body;

    if (!transcript || !Array.isArray(transcript) || transcript.length < 2) {
      return Response.json({ confirmed: false, message: 'No transcript available' });
    }

    // The WHOLE call is read, not just its opening: the transcript is split into
    // chunks, every chunk is analyzed, and the results are merged below.
    const chunks = chunkTranscript(formatTranscriptLines(transcript));

    // Extract the tagged script sections so the LLM knows exactly where in
    // the script the debt amount, debt type, and per-type amounts are discussed.
    let scriptContext = '';
    if (scriptContent && typeof scriptContent === 'string') {
      const cleaned = scriptContent
        .replace(/\[\/?(b|i|c|bg|s|f|anim|gap)(?:=[^\]]+)?\]/gi, '')
        .replace(/@@CUE:\w+:.*?@@/g, '')
        .replace(/@@COMPLETED_STEPS@@/g, '')
        .replace(/@@AI_INPUT@@/g, '')
        .replace(/@@SEND_EMAIL@@/g, '')
        .replace(/@@DEBT_CONFIRM@@/g, '[DEBT CONFIRM POINT]')
        .replace(/@@BLENDED_DEBT_CONFIRM@@/g, '[DEBT CONFIRM POINT]')
        .trim();
      const hasDebtAmountTag = /\[\[AI:debtAmount\]\]/i.test(cleaned);
      const hasDebtTypeTag = /\[\[AI:debtTypesJson\]\]/i.test(cleaned);
      const hasBlendedTag = /\[\[AI:debtAmountsJson\]\]/i.test(cleaned);
      const hasConfirmTag = cleaned.includes('[DEBT CONFIRM POINT]');
      if (hasDebtAmountTag || hasDebtTypeTag || hasBlendedTag || hasConfirmTag) {
        const lines = cleaned.split('\n');
        const taggedLines: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (/\[\[AI:debtAmount\]\]/i.test(lines[i]) || /\[\[AI:debtTypesJson\]\]/i.test(lines[i]) || /\[\[AI:debtAmountsJson\]\]/i.test(lines[i]) || lines[i].includes('[DEBT CONFIRM POINT]')) {
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 3);
            for (let j = start; j < end; j++) taggedLines.push(`  L${j + 1}: ${lines[j]}`);
          }
        }
        const taggedContext = taggedLines.length > 0
          ? `\n\nTAGGED SCRIPT SECTIONS (where debt amount/type/blended amounts are discussed):\n${taggedLines.join('\n')}`
          : '';
        scriptContext = `\n\nSCRIPT CONTEXT:\n${cleaned.slice(0, 3000)}${taggedContext}`;
      }
    }

    const currentDebtAmount = currentLeadData?.debtAmount ?? null;
    const currentDebtTypes = (() => {
      try { return JSON.parse(currentLeadData?.debtTypesJson || '[]'); } catch { return []; }
    })();

    const system = `You are an AI assistant analyzing a sales call transcript to confirm the customer's debt details in ONE pass.

Your job is to determine what the CUSTOMER explicitly stated or confirmed about:
1. Their TOTAL debt amount (dollar amount) — the script may have [[AI:debtAmount]] tags marking where this is discussed
2. Their type(s) of debt — the script may have [[AI:debtTypesJson]] tags marking where this is discussed
3. The PER-TYPE dollar amounts (blended) — the script may have [[AI:debtAmountsJson]] tags marking where each type's amount is discussed

The script has a [DEBT CONFIRM POINT] marker showing where the agent asks about debt. Pay special attention to the transcript lines that correspond to that script section.

VALID DEBT TYPES:
- "Unsecured Credit Card" — credit card debt
- "Unsecured Loans" — personal/unsecured loans

RULES:
1. Only extract values the CUSTOMER explicitly stated or confirmed — NOT what the agent said.
2. For debtAmount: return the total dollar amount the customer stated (number only, no $ or commas).
3. For debtTypes: return an array of the debt types the customer has (from the valid types above).
4. For debtAmounts: return an array of { type, amount } for each debt type the customer gave a specific dollar amount for. If the customer only stated a total but not a per-type breakdown, return an empty array here — the total still goes in debtAmount.
5. If the customer did not clearly state or confirm a debt amount AND debt type, return confirmed: false.
6. The total debtAmount should equal the sum of all per-type amounts when a breakdown was given.
7. Provide a brief summary of what was discussed about debt.${scriptContext}

Return ONLY this JSON (no markdown):
{
  "confirmed": true/false,
  "debtAmount": number or null,
  "debtTypes": ["Unsecured Credit Card"] or ["Unsecured Loans"] or both,
  "debtAmounts": [{"type": "Unsecured Credit Card", "amount": 10000}, {"type": "Unsecured Loans", "amount": 5000}],
  "summary": "Brief summary of what the customer said about their debt"
}`;

    const results = await runChunks(chunks, async (chunk) => {
      const data = await callLLM(req, {
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system,
        messages: [{ role: 'user', content: `Current lead data:\n  debtAmount: ${currentDebtAmount}\n  debtTypes: ${JSON.stringify(currentDebtTypes)}\n\nCall transcript:\n${chunk}` }],
      });

      const text = data?.content?.[0]?.text || '{}';
      try {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
      } catch {
        console.error('[debtConfirm] Chunk returned non-JSON output. Length:', text.length);
        return null;
      }
    });

    const merged = mergeConfirmResults(results);
    if (!merged) return Response.json({ confirmed: false, message: 'Failed to parse AI response' });
    return Response.json(merged);
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('CREDIT_EXHAUSTED')) {
      return Response.json({ error: msg, creditError: true }, { status: 500 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}