/**
 * DebtConfirm — AI function that reviews the transcript to confirm the
 * customer's debt type and debt amount. Looks for [[AI:debtAmount]] and
 * [[AI:debtTypesJson]] tags in the script to know where to look, then
 * extracts the confirmed values from the transcript.
 *
 * Returns: { debtAmount, debtTypes, confirmed, summary }
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

    // Check if script has debt-related tags
    let scriptContext = '';
    if (scriptContent && typeof scriptContent === 'string') {
      const cleaned = scriptContent
        .replace(/\[\/?(b|i|c|bg|s|f|anim|gap)(?:=[^\]]+)?\]/gi, '')
        .replace(/@@CUE:\w+:.*?@@/g, '')
        .replace(/@@COMPLETED_STEPS@@/g, '')
        .replace(/@@DEBT_CONFIRM@@/g, '[DEBT CONFIRM POINT]')
        .trim();
      const hasDebtTags = /\[\[AI:debtAmount\]\]/i.test(cleaned) || /\[\[AI:debtTypesJson\]\]/i.test(cleaned);
      if (hasDebtTags || cleaned.includes('[DEBT CONFIRM POINT]')) {
        scriptContext = `\n\nSCRIPT CONTEXT:\n${cleaned.slice(0, 3000)}`;
      }
    }

    const currentDebtAmount = currentLeadData?.debtAmount ?? null;
    const currentDebtTypes = (() => {
      try { return JSON.parse(currentLeadData?.debtTypesJson || '[]'); } catch { return []; }
    })();

    const system = `You are an AI assistant analyzing a sales call transcript to confirm the customer's debt type and debt amount.

Your job is to determine what the CUSTOMER explicitly stated or confirmed about:
1. Their total debt amount (dollar amount)
2. Their type of debt (must be one of: "Unsecured Credit Card", "Unsecured Loans", or both)

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