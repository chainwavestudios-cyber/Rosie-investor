import { useState } from 'react';

const GOLD = '#b8933a';

/**
 * VoiceFXPanel
 * Standalone voice effects control panel
 * 
 * Props:
 *   onClose     — callback when panel is closed
 *   isActive    — bool: whether effects are currently active
 *   onFXChange  — callback when effects are modified
 */
export default function VoiceFXPanel({ onClose, isActive = false, onFXChange }) {
  const [effects, setEffects] = useState({
    echo: false,
    reverb: false,
    compress: false,
    equalize: false,
  });

  const [echoLevel, setEchoLevel] = useState(0.3);
  const [reverbLevel, setReverbLevel] = useState(0.5);

  const handleEffectToggle = (effect) => {
    const updated = { ...effects, [effect]: !effects[effect] };
    setEffects(updated);
    onFXChange && onFXChange(updated);
  };

  const handleEchoChange = (val) => {
    setEchoLevel(val);
    onFXChange && onFXChange({ ...effects, echoLevel: val });
  };

  const handleReverbChange = (val) => {
    setReverbLevel(val);
    onFXChange && onFXChange({ ...effects, reverbLevel: val });
  };

  const EffectToggle = ({ label, effect, icon }) => (
    <button
      onClick={() => handleEffectToggle(effect)}
      style={{
        background: effects[effect] ? `${GOLD}22` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${effects[effect] ? `${GOLD}55` : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '4px',
        padding: '10px 14px',
        cursor: 'pointer',
        color: effects[effect] ? GOLD : '#6b7280',
        fontSize: '12px',
        fontWeight: effects[effect] ? 'bold' : 'normal',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s',
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div
      style={{
        background: '#0d1b2a',
        border: `1px solid rgba(184,147,58,0.3)`,
        borderRadius: '6px',
        padding: '16px',
        fontFamily: 'Georgia, serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <h3
            style={{
              color: GOLD,
              margin: '0 0 4px',
              fontSize: '13px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            🎵 Voice Effects
          </h3>
          <p
            style={{
              color: '#6b7280',
              fontSize: '11px',
              margin: 0,
            }}
          >
            {isActive ? 'Active' : 'Inactive'}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '20px',
          }}
        >
          ×
        </button>
      </div>

      {/* Effects Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <EffectToggle label="Echo" effect="echo" icon="🔊" />
        <EffectToggle label="Reverb" effect="reverb" icon="🌊" />
        <EffectToggle label="Compress" effect="compress" icon="📉" />
        <EffectToggle label="EQ" effect="equalize" icon="🎚" />
      </div>

      {/* Sliders */}
      {effects.echo && (
        <div style={{ marginBottom: '12px' }}>
          <label
            style={{
              display: 'block',
              color: '#8a9ab8',
              fontSize: '10px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Echo Level: {(echoLevel * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={echoLevel}
            onChange={(e) => handleEchoChange(parseFloat(e.target.value))}
            style={{
              width: '100%',
              cursor: 'pointer',
              accentColor: GOLD,
            }}
          />
        </div>
      )}

      {effects.reverb && (
        <div style={{ marginBottom: '12px' }}>
          <label
            style={{
              display: 'block',
              color: '#8a9ab8',
              fontSize: '10px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Reverb Level: {(reverbLevel * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={reverbLevel}
            onChange={(e) => handleReverbChange(parseFloat(e.target.value))}
            style={{
              width: '100%',
              cursor: 'pointer',
              accentColor: GOLD,
            }}
          />
        </div>
      )}

      {/* Footer note */}
      <div
        style={{
          color: '#4a5568',
          fontSize: '10px',
          padding: '10px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        Effects applied in real-time during active calls.
      </div>
    </div>
  );
}