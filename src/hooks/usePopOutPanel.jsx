/**
 * usePopOutPanel.jsx — Reusable hook for pop-out / detachable panels with drag,
 * 8-way resize (all edges + corners), and database-backed layout persistence.
 * Panel positions/sizes are stored in the DebtCoachUserSetting entity per user.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getDebtCoachValue, setDebtCoachValue } from '@/lib/debtCoachStorage';

export function usePopOutPanel(storageKey, defaultSize = { width: 420, height: 600 }, username = null) {
  const [poppedOut, setPoppedOut] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState(defaultSize);
  const [dragging, setDragging] = useState(false);
  const [resizingEdge, setResizingEdge] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  const resizeStart = useRef(null);

  // Restore saved layout from database
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    getDebtCoachValue(username, `popout_${storageKey}`).then(saved => {
      if (cancelled || !saved) { setLoaded(true); return; }
      if (saved.poppedOut) setPoppedOut(true);
      if (saved.position) setPosition(saved.position);
      if (saved.size) setSize(saved.size);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [storageKey, username]);

  // Persist layout to database whenever it changes (debounced via setDebtCoachValue)
  useEffect(() => {
    if (!username || !loaded) return;
    setDebtCoachValue(username, `popout_${storageKey}`, { poppedOut, position, size });
  }, [username, storageKey, poppedOut, position, size, loaded]);

  // Listen for layout_restored event (from "Open Layout") — re-read from database
  useEffect(() => {
    const handler = () => {
      if (!username) return;
      getDebtCoachValue(username, `popout_${storageKey}`).then(saved => {
        if (!saved) return;
        if (saved.poppedOut !== undefined) setPoppedOut(saved.poppedOut);
        if (saved.position) setPosition(saved.position);
        if (saved.size) setSize(saved.size);
      });
    };
    window.addEventListener('layout_restored', handler);
    return () => window.removeEventListener('layout_restored', handler);
  }, [storageKey, username]);

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

  const popOut = useCallback(() => {
    setPoppedOut(prev => {
      if (prev) return prev;
      setPosition(p => ({
        x: p.x <= 100 ? Math.max(20, window.innerWidth - size.width - 20) : p.x,
        y: p.y <= 100 ? 80 : p.y,
      }));
      return true;
    });
  }, [size.width]);

  const [layoutSaved, setLayoutSaved] = useState(false);
  const saveLayout = useCallback(() => {
    if (!username) return false;
    setDebtCoachValue(username, `popout_${storageKey}`, { poppedOut, position, size });
    setLayoutSaved(true);
    setTimeout(() => setLayoutSaved(false), 2000);
    return true;
  }, [username, storageKey, poppedOut, position, size]);

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

  const center = useCallback(() => {
    setPosition({
      x: Math.max(0, Math.round((window.innerWidth - size.width) / 2)),
      y: Math.max(0, Math.round((window.innerHeight - size.height) / 2)),
    });
  }, [size.width, size.height]);

  const resizeHandles = poppedOut && (
    <>
      <div onMouseDown={onResizeStart('n')} style={{ position: 'absolute', top: -3, left: 18, right: 18, height: 7, cursor: 'ns-resize', zIndex: 10, background: 'rgba(16,185,129,0.0)', borderTop: '2px solid rgba(16,185,129,0.25)', borderRadius: '3px' }} />
      <div onMouseDown={onResizeStart('s')} style={{ position: 'absolute', bottom: -3, left: 18, right: 18, height: 7, cursor: 'ns-resize', zIndex: 10, background: 'rgba(16,185,129,0.0)', borderBottom: '2px solid rgba(16,185,129,0.25)', borderRadius: '3px' }} />
      <div onMouseDown={onResizeStart('w')} style={{ position: 'absolute', left: -3, top: 18, bottom: 18, width: 7, cursor: 'ew-resize', zIndex: 10, background: 'rgba(16,185,129,0.0)', borderLeft: '2px solid rgba(16,185,129,0.25)', borderRadius: '3px' }} />
      <div onMouseDown={onResizeStart('e')} style={{ position: 'absolute', right: -3, top: 18, bottom: 18, width: 7, cursor: 'ew-resize', zIndex: 10, background: 'rgba(16,185,129,0.0)', borderRight: '2px solid rgba(16,185,129,0.25)', borderRadius: '3px' }} />
      <div onMouseDown={onResizeStart('nw')} style={{ position: 'absolute', top: -3, left: -3, width: 16, height: 16, cursor: 'nwse-resize', zIndex: 11, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)', borderRadius: '3px 0 0 0' }} />
      <div onMouseDown={onResizeStart('ne')} style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, cursor: 'nesw-resize', zIndex: 11, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)', borderRadius: '0 3px 0 0' }} />
      <div onMouseDown={onResizeStart('sw')} style={{ position: 'absolute', bottom: -3, left: -3, width: 16, height: 16, cursor: 'nesw-resize', zIndex: 11, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)', borderRadius: '0 0 0 3px' }} />
      <div onMouseDown={onResizeStart('se')} style={{ position: 'absolute', bottom: -3, right: -3, width: 16, height: 16, cursor: 'nwse-resize', zIndex: 11, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)', borderRadius: '0 0 3px 0' }} />
    </>
  );

  return { poppedOut, toggle, popOut, onDragStart, onResizeStart, floatingStyle, size, setSize, setPosition, center, resizeHandles, saveLayout, layoutSaved };
}