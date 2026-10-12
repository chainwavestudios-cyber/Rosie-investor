/**
 * llmHelper.ts — Shared LLM helper for backend functions.
 * Routes through direct Anthropic API (ANTHROPIC_API_KEY) first, falls back
 * to platform InvokeLLM integration on error. Returns an Anthropic-shaped
 * response ({ content: [{ text }] }) so call sites parse unchanged.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export async function callLLM(req: Request, body: any): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const system = body?.system || '';
  const userContent = body?.messages?.[0]?.content || '';
  const model = body?.model || 'claude-haiku-4-5-20251001';
  const maxTokens = body?.max_tokens || 500;

  if (apiKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          ...(process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : {}),
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: userContent }],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        if ([401, 402, 403, 429].includes(response.status)) throw new Error(`CREDIT_EXHAUSTED:anthropic:${response.status}`);
        throw new Error(`Anthropic API ${response.status}`);
      }
      const data = await response.json();
      return { content: [{ type: 'text', text: data.content?.[0]?.text || '' }], usage: data.usage };
    } catch (e: any) {
      if (e?.message?.includes('CREDIT_EXHAUSTED')) throw e;
      console.log('[llmHelper] Anthropic failed, falling back to InvokeLLM:', e?.message || String(e));
    }
  }

  // Fallback: InvokeLLM (platform credits)
  const base44 = createClientFromRequest(req);
  const prompt = system ? `${system}\n\n${userContent}` : userContent;
  try {
    const res: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      ...(body?.response_json_schema ? { response_json_schema: body.response_json_schema } : {}),
    });
    const text = typeof res === 'string' ? res : (res?.text || res?.content?.[0]?.text || JSON.stringify(res));
    return { content: [{ type: 'text', text }], usage: null };
  } catch (fbErr: any) {
    const fbMsg = (fbErr?.message || '').toLowerCase();
    if (fbMsg.includes('quota') || fbMsg.includes('credit') || fbMsg.includes('429') || fbMsg.includes('402') || fbMsg.includes('limit') || fbMsg.includes('exhausted')) {
      throw new Error('CREDIT_EXHAUSTED:anthropic:fallback');
    }
    throw fbErr;
  }
}