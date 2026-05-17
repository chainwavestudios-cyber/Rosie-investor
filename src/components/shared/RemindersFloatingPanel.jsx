import { useState, useEffect, useRef } from 'react';

const GOLD = '#b8933a';

const LEAD_TYPE_LABELS = {
  nb_tech: '💡 NB Tech',
  standard: '🔵 Standard',
};

function formatTimeLeft(ms) {
  if (ms <= 0) return 'Expired';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function RemindersFloatingPanel({ reminders = [], onClearReminder }) {
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: 80 });
  const [size, setSize] = useState({ w: 300, h: 'auto' });
  const [minimized, setMinimized] = useState(false);
  const [now, setNow] = useState(Date.now());
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef(null);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-remove expired reminders
  useEffect(() => {
    reminders.forEach(r => {
      if (r.dueAt <= now && !r.fired) {
        // Already handled by useReminders hook firing them
      }
    });
  }, [now, reminders]);

  // Active reminders: not fired, not expired (or just expired in last 5s)
  const active = reminders.filter(r => !r.fired && r.dueAt > now - 5000);

  // Drag handlers
  const onHeaderMouseDown = (e) => {
    if (e.target.closest('button')) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current) {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y)),
        });
      }
      if (resizing.current) {
        const newW = Math.max(220, e.clientX - pos.x);
        setSize(s => ({ ...s, w: newW }));
      }
    };
    const onUp = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [pos.x]);

  if (active.length === 0) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        zIndex: 99990,
        background: '#0d1b2a',
        border: `2px solid ${GOLD}`,
        borderRadius: '10px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        fontFamily: 'Georgia, serif',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header — draggable */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          background: 'rgba(184,147,58,0.15)',
          borderBottom: `1px solid rgba(184,147,58,0.3)`,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'move',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '14px' }}>⏰</span>
          <span style={{ color: GOLD, fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Reminders
          </span>
          <span style={{ background: 'rgba(184,147,58,0.25)', color: GOLD, borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold' }}>
            {active.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setMinimized(m => !m)}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#8a9ab8', cursor: 'pointer', fontSize: '12px', padding: '2px 7px', lineHeight: 1 }}
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {active.map(r => {
            const msLeft = r.dueAt - now;
            const expired = msLeft <= 0;
            const urgentColor = expired ? '#ef4444' : msLeft < 60000 ? '#f59e0b' : '#4ade80';
            const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Unknown';
            const typeLabel = r.leadType ? (LEAD_TYPE_LABELS[r.leadType] || r.leadType) : (r.type === 'investor' ? '✅ Investor' : '🔵 Lead');

            return (
              <div key={r.id} style={{
                background: expired ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${expired ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '6px',
                padding: '8px 10px',
                position: 'relative',
              }}>
                {/* X button */}
                <button
                  onClick={() => onClearReminder(r.id)}
                  style={{ position: 'absolute', top: '5px', right: '6px', background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
                  title="Dismiss"
                >×</button>

                {/* Name */}
                <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', paddingRight: '18px' }}>{name}</div>

                {/* Lead type */}
                <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>{typeLabel}</div>

                {/* Timer */}
                <div style={{
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: urgentColor,
                    boxShadow: `0 0 6px ${urgentColor}`,
                    animation: expired ? 'none' : msLeft < 30000 ? 'urgent-pulse 0.6s infinite' : 'none',
                    flexShrink: 0,
                  }} />
                  <span style={{ color: urgentColor, fontSize: '16px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px' }}>
                    {formatTimeLeft(msLeft)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={(e) => { resizing.current = true; e.preventDefault(); }}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '16px',
          height: '16px',
          cursor: 'se-resize',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          padding: '2px',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 9L9 2M5 9L9 5M9 9L9 9" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <style>{`
        @keyframes urgent-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}