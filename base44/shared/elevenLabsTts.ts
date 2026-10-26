/**
 * elevenLabsTts.ts — ElevenLabs text-to-speech clips, cached in InboundAudioCache.
 *
 * One generated clip per (voice + wording) pair: the cache key carries both, so a
 * repeated request replays the stored public URL instead of paying for another
 * generation. Shared by the inbound greeting pipeline and the BOB training
 * transfer simulation.
 */

// Same voice pacing as the live agent: a rushed greeting is the first thing a
// caller notices. Model and speed are part of the cache key, so retuning either
// regenerates the clip instead of replaying the old one.
const CLIP_MODEL = 'eleven_turbo_v2_5';
const CLIP_SPEED = 0.9;

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
  const cacheKey = `${keyPrefix}:${voiceId.slice(0, 8)}:${textFingerprint(`${text}|${CLIP_MODEL}|${CLIP_SPEED}`)}`;

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
        model_id: CLIP_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed: CLIP_SPEED },
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

// ── Live avatar speech ────────────────────────────────────────────────────────
// The avatar's face is lip-synced from raw audio, so these lines are synthesized as
// PCM16 mono at 16 kHz (what sendAudioData takes) instead of an MP3 file.
const LIVE_MODEL = 'eleven_turbo_v2_5';
export const PCM_SAMPLE_RATE = 16000;
const MAX_SPEECH_CHARS = 600;
// Full-speed speech reads as rushed on the video call and outruns the face, so the live
// agent speaks at the same 0.9 pacing the app already uses for its spoken greetings.
const LIVE_SPEED = 0.9;

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

/** One spoken line as base64 PCM16 16 kHz mono, ready to stream to the avatar. */
export async function getSpeechPcmBase64(text: string, voiceId: string): Promise<{ audio: string; sampleRate: number } | null> {
  const clean = String(text || '').trim().slice(0, MAX_SPEECH_CHARS);
  if (!clean || !voiceId) return null;
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_${PCM_SAMPLE_RATE}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/pcm' },
      body: JSON.stringify({
        text: clean,
        model_id: LIVE_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed: LIVE_SPEED },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.warn('[elevenLabsTts] live speech failed:', res.status);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 2) return null;
    return { audio: base64FromBytes(bytes), sampleRate: PCM_SAMPLE_RATE };
  } catch (e: any) {
    console.warn('[elevenLabsTts] live speech error:', e?.message);
    return null;
  }
}