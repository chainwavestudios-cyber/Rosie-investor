/**
 * protofaceAdmin — the video qualification settings screen (Debt Call Coach → ProtoFace),
 * in one call.
 *
 * The settings record can only be read from the app by a platform admin, while the
 * portal signs its people in with a Debt Call Coach session of its own, so the screen
 * read would always fail for a portal admin. This reads and writes the record as the
 * service role, behind the same admin gate the other portal admin screens use.
 *
 * Returns { config } — the whole settings record (created if it is missing yet).
 * Actions:
 *   (none)  → the settings as they stand
 *   'save'  → merges only the fields this screen owns, then returns the saved record
 *
 * Admins only: the Debt Call Coach admin session, or a platform admin.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { marketingUser } from '../../shared/fronterMarketing.ts';
import { loadConfig } from '../../shared/videoQualify.ts';

/** The fields this screen owns. Anything else on the record is left untouched. */
const TEXT_FIELDS = [
  'assistantsJson',
  'agentName',
  'kbName',
  'agentVoiceId',
  'firstMessage',
  'systemPrompt',
  'llmModel',
  'salesLine',
  'bridgeWhisper',
  'protofaceAvatarId',
  'protofaceEmbedId',
  'protofaceEmbedUrl',
];
const BOOLEAN_FIELDS = ['isActive', 'agentDrivenMode'];
const NUMBER_LIMITS: any = {
  temperature: [0, 2],
  speechChunkMs: [10, 2000],
  speechGapMs: [0, 5000],
  voiceDelayMs: [0, 5000],
};

export default async function (req: Request): Promise<Response> {
  try {
    const body: any = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const user = await marketingUser(base44, body);
    if (!user.canEdit) {
      return Response.json({ error: 'Only an admin can see or change the video qualification settings.' }, { status: 403 });
    }

    if (body.action === 'save') {
      const patch: any = {};
      for (const field of TEXT_FIELDS) if (field in body) patch[field] = String(body[field] ?? '');
      for (const field of BOOLEAN_FIELDS) if (field in body) patch[field] = body[field] === true || body[field] === 'true';
      for (const field of Object.keys(NUMBER_LIMITS)) {
        if (!(field in body)) continue;
        const parsed = Number(body[field]);
        if (!Number.isFinite(parsed)) continue;
        const [min, max] = NUMBER_LIMITS[field];
        patch[field] = Math.max(min, Math.min(max, parsed));
      }
      if (!Object.keys(patch).length) return Response.json({ error: 'Nothing to save.' }, { status: 400 });

      patch.updatedBy = user.username || user.email || 'admin';
      patch.updatedAt = new Date().toISOString();

      const existing = await loadConfig(base44);
      await base44.asServiceRole.entities.VideoQualifyConfig.update(existing.id, patch);
      return Response.json({ ok: true, config: { ...existing, ...patch } });
    }

    const config = await loadConfig(base44);
    return Response.json({ config });
  } catch (error: any) {
    const forbidden = error?.message === 'Forbidden' || error?.message === 'Unauthorized';
    return Response.json(
      { error: error?.message || 'Could not read the video qualification settings' },
      { status: forbidden ? 403 : 500 },
    );
  }
}