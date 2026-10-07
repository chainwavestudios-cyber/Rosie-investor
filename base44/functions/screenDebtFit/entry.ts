/**
 * screenDebtFit — AI screening for credit-card / unsecured personal-loan debt.
 *
 * Reads each scraped post's title + text and uses an LLM to determine whether
 * the author is genuinely dealing with accumulated credit-card or unsecured
 * personal-loan debt and may be interested in consolidating it into one payment.
 *
 * Classification:
 *   fit      — Post clearly references credit-card or unsecured personal-loan
 *              debt and suggests the person is looking for help/consolidation.
 *   not_fit  — Post is about other debt types (student, mortgage, auto, medical,
 *              tax, business) or not about debt at all.
 *   ambiguous — Mentions debt but unclear if it's credit-card/unsecured personal
 *              loan, or unclear if they want consolidation.
 *
 * Modes:
 *   { leadId }              — screen a single lead
 *   { bulk: true, leadIds } — screen specific leads
 *   { pending: true }       — screen all leads with debtFitStatus 'pending'
 *
 * Batches 5 posts per LLM call to minimize credit usage. Uses gemini_3_flash
 * (cheapest model with good text classification).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const BATCH_SIZE = 5;

interface FitResult {
  index: number;
  status: 'fit' | 'not_fit' | 'ambiguous';
  confidence: number;
  reason: string;
}

async function screenBatch(base44: any, leads: any[]): Promise<FitResult[]> {
  const postsContext = leads.map((lead, i) => {
    const title = (lead.postTitle || '').substring(0, 200);
    const text = (lead.postText || '').substring(0, 1500);
    return `[POST ${i + 1}]\nTitle: ${title}\nText: ${text}`;
  }).join('\n\n');

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a debt-relief lead qualifier. You screen social media posts to determine if the author is genuinely dealing with accumulated CREDIT-CARD or UNSECURED PERSONAL-LOAN debt and may be interested in CONSOLIDATING that debt into one payment.

For each post below, classify it as one of:
- "fit": The post clearly indicates the person has credit-card debt or unsecured personal-loan debt (multiple cards, maxed out cards, high interest, drowning in card debt, personal loan debt) AND suggests they are looking for help, relief, settlement, or consolidation.
- "not_fit": The post is about other types of debt (student loans, mortgage, auto loans, medical debt, tax debt, business debt, payday loans as sole topic) OR is not about debt at all OR is about general financial topics without credit-card/unsecured-loan debt.
- "ambiguous": The post mentions debt but it's unclear whether it's credit-card or unsecured personal-loan debt, OR it's unclear if the person wants consolidation help (e.g., just venting, asking about budgeting, discussing someone else's debt).

KEY DISTINCTIONS:
- Credit card debt, maxed out cards, card balances, high APR on cards = FIT
- "Drowning in debt" + mentions credit cards = FIT
- Personal loans (unsecured) with debt burden = FIT
- Looking for debt consolidation, settlement, relief, or help = FIT
- Student loans, mortgage, car loans, medical bills, tax debt = NOT_FIT
- General budgeting advice, investing, saving money = NOT_FIT
- Just complaining about capitalism/economy without personal debt = NOT_FIT
- Mentioning "debt" without specifying type or asking for help = AMBIGUOUS

Return a JSON object with a "results" array, one entry per post IN ORDER. Each entry has:
- index: the post number (1-based)
- status: "fit", "not_fit", or "ambiguous"
- confidence: 0-100 (how confident you are in the classification)
- reason: one short sentence explaining why (cite the specific debt type or lack thereof)

POSTS TO CLASSIFY:

${postsContext}`,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              status: { type: 'string' },
              confidence: { type: 'number' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
  });

  return (result?.results || []).map((r: any) => ({
    index: r.index,
    status: ['fit', 'not_fit', 'ambiguous'].includes(r.status) ? r.status : 'ambiguous',
    confidence: typeof r.confidence === 'number' ? r.confidence : 50,
    reason: (r.reason || '').substring(0, 500),
  }));
}

async function screenSingleLead(base44: any, leadId: string): Promise<any> {
  const lead = await base44.asServiceRole.entities.ScrapedLead.get(leadId);
  if (!lead) throw new Error('Lead not found');

  await base44.asServiceRole.entities.ScrapedLead.update(leadId, { debtFitStatus: 'screening' });

  const results = await screenBatch(base44, [lead]);
  const r = results[0] || { status: 'ambiguous', confidence: 50, reason: 'No result from AI' };

  await base44.asServiceRole.entities.ScrapedLead.update(leadId, {
    debtFitStatus: r.status,
    debtFitReason: r.reason,
    debtFitConfidence: r.confidence,
    debtFitScreenedAt: new Date().toISOString(),
    // Eliminate non-fits from the active pipeline automatically
    ...(r.status === 'not_fit' ? { status: 'rejected' } : {}),
  });

  return { leadId, status: r.status, confidence: r.confidence, reason: r.reason };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // ── Single lead mode ──────────────────────────────────────────────────
    if (body?.leadId) {
      const result = await screenSingleLead(base44, body.leadId);
      return Response.json(result);
    }

    // ── Bulk mode: specific leadIds ──────────────────────────────────────
    if (body?.bulk === true) {
      let leadIds: string[] = body?.leadIds || [];

      // If pending mode, fetch all pending leads
      if (body?.pending === true) {
        // Match leads that are pending, screening, or never screened (null/unset)
        const pending = await base44.asServiceRole.entities.ScrapedLead.filter({
          $or: [
            { debtFitStatus: { $in: ['pending', 'screening'] } },
            { debtFitStatus: null },
          ],
        });
        leadIds = (pending || []).map((l: any) => l.id);
      }

      if (leadIds.length === 0) {
        return Response.json({ status: 'success', processed: 0, fit: 0, notFit: 0, ambiguous: 0, failed: 0 });
      }

      // Mark all as screening
      await base44.asServiceRole.entities.ScrapedLead.updateMany(
        { id: { $in: leadIds } },
        { $set: { debtFitStatus: 'screening' } }
      );

      // Fetch full lead records
      const leads = await base44.asServiceRole.entities.ScrapedLead.filter({
        id: { $in: leadIds },
      });

      let fit = 0, notFit = 0, ambiguous = 0, failed = 0;
      const updateBatch: any[] = [];

      // Process in batches of BATCH_SIZE
      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        try {
          const results = await screenBatch(base44, batch);
          const resultByIndex = new Map(results.map((r: any) => [r.index, r]));

          for (let j = 0; j < batch.length; j++) {
            const lead = batch[j];
            const r = resultByIndex.get(j + 1) || { status: 'ambiguous', confidence: 50, reason: 'No result from AI' };
            if (r.status === 'fit') fit++;
            else if (r.status === 'not_fit') notFit++;
            else ambiguous++;
            updateBatch.push({
              id: lead.id,
              debtFitStatus: r.status,
              debtFitReason: r.reason,
              debtFitConfidence: r.confidence,
              debtFitScreenedAt: new Date().toISOString(),
              // Eliminate non-fits from the active pipeline automatically
              ...(r.status === 'not_fit' ? { status: 'rejected' } : {}),
            });
          }
        } catch (e: any) {
          failed += batch.length;
          for (const lead of batch) {
            updateBatch.push({
              id: lead.id,
              debtFitStatus: 'pending',
              debtFitReason: `Screening failed: ${(e as Error).message}`,
            });
          }
        }
        // Rate limit between batches
        if (i + BATCH_SIZE < leads.length) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // Bulk update results
      if (updateBatch.length > 0) {
        await base44.asServiceRole.entities.ScrapedLead.bulkUpdate(updateBatch);
      }

      return Response.json({
        status: 'success',
        processed: leads.length,
        fit,
        notFit,
        ambiguous,
        failed,
      });
    }

    return Response.json({ error: 'Provide leadId, or { bulk: true, leadIds: [...] }, or { bulk: true, pending: true }' }, { status: 400 });
  } catch (error) {
    console.error('[screenDebtFit] Fatal error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}