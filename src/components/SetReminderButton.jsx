import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

const GOLD = '#b8933a';

export default function SetReminderButton({ contact, onSetReminder }) {
  const [showInput, setShowInput] = useState(false);
  const [minutes, setMinutes] = useState('5');
  const inputRef = useRef(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  const handleSet = () => {
    const m = parseInt(minutes);
    if (m > 0) {
      onSetReminder(contact, m);
      setShowInput(false);
      setMinutes('5');
    }
  };

  if (showInput) {
    return (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="number"
          min="1"
          max="1440"
          value={minutes}
          onChange={e => setMinutes(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSet();
            if (e.key === 'Escape') setShowInput(false);
          }}
          placeholder="Minutes"
          style={{
            width: '50px',
            padding: '4px 6px',
            borderRadius: '3px',
            border: `1px solid ${GOLD}`,
            background: 'rgba(184,147,58,0.1)',
            color: '#e8e0d0',
            fontSize: '12px',
            outline: 'none',
            fontFamily: 'Georgia, serif',
          }}
        />
        <button
          onClick={handleSet}
          style={{
            background: GOLD,
            color: '#0a0f1e',
            border: 'none',
            borderRadius: '3px',
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '700',
            fontFamily: 'Georgia, serif',
          }}>
          Set
        </button>
        <button
          onClick={() => setShowInput(false)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '3px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'Georgia, serif',
          }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: `rgba(184,147,58,0.1)`,
        color: GOLD,
        border: `1px solid rgba(184,147,58,0.3)`,
        borderRadius: '3px',
        padding: '4px 10px',
        cursor: 'pointer',
        fontSize: '11px',
        fontFamily: 'Georgia, serif',
      }}>
      <Clock style={{ width: '14px', height: '14px' }} />
      Remind
    </button>
  );
}