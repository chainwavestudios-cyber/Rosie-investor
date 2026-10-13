/**
 * syncObjectionsToKB — Copies enabled Objection records into the KnowledgeBase
 * as debt_objections entries so BOB training AND live-call AI panels pick them
 * up automatically. Deduplicates by matching objection ID in tags.
 * Called by a scheduled workflow every 2 hours, or manually.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all enabled objections
    const objections = await base44.asServiceRole.entities.Objection.filter({
      enabled: true,
    });

    if (!objections || objections.length === 0) {
      return Response.json({ status: 'success', synced: 0, message: 'No enabled objections to sync.' });
    }

    // Get existing debt_objections KB entries to dedupe by objection ID in tags
    const existing = await base44.asServiceRole.entities.KnowledgeBase.filter({
      category: 'debt_objections',
    });
    const existingIds = new Set(
      (existing || [])
        .map((e: any) => {
          const m = (e.tags || '').match(/objection_id:(\S+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean)
    );

    // Also track existing entries that are no longer in Objection (to remove stale ones)
    const activeObjectionIds = new Set(objections.map((o: any) => o.id));
    const staleEntries = (existing || []).filter((e: any) => {
      const m = (e.tags || '').match(/objection_id:(\S+)/);
      const oid = m ? m[1] : null;
      return oid && !activeObjectionIds.has(oid);
    });

    let synced = 0;
    let updated = 0;
    let skipped = 0;

    for (const obj of objections) {
      const tagId = `objection_id:${obj.id}`;
      const existingEntry = (existing || []).find((e: any) => (e.tags || '').includes(tagId));

      // Build the KB answer from objection fields
      const parts = [obj.responseText || ''];
      if (obj.mindset) parts.push(`\n[Customer Mindset: ${obj.mindset}]`);
      if (obj.goal) parts.push(`\n[Agent Goal: ${obj.goal}]`);
      const answer = parts.join('');
      const triggerPhrases = obj.triggerPhrases || '[]';

      if (existingEntry) {
        // Update existing entry if content changed
        const needsUpdate =
          existingEntry.question !== obj.title ||
          existingEntry.answer !== answer;
        if (needsUpdate) {
          await base44.asServiceRole.entities.KnowledgeBase.update(existingEntry.id, {
            question: obj.title,
            answer,
            variations: triggerPhrases,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Create new KB entry
        await base44.asServiceRole.entities.KnowledgeBase.create({
          question: obj.title,
          answer,
          category: 'debt_objections',
          source: `Objection Sync (${obj.priority || 'medium'} priority)`,
          kbName: 'Debt Settlement',
          tags: `${tagId} priority:${obj.priority || 'medium'}`,
          variations: triggerPhrases,
          created_date: new Date().toISOString(),
        });
        synced++;
      }
    }

    // Remove stale entries (objection deleted or disabled since last sync)
    let removed = 0;
    for (const stale of staleEntries) {
      try {
        await base44.asServiceRole.entities.KnowledgeBase.delete(stale.id);
        removed++;
      } catch {}
    }

    return Response.json({
      status: 'success',
      totalObjections: objections.length,
      synced,
      updated,
      skipped,
      removed,
      message: `Synced ${synced} new, updated ${updated}, skipped ${skipped}, removed ${removed} stale. ${objections.length} active objections now in BOB's brain.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}