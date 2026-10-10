/**
 * cleanupBobSessions — Deletes BobSession records whose expiresAt has passed.
 * Called by a scheduled workflow every hour. Recordings (and their sessions)
 * are auto-deleted after 24 hours.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const all = await base44.asServiceRole.entities.BobSession.list('-created_date', 500);
    const sessions = all || [];
    const now = new Date();
    const expired = sessions.filter((s: any) => s.expiresAt && new Date(s.expiresAt) < now);

    let deleted = 0;
    for (const session of expired) {
      try {
        await base44.asServiceRole.entities.BobSession.delete(session.id);
        deleted++;
      } catch {}
    }

    return Response.json({ status: 'success', expiredCount: expired.length, deletedCount: deleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}