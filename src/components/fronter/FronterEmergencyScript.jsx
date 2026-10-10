/**
 * FronterEmergencyScript.jsx — Alt+S toggles a hardcoded, non-editable emergency
 * script in a draggable, resizable popout.
 */
import { useState, useEffect, useRef } from 'react';

const EMERGENCY_SCRIPT = `EMERGENCY SCRIPT

(Script text not yet provided — paste the full emergency script here.)`;

export default function FronterEmergencyScript() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 120, y: 90 });
  const [size, setSize] = useState({ w: 460, h: 520 });
  const dragRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  const track = (onMove) => {
    const up = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', up);
  };

  const onDragStart = (e) => {
    dragRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    track(ev => setPos({ x: ev.clientX - dragRef.current.x, y: ev.clientY - dragRef.current.y }));
  };

  const onResizeStart = (e) => {
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sw = size.w, sh = size.h;
    track(ev => setSize({ w: Math.max(300, sw + ev.clientX - sx), h: Math.max(200, sh + ev.clientY - sy) }));
  };

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#1a0a0a', border: '2px solid rgba(239,68,68,0.6)', borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.85)', zIndex: 10050, display: 'flex', flexDirection: 'column' }}>
      <div onMouseDown={onDragStart} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(239,68,68,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', background: 'rgba(239,68,68,0.12)' }}>
        <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🆘 Emergency Script <span style={{ color: '#8a9ab8', fontWeight: 'normal', textTransform: 'none' }}>(Alt+S)</span></span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#8a9ab8', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', color: '#f5e6e6', fontSize: '15px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>{EMERGENCY_SCRIPT}</div>
      <div onMouseDown={onResizeStart} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#8a9ab8', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}