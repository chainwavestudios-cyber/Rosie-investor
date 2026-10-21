/**
 * AgentVoiceBar.jsx — Mic control + live state for the contact-card AI agent's
 * voice mode: listening, thinking, speaking, with the incoming words on screen.
 */
const PURPLE = '#a78bfa';
const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';

const LABELS = {
  off: { text: 'Voice off', color: '#6b7280', dot: '○' },
  connecting: { text: 'Connecting mic…', color: GOLD, dot: '◍' },
  listening: { text: 'Listening — just talk', color: '#4ade80', dot: '●' },
  thinking: { text: 'Agent working…', color: PURPLE, dot: '◍' },
  speaking: { text: 'Agent speaking…', color: '#60a5fa', dot: '◍' },
  error: { text: 'Voice error', color: RED, dot: '●' },
};

export default function AgentVoiceBar({ voice, hint }) {
  const meta = LABELS[voice.status] || LABELS.off;
  const live = voice.status !== 'off';

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <button
        onClick={live ? voice.stop : voice.start}
        title={live ? 'Stop voice mode' : 'Talk to the agent'}
        style={{
          background: live ? `linear-gradient(135deg,${RED},#dc2626)` : `linear-gradient(135deg,${PURPLE},#8b5cf6)`,
          color: live ? '#fff' : '#0a0f1e', border: 'none', borderRadius: '4px', padding: '7px 14px',
          cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px', whiteSpace: 'nowrap',
        }}
      >
        {live ? '⏹ Stop Voice' : '🎙 Talk to Agent'}
      </button>

      {/* Replies come back as text by default — switch this on to hear them */}
      <button
        onClick={() => voice.setSpeakReplies?.(!voice.speakReplies)}
        title={voice.speakReplies ? 'Answers are read out loud' : 'Answers come back as text only'}
        style={{
          background: voice.speakReplies ? `${BLUE}22` : 'rgba(255,255,255,0.05)',
          color: voice.speakReplies ? BLUE : '#8a9ab8',
          border: `1px solid ${voice.speakReplies ? `${BLUE}55` : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '4px', padding: '7px 12px', cursor: 'pointer', fontSize: '11px',
          fontWeight: 'bold', whiteSpace: 'nowrap',
        }}
      >
        {voice.speakReplies ? '🔊 Voice replies' : '💬 Text replies'}
      </button>

      <span style={{ color: meta.color, fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
        {meta.dot} {meta.text}
      </span>

      {voice.interim && (
        <span style={{ color: '#8a9ab8', fontSize: '11px', fontStyle: 'italic', flex: 1, minWidth: '120px' }}>
          “{voice.interim}”
        </span>
      )}

      {!voice.interim && !live && (
        <span style={{ color: '#6b7280', fontSize: '10px', flex: 1, minWidth: '120px' }}>
          {hint || 'Speak commands and questions — the agent answers in text and fills the fields.'}
        </span>
      )}

      {voice.error && (
        <span style={{ color: RED, fontSize: '10px', width: '100%' }}>⚠ {voice.error}</span>
      )}
    </div>
  );
}