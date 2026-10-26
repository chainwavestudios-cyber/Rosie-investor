/**
 * sendQueuedFollowUps — releases the follow-up emails that had to wait.
 *
 * A lead qualifies the moment they open their credentials email and click 2 of
 * the 3 tracked links, which is usually minutes after the email lands. Those
 * too-early ones are queued by processEmailTrackingEvent with followUpDueAt —
 * the moment their eight business hours are up. This tick, driven by the
 * "Queued Follow-Up Release" workflow every 5 minutes, sends each queued
 * follow-up whose moment has arrived.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { automationGate } from '../../shared/automationRules.ts';
import { sendFollowUpEmail } from '../../shared/followUpEmail.ts';

const BATCH = 50;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Workflow-only function on a public URL: only the app's own admin drives it.
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const gate = await automationGate(base44, 'email_followup');
    if (!gate.run) return Response.json({ skipped: true, automation: 'email_followup', reason: gate.reason });

    const raw = await base44.asServiceRole.entities.FronterLead.filter(
      { followUpQueued: true, followUpDueAt: { $lte: new Date().toISOString() } },
      { sort: 'followUpDueAt', limit: BATCH }
    );
    const leads = Array.isArray(raw) ? raw : (raw?.items || []);

    let sent = 0;
    let failed = 0;
    for (const lead of leads) {
      if (!lead.email) { failed += 1; continue; }
      try {
        await sendFollowUpEmail(
          base44,
          lead,
          `📨 Auto follow-up email sent to ${lead.email} — released from the queue once the 8 business hours after the credentials email had passed`
        );
        sent += 1;
      } catch (e) {
        failed += 1;
        console.error(`[sendQueuedFollowUps] Follow-up failed for ${lead.id}:`, (e as Error).message);
      }
    }

    return Response.json({ success: true, due: leads.length, sent, failed });
  } catch (error) {
    console.error('[sendQueuedFollowUps] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}