import { Mic, MicOff } from 'lucide-react';

// The mic in the AI console composer. Tap to speak a command; ACE hears the
// finished sentence and runs it, so talking to the agent needs no typing.
export default function AceVoiceButton({ listening, supported, onClick }) {
  const Icon = listening ? MicOff : Mic;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!supported}
      title={supported ? (listening ? 'Stop listening' : 'Speak a command') : 'Voice input needs Chrome, Edge or Safari'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '40px', height: '40px', flex: 'none',
        background: listening ? 'rgba(239,68,68,0.18)' : '#111925',
        color: listening ? '#ef4444' : supported ? '#9ca3af' : '#3f4b5b',
        border: `1px solid ${listening ? 'rgba(239,68,68,0.5)' : '#1f2937'}`,
        borderRadius: '6px',
        cursor: supported ? 'pointer' : 'default',
      }}
    >
      <Icon size={16} />
    </button>
  );
}