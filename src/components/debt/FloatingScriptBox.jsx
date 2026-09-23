/**
 * FloatingScriptBox.jsx — Draggable floating script panel.
 * Custom script textarea (auto-saved) + closer pitches access.
 * Available during live calls and BOB training. Drag by the header.
 */
import { useState, useRef, useEffect } from 'react';
import { DebtPitchPanel } from '@/components/debt/DebtPitchTab';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function FloatingScriptBox({ storageKey = 'floating_script' }) {
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState('script');
  const [script, setScript] = useState('');
  const [pos, setPos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);

  // Load saved script from localStorage
  useEffect(() => {
    try { const saved = localStorage.getItem(storageKey); if (saved) setScript(saved); } catch {}
  }, [storageKey]);

  // Save script to localStorage
  useEffect(() => {
    try { localStorage.setItem(storageKey, script); } catch {}
  }, [script, storageKey]);

  // Initialize position to bottom-right on first show
  useEffect(() => {
    if (visible && !pos) {
      setPos({ left: window.innerWidth - 420, top: window.innerHeight - 460 });
    }
  }, [visible, pos]);

  // Dragging
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      setPos({
        left: Math.max(0, Math.min(window.innerWidth - 80, dragStart.current.boxLeft + dx)),
        top: Math.max(0, Math.min(window.innerHeight - 40, dragStart.current.boxTop + dy)),
      });
    };
    const handleUp = () => { setDragging(false); dragStart.current = null; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragging]);

  const startDrag = (e) => {
    if (!pos) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, boxLeft: pos.left, boxTop: pos.top };
  };

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999,
          background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK,
          border: 'none', borderRadius: '50%', width: '52px', height: '52px',
          fontSize: '22px', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Open Script Box"
      >📝</button>
    );
  }

  return (
    <div style={{
      position: 'fixed', left: pos?.left ?? window.innerWidth - 420, top: pos?.top ?? window.innerHeight - 460,
      zIndex: 99999, width: minimized ? '260px' : '400px',
      background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      {/* Header — draggable */}
      <div
        onMouseDown={startDrag}
        style={{
          padding: '10px 14px', background: `${GOLD}12`,
          borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.07)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'move', borderRadius: minimized ? '8px' : '8px 8px 0 0',
          userSelect: 'none',
        }}
      >
        <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📝 Script Box</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setMinimized(p => !p)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>{minimized ? '▢' : '—'}</button>
          <button onClick={() => setVisible(false)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>✕</button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {[{ id: 'script', label: '📝 My Script' }, { id: 'pitches', label: '🎤 Pitches' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: '8px', background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`,
                color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer',
                fontSize: '11px', fontWeight: tab === t.id ? 'bold' : 'normal',
              }}>{t.label}</button>
            ))}
          </div>

          {/* Content */}
          {tab === 'script' ? (
            <div style={{ padding: '4px' }}>
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder={'Type or paste your script here…\n\nThis is your personal teleprompter. Drag this box anywhere on screen. Your script is saved automatically.'}
                style={{
                  width: '100%', height: '320px',
                  background: 'rgba(255,255,255,0.03)', border: 'none',
                  color: '#e8e0d0', fontSize: '14px', lineHeight: 1.6,
                  padding: '12px', outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box', fontFamily: 'Georgia, serif',
                  borderRadius: '4px',
                }}
              />
              <div style={{ padding: '4px 8px', color: '#4a5568', fontSize: '10px', textAlign: 'right' }}>
                {script.length} chars · auto-saved
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <DebtPitchPanel />
            </div>
          )}
        </>
      )}
    </div>
  );
}