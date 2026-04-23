import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const DEFAULT_SCRIPTS = [
  { id: 'intro', name: 'Introduction', content: 'Hi, this is [Your Name] calling from [Company]. How are you doing today?\n\nI\'m reaching out because...', color: '#e8e0d0', fontSize: 14 },
  { id: 'followup', name: 'Follow Up', content: 'Hi [Name], I wanted to follow up on our previous conversation about...', color: '#e8e0d0', fontSize: 14 },
  { id: 'voicemail', name: 'Voicemail', content: 'Hi [Name], this is [Your Name] from [Company]. Please give me a call back at [Number]. Thank you!', color: '#e8e0d0', fontSize: 14 },
];

const FONT_SIZES = [11, 12, 13, 14, 15, 16, 18, 20];
const TEXT_COLORS = [
  { label: 'White', value: '#e8e0d0' },
  { label: 'Gold', value: '#b8933a' },
  { label: 'Green', value: '#4ade80' },
  { label: 'Blue', value: '#60a5fa' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Yellow', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Gray', value: '#8a9ab8' },
];

export default function ScriptTab({ contactId, contactType = 'lead' }) {
  const [scripts, setScripts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [newScriptName, setNewScriptName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const storageKey = `scripts_${contactType}_${contactId}`;

  // Load scripts from localStorage (fast) + entity (persistent)
  useEffect(() => {
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        setScripts(parsed);
        setActiveId(parsed[0]?.id || null);
        return;
      } catch {}
    }
    // Load from base44 entity
    loadScripts();
  }, [contactId]);

  const loadScripts = async () => {
    try {
      const results = await base44.entities.Script.filter({ contactId, contactType });
      if (results?.length > 0) {
        const sorted = results.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setScripts(sorted);
        setActiveId(sorted[0].id);
        localStorage.setItem(storageKey, JSON.stringify(sorted));
      } else {
        // Seed with defaults
        setScripts(DEFAULT_SCRIPTS);
        setActiveId(DEFAULT_SCRIPTS[0].id);
      }
    } catch {
      setScripts(DEFAULT_SCRIPTS);
      setActiveId(DEFAULT_SCRIPTS[0].id);
    }
  };

  const activeScript = scripts.find(s => s.id === activeId) || scripts[0];

  const updateActive = (changes) => {
    setScripts(prev => prev.map(s => s.id === activeId ? { ...s, ...changes } : s));
  };

  const saveScripts = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      // Save each script to entity
      for (const script of scripts) {
        if (script.id?.startsWith('intro') || script.id?.startsWith('followup') || script.id?.startsWith('voicemail')) {
          // Default scripts — create if not saved yet
          const existing = await base44.entities.Script.filter({ contactId, contactType, name: script.name });
          if (existing?.length > 0) {
            await base44.entities.Script.update(existing[0].id, { content: script.content, color: script.color, fontSize: script.fontSize });
          } else {
            const saved = await base44.entities.Script.create({ contactId, contactType, name: script.name, content: script.content, color: script.color, fontSize: script.fontSize });
            setScripts(prev => prev.map(s => s.name === script.name ? { ...s, id: saved.id } : s));
          }
        } else {
          const existing = await base44.entities.Script.filter({ contactId, contactType, name: script.name });
          if (existing?.length > 0) {
            await base44.entities.Script.update(existing[0].id, { content: script.content, color: script.color, fontSize: script.fontSize });
          } else {
            await base44.entities.Script.create({ contactId, contactType, name: script.name, content: script.content, color: script.color, fontSize: script.fontSize });
          }
        }
      }
      localStorage.setItem(storageKey, JSON.stringify(scripts));
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (e) {
      setSaveMsg('Error: ' + e.message);
    }
    setSaving(false);
  };

  const addScript = async () => {
    if (!newScriptName.trim()) return;
    const newScript = { id: `new_${Date.now()}`, name: newScriptName.trim(), content: '', color: '#e8e0d0', fontSize: 14 };
    setScripts(prev => [...prev, newScript]);
    setActiveId(newScript.id);
    setNewScriptName('');
    setShowNewForm(false);
  };

  const deleteScript = (id) => {
    if (scripts.length <= 1) return;
    const newScripts = scripts.filter(s => s.id !== id);
    setScripts(newScripts);
    setActiveId(newScripts[0]?.id || null);
  };

  const inp = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'6px 10px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif' };

  const content = (
    <div style={{ display:'flex', flexDirection:'column', height: expanded ? 'calc(100vh - 120px)' : '100%' }}>

      {/* Script selector tabs */}
      <div style={{ display:'flex', alignItems:'center', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'12px', overflowX:'auto', flexShrink:0 }}>
        {scripts.map(s => (
          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'0', flexShrink:0 }}>
            <button onClick={() => setActiveId(s.id)}
              style={{ background: activeId===s.id ? 'rgba(184,147,58,0.1)' : 'none', border:'none', borderBottom: activeId===s.id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeId===s.id ? GOLD : '#6b7280', padding:'8px 14px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
              {s.name}
            </button>
            {scripts.length > 1 && activeId === s.id && (
              <button onClick={() => deleteScript(s.id)}
                style={{ background:'none', border:'none', color:'#ef444460', cursor:'pointer', fontSize:'12px', padding:'0 4px', lineHeight:1 }}>×</button>
            )}
          </div>
        ))}
        {/* Add new script */}
        {showNewForm ? (
          <div style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 8px' }}>
            <input value={newScriptName} onChange={e => setNewScriptName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addScript(); if (e.key === 'Escape') setShowNewForm(false); }}
              placeholder="Script name…" autoFocus
              style={{ ...inp, width:'120px', padding:'4px 8px', fontSize:'11px' }} />
            <button onClick={addScript} style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'2px', padding:'3px 8px', cursor:'pointer', fontSize:'11px' }}>Add</button>
            <button onClick={() => setShowNewForm(false)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'14px' }}>×</button>
          </div>
        ) : (
          <button onClick={() => setShowNewForm(true)}
            style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'18px', padding:'4px 10px', lineHeight:1 }}>+</button>
        )}

        {/* Expand / collapse */}
        <button onClick={() => setExpanded(e => !e)}
          style={{ marginLeft:'auto', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', color:'#8a9ab8', cursor:'pointer', fontSize:'11px', padding:'4px 10px', whiteSpace:'nowrap', flexShrink:0 }}>
          {expanded ? '⊡ Collapse' : '⊞ Expand'}
        </button>
      </div>

      {activeScript && (
        <>
          {/* Formatting toolbar */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', flexWrap:'wrap', flexShrink:0 }}>
            {/* Font size */}
            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>Size</span>
              <select value={activeScript.fontSize || 14} onChange={e => updateActive({ fontSize: parseInt(e.target.value) })}
                style={{ ...inp, padding:'3px 6px', cursor:'pointer', width:'60px' }}>
                {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
              </select>
            </div>

            {/* Text color */}
            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>Color</span>
              <div style={{ display:'flex', gap:'3px' }}>
                {TEXT_COLORS.map(c => (
                  <button key={c.value} onClick={() => updateActive({ color: c.value })} title={c.label}
                    style={{ width:'18px', height:'18px', borderRadius:'50%', background:c.value, border: activeScript.color===c.value ? '2px solid #fff' : '2px solid transparent', cursor:'pointer', padding:0 }} />
                ))}
              </div>
            </div>

            <div style={{ marginLeft:'auto', display:'flex', gap:'6px', alignItems:'center' }}>
              {saveMsg && <span style={{ color: saveMsg.startsWith('Error') ? '#ef4444' : '#4ade80', fontSize:'11px' }}>{saveMsg}</span>}
              <button onClick={saveScripts} disabled={saving}
                style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'5px 14px', cursor:'pointer', fontSize:'11px', fontWeight:'700', letterSpacing:'1px' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          {/* Script editor */}
          <textarea
            value={activeScript.content || ''}
            onChange={e => updateActive({ content: e.target.value })}
            placeholder="Type your script here…"
            style={{
              flex:1,
              width:'100%',
              background:'rgba(0,0,0,0.2)',
              border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'4px',
              padding:'16px',
              color: activeScript.color || '#e8e0d0',
              fontSize: `${activeScript.fontSize || 14}px`,
              lineHeight: 1.7,
              outline:'none',
              resize:'none',
              fontFamily:'Georgia, serif',
              boxSizing:'border-box',
              minHeight: expanded ? '0' : '300px',
            }}
          />
        </>
      )}
    </div>
  );

  if (expanded) {
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:99999, display:'flex', flexDirection:'column', padding:'24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <span style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>📝 Script Editor</span>
          <button onClick={() => setExpanded(false)}
            style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'2px', color:'#e8e0d0', cursor:'pointer', fontSize:'12px', padding:'6px 16px' }}>
            ⊡ Close Fullscreen
          </button>
        </div>
        {content}
      </div>
    );
  }

  return content;
}