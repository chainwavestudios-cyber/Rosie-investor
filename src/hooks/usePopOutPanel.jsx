/**
 * usePopOutPanel.jsx — Reusable hook for pop-out / detachable panels with drag,
 * 8-way resize (all edges + corners), and database-backed layout persistence.
 * Panel positions/sizes are stored in the DebtCoachUserSetting entity per user.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getDebtCoachValue, setDebtCoachValue } from '@/lib/debtCoachStorage';

let topFloatingZ = 16500;
function nextFloatingZ() { topFloatingZ += 1; if (topFloatingZ > 28000) topFloatingZ = 16500; return topFloatingZ; }

export function usePopOutPanel(storageKey, defaultSize = { width: 420, height: 600 }, username = null, zIndex = 9998, restoreOpenOnMount = true, options = {}) {
  const [poppedOut, setPoppedOut] = useState(false);
  const [position, setPosition] = useState(() => options.defaultPosition || { x: 100, y: 100 });
  const [frontZ, setFrontZ] = useState(zIndex);
  const bringToFront = useCallback(() => setFrontZ(nextFloatingZ()), []);
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
      // Debt Call Coach defaults to a docked, interruption-free startup.
      // Other portals can opt into their existing remembered pop-out behavior.
      if (saved.poppedOut && restoreOpenOnMount) setPoppedOut(true);
      if (saved.position) setPosition(saved.position);
      if (saved.size) setSize(saved.size);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [storageKey, username, restoreOpenOnMount]);

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
    // Live Call's Save/Reset is scoped to its four windows; it must not
    // unexpectedly reopen unrelated Smart Close, scripts-tab or stats tools.
    const isLiveWindow = ['live_transcript','live_scripts','live_ai_panel','live_contact_profile'].includes(storageKey);
    if(isLiveWindow)window.addEventListener('live_workspace_layout_restored',handler);
    return () => {
      window.removeEventListener('layout_restored',handler);
      if(isLiveWindow)window.removeEventListener('live_workspace_layout_restored',handler);
    };
  }, [storageKey, username]);

  // Global mouse handlers for drag / resize
  useEffect(() => {
    if (!dragging && !resizingEdge) return;
    const onMove = (e) => {
      if (dragging) {
        setPosition({
          x: Math.max(0, Math.min(Math.max(0, window.innerWidth - Math.min(size.width, window.innerWidth)), e.clientX - offset.x)),
          y: Math.max(0, Math.min(Math.max(0, window.innerHeight - 44), e.clientY - offset.y)),
        });
      }
      if (resizingEdge && resizeStart.current) {
        const { edge, mouseX, mouseY, x, y, w, h } = resizeStart.current;
        const dx = e.clientX - mouseX;
        const dy = e.clientY - mouseY;
        const minW = Math.min(options.minWidth || 280, Math.max(260, window.innerWidth - 12));
        const minH = Math.min(options.minHeight || 220, Math.max(230, window.innerHeight - 12));
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
        newX = Math.max(0, Math.min(newX, window.innerWidth - minW));
        newY = Math.max(0, Math.min(newY, window.innerHeight - minH));
        if (newX + newW > window.innerWidth) newW = Math.max(minW, window.innerWidth - newX);
        if (newY + newH > window.innerHeight) newH = Math.max(minH, window.innerHeight - newY);
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
  }, [dragging, resizingEdge, offset, size.width, options.minWidth, options.minHeight]);

  const toggle = useCallback(() => {
    bringToFront();
    setPoppedOut(prev => {
      if (!prev) {
        setPosition(p => ({
          x: p.x <= 100 ? Math.max(20, window.innerWidth - size.width - 20) : p.x,
          y: p.y <= 100 ? 80 : p.y,
        }));
      }
      return !prev;
    });
  }, [size.width, bringToFront]);

  const popOut = useCallback(() => {
    bringToFront();
    setPoppedOut(prev => {
      if (prev) return prev;
      setPosition(p => ({
        x: p.x <= 100 ? Math.max(20, window.innerWidth - size.width - 20) : p.x,
        y: p.y <= 100 ? 80 : p.y,
      }));
      return true;
    });
  }, [size.width, bringToFront]);

  // Open without changing restored coordinates; used by Live Call auto-layout.
  const openAtSavedPosition = useCallback(() => { setPoppedOut(true); }, []);
  const [layoutSaved, setLayoutSaved] = useState(false);
  const saveLayout = useCallback(() => {
    if (!username) return false;
    setDebtCoachValue(username, `popout_${storageKey}`, { poppedOut, position, size });
    setLayoutSaved(true);
    setTimeout(() => setLayoutSaved(false), 2000);
    return true;
  }, [username, storageKey, poppedOut, position, size]);

  const onDragStart = useCallback((e) => {
    if (e.button !== 0 || e.target.closest('button,input,select,textarea,a,[data-no-drag]')) return;
    e.preventDefault();
    bringToFront();
    setDragging(true);
    setOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position, bringToFront]);

  const onResizeStart = useCallback((edge) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    bringToFront();
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
  }, [position, size, bringToFront]);

  // Clamp to the current viewport so a layout saved on a larger screen never renders off-screen
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const clampedW = Math.max(270, Math.min(size.width, vw - 10));
  const clampedH = Math.max(230, Math.min(size.height, vh - 10));
  const floatingStyle = {
    position: 'fixed',
    left: Math.max(0, Math.min(position.x, vw - clampedW)),
    top: Math.max(0, Math.min(position.y, vh - clampedH)),
    width: clampedW,
    height: clampedH,
    zIndex: frontZ,
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

  // Handles sit INSIDE the window so the card's rounded/overflow-hidden
  // container cannot swallow pointer hits (the old contact-card resize bug).
  const resizeHandles = poppedOut && (
    <>
      {[
        ['n', {top:0,left:17,right:17,height:9,cursor:'ns-resize'}],
        ['s', {bottom:0,left:17,right:17,height:9,cursor:'ns-resize'}],
        ['w', {left:0,top:17,bottom:17,width:9,cursor:'ew-resize'}],
        ['e', {right:0,top:17,bottom:17,width:9,cursor:'ew-resize'}],
        ['nw', {top:0,left:0,width:16,height:16,cursor:'nwse-resize'}],
        ['ne', {top:0,right:0,width:16,height:16,cursor:'nesw-resize'}],
        ['sw', {bottom:0,left:0,width:16,height:16,cursor:'nesw-resize'}],
        ['se', {bottom:0,right:0,width:19,height:19,cursor:'nwse-resize',borderRight:'3px solid #e7c785',borderBottom:'3px solid #e7c785',borderBottomRightRadius:7,background:'rgba(200,169,112,.08)'}]
      ].map(([edge, style]) => (
        <div key={edge} role="separator" aria-label={'Resize window ' + edge}
          title="Drag to resize" onMouseDown={onResizeStart(edge)}
          style={{position:'absolute',zIndex:30,touchAction:'none',...style}} />
      ))}
    </>
  );

  return { poppedOut, toggle, popOut, openAtSavedPosition, onDragStart, onResizeStart, floatingStyle, size, position, setSize, setPosition, setPoppedOut, bringToFront, center, resizeHandles, saveLayout, layoutSaved, loaded };
}