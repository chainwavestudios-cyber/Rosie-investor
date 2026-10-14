/**
 * DebtConfirm — AI function that reviews the transcript to confirm the
 * customer's debt type and debt amount. Looks for [[AI:debtAmount]] and
 * [[AI:debtTypesJson]] tags in the script to know where to look, then
 * extracts the confirmed values from the transcript.
 *
 * When the script contains @@BLENDED_DEBT_CONFIRM@@, switches to blended
 * mode: extracts the PER-TYPE debt amounts (e.g. $10k credit card, $5k
 * unsecured loans) instead of just the total. Returns debtAmountsJson
 * (array of {type, amount}) which the contact card applies to each badge.
 *
 * Returns: { debtAmount, debtTypes, debtAmountsJson, confirmed, summary }
 */
import { callLLM } from '../../shared/llmHelper.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { transcript, currentLeadData, scriptContent } = body;

    if (!transcript || !Array.isArray(transcript) || transcript.length < 2) {
      return Response.json({ confirmed: false, message: 'No transcript available' });
    }

    const transcriptStr = (transcript || []).map((t: any) => {
      const speaker = t.speaker === 0 ? 'AGENT' : t.speaker === 1 ? 'CUSTOMER' : (t.role || 'UNKNOWN').toUpperCase();
      return `[${speaker}]: ${t.text}`;
    }).join('\n').slice(0, 8000);

    // Check if script has debt-related tags — extract the specific tagged
    // sections so the LLM knows exactly where in the script the debt amount
    // and debt type are discussed, then maps that to the transcript.
    let scriptContext = '';
    let isBlended = false;
    if (scriptContent && typeof scriptContent === 'string') {
      isBlended = scriptContent.includes('@@BLENDED_DEBT_CONFIRM@@');
      const cleaned = scriptContent
        .replace(/\[\/?(b|i|c|bg|s|f|anim|gap)(?:=[^\]]+)?\]/gi, '')
        .replace(/@@CUE:\w+:.*?@@/g, '')
        .replace(/@@COMPLETED_STEPS@@/g, '')
        .replace(/@@AI_INPUT@@/g, '')
        .replace(/@@SEND_EMAIL@@/g, '')
        .replace(/@@BLENDED_DEBT_CONFIRM@@/g, '[BLENDED DEBT CONFIRM POINT — per-type amounts discussed here]')
        .replace(/@@DEBT_CONFIRM@@/g, '[DEBT CONFIRM POINT]')
        .trim();
      const hasDebtAmountTag = /\[\[AI:debtAmount\]\]/i.test(cleaned);
      const hasDebtTypeTag = /\[\[AI:debtTypesJson\]\]/i.test(cleaned);
      const hasBlendedTag = cleaned.includes('[BLENDED DEBT CONFIRM POINT]');
      const hasConfirmTag = cleaned.includes('[DEBT CONFIRM POINT]');
      if (hasDebtAmountTag || hasDebtTypeTag || hasBlendedTag || hasConfirmTag) {
        // Extract lines near the debt tags to give the LLM focused context
        const lines = cleaned.split('\n');
        const taggedLines: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (/\[\[AI:debtAmount\]\]/i.test(lines[i]) || /\[\[AI:debtTypesJson\]\]/i.test(lines[i]) || lines[i].includes('[BLENDED DEBT CONFIRM POINT]') || lines[i].includes('[DEBT CONFIRM POINT]')) {
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 3);
            for (let j = start; j < end; j++) taggedLines.push(`  L${j + 1}: ${lines[j]}`);
          }
        }
        const taggedContext = taggedLines.length > 0
          ? `\n\nTAGGED SCRIPT SECTIONS (where debt amount/type are discussed):\n${taggedLines.join('\n')}`
          : '';
        scriptContext = `\n\nSCRIPT CONTEXT:\n${cleaned.slice(0, 3000)}${taggedContext}`;
      }
    }

    const currentDebtAmount = currentLeadData?.debtAmount ?? null;
    const currentDebtTypes = (() => {
      try { return JSON.parse(currentLeadData?.debtTypesJson || '[]'); } catch { return []; }
    })();

    // Blended mode: extract per-type amounts
    if (isBlended) {
      const system = `You are an AI assistant analyzing a sales call transcript to confirm the customer's BLENDED debt amounts — the dollar amount for EACH type of debt separately.

Your job is to determine what the CUSTOMER explicitly stated or confirmed about:
1. The dollar amount for their "Unsecured Credit Card" debt (if they have any)
2. The dollar amount for their "Unsecured Loans" debt (if they have any)
3. Their total combined debt amount (sum of all types)

The script has a [BLENDED DEBT CONFIRM POINT] marker showing where the agent asks about per-type amounts. Pay special attention to the transcript lines that correspond to that script section.

VALID DEBT TYPES:
- "Unsecured Credit Card" — credit card debt
- "Unsecured Loans" — personal/unsecured loans

RULES:
1. Only extract values the CUSTOMER explicitly stated or confirmed — NOT what the agent said.
2. If the customer stated an amount for a specific debt type, include it in debtAmounts with that type.
3. If the customer only stated a total but not per-type breakdown, still return confirmed: true with the total in debtAmount, but leave debtAmounts empty.
4. If the customer did not clearly state any debt amount, return confirmed: false.
5. For amounts, return numbers only (no $ signs or commas).
6. The total debtAmount should equal the sum of all per-type amounts (or the stated total if no breakdown).
7. Provide a brief summary of what was discussed about debt.${scriptContext}

Return ONLY this JSON (no markdown):
{
  "confirmed": true/false,
  "debtAmount": number (total) or null,
  "debtTypes": ["Unsecured Credit Card"] or ["Unsecured Loans"] or both,
  "debtAmounts": [{"type": "Unsecured Credit Card", "amount": 10000}, {"type": "Unsecured Loans", "amount": 5000}],
  "summary": "Brief summary of what the customer said about their debt"
}`;

      const data = await callLLM(req, {
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system,
        messages: [{ role: 'user', content: `Current lead data:\n  debtAmount: ${currentDebtAmount}\n  debtTypes: ${JSON.stringify(currentDebtTypes)}\n\nCall transcript:\n${transcriptStr}` }],
      });

      const text = data?.content?.[0]?.text || '{}';
      try {
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());
        const debtAmounts = result.debtAmounts || [];
        const debtTypes = result.debtTypes || debtAmounts.map((a: any) => a.type);
        return Response.json({
          confirmed: result.confirmed || false,
          debtAmount: result.debtAmount ?? null,
          debtTypes,
          debtTypesJson: debtTypes.length > 0 ? JSON.stringify(debtTypes) : null,
          debtAmountsJson: debtAmounts.length > 0 ? JSON.stringify(debtAmounts) : null,
          summary: result.summary || '',
        });
      } catch {
        return Response.json({ confirmed: false, message: 'Failed to parse AI response' });
      }
    }

    // Standard mode: extract total debt amount + types (original behavior)
    const system = `You are an AI assistant analyzing a sales call transcript to confirm the customer's debt type and debt amount.

Your job is to determine what the CUSTOMER explicitly stated or confirmed about:
1. Their total debt amount (dollar amount) — the script may have [[AI:debtAmount]] tags marking where this is discussed
2. Their type of debt (must be one of: "Unsecured Credit Card", "Unsecured Loans", or both) — the script may have [[AI:debtTypesJson]] tags marking where this is discussed

If the script has tagged sections, pay special attention to the transcript lines that correspond to those script sections — that is where the customer is most likely to have stated their debt amount and type.

VALID DEBT TYPES:
- "Unsecured Credit Card" — credit card debt
- "Unsecured Loans" — personal/unsecured loans

RULES:
1. Only extract values the CUSTOMER explicitly stated or confirmed — NOT what the agent said.
2. If the customer did not clearly state or confirm a debt amount, return confirmed: false.
3. If the customer did not clearly state or confirm a debt type, return confirmed: false.
4. Both debt amount AND debt type must be confirmed for this to return confirmed: true.
5. For debt amount, return a number only (no $ signs or commas).
6. For debt types, return an array of strings using the exact values above.
7. Provide a brief summary of what was discussed about debt.${scriptContext}

Return ONLY this JSON (no markdown):
{
  "confirmed": true/false,
  "debtAmount": number or null,
  "debtTypes": ["Unsecured Credit Card"] or ["Unsecured Loans"] or both,
  "summary": "Brief summary of what the customer said about their debt"
}`;

    const data = await callLLM(req, {
      model: 'claude-sonnet-5',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: `Current lead data:\n  debtAmount: ${currentDebtAmount}\n  debtTypes: ${JSON.stringify(currentDebtTypes)}\n\nCall transcript:\n${transcriptStr}` }],
    });

    const text = data?.content?.[0]?.text || '{}';
    try {
      const result = JSON.parse(text.replace(/```json|```/g, '').trim());
      return Response.json({
        confirmed: result.confirmed || false,
        debtAmount: result.debtAmount ?? null,
        debtTypes: result.debtTypes || [],
        debtTypesJson: (result.debtTypes || []).length > 0 ? JSON.stringify(result.debtTypes) : null,
        summary: result.summary || '',
      });
    } catch {
      return Response.json({ confirmed: false, message: 'Failed to parse AI response' });
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('CREDIT_EXHAUSTED')) {
      return Response.json({ error: msg, creditError: true }, { status: 500 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}