/**
 * listElevenLabsVoices — Admin-only endpoint that fetches the ElevenLabs
 * voice library from the server-side API key. Never exposes the API key
 * to the browser. Returns voice_id, name, category, labels, and preview_url.
 *
 * Auth: same pattern as aiAgentPipeline (DebtCoachAuth session or base44.auth.me).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

export default async function(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const body = await req.json().catch(() => ({})) as any;
    let actor: any;
    if (body.sessionUserId && body.sessionToken) {
      const session = await client.functions.invoke('debtCoachAuth', { action: 'me', sessionUserId: body.sessionUserId, sessionToken: body.sessionToken });
      actor = session.data?.user;
      if (actor?.role !== 'super_admin' && actor?.role !== 'admin') {
        return Response.json({ error: 'Admin access required.' }, { status: 403 });
      }
    } else {
      actor = await client.auth.me();
      if (actor?.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const apiKey = secrets.get('ELEVENLABS_API_KEY');
    if (!apiKey) return Response.json({ error: 'ELEVENLABS_API_KEY is not configured.' }, { status: 500 });

    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const details = await res.text().catch(() => '');
      return Response.json(
        { error: `ElevenLabs API returned ${res.status}.`, details: details.slice(0, 300) },
        { status: 502 }
      );
    }
    const data = await res.json() as any;
    const voices = (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category || '',
      labels: v.labels || {},
      preview_url: v.preview_url || '',
    }));
    return Response.json({ voices });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to list ElevenLabs voices.' }, { status: 500 });
  }
}