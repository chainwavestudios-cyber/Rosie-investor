import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Nightly backup of DebtScripts that have alwaysSaveBackup enabled.
// Creates a ScriptBackup record per script, then deletes backups older than 7 days.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const now = new Date();
    const backupDate = now.toISOString();

    // Fetch all scripts (500 is plenty for this app)
    const scripts = await svc.entities.DebtScript.list('sortOrder', 500);
    const toBackup = (scripts || []).filter((s: any) => s.alwaysSaveBackup === true);

    let backedUp = 0;
    for (const script of toBackup) {
      try {
        await svc.entities.ScriptBackup.create({
          scriptId: script.id,
          scriptName: script.name || 'Untitled',
          backupDate,
          content: script.content || '',
          scriptType: script.scriptType || 'custom',
          color: script.color || '#e8e0d0',
          fontSize: script.fontSize || 14,
        });
        backedUp++;
      } catch (e) { /* skip individual failures */ }
    }

    // Delete backups older than 7 days
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const allBackups = await svc.entities.ScriptBackup.list('-created_date', 500);
    const stale = (allBackups || []).filter((b: any) => {
      const bd = b.backupDate || b.created_date;
      return bd && new Date(bd) < new Date(cutoff);
    });
    let deletedCount = 0;
    for (const b of stale) {
      try { await svc.entities.ScriptBackup.delete(b.id); deletedCount++; } catch {}
    }

    return Response.json({ ok: true, backedUp, deletedCount, cutoff });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}