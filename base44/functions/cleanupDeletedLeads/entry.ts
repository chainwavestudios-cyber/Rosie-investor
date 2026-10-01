/**
 * cleanupDeletedLeads — Permanently deletes DebtLead records that were soft-deleted
 * (deletedAt set) more than 7 days ago. Called by a scheduled workflow daily.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const all = await base44.asServiceRole.entities.DebtLead.list('-created_date', 500);
    const leads = all || [];
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
    const expired = leads.filter((l: any) => l.deletedAt && new Date(l.deletedAt) < cutoff);

    let deleted = 0;
    for (const lead of expired) {
      try {
        await base44.asServiceRole.entities.DebtLead.delete(lead.id);
        deleted++;
      } catch {}
    }

    return Response.json({ status: 'success', expiredCount: expired.length, deletedCount: deleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}