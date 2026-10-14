/**
 * FronterTranscriptPopout.jsx — Narrow, full-height transcript-only window.
 * Auto-opens on call connect. Draggable, resizable, and persists size/position
 * to localStorage for future calls.
 */
import { useState, useEffect, useRef } from 'react';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const DARK = '#0a0f1e';

export default function FronterTranscriptPopout({ transcript, callActive, callDuration, onClose, initialLayout = null, layoutRef = null, onSave = null }) {
  const [layout, setLayout] = useState(() => {
    if (initialLayout) {
      return { pos: { x: initialLayout.x, y: initialLayout.y }, size: { w: initialLayout.w, h: initialLayout.h } };
    }
    return { pos: { x: 20, y: 20 }, size: { w: 340, h: window.innerHeight - 40 } };
  });
  const [saveMsg, setSaveMsg] = useState(false);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript?.length]);

  // Report current layout to parent ref (no re-render)
  useEffect(() => {
    if (layoutRef) layoutRef.current = { ...layout.pos, ...layout.size };
  }, [layout, layoutRef]);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - layout.pos.x, startY: e.clientY - layout.pos.y };
    const onMove = (ev) => {
      if (dragRef.current) setLayout(prev => ({ ...prev, pos: { x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY } }));
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const onResizeStart = (e) => {
    e.stopPropagation();
    resizeRef.current = { sx: e.clientX, sy: e.clientY, sw: layout.size.w, sh: layout.size.h, sp: { ...layout.pos } };
    const onMove = (ev) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.sx;
      const dy = ev.clientY - resizeRef.current.sy;
      setLayout(prev => ({
        ...prev,
        size: {
          w: Math.max(260, resizeRef.current.sw + dx),
          h: Math.max(300, resizeRef.current.sh + dy),
        },
      }));
    };
    const onUp = () => { resizeRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const saveLayout = () => {
    if (onSave) {
      onSave({ ...layout.pos, ...layout.size });
      setSaveMsg(true);
      setTimeout(() => setSaveMsg(false), 2000);
    }
  };

  const fmtDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div style={{ position: 'fixed', left: layout.pos.x, top: layout.pos.y, width: layout.size.w, height: layout.size.h, background: '#0d1b2a', border: `1px solid ${BLUE}44`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10002, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', cursor: 'move', userSelect: 'none', flexShrink: 0, background: `linear-gradient(135deg, rgba(96,165,250,0.08), transparent)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: BLUE, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>📝 Transcript</span>
          {callActive && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite' }} />
              <span style={{ color: GOLD, fontSize: '10px', fontFamily: 'monospace' }}>{fmtDuration(callDuration)}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button onClick={saveLayout} style={{ background: saveMsg ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)', color: saveMsg ? '#4ade80' : '#6b7280', border: `1px solid ${saveMsg ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>{saveMsg ? '✓ Saved' : '📐 Save'}</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Speaker legend */}
      <div style={{ padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#6b7280', fontSize: '9px', flexShrink: 0 }}>
        <span style={{ color: BLUE }}>● Agent</span> · <span style={{ color: GOLD }}>● Customer</span>
      </div>

      {/* Transcript body */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {!transcript || transcript.length === 0 ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 10px', fontSize: '12px' }}>
            {callActive ? 'Listening… start speaking.' : 'No active call.'}
          </div>
        ) : transcript.map((msg, i) => {
          const isAgent = msg.speaker === 0;
          return (
            <div key={i} style={{ display: 'flex', marginBottom: '8px', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '88%', background: isAgent ? 'rgba(96,165,250,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isAgent ? 'rgba(96,165,250,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: isAgent ? '10px 10px 2px 10px' : '10px 10px 10px 2px', padding: '6px 10px' }}>
                <div style={{ marginBottom: '2px' }}>
                  <span style={{ color: isAgent ? BLUE : GOLD, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>{isAgent ? '🎙 Agent' : '👤 Customer'}</span>
                </div>
                <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.45 }}>{msg.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resize handle — bottom right only (narrow column) */}
      <div onMouseDown={onResizeStart} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px', zIndex: 1 }}>⌟</div>
    </div>
  );
}