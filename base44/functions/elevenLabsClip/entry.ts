/**
 * elevenLabsClip — generates (and caches) one ElevenLabs spoken line and returns
 * its public MP3 URL. Used by the BOB training transfer simulation to voice the
 * advisor on the other end of the merged call.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { getTtsClip } from '../../shared/elevenLabsTts.ts';

const MAX_TEXT = 600;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || '').trim().slice(0, MAX_TEXT);
    const voiceId = String(body?.voiceId || '').trim();
    const keyPrefix = String(body?.keyPrefix || 'simvoice').trim().slice(0, 40);
    if (!text || !voiceId) return Response.json({ error: 'text and voiceId are required' }, { status: 400 });

    const audioUrl = await getTtsClip(base44.asServiceRole, { text, voiceId, keyPrefix });
    if (!audioUrl) return Response.json({ error: 'Voice clip unavailable' }, { status: 502 });

    return Response.json({ audioUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}