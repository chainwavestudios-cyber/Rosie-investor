/**
 * EmergencyScripts.jsx — A floating, draggable, resizable popup that overlays
 * ALL other windows (z-index 30000). Shows every DebtScript as a read-only,
 * scrollable tab at 14pt font. Triggered by a hotkey (Alt+E) during live calls
 * so the agent can instantly pull up any script without navigating away.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const RED = '#ef4444';
const DARK = '#0a0f1e';

export default function EmergencyScripts({ open, onClose }) {
  const [scripts, setScripts] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [pos, setPos] = useState({ x: 120, y: 80 });
  const [size, setSize] = useState({ width: 620, height: 520 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef(null);

  // Load scripts when opened
  useEffect(() => {
    if (!open) return;
    base44.entities.DebtScript.list('sortOrder', 100)
      .then(all => { setScripts(all || []); setActiveTab(0); })
      .catch(() => setScripts([]));
  }, [open]);

  // Center on first open
  useEffect(() => {
    if (open) {
      setPos({ x: Math.max(40, Math.round((window.innerWidth - 620) / 2)), y: Math.max(40, Math.round((window.innerHeight - 520) / 2)) });
    }
  }, [open]);

  // Drag + resize
  useEffect(() => {
    if (!dragging && !resizing) return;
    const onMove = (e) => {
      if (dragging) {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dragOffset.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOffset.current.y)),
        });
      }
      if (resizing && resizeStart.current) {
        const dx = e.clientX - resizeStart.current.mouseX;
        const dy = e.clientY - resizeStart.current.mouseY;
        const edge = resizeStart.current.edge;
        let newW = resizeStart.current.w, newH = resizeStart.current.h, newX = resizeStart.current.x, newY = resizeStart.current.y;
        if (edge.includes('e')) newW = Math.max(320, resizeStart.current.w + dx);
        if (edge.includes('s')) newH = Math.max(240, resizeStart.current.h + dy);
        if (edge.includes('w')) { newW = Math.max(320, resizeStart.current.w - dx); newX = resizeStart.current.x + (resizeStart.current.w - newW); }
        if (edge.includes('n')) { newH = Math.max(240, resizeStart.current.h - dy); newY = resizeStart.current.y + (resizeStart.current.h - newH); }
        setPos({ x: Math.max(0, newX), y: Math.max(0, newY) });
        setSize({ width: newW, height: newH });
      }
    };
    const onUp = () => { setDragging(false); setResizing(null); resizeStart.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, resizing]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const activeScript = scripts[activeTab];
  const onDragStart = (e) => { setDragging(true); dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; };
  const onResizeStart = (edge) => (e) => { e.stopPropagation(); e.preventDefault(); resizeStart.current = { edge, mouseX: e.clientX, mouseY: e.clientY, x: pos.x, y: pos.y, w: size.width, h: size.height }; setResizing(edge); };

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.width, height: size.height, zIndex: 30000, display: 'flex', flexDirection: 'column', background: DARK, border: `2px solid ${RED}`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.95)' }}>
      {/* Resize handles */}
      <div onMouseDown={onResizeStart('n')} style={{ position: 'absolute', top: -3, left: 18, right: 18, height: 7, cursor: 'ns-resize', zIndex: 11 }} />
      <div onMouseDown={onResizeStart('s')} style={{ position: 'absolute', bottom: -3, left: 18, right: 18, height: 7, cursor: 'ns-resize', zIndex: 11 }} />
      <div onMouseDown={onResizeStart('w')} style={{ position: 'absolute', left: -3, top: 18, bottom: 18, width: 7, cursor: 'ew-resize', zIndex: 11 }} />
      <div onMouseDown={onResizeStart('e')} style={{ position: 'absolute', right: -3, top: 18, bottom: 18, width: 7, cursor: 'ew-resize', zIndex: 11 }} />
      <div onMouseDown={onResizeStart('nw')} style={{ position: 'absolute', top: -3, left: -3, width: 16, height: 16, cursor: 'nwse-resize', zIndex: 12 }} />
      <div onMouseDown={onResizeStart('ne')} style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, cursor: 'nesw-resize', zIndex: 12 }} />
      <div onMouseDown={onResizeStart('sw')} style={{ position: 'absolute', bottom: -3, left: -3, width: 16, height: 16, cursor: 'nesw-resize', zIndex: 12 }} />
      <div onMouseDown={onResizeStart('se')} style={{ position: 'absolute', bottom: -3, right: -3, width: 16, height: 16, cursor: 'nwse-resize', zIndex: 12 }} />

      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '10px 16px', borderBottom: `1px solid ${RED}44`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0, background: `${RED}10` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🚨</span>
          <span style={{ color: RED, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>EMERGENCY SCRIPTS</span>
          <span style={{ color: '#6b7280', fontSize: '9px' }}>Alt+E to toggle · Esc to close</span>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(239,68,68,0.15)', border: `1px solid rgba(239,68,68,0.3)`, color: RED, cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '4px', lineHeight: 1 }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', flexShrink: 0 }}>
        {scripts.length === 0 && <span style={{ color: '#4a5568', fontSize: '11px', padding: '6px' }}>Loading scripts…</span>}
        {scripts.map((s, i) => (
          <button key={s.id || i} onClick={() => setActiveTab(i)} style={{ padding: '6px 12px', borderRadius: '4px', border: `1px solid ${activeTab === i ? RED + '66' : 'rgba(255,255,255,0.1)'}`, background: activeTab === i ? `${RED}18` : 'transparent', color: activeTab === i ? RED : '#8a9ab8', cursor: 'pointer', fontSize: '11px', fontWeight: activeTab === i ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{s.name}</button>
        ))}
      </div>

      {/* Script content — read-only, scrollable, 14pt */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {activeScript ? (
          <div style={{ color: activeScript.color || '#e8e0d0', fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{activeScript.content || 'No content'}</div>
        ) : (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No scripts found.</div>
        )}
      </div>
    </div>
  );
}