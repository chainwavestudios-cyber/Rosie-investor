/**
 * ScriptFormatToolbar.jsx — Inline formatting toolbar for the script WYSIWYG editor.
 * Uses document.execCommand on the contentEditable to apply bold, italic, text
 * color, background highlight (incl. neon), font size, and font family directly
 * to the selection — true WYSIWYG, no raw BBCode tags shown to the user.
 */
import React, { useState, useRef, useEffect } from 'react';
import { htmlToBbcode } from '@/components/debt/ScriptRichText';

const GOLD = '#10b981';

const TEXT_COLORS = ['#e8e0d0', '#ffffff', '#10b981', '#60a5fa', '#a78bfa', '#f59e0b', '#ef4444', '#f472b6', '#000000'];
const BG_COLORS = [
  '#39ff14', '#00ffff', '#ff00ff', '#ccff00', '#ff6ec7', '#00ff99',
  '#7f00ff', '#ff9900', '#1e90ff', '#ff1744', '#fff700', '#00e5ff',
];
const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24, 28];
const FONTS = ['Georgia', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Impact', 'Comic Sans MS', 'Trebuchet MS'];
const ANIMATIONS = [
  { id: 'pulse', label: '💓 Pulse' },
  { id: 'blink', label: '⚡ Blink' },
  { id: 'shake', label: '📳 Shake' },
  { id: 'glow', label: '✨ Glow' },
];
const SPACING = [10, 20, 30, 40, 50];

const btn = { padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#c4cdd8', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' };
const popover = { padding: '8px', background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '6px', position: 'absolute', zIndex: 50, marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' };

export default function ScriptFormatToolbar({ editorRef, onChange }) {
  const [open, setOpen] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const flushChange = () => {
    const ce = editorRef?.current;
    if (!ce) return;
    const bbcode = htmlToBbcode(ce.innerHTML);
    onChange(bbcode);
  };

  const applyCommand = (command, value) => {
    const ce = editorRef?.current;
    if (!ce) return;
    ce.focus();
    if (command === 'fontSize') {
      // execCommand fontSize only supports 1-7; use workaround to get px sizes
      document.execCommand('fontSize', false, '7');
      const fonts = ce.querySelectorAll('font[size="7"]');
      fonts.forEach(f => {
        const span = document.createElement('span');
        span.style.fontSize = value + 'px';
        while (f.firstChild) span.appendChild(f.firstChild);
        f.replaceWith(span);
      });
    } else if (command === 'highlight') {
      // Try hiliteColor (Firefox) then backColor (Chrome)
      if (!document.execCommand('hiliteColor', false, value)) {
        document.execCommand('backColor', false, value);
      }
    } else {
      document.execCommand(command, false, value);
    }
    flushChange();
    setOpen(null);
  };

  const applyAnimation = (animName) => {
    const ce = editorRef?.current;
    if (!ce) return;
    ce.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement('span');
    span.style.animation = `script-${animName} 1.5s ease-in-out infinite`;
    span.style.display = 'inline-block';
    span.appendChild(range.extractContents());
    range.insertNode(span);
    flushChange();
    setOpen(null);
  };

  const insertGap = (px) => {
    const ce = editorRef?.current;
    if (!ce) return;
    ce.focus();
    document.execCommand('insertHTML', false, `<div style="height:${px}px"></div>`);
    flushChange();
    setOpen(null);
  };

  const clearFormat = () => {
    const ce = editorRef?.current;
    if (!ce) return;
    ce.focus();
    document.execCommand('removeFormat');
    document.execCommand('foreColor', false, '');
    flushChange();
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
      <button onClick={() => applyCommand('bold')} style={btn} title="Bold"><b>B</b></button>
      <button onClick={() => applyCommand('italic')} style={btn} title="Italic"><i>I</i></button>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === 'c' ? null : 'c')} style={menuBtn('c', '🎨 Color')}>🎨 Color</button>
        {open === 'c' && <Swatches colors={TEXT_COLORS} onPick={c => applyCommand('foreColor', c)} />}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === 'bg' ? null : 'bg')} style={menuBtn('bg', '🖍 Highlight')}>🖍 Highlight</button>
        {open === 'bg' && <Swatches colors={BG_COLORS} onPick={c => applyCommand('highlight', c)} />}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === 's' ? null : 's')} style={menuBtn('s', 'Size')}>Size</button>
        {open === 's' && (
          <div style={{ ...popover, display: 'flex', flexWrap: 'wrap', gap: '4px', width: '120px' }}>
            {FONT_SIZES.map(s => <button key={s} onClick={() => applyCommand('fontSize', s)} style={{ ...btn, width: '100%' }}>{s}px</button>)}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === 'f' ? null : 'f')} style={menuBtn('f', '🔤 Font')}>Font</button>
        {open === 'f' && (
          <div style={{ ...popover, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '150px' }}>
            {FONTS.map(f => <button key={f} onClick={() => applyCommand('fontName', f)} style={{ ...btn, fontFamily: f, textAlign: 'left', width: '100%' }}>{f}</button>)}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === 'anim' ? null : 'anim')} style={menuBtn('anim', '🎬 Animate')}>🎬 Animate</button>
        {open === 'anim' && (
          <div style={{ ...popover, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px' }}>
            {ANIMATIONS.map(a => <button key={a.id} onClick={() => applyAnimation(a.id)} style={{ ...btn, textAlign: 'left', width: '100%' }}>{a.label}</button>)}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === 'gap' ? null : 'gap')} style={menuBtn('gap', '↕ Space')}>↕ Space</button>
        {open === 'gap' && (
          <div style={{ ...popover, display: 'flex', flexWrap: 'wrap', gap: '4px', width: '120px' }}>
            {SPACING.map(s => <button key={s} onClick={() => insertGap(s)} style={{ ...btn, width: '100%' }}>{s}px gap</button>)}
          </div>
        )}
      </div>

      <button onClick={clearFormat} style={btn} title="Clear formatting on selection">✕ Clear</button>
    </div>
  );
}