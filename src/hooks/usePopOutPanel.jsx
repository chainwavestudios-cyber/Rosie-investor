/**
 * usePopOutPanel.jsx — Reusable hook for pop-out / detachable panels with drag,
 * 8-way resize (all edges + corners), and localStorage layout persistence.
 * Used by Live Call lead card and BOB controls panel so their layouts are
 * saved between sessions.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export function usePopOutPanel(storageKey, defaultSize = { width: 420, height: 600 }) {
  const [poppedOut, setPoppedOut] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState(defaultSize);
  const [dragging, setDragging] = useState(false);
  const [resizingEdge, setResizingEdge] = useState(null); // 'n','s','e','w','ne','nw','se','sw'
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const resizeStart = useRef(null); // { edge, mouseX, mouseY, x, y, w, h }

  // Restore saved layout from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`popout_${storageKey}`);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.poppedOut) setPoppedOut(true);
        if (p.position) setPosition(p.position);
        if (p.size) setSize(p.size);
      }
    } catch {}
  }, [storageKey]);

  // Persist layout to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(`popout_${storageKey}`, JSON.stringify({ poppedOut, position, size }));
    } catch {}
  }, [storageKey, poppedOut, position, size]);

  // Global mouse handlers for drag / resize
  useEffect(() => {
    if (!dragging && !resizingEdge) return;
    const onMove = (e) => {
      if (dragging) {
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - 80, e.clientX - offset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offset.y)),
        });
      }
      if (resizingEdge && resizeStart.current) {
        const { edge, mouseX, mouseY, x, y, w, h } = resizeStart.current;
        const dx = e.clientX - mouseX;
        const dy = e.clientY - mouseY;
        const minW = 280, minH = 220;
        let newX = x, newY = y, newW = w, newH = h;

        if (edge.includes('e')) newW = Math.max(minW, w + dx);
        if (edge.includes('s')) newH = Math.max(minH, h + dy);
        if (edge.includes('w')) {
          newW = Math.max(minW, w - dx);
          newX = x + (w - newW);
        }
        if (edge.includes('n')) {
          newH = Math.max(minH, h - dy);
          newY = y + (h - newH);
        }
        // Clamp position so panel stays on screen
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        if (newX + newW > window.innerWidth) newW = window.innerWidth - newX;
        if (newY + newH > window.innerHeight) newH = window.innerHeight - newY;
        setPosition({ x: newX, y: newY });
        setSize({ width: newW, height: newH });
      }
    };
    const onUp = () => { setDragging(false); setResizingEdge(null); resizeStart.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, resizingEdge, offset]);

  const toggle = useCallback(() => {
    setPoppedOut(prev => {
      if (!prev) {
        setPosition(p => ({
          x: p.x <= 100 ? Math.max(20, window.innerWidth - size.width - 20) : p.x,
          y: p.y <= 100 ? 80 : p.y,
        }));
      }
      return !prev;
    });
  }, [size.width]);

  const onDragStart = useCallback((e) => {
    setDragging(true);
    setOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const onResizeStart = useCallback((edge) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    resizeStart.current = {
      edge,
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: position.x,
      y: position.y,
      w: size.width,
      h: size.height,
    };
    setResizingEdge(edge);
  }, [position, size]);

  const floatingStyle = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
    zIndex: 9998,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  };

  // 8 resize handles — 4 edges + 4 corners. Render these inside the popped-out container.
  const resizeHandles = poppedOut && (
    <>
      {/* Edges */}
      <div onMouseDown={onResizeStart('n')} style={{ position: 'absolute', top: -2, left: 14, right: 14, height: 6, cursor: 'ns-resize', zIndex: 10 }} />
      <div onMouseDown={onResizeStart('s')} style={{ position: 'absolute', bottom: -2, left: 14, right: 14, height: 6, cursor: 'ns-resize', zIndex: 10 }} />
      <div onMouseDown={onResizeStart('w')} style={{ position: 'absolute', left: -2, top: 14, bottom: 14, width: 6, cursor: 'ew-resize', zIndex: 10 }} />
      <div onMouseDown={onResizeStart('e')} style={{ position: 'absolute', right: -2, top: 14, bottom: 14, width: 6, cursor: 'ew-resize', zIndex: 10 }} />
      {/* Corners */}
      <div onMouseDown={onResizeStart('nw')} style={{ position: 'absolute', top: -2, left: -2, width: 14, height: 14, cursor: 'nwse-resize', zIndex: 11 }} />
      <div onMouseDown={onResizeStart('ne')} style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, cursor: 'nesw-resize', zIndex: 11 }} />
      <div onMouseDown={onResizeStart('sw')} style={{ position: 'absolute', bottom: -2, left: -2, width: 14, height: 14, cursor: 'nesw-resize', zIndex: 11 }} />
      <div onMouseDown={onResizeStart('se')} style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, cursor: 'nwse-resize', zIndex: 11 }} />
    </>
  );

  return { poppedOut, toggle, onDragStart, onResizeStart, floatingStyle, size, resizeHandles };
}