/**
 * FronterPopup.jsx — Reusable top-layer popup: draggable header, resizable
 * from all 4 edges and 4 corners. Used by meeting scheduler, creds email,
 * emergency script, and any button-generated popup.
 */
import { useState, useRef, useCallback } from 'react';

const HANDLES = [
  { dir: 'n', style: { top: -3, left: 8, right: 8, height: 7, cursor: 'ns-resize' } },
  { dir: 's', style: { bottom: -3, left: 8, right: 8, height: 7, cursor: 'ns-resize' } },
  { dir: 'e', style: { right: -3, top: 8, bottom: 8, width: 7, cursor: 'ew-resize' } },
  { dir: 'w', style: { left: -3, top: 8, bottom: 8, width: 7, cursor: 'ew-resize' } },
  { dir: 'ne', style: { top: -4, right: -4, width: 14, height: 14, cursor: 'nesw-resize' } },
  { dir: 'nw', style: { top: -4, left: -4, width: 14, height: 14, cursor: 'nwse-resize' } },
  { dir: 'se', style: { bottom: -4, right: -4, width: 14, height: 14, cursor: 'nwse-resize' } },
  { dir: 'sw', style: { bottom: -4, left: -4, width: 14, height: 14, cursor: 'nesw-resize' } },
];

export default function FronterPopup({ title, subtitle, accent = '#10b981', children, footer, onClose, initialPos = { x: 140, y: 80 }, initialSize = { w: 520, h: 560 }, minW = 320, minH = 240, zIndex = 10050, headerChildren }) {
  const [pos, setPos] = useState(initialPos);
  const [size, setSize] = useState(initialSize);
  const dragRef = useRef(null);

  const startDrag = (e) => {
    dragRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    const onMove = (ev) => setPos({ x: ev.clientX - dragRef.current.x, y: ev.clientY - dragRef.current.y });
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startResize = useCallback((dir) => (e) => {
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sp = { ...pos }, ss = { ...size };
    const onMove = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let { x, y, w, h } = { ...sp, ...ss };
      if (dir.includes('e')) w = Math.max(minW, ss.w + dx);
      if (dir.includes('s')) h = Math.max(minH, ss.h + dy);
      if (dir.includes('w')) { w = Math.max(minW, ss.w - dx); if (w !== minW || ss.w - dx > minW) x = sp.x + dx; }
      if (dir.includes('n')) { h = Math.max(minH, ss.h - dy); if (h !== minH || ss.h - dy > minH) y = sp.y + dy; }
      setPos({ x, y }); setSize({ w, h });
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos, size, minW, minH]);

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: `1px solid ${accent}66`, borderRadius: '10px', boxShadow: '0 24px 72px rgba(0,0,0,0.85)', zIndex, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div onMouseDown={startDrag} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', cursor: 'move', userSelect: 'none', flexShrink: 0, background: `linear-gradient(135deg, ${accent}14, transparent)` }}>
        <div style={{ minWidth: 0 }}>
          {title && <div style={{ color: accent, fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{title}</div>}
          {subtitle && <div style={{ color: '#8a9ab8', fontSize: '10px', marginTop: '1px' }}>{subtitle}</div>}
        </div>
        {headerChildren}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
      {footer && <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>{footer}</div>}
      {HANDLES.map(h => (
        <div key={h.dir} onMouseDown={startResize(h.dir)} style={{ position: 'absolute', ...h.style, zIndex: 1 }} />
      ))}
    </div>
  );
}