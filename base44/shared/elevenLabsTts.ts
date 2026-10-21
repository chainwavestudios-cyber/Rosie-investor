/**
 * elevenLabsTts.ts — ElevenLabs text-to-speech clips, cached in InboundAudioCache.
 *
 * One generated clip per (voice + wording) pair: the cache key carries both, so a
 * repeated request replays the stored public URL instead of paying for another
 * generation. Shared by the inbound greeting pipeline and the BOB training
 * transfer simulation.
 */

/** Cheap content fingerprint so a cached clip never outlives a wording change. */
export function textFingerprint(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 1000000007;
  return hash.toString(36).slice(0, 6);
}

export interface TtsClipInput {
  text: string;
  voiceId: string;
  /** Cache-key prefix, so unrelated clips can never collide. */
  keyPrefix: string;
}

/** Resolve (or generate + cache) the public MP3 URL for a spoken line. */
export async function getTtsClip(base44: any, { text, voiceId, keyPrefix }: TtsClipInput): Promise<string | null> {
  if (!text || !voiceId) return null;
  const cacheKey = `${keyPrefix}:${voiceId.slice(0, 8)}:${textFingerprint(text)}`;

  // Check cache first
  try {
    const cached = await base44.entities.InboundAudioCache.filter({ cacheKey }, '-generatedAt', 1);
    const hit = cached?.[0] || cached?.items?.[0];
    if (hit?.audioUrl) return hit.audioUrl;
  } catch {}

  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn('[elevenLabsTts] TTS failed:', res.status);
      return null;
    }
    const audioBuffer = await res.arrayBuffer();
    const file = new File([audioBuffer], `${cacheKey.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`, { type: 'audio/mpeg' });
    const upRes = await base44.integrations.Core.UploadPublicFile({ file });
    const audioUrl = upRes?.file_url;
    if (audioUrl) {
      try {
        await base44.entities.InboundAudioCache.create({ cacheKey, audioUrl, voiceId, generatedAt: new Date().toISOString() });
      } catch {}
    }
    return audioUrl || null;
  } catch (e) {
    console.warn('[elevenLabsTts] clip error:', e?.message);
    return null;
  }
}