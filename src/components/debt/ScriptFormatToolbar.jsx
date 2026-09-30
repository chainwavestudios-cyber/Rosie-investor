/**
 * ScriptFormatToolbar.jsx — Inline formatting toolbar for the script textarea.
 * Wraps the current textarea selection with BBCode-style tags: bold, italic,
 * text color, background highlight (incl. neon), font size, font family, and
 * a clear-formatting action. Operates on a ref to the textarea.
 */
import React, { useState, useRef, useEffect } from 'react';
import { stripFormatTags } from '@/components/debt/ScriptRichText';

const GOLD = '#10b981';

const TEXT_COLORS = ['#e8e0d0', '#ffffff', '#10b981', '#60a5fa', '#a78bfa', '#f59e0b', '#ef4444', '#f472b6', '#000000'];
const BG_COLORS = [
  '#39ff14', '#00ffff', '#ff00ff', '#ccff00', '#ff6ec7', '#00ff99',
  '#7f00ff', '#ff9900', '#1e90ff', '#ff1744', '#fff700', '#00e5ff',
];
const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24, 28];
const FONTS = ['Georgia', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Impact', 'Comic Sans MS', 'Trebuchet MS'];

const btn = { padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#c4cdd8', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' };
const popover = { padding: '8px', background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '6px', position: 'absolute', zIndex: 50, marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' };

export default function ScriptFormatToolbar({ textareaRef, value, onChange }) {
  const [open, setOpen] = useState(null); // 'c' | 'bg' | 's' | 'f' | null
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const wrap = (openTag, closeTag) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = value.slice(start, end);
    const next = value.slice(0, start) + openTag + sel + closeTag + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + openTag.length, end + openTag.length); });
  };

  const apply = (tag, val) => {
    const open = val != null ? `[${tag}=${val}]` : `[${tag}]`;
    wrap(open, `[/${tag}]`);
    setOpen(null);
  };

  const clear = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = value.slice(start, end);
    const cleaned = stripFormatTags(sel);
    onChange(value.slice(0, start) + cleaned + value.slice(end));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start, start + cleaned.length); });
  };

  const Swatches = ({ colors, onPick }) => (
    <div style={{ ...popover, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
      {colors.map(c => (
        <button key={c} onClick={() => onPick(c)} title={c} style={{ width: '22px', height: '22px', borderRadius: '4px', background: c, border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', padding: 0 }} />
      ))}
    </div>
  );

  const menuBtn = (id, label) => ({ ...btn, background: open === id ? `${GOLD}18` : 'rgba(255,255,255,0.05)', color: open === id ? GOLD : '#c4cdd8' });

  return (
    <div ref={rootRef} style={{ display: 'flex', gap: '4px', alignItems: 'flex-start', flexWrap: 'wrap', position: 'relative' }}>
      <button onClick={() => apply('b')} style={btn} title="Bold"><b>B</b></button>
      <button onClick={() => apply('i')} style={btn} title="Italic"><i>I</i></button>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === 'c' ? null : 'c')} style={menuBtn('c', '🎨 Color')}>🎨 Color</button>
        {open === 'c' && <Swatches colors={TEXT_COLORS} onPick={c => apply('c', c)} />}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === 'bg' ? null : 'bg')} style={menuBtn('bg', '🖍 Highlight')}>🖍 Highlight</button>
        {open === 'bg' && <Swatches colors={BG_COLORS} onPick={c => apply('bg', c)} />}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === 's' ? null : 's')} style={menuBtn('s', 'Size')}>Size</button>
        {open === 's' && (
          <div style={{ ...popover, display: 'flex', flexWrap: 'wrap', gap: '4px', width: '120px' }}>
            {FONT_SIZES.map(s => <button key={s} onClick={() => apply('s', s)} style={{ ...btn, width: '100%' }}>{s}px</button>)}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === 'f' ? null : 'f')} style={menuBtn('f', '🔤 Font')}>Font</button>
        {open === 'f' && (
          <div style={{ ...popover, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '150px' }}>
            {FONTS.map(f => <button key={f} onClick={() => apply('f', f)} style={{ ...btn, fontFamily: f, textAlign: 'left', width: '100%' }}>{f}</button>)}
          </div>
        )}
      </div>

      <button onClick={clear} style={btn} title="Clear formatting on selection">✕ Clear</button>
    </div>
  );
}