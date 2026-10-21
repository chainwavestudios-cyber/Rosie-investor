/**
 * inboundGreeting.ts — Shared logic for the inbound call greeting pipeline.
 *
 * Prompt 1: Lead lookup by caller ID → client_name + region + lead fields.
 * Prompt 2: Audio asset resolution → Clip A (name TTS), Clip B (regional phrase),
 *           Clip C (admin-recorded inbound initial message). Returned as ordered
 *           TwiML fragments (Play or Say) for sequential playback before the AI
 *           agent (Adam) connects.
 *
 * Region detection: riverside, san_bernardino, honolulu, or fallback — inferred
 * from the lead's city/state/zip since no explicit county field exists.
 */
import { getPollyVoice } from './aiVoiceMap.ts';

export type Region = 'riverside' | 'san_bernardino' | 'honolulu' | 'fallback';

export interface InboundClip {
  type: 'play' | 'say';
  content: string;
  voice?: string;
}

const REGIONAL_PHRASES: Record<Region, string | null> = {
  riverside: "I hope the Inland Empire commute isn't too terrible today... for years I commuted the 91 to Corona daily, so I get it!",
  san_bernardino: "I hope the Inland Empire commute isn't too terrible today... for years I commuted the 91 to Corona daily, so I get it!",
  honolulu: "I hope that H-1 crawl isn't treating you too rough today...",
  fallback: null,
};

// ── Region detection from lead city/state/zip ──────────────────────────
export function detectRegion(lead: any): Region {
  if (!lead) return 'fallback';
  const city = (lead.city || '').toLowerCase();
  const state = (lead.state || '').toLowerCase();
  const zip = (lead.zipCode || lead.zip || '').toString();

  // Honolulu, HI — zip 967xx/968xx or HI state
  if (state === 'hi' || zip.startsWith('967') || zip.startsWith('968')) return 'honolulu';
  if (city.includes('honolulu') || city.includes('pearl city') || city.includes('waipahu') || city.includes('kaneohe') || city.includes('kailua') || city.includes('mililani')) return 'honolulu';

  // Riverside County, CA — zip 925xx
  if (zip.startsWith('925')) return 'riverside';
  const riversideCities = ['riverside', 'corona', 'moreno valley', 'murrieta', 'temecula', 'hemet', 'perris', 'lake elsinore', 'jurupa', 'beaumont', 'banning', 'palm springs', 'palm desert', 'cathedral city', 'indio', 'coachella', 'desert hot springs', 'la quinta'];
  if (state === 'ca' && riversideCities.some(c => city.includes(c))) return 'riverside';

  // San Bernardino County, CA — zip 923xx/924xx
  if (zip.startsWith('923') || zip.startsWith('924')) return 'san_bernardino';
  const sbCities = ['san bernardino', 'ontario', 'rancho cucamonga', 'fontana', 'upland', 'victorville', 'hesperia', 'apple valley', 'redlands', 'highland', 'colton', 'rialto', 'chino', 'montclair'];
  if (state === 'ca' && sbCities.some(c => city.includes(c))) return 'san_bernardino';

  return 'fallback';
}

// ── Lead lookup by caller phone (Prompt 1) ─────────────────────────────
export async function lookupInboundLead(base44: any, rawPhone: string) {
  if (!rawPhone) return { client_name: 'there', region: 'fallback' as Region, leadId: null, lead: null, leadType: null };

  // Normalize: raw, spaced, E.164, and the bare 10-digit form. Twilio sends
  // "+12162586934" while contact cards are often stored as "2162586934".
  const digits = rawPhone.replace(/\D/g, '');
  const nationalDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  const candidates = Array.from(new Set([
    rawPhone,
    rawPhone.replace(/\s/g, ''),
    '+' + digits,
    digits,
    nationalDigits,
    nationalDigits.length === 10 ? '+1' + nationalDigits : digits,
  ]));

  let lead: any = null;
  let leadType: string | null = null;

  // Try FronterLead (phone + phone2)
  for (const p of candidates) {
    if (lead) break;
    try {
      const results = await base44.entities.FronterLead.filter({ phone: p }, '-created_date', 1);
      if (results?.[0]) { lead = results[0]; leadType = 'fronter'; break; }
    } catch {}
  }
  if (!lead) {
    for (const p of candidates) {
      if (lead) break;
      try {
        const results = await base44.entities.FronterLead.filter({ phone2: p }, '-created_date', 1);
        if (results?.[0]) { lead = results[0]; leadType = 'fronter'; break; }
      } catch {}
    }
  }
  // Try DebtLead
  if (!lead) {
    for (const p of candidates) {
      if (lead) break;
      try {
        const results = await base44.entities.DebtLead.filter({ phone: p }, '-created_date', 1);
        if (results?.[0]) { lead = results[0]; leadType = 'debt'; break; }
      } catch {}
    }
  }

  if (!lead) return { client_name: 'there', region: 'fallback' as Region, leadId: null, lead: null, leadType: null };

  const client_name = lead.firstName || 'there';
  const region = detectRegion(lead);
  // Only a FronterLead id may travel downstream as the inbound contact card.
  // A Debt Call Coach match still personalizes the greeting by name and region,
  // but its id does not exist in FronterLead — the caller then gets a fresh card.
  if (leadType !== 'fronter') return { client_name, region, leadId: null, lead, leadType };
  return { client_name, region, leadId: lead.id, lead, leadType };
}

// ── ElevenLabs TTS clip generation + cache (Prompt 2, Clip A/B) ─────────
async function generateElevenLabsClip(base44: any, text: string, voiceId: string, cacheKey: string): Promise<string | null> {
  // Check cache first
  try {
    const cached = await base44.entities.InboundAudioCache.filter({ cacheKey }, '-generatedAt', 1);
    if (cached?.[0]?.audioUrl) return cached[0].audioUrl;
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
      console.warn('[inboundGreeting] ElevenLabs TTS failed:', res.status);
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
    console.warn('[inboundGreeting] ElevenLabs clip error:', e?.message);
    return null;
  }
}

// ── Resolve the sequential playback queue (Prompt 2) ──────────────────
export async function resolveInboundClips(base44: any, clientName: string, region: Region, config: any): Promise<InboundClip[]> {
  const clips: InboundClip[] = [];
  const voiceId = config?.elevenLabsVoiceId || '';
  const pollyVoice = getPollyVoice(config?.ttsVoiceModel || 'aura-2-thalia-en');

  // Clip A: Name greeting — "Hey {name},"
  if (clientName && clientName !== 'there') {
    const nameText = `Hey ${clientName},`;
    if (voiceId) {
      // Voice ID is part of the key so switching voices regenerates the clip
      const cacheKey = `name:${clientName.toLowerCase()}:${voiceId.slice(0, 8)}`;
      const url = await generateElevenLabsClip(base44, nameText, voiceId, cacheKey);
      if (url) clips.push({ type: 'play', content: url });
      else clips.push({ type: 'say', content: nameText, voice: pollyVoice });
    } else {
      clips.push({ type: 'say', content: nameText, voice: pollyVoice });
    }
  }

  // Clip B: Regional phrase
  const regionalText = REGIONAL_PHRASES[region];
  if (regionalText) {
    if (voiceId) {
      const cacheKey = `region:${region}:${voiceId.slice(0, 8)}`;
      const url = await generateElevenLabsClip(base44, regionalText, voiceId, cacheKey);
      if (url) clips.push({ type: 'play', content: url });
      else clips.push({ type: 'say', content: regionalText, voice: pollyVoice });
    } else {
      clips.push({ type: 'say', content: regionalText, voice: pollyVoice });
    }
  }

  // Clip C: Admin-recorded Inbound Call Initial Message (master human intro)
  try {
    const adminAudio = await base44.entities.InboundCallAudio.filter(
      { assetType: 'inbound_initial_message', isActive: true },
      '-uploadedAt',
      1,
    );
    if (adminAudio?.[0]?.fileUrl) {
      clips.push({ type: 'play', content: adminAudio[0].fileUrl });
    }
  } catch (e) {
    console.warn('[inboundGreeting] Failed to load admin inbound audio:', e?.message);
  }

  return clips;
}

// ── Build TwiML fragments from resolved clips ──────────────────────────
export function clipsToTwiml(clips: InboundClip[]): string {
  return clips.map(c => {
    if (c.type === 'play') return `<Play>${c.content}</Play>`;
    return `<Say voice="${c.voice || 'Polly.Joanna-Neural'}">${c.content}</Say>`;
  }).join('\n  ');
}