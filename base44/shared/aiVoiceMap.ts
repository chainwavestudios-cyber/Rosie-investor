/**
 * aiVoiceMap.ts — Maps AI Agent TTS config to Twilio Polly voices.
 *
 * Twilio <Say> only supports Amazon Polly voices. Deepgram Aura and ElevenLabs
 * voices are mapped to the closest Polly equivalent so the voice selector
 * actually changes what the caller hears. True Deepgram/ElevenLabs TTS would
 * require generating audio and using <Play> (higher latency, not implemented).
 */

// Config voice → Twilio Polly voice
const POLLY_VOICE_MAP: Record<string, string> = {
  // Deepgram Aura voices
  'aura-2-thalia-en': 'Polly.Joanna-Neural',     // warm, female
  'aura-2-asteria-en': 'Polly.Salli-Neural',      // smooth, female
  'aura-2-arcas-en': 'Polly.Matthew-Neural',      // deep, male
  'aura-2-orpheus-en': 'Polly.Brian-Neural',      // narrator, male
  // ElevenLabs voices
  '21m00Tcm4TlvDq8ikWAM': 'Polly.Kendra-Neural',  // Rachel (calm, female)
  'EXAVITqu4j5949LvpkN8': 'Polly.Matthew-Neural', // Adam (deep, male)
  'pNInz6obpgDQGcFmaJgB': 'Polly.Brian-Neural',   // Adam (narrator)
  '1SM7GgM6IMuvQlz2BwM3': 'Polly.Matthew-Neural', // Conversational Mark (natural, male)
};

// Config voice → human-readable label (for UI display)
const VOICE_LABEL_MAP: Record<string, string> = {
  'aura-2-thalia-en': 'Joanna (warm, female)',
  'aura-2-asteria-en': 'Salli (smooth, female)',
  'aura-2-arcas-en': 'Matthew (deep, male)',
  'aura-2-orpheus-en': 'Brian (narrator, male)',
  '21m00Tcm4TlvDq8ikWAM': 'Kendra (calm, female)',
  'EXAVITqu4j5949LvpkN8': 'Matthew (deep, male)',
  'pNInz6obpgDQGcFmaJgB': 'Brian (narrator, male)',
  '1SM7GgM6IMuvQlz2BwM3': 'Conversational Mark (natural, male)',
};

export function getPollyVoice(ttsVoiceModel: string): string {
  return POLLY_VOICE_MAP[ttsVoiceModel] || 'Polly.Joanna-Neural';
}

export function getActualVoiceLabel(ttsVoiceModel: string): string {
  return VOICE_LABEL_MAP[ttsVoiceModel] || 'Joanna (default, female)';
}