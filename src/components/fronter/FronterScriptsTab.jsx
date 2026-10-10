/**
 * FronterScriptsTab.jsx — Popoutable script viewer for the fronter.
 * The fronter can float the script at any size while dialing from the leads list.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { substituteScriptVars } from '@/lib/scriptSubstitute';
import { renderFormatted } from '@/components/debt/ScriptRichText';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function FronterScriptsTab({ fronterFirstName }) {
  const [scripts, setScripts] = useState([]);
  const [activeScript, setActiveScript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [poppedOut, setPoppedOut] = useState(false);
  const [pos, setPos] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ w: 450, h: 500 });
  const dragRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.FronterScript.list('sortOrder', 50);
      setScripts(all || []);
      if (all?.length > 0 && !activeScript) setActiveScript(all[0]);
    } catch {}
    setLoading(false);
  }, [activeScript]);

  useEffect(() => { load(); }, [load]);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => {
      if (!dragRef.current) return;
      setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY });
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const scriptContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Script selector */}
      {scripts.length > 1 && (
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', flexShrink: 0 }}>
          {scripts.map(s => (
            <button key={s.id} onClick={() => setActiveScript(s)} style={{ padding: '8px 12px', background: 'none', border: 'none', borderBottom: `2px solid ${activeScript?.id === s.id ? GOLD : 'transparent'}`, color: activeScript?.id === s.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: activeScript?.id === s.id ? 'bold' : 'normal' }}>{s.name}</button>
          ))}
        </div>
      )}
      {/* Script content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
        ) : !activeScript ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No scripts yet. Ask your admin to add a script.</div>
        ) : (
          <div style={{ color: '#e8e0d0', fontSize: '15px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>{renderFormatted(substituteScriptVars(activeScript.content, { fronterFirstName }))}</div>
        )}
      </div>
    </div>
  );

  if (poppedOut) {
    return (
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
        {/* Drag header */}
        <div onMouseDown={onDragStart} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
          <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 {activeScript?.name || 'Script'}</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => setSize(s => ({ ...s, w: Math.max(300, s.w - 50) }))} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: 'none', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}>−</button>
            <button onClick={() => setSize(s => ({ ...s, w: s.w + 50, h: s.h + 50 }))} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: 'none', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}>+</button>
            <button onClick={() => setPoppedOut(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: '0 4px' }}>×</button>
          </div>
        </div>
        {scriptContent}
        {/* Resize handle */}
        <div onMouseDown={(e) => {
          e.stopPropagation();
          const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
          const onMove = (ev) => setSize({ w: Math.max(300, startW + ev.clientX - startX), h: Math.max(200, startH + ev.clientY - startY) });
          const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
      </div>
    );
  }

  // Inline (docked) view
  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📜 Scripts</div>
        <button onClick={() => setPoppedOut(true)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>↗ Pop Out</button>
      </div>
      <div style={{ flex: 1, minHeight: '300px' }}>{scriptContent}</div>
    </div>
  );
}