/**
 * FronterScriptEditor.jsx — WYSIWYG editor for fronter scripts.
 * Wraps ScriptWysiwygEditor + ScriptFormatToolbar so fronter scripts get the
 * same rich-text features as debt call coach scripts (bold, color, highlight,
 * font, size, and animations like pulse/blink/shake/glow).
 */
import React, { useRef, useState } from 'react';
import ScriptWysiwygEditor from '@/components/debt/ScriptWysiwygEditor';
import ScriptFormatToolbar from '@/components/debt/ScriptFormatToolbar';

const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function FronterScriptEditor({ initialName = '', initialContent = '', onSubmit, submitLabel = 'Add Script', onCancel }) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);
  const editorRef = useRef(null);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), content });
  };

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <label style={ls}>Script Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Fronter Opener" style={inp} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={ls}>Script Content</label>
        <ScriptFormatToolbar editorRef={editorRef} onChange={setContent} />
        <div style={{ marginTop: '6px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', overflow: 'hidden' }}>
          <ScriptWysiwygEditor
            ref={editorRef}
            value={content}
            onChange={setContent}
            style={{ padding: '12px', minHeight: '200px', maxHeight: '400px', color: '#e8e0d0', fontSize: '15px', fontFamily: 'Georgia, serif' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleSubmit} disabled={!name.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: !name.trim() ? 0.5 : 1 }}>{submitLabel}</button>
        {onCancel && <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>}
      </div>
    </div>
  );
}