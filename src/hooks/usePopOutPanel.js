/**
 * usePopOutPanel.js — Reusable hook for pop-out / detachable panels with drag,
 * resize, and localStorage layout persistence. Used by Live Call lead card and
 * BOB controls panel so their layouts are saved between sessions.
 */
import { useState, useEffect, useCallback } from 'react';

export function usePopOutPanel(storageKey, defaultSize = { width: 420, height: 600 }) {
  const [poppedOut, setPoppedOut] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState(defaultSize);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

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
    if (!dragging && !resizing) return;
    const onMove = (e) => {
      if (dragging) {
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - 80, e.clientX - offset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offset.y)),
        });
      }
      if (resizing) {
        setSize({
          width: Math.max(300, e.clientX - position.x),
          height: Math.max(250, e.clientY - position.y),
        });
      }
    };
    const onUp = () => { setDragging(false); setResizing(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, resizing, offset, position]);

  const toggle = useCallback(() => {
    setPoppedOut(prev => {
      if (!prev) {
        // First pop-out: position panel on the right side of the screen
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

  const onResizeStart = useCallback((e) => {
    e.stopPropagation();
    setResizing(true);
  }, []);

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

  return { poppedOut, toggle, onDragStart, onResizeStart, floatingStyle, size };
}