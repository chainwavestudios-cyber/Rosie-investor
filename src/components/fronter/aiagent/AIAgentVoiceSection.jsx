import React from 'react';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const STT_OPTIONS = [
  { value: 'deepgram-nova-2', label: 'Deepgram Nova-2 (low-latency, real-time)' },
  { value: 'deepgram-nova-3', label: 'Deepgram Nova-3 (highest accuracy)' },
];

const TTS_OPTIONS = [
  { value: 'deepgram-aura', label: 'Deepgram Aura (sub-200ms latency)' },
  { value: 'elevenlabs', label: 'ElevenLabs (premium conversational voices)' },
];

const LLM_OPTIONS = [
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 (best conversational reasoning)' },
  { value: 'claude-opus-5', label: 'Claude Opus 5 (deepest reasoning)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (fast, capable)' },
  { value: 'gpt-5-4', label: 'GPT-5.4 (OpenAI)' },
  { value: 'gemini-3-1-pro', label: 'Gemini 3.1 Pro (Google)' },
];

const VOICE_PRESETS = {
  'deepgram-aura': [
    { value: 'aura-2-thalia-en', label: 'Thalia (warm, female)' },
    { value: 'aura-2-asteria-en', label: 'Asteria (smooth, female)' },
    { value: 'aura-2-arcas-en', label: 'Arcas (deep, male)' },
    { value: 'aura-2-orpheus-en', label: 'Orpheus (narrator, male)' },
  ],
  'elevenlabs': [
    { value: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel (calm, female)' },
    { value: 'EXAVITqu4j5949LvpkN8', label: 'Adam (deep, male)' },
    { value: 'pNInz6obpgDQGcFmaJgB', label: 'Adam (narrator)' },
    { value: '1SM7GgM6IMuvQlz2BwM3', label: 'Conversational Mark (natural, male)' },
  ],
};

export default function AIAgentVoiceSection({ config, update }) {
  const voiceOptions = VOICE_PRESETS[config.ttsEngine] || [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
      <div>
        <label style={ls}>STT Engine (Speech-to-Text)</label>
        <select value={config.sttEngine || 'deepgram-nova-2'} onChange={e => update('sttEngine', e.target.value)} style={inp}>
          {STT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <label style={ls}>TTS Engine (Text-to-Speech)</label>
        <select value={config.ttsEngine || 'deepgram-aura'} onChange={e => { update('ttsEngine', e.target.value); update('ttsVoiceModel', ''); }} style={inp}>
          {TTS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <label style={ls}>Voice Model</label>
        {voiceOptions.length > 0 ? (
          <select value={config.ttsVoiceModel || ''} onChange={e => update('ttsVoiceModel', e.target.value)} style={inp}>
            <option value="">— Select voice —</option>
            {voiceOptions.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        ) : (
          <input value={config.ttsVoiceModel || ''} onChange={e => update('ttsVoiceModel', e.target.value)} style={inp} placeholder="Voice ID" />
        )}
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <label style={ls}>LLM Model (conversation brain)</label>
        <select value={config.llmModel || 'claude-sonnet-5'} onChange={e => update('llmModel', e.target.value)} style={inp}>
          {LLM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}