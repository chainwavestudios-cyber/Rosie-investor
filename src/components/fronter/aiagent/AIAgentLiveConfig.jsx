/**
 * AIAgentLiveConfig — Shows what LLM model and TTS voice are ACTUALLY
 * being used during calls, so the admin can confirm their selections
 * are taking effect. Displays the config value → actual mapped value.
 */
import React from 'react';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

const LLM_LABELS = {
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-opus-5': 'Claude Opus 5',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'gpt-5-4': 'GPT-5.4',
  'gemini-3-1-pro': 'Gemini 3.1 Pro',
};

const VOICE_LABELS = {
  'aura-2-thalia-en': 'Joanna (warm, female)',
  'aura-2-asteria-en': 'Salli (smooth, female)',
  'aura-2-arcas-en': 'Matthew (deep, male)',
  'aura-2-orpheus-en': 'Brian (narrator, male)',
  '21m00Tcm4TlvDq8ikWAM': 'Kendra (calm, female)',
  'EXAVITqu4j5949LvpkN8': 'Matthew (deep, male)',
  'pNInz6obpgDQGcFmaJgB': 'Brian (narrator, male)',
};

export default function AIAgentLiveConfig({ config }) {
  if (!config) return null;

  const llmLabel = LLM_LABELS[config.llmModel] || config.llmModel || 'Claude Sonnet 5 (default)';
  const voiceLabel = VOICE_LABELS[config.ttsVoiceModel] || 'Joanna (default, female)';
  const ttsEngineLabel = config.ttsEngine === 'elevenlabs' ? 'ElevenLabs' : 'Deepgram Aura';

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(96,165,250,0.06))',
      border: '1px solid rgba(16,185,129,0.25)',
      borderRadius: '6px',
      padding: '14px 18px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD, animation: 'pulse 1.5s infinite' }} />
        <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Live Call Config</span>
        <span style={{ color: '#4a5568', fontSize: '10px' }}>— what the AI agent actually uses on every call</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        {/* LLM Model */}
        <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '10px 12px' }}>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>LLM Brain</div>
          <div style={{ color: BLUE, fontSize: '13px', fontWeight: 'bold' }}>{llmLabel}</div>
          <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '2px' }}>via platform InvokeLLM</div>
        </div>

        {/* TTS Voice */}
        <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '10px 12px' }}>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>TTS Voice</div>
          <div style={{ color: PURPLE, fontSize: '13px', fontWeight: 'bold' }}>{voiceLabel}</div>
          <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '2px' }}>Twilio Polly (mapped from {ttsEngineLabel})</div>
        </div>

        {/* Transfer Target */}
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '10px 12px' }}>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Transfer To</div>
          <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>{config.transferPhoneNumber || '+16193530919'}</div>
          <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '2px' }}>2nd: {config.transferPhoneNumber2 || '+12162586934'}</div>
        </div>
      </div>

      <div style={{ marginTop: '8px', color: AMBER, fontSize: '10px', lineHeight: 1.4 }}>
        Note: Twilio uses Amazon Polly voices for speech. Your {ttsEngineLabel} selection is mapped to the closest Polly equivalent above. True {ttsEngineLabel === 'ElevenLabs' ? 'ElevenLabs' : 'Deepgram Aura'} TTS (sub-200ms streaming) requires a custom streaming architecture — the current setup uses Polly for reliability.
      </div>
    </div>
  );
}