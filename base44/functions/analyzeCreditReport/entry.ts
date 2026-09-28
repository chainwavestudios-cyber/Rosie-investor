const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { photoUrl, leadId } = body;

    if (!photoUrl) {
      return Response.json({ error: 'No photo URL provided' }, { status: 400 });
    }

    // Call Claude with vision to analyze the credit report
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'url', url: photoUrl },
              },
              {
                type: 'text',
                text: `You are analyzing a credit report photo. Extract ALL debt and credit information visible in this image. Look carefully at every account, balance, payment, interest rate, and credit limit.

Return ONLY this JSON (no markdown, no explanation):
{
  "creditScore": number or null,
  "monthlyIncome": number or null,
  "creditors": [
    {
      "creditor": "name of the creditor/bank",
      "balance": number,
      "creditLimit": number or null,
      "interestRate": number or null,
      "monthlyPayment": number or null,
      "accountLast4": "last 4 digits if visible",
      "accountStatus": "current/late/collections/charged off if visible",
      "notes": "any additional details"
    }
  ],
  "totalDebt": number,
  "creditorCount": number,
  "behindOnPayments": boolean,
  "monthsBehind": number or null,
  "rawText": "key text excerpts from the report"
}

Rules:
- Extract EVERY account you can see — do not skip any
- Only include data that is actually visible in the image — do NOT make up values
- If a field is not visible, use null
- Balance, creditLimit, monthlyPayment should be dollar amounts (numbers only, no $ or commas)
- interestRate should be a percentage number (e.g., 24.99 for 24.99%)
- If you cannot read the image clearly, return empty creditors array and explain in rawText`,
              },
            ],
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text || '{}';

    try {
      const result = JSON.parse(text.replace(/```json|```/g, '').trim());
      return Response.json({ result, leadId });
    } catch {
      return Response.json({ error: 'Failed to parse AI response', raw: text }, { status: 500 });
    }
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});