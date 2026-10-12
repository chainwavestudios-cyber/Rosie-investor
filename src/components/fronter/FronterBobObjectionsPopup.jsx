/**
 * FronterBobObjectionsPopup.jsx — Floating, draggable, resizable popup
 * for manually injecting objections into a live BOB training call.
 * Select an objection, click "Ask", and BOB says it at that moment.
 */
import { useState, useRef } from 'react';

const PURPLE = '#a78bfa';
const GOLD = '#10b981';

const OBJECTIONS = [
  "I'm not interested",
  "I don't have time right now",
  "How did you get my number?",
  "Is this a scam?",
  "I've been burned before by debt relief companies",
  "I'm already in a program",
  "I need to think about it",
  "How much does this cost?",
  "Will this hurt my credit?",
  "I don't give out financial info over the phone",
  "Can you send me something in writing?",
  "I need to talk to my spouse first",
  "I can't afford the payments",
  "What's the catch?",
  "Are you a real company?",
  "I don't do business over the phone",
  "Take me off your call list",
  "I'm on the Do Not Call registry",
];

export default function FronterBobObjectionsPopup({ onAsk, onClose }) {
  const [selected, setSelected] = useState(null);
  const [pos, setPos] = useState({ x: window.innerWidth - 400, y: 80 });
  const [size, setSize] = useState({ w: 340, h: 460 });
  const [asking, setAsking] = useState(false);
  const dragRef = useRef(null);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleAsk = () => {
    if (!selected || asking) return;
    setAsking(true);
    onAsk?.(selected);
    setTimeout(() => setAsking(false), 1500);
  };

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: `2px solid ${PURPLE}55`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10002, display: 'flex', flexDirection: 'column' }}>
      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0, background: 'linear-gradient(135deg, rgba(167,139,250,0.08), transparent)' }}>
        <span style={{ color: PURPLE, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🎯 Manual Objections</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: 0, lineHeight: 1 }}>×</button>
      </div>

      {/* Info bar */}
      <div style={{ padding: '5px 12px', color: '#6b7280', fontSize: '9px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        Select an objection and click Ask to inject it into the call
      </div>

      {/* Objections list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
        {OBJECTIONS.map((obj, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', marginBottom: '2px', borderRadius: '4px', cursor: 'pointer', background: selected === obj ? 'rgba(167,139,250,0.1)' : 'transparent', border: `1px solid ${selected === obj ? 'rgba(167,139,250,0.3)' : 'transparent'}` }}>
            <input type="radio" name="objection" checked={selected === obj} onChange={() => setSelected(obj)} style={{ accentColor: PURPLE, width: '13px', height: '13px' }} />
            <span style={{ color: selected === obj ? '#e8e0d0' : '#8a9ab8', fontSize: '11px', fontFamily: 'Georgia, serif' }}>{obj}</span>
          </label>
        ))}
      </div>

      {/* Ask button */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', gap: '6px' }}>
        <button onClick={() => setSelected(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Clear</button>
        <button onClick={handleAsk} disabled={!selected || asking} style={{ flex: 2, background: 'linear-gradient(135deg,#a78bfa,#8b5cf6)', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px', cursor: (!selected || asking) ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: (!selected || asking) ? 0.4 : 1 }}>
          {asking ? '⏳ Asking…' : '📢 Ask'}
        </button>
      </div>

      {/* Resize handle */}
      <div onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onMove = (ev) => setSize({ w: Math.max(260, startW + ev.clientX - startX), h: Math.max(280, startH + ev.clientY - startY) });
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}