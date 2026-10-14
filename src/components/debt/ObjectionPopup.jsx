/**
 * ObjectionPopup — floating, draggable, resizable, dockable card shown during
 * a live call when a high-priority objection is detected. Can be dragged by
 * the header, resized from the bottom-right corner, and minimized/docked to
 * a compact bar to get it out of the way without dismissing it.
 */
import { useState, useMemo, useRef, useEffect } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const PURPLE = '#a78bfa';

export default function ObjectionPopup({ objection, onDismiss }) {
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 460, y: window.innerHeight - 420 });
  const [size, setSize] = useState({ w: 440, h: 480 });
  const dragRef = useRef(null);

  // Reset selection when a new objection appears
  useEffect(() => {
    if (objection) { setSelected(0); setCopied(false); setMinimized(false); }
  }, [objection?.id, objection?.lineTime]);

  // Build the list of answer options: engine response first, then KB answers.
  const options = useMemo(() => {
    if (!objection) return [];
    const list = [{ label: '🛡️ Objection Engine', text: objection.responseText, color: GOLD, mindset: objection.mindset, goal: objection.goal }];
    if (Array.isArray(objection.kbOptions)) {
      objection.kbOptions.forEach((kb) => {
        list.push({ label: `📖 KB: ${kb.question || 'Recorded Call'}`, text: kb.answer, color: PURPLE, source: kb.source });
      });
    }
    return list;
  }, [objection]);

  if (!objection) return null;

  const current = options[selected] || options[0];

  const copy = () => {
    navigator.clipboard?.writeText(current?.text || '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Minimized / docked bar — compact, still draggable, click to expand
  if (minimized) {
    return (
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 10001, display: 'flex', alignItems: 'center', gap: '8px', background: DARK, border: `2px solid ${GOLD}`, borderRadius: '8px', padding: '8px 12px', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
        <div onMouseDown={onDragStart} style={{ cursor: 'move', display: 'flex', alignItems: 'center', gap: '8px', flex: 1, userSelect: 'none' }}>
          <span style={{ fontSize: '16px' }}>🛡️</span>
          <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>OBJECTION</span>
          <span style={{ color: '#e8e0d0', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{objection.title}</span>
        </div>
        <button onClick={() => setMinimized(false)} title="Expand" style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>⬆</button>
        <button onClick={onDismiss} title="Dismiss" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, maxHeight: '78vh', zIndex: 10001, display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.7)' }}>
      <div style={{ background: DARK, border: `2px solid ${GOLD}`, borderRadius: '10px', display: 'flex', flexDirection: 'column', maxHeight: '78vh', overflow: 'hidden' }}>
        {/* Header — draggable, with minimize + close */}
        <div onMouseDown={onDragStart} style={{ padding: '12px 16px', borderBottom: `1px solid ${GOLD}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${GOLD}10`, flexShrink: 0, cursor: 'move', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>🛡️</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>OBJECTION DETECTED</div>
              <div style={{ color: '#e8e0d0', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{objection.title}</div>
            </div>
          </div>
          <div onMouseDown={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setMinimized(true)} title="Minimize (dock)" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8a9ab8', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '4px', lineHeight: 1 }}>—</button>
            <button onClick={onDismiss} title="Close" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '4px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Customer said */}
          {objection.lineText && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(239,68,68,0.06)' }}>
              <div style={{ color: RED, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>🗣️ Customer said</div>
              <div style={{ color: '#c4cdd8', fontSize: '12px', fontStyle: 'italic' }}>"{objection.lineText}"</div>
            </div>
          )}

          {/* Mindset + Goal (only for the engine option) */}
          {selected === 0 && (objection.mindset || objection.goal) && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '16px', fontSize: '10px', flexWrap: 'wrap' }}>
              {objection.mindset && <div style={{ flex: 1, minWidth: '160px' }}><span style={{ color: '#8a9ab8', fontWeight: 'bold' }}>Mindset: </span><span style={{ color: '#c4cdd8' }}>{objection.mindset}</span></div>}
              {objection.goal && <div style={{ flex: 1, minWidth: '160px' }}><span style={{ color: '#8a9ab8', fontWeight: 'bold' }}>Goal: </span><span style={{ color: '#c4cdd8' }}>{objection.goal}</span></div>}
            </div>
          )}

          {/* Option selector — only if more than one option */}
          {options.length > 1 && (
            <div style={{ padding: '8px 16px 0', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {options.map((opt, i) => (
                <button key={i} onClick={() => { setSelected(i); setCopied(false); }} style={{ padding: '5px 10px', borderRadius: '4px', border: `1px solid ${selected === i ? opt.color + '66' : 'rgba(255,255,255,0.1)'}`, background: selected === i ? `${opt.color}18` : 'transparent', color: selected === i ? opt.color : '#6b7280', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Response — the main content (read verbatim) */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ color: current.color, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>💬 Read this {options.length > 1 ? `(${selected + 1}/${options.length})` : ''}</div>
              <button onClick={copy} style={{ background: `${current.color}18`, color: current.color, border: `1px solid ${current.color}44`, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{copied ? '✓ Copied' : '📋 Copy'}</button>
            </div>
            <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '12px', border: `1px solid ${current.color}22` }}>
              {current?.text}
            </div>
            {current?.source && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '5px' }}>Source: {current.source}</div>}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
          <button onClick={() => setMinimized(true)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>— Dock</button>
          <button onClick={onDismiss} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '8px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Got it ✓</button>
        </div>
      </div>

      {/* Resize handle */}
      <div onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onMove = (ev) => setSize({ w: Math.max(320, startW + ev.clientX - startX), h: Math.max(300, startH + ev.clientY - startY) });
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px', fontSize: '10px', userSelect: 'none' }}>⌟</div>
    </div>
  );
}