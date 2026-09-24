/**
 * syncDebtKB — Merges BOB's Brain and the main KB into one unified dataset.
 * Ensures every entry with a debt category also has kbName = 'Debt Settlement',
 * so both views show the same entries and the same count.
 * Called by a scheduled workflow every 2 hours, or manually.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

const DEBT_CATEGORIES = [
  'debt_kb', 'debt_faq', 'debt_agent', 'debt_customer',
  'debt_doc', 'debt_web', 'debt_call', 'debt_objections',
  'debt_open_scenario', 'debt_close_scenario', 'debt_disqualify', 'debt_hotpoints',
];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // List all KnowledgeBase entries
    const all = await base44.asServiceRole.entities.KnowledgeBase.list('-created_date', 1000);
    const entries = all || [];

    // Find entries with debt categories but kbName !== 'Debt Settlement'
    const toFix = entries.filter((e: any) =>
      DEBT_CATEGORIES.includes(e.category) && (e.kbName || '') !== 'Debt Settlement'
    );

    // Update them to have kbName: 'Debt Settlement'
    let fixed = 0;
    for (const e of toFix) {
      try {
        await base44.asServiceRole.entities.KnowledgeBase.update(e.id, { kbName: 'Debt Settlement' });
        fixed++;
      } catch {}
    }

    // Count totals
    const debtSettlementCount = entries.filter((e: any) => (e.kbName || '') === 'Debt Settlement').length;
    const debtCategoryCount = entries.filter((e: any) => DEBT_CATEGORIES.includes(e.category)).length;
    const totalAfterSync = debtSettlementCount + fixed;

    return Response.json({
      status: 'success',
      totalEntries: entries.length,
      debtSettlementCount,
      debtCategoryCount,
      fixed,
      totalAfterSync,
      message: `Synced ${fixed} entries to Debt Settlement KB. ${totalAfterSync} total entries now in Debt Settlement.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}