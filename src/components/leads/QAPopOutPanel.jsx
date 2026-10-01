/**
 * QAPopOutPanel.jsx — Detached floating panel for Q&A only.
 * The transcript is NOT included here — it lives in the main AI Assistant window
 * and in its own separate transcript window, so showing it here is redundant.
 * Coach and Intent stay in the main AIAssistantPopup.
 */
import { useState, useRef, useEffect } from 'react';
import { useDebtCoachValue } from '@/lib/debtCoachStorage';
import { QASection } from './AIAssistantPopup';

export default function QAPopOutPanel({
  transcript, transcriptRef, kbEntries, lead, pendingQuestion,
  qaActive, onToggleQA, portalCfg, manualQ, setManualQ,
  onClose, aiPanelItem, setAiPanelItem, rightPanelWidth, setRightPanelWidth,
  username = null,
}) {
  // DB-backed layout storage (Debt Call Coach) — falls back to localStorage (admin panel)
  const [dbSaved, setDbSaved, dbLoaded] = useDebtCoachValue(username, 'popout_qa_popup', null);
  const lsSaved = (!username && typeof window !== 'undefined') ? (() => { try { return JSON.parse(localStorage.getItem('qaPopOutSize')); } catch { return null; } })() : null;

  const [pos, setPos] = useState({ x: 30, y: 80 });
  const [size, setSize] = useState({ w: 700, h: 600 });

  // Load from localStorage (admin panel — no username)
  useEffect(() => {
    if (username || !lsSaved) return;
    if (lsSaved.x !== undefined) setPos({ x: lsSaved.x, y: lsSaved.y });
    if (lsSaved.w) setSize({ w: lsSaved.w, h: lsSaved.h });
  }, [username]);

  // Load from DB (Debt Call Coach)
  const lastAppliedSig = useRef('');
  useEffect(() => {
    if (!username || !dbLoaded || !dbSaved) return;
    const sig = JSON.stringify(dbSaved);
    if (sig === lastAppliedSig.current) return;
    lastAppliedSig.current = sig;
    if (dbSaved.x !== undefined) setPos({ x: dbSaved.x, y: dbSaved.y });
    if (dbSaved.w) setSize({ w: dbSaved.w, h: dbSaved.h });
  }, [username, dbLoaded, dbSaved]);

  // Auto-save to DB
  useEffect(() => {
    if (!username || !dbLoaded) return;
    setDbSaved({ x: pos.x, y: pos.y, w: size.w, h: size.h });
  }, [pos, size, username, dbLoaded]);

  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizing = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current) {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - size.w, dragStart.current.px + e.clientX - dragStart.current.mx)),
          y: Math.max(0, Math.min(window.innerHeight - size.h, dragStart.current.py + e.clientY - dragStart.current.my)),
        });
      }
      if (resizing.current) {
        const { edge, startX, startY, startW, startH, startPX, startPY } = resizing.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const minW = 400, minH = 200;
        if (edge === 'top' || edge === 'top-left' || edge === 'top-right') {
          const newH = Math.max(minH, startH - dy);
          const newPY = Math.max(0, startPY + (startH - newH));
          setSize(s => ({ ...s, h: newH })); setPos(p => ({ ...p, y: newPY }));
        }
        if (edge === 'bottom' || edge === 'bottom-left' || edge === 'bottom-right') {
          setSize(s => ({ ...s, h: Math.max(minH, Math.min(window.innerHeight - startPY - 4, startH + dy)) }));
        }
        if (edge === 'right' || edge === 'top-right' || edge === 'bottom-right') {
          setSize(s => ({ ...s, w: Math.max(minW, Math.min(window.innerWidth - startPX - 4, startW + dx)) }));
        }
        if (edge === 'left' || edge === 'top-left' || edge === 'bottom-left') {
          const newW = Math.max(minW, startW - dx);
          const newPX = Math.max(0, startPX + (startW - newW));
          setSize(s => ({ ...s, w: newW })); setPos(p => ({ ...p, x: newPX }));
        }
      }
    };
    const onUp = () => { dragging.current = false; resizing.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [size.w, size.h]);

  const startResize = (edge, e) => {
    e.preventDefault();
    resizing.current = { edge, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, startPX: pos.x, startPY: pos.y };
  };

  const saveSize = () => {
    if (username) {
      setDbSaved({ x: pos.x, y: pos.y, w: size.w, h: size.h });
    } else {
      localStorage.setItem('qaPopOutSize', JSON.stringify({ x: pos.x, y: pos.y, w: size.w, h: size.h }));
    }
  };

  const EDGE = { position: 'absolute', zIndex: 1 };
  const cornerStyle = (top, right, bottom, left) => ({ ...EDGE, width: 14, height: 14, top, right, bottom, left, cursor: `${top != null ? 'n' : 's'}${left != null ? 'w' : 'e'}-resize` });
  const edgeH = (top, bottom) => ({ ...EDGE, left: 14, right: 14, top, bottom, height: 6, cursor: 'ns-resize' });
  const edgeV = (left, right) => ({ ...EDGE, top: 14, bottom: 14, left, right, width: 6, cursor: 'ew-resize' });

  const dotStyle = { width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: qaActive ? '#f59e0b' : '#4a5568', boxShadow: qaActive ? '0 0 6px #f59e0b' : 'none', animation: qaActive ? 'aipulse 2s infinite' : 'none' };
  const toggleBg = qaActive ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)';
  const toggleBorder = qaActive ? 'rgba(245,158,11,0.44)' : 'rgba(255,255,255,0.08)';
  const toggleColor = qaActive ? '#f59e0b' : '#4a5568';

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '8px', boxShadow: '0 12px 60px rgba(0,0,0,0.9)', zIndex: 20001, display: 'flex', flexDirection: 'column', fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
      <style>{`@keyframes aipulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>

      {/* Resize handles */}
      <div style={edgeH(0, undefined)} onMouseDown={e => startResize('top', e)} />
      <div style={edgeH(undefined, 0)} onMouseDown={e => startResize('bottom', e)} />
      <div style={edgeV(0, undefined)} onMouseDown={e => startResize('left', e)} />
      <div style={edgeV(undefined, 0)} onMouseDown={e => startResize('right', e)} />
      <div style={cornerStyle(0, undefined, undefined, 0)} onMouseDown={e => startResize('top-left', e)} />
      <div style={cornerStyle(0, 0, undefined, undefined)} onMouseDown={e => startResize('top-right', e)} />
      <div style={cornerStyle(undefined, undefined, 0, 0)} onMouseDown={e => startResize('bottom-left', e)} />
      <div style={cornerStyle(undefined, 0, 0, undefined)} onMouseDown={e => startResize('bottom-right', e)} />

      {/* Title bar */}
      <div onMouseDown={e => { if (e.target.closest('button,select,input')) return; dragging.current = true; dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }; e.preventDefault(); }}
        style={{ padding: '6px 14px', background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, cursor: 'grab', userSelect: 'none', zIndex: 2, position: 'relative' }}>
        <span style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', flexShrink: 0 }}>❓ Q&A — Popped Out</span>
        <div style={{ flex: 1 }} />
        <button onClick={saveSize} title="Save current size/position" style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>📐 Save Size</button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>⬇ Pop In</button>
      </div>

      {/* Main body: Q&A only — full width, no transcript sidebar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ padding: '4px 12px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={dotStyle} />
            <span style={{ color: toggleColor, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', flex: 1 }}>❓ Q&A</span>
            <button onClick={onToggleQA} style={{ background: toggleBg, border: `1px solid ${toggleBorder}`, borderRadius: '20px', color: toggleColor, padding: '2px 9px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>{qaActive ? 'ON' : 'OFF'}</button>
          </div>
          <QASection
            transcript={transcript}
            transcriptRef={transcriptRef}
            kbEntries={kbEntries}
            active={qaActive}
            qaKeywords={portalCfg?.intentTriggerKeywords}
            manualQ={manualQ}
            setManualQ={setManualQ}
            collapsed={false}
            qaOnly={true}
            onSidePanel={setAiPanelItem}
            lead={lead}
            pendingQuestion={pendingQuestion}
          />
      </div>
    </div>
  );
}