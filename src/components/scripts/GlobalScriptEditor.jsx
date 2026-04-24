import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const FONT_SIZES = [11, 12, 13, 14, 15, 16, 18, 20];
const TEXT_COLORS = [
  { label: 'Cream',  value: '#e8e0d0' },
  { label: 'Gold',   value: '#b8933a' },
  { label: 'Green',  value: '#4ade80' },
  { label: 'Blue',   value: '#60a5fa' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Yellow', value: '#f59e0b' },
  { label: 'Red',    value: '#ef4444' },
  { label: 'Gray',   value: '#8a9ab8' },
];

const SCRIPT_TYPES = [
  { id: 'open',       label: '👋 Open',       hint: 'Opening / introduction script' },
  { id: 'followup',   label: '📞 Follow Up',   hint: 'Follow-up call script' },
  { id: 'highlights', label: '⭐ Highlights',  hint: 'Key talking points & highlights' },
  { id: 'close',      label: '🤝 Close',       hint: 'Closing / CTA script' },
  { id: 'load',       label: '📋 Load Script', hint: 'Loading / intro to pitch script' },
  { id: 'custom',     label: '✏️ Custom',      hint: 'Custom script' },
];

const DEFAULT_SCRIPTS = [
  { name: 'Open Script',   scriptType: 'open',       content: 'Hi {{firstname}}, this is [Your Name] calling from [Company]. How are you doing today?\n\nI\'m reaching out because...', color: '#e8e0d0', fontSize: 14, sortOrder: 0 },
  { name: 'Follow Up',     scriptType: 'followup',   content: 'Hi {{firstname}}, I wanted to follow up on our previous conversation about...', color: '#e8e0d0', fontSize: 14, sortOrder: 1 },
  { name: 'Highlights',    scriptType: 'highlights', content: 'Here are the key highlights I wanted to share with you, {{firstname}}:\n\n• Point 1\n• Point 2\n• Point 3', color: '#e8e0d0', fontSize: 14, sortOrder: 2 },
  { name: 'Close',         scriptType: 'close',      content: 'So {{firstname}}, based on everything we\'ve discussed, I think this would be a great fit. What are your thoughts?', color: '#e8e0d0', fontSize: 14, sortOrder: 3 },
  { name: 'Load Script',   scriptType: 'load',       content: 'Great {{firstname}}, let me walk you through the opportunity...', color: '#e8e0d0', fontSize: 14, sortOrder: 4 },
];

const inp = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'6px 10px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', width:'100%', boxSizing:'border-box' };

export default function GlobalScriptEditor() {
  const [scripts, setScripts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('custom');
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { loadScripts(); }, []);

  const loadScripts = async () => {
    setLoading(true);
    try {
      const results = await base44.entities.GlobalScript.list('sortOrder', 200);
      if (results?.length > 0) {
        setScripts(results);
        setActiveId(results[0].id);
      } else {
        // Seed defaults
        const created = [];
        for (const s of DEFAULT_SCRIPTS) {
          const r = await base44.entities.GlobalScript.create(s);
          created.push(r);
        }
        setScripts(created);
        setActiveId(created[0]?.id || null);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const active = scripts.find(s => s.id === activeId) || scripts[0];

  const updateActive = (changes) => {
    setScripts(prev => prev.map(s => s.id === activeId ? { ...s, ...changes } : s));
  };

  const saveActive = async () => {
    if (!active) return;
    setSaving(true); setSaveMsg('');
    try {
      await base44.entities.GlobalScript.update(active.id, {
        name: active.name,
        content: active.content,
        color: active.color,
        fontSize: active.fontSize,
        scriptType: active.scriptType,
      });
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (e) {
      setSaveMsg('Error: ' + e.message);
    }
    setSaving(false);
  };

  const addScript = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await base44.entities.GlobalScript.create({
        name: newName.trim(),
        scriptType: newType,
        content: '',
        color: '#e8e0d0',
        fontSize: 14,
        sortOrder: scripts.length,
      });
      setScripts(prev => [...prev, created]);
      setActiveId(created.id);
      setNewName('');
      setNewType('custom');
      setShowNewForm(false);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const deleteActive = async () => {
    if (!active || scripts.length <= 1) return;
    if (!window.confirm(`Delete "${active.name}"?`)) return;
    setDeleting(true);
    try {
      await base44.entities.GlobalScript.delete(active.id);
      const remaining = scripts.filter(s => s.id !== active.id);
      setScripts(remaining);
      setActiveId(remaining[0]?.id || null);
    } catch (e) { console.error(e); }
    setDeleting(false);
  };

  const substituteTokens = (text, firstName = '{{firstname}}', lastName = '{{lastname}}') =>
    (text || '').replace(/\{\{firstname\}\}/gi, firstName).replace(/\{\{lastname\}\}/gi, lastName);

  const editorContent = (
    <div style={{ display:'flex', flexDirection:'column', height: expanded ? 'calc(100vh - 80px)' : '100%', minHeight: 0 }}>

      {/* Script tabs */}
      <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'14px', overflowX:'auto', flexShrink:0, gap:0 }}>
        {scripts.map(s => {
          const typeInfo = SCRIPT_TYPES.find(t => t.id === s.scriptType);
          return (
            <div key={s.id} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
              <button onClick={() => setActiveId(s.id)}
                style={{ background: activeId===s.id ? 'rgba(184,147,58,0.1)' : 'none', border:'none', borderBottom: activeId===s.id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeId===s.id ? GOLD : '#6b7280', padding:'9px 14px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                {s.name}
              </button>
            </div>
          );
        })}

        {/* Add new */}
        {showNewForm ? (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'4px 10px', flexShrink:0, background:'rgba(0,0,0,0.2)', borderRadius:'4px', margin:'4px' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addScript(); if (e.key === 'Escape') setShowNewForm(false); }}
              placeholder="Script name…" autoFocus
              style={{ ...inp, width:'130px', padding:'4px 8px', fontSize:'11px' }} />
            <select value={newType} onChange={e => setNewType(e.target.value)}
              style={{ ...inp, width:'110px', padding:'4px 6px', fontSize:'11px', cursor:'pointer' }}>
              {SCRIPT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button onClick={addScript} disabled={saving} style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'2px', padding:'4px 10px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>+ Add</button>
            <button onClick={() => setShowNewForm(false)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'16px' }}>×</button>
          </div>
        ) : (
          <button onClick={() => setShowNewForm(true)}
            style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'20px', padding:'4px 12px', lineHeight:1, flexShrink:0 }}>+</button>
        )}

        <button onClick={() => setExpanded(e => !e)}
          style={{ marginLeft:'auto', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', color:'#8a9ab8', cursor:'pointer', fontSize:'11px', padding:'4px 10px', whiteSpace:'nowrap', flexShrink:0 }}>
          {expanded ? '⊡ Collapse' : '⊞ Expand'}
        </button>
      </div>

      {active && (
        <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>

          {/* Name + type row */}
          <div style={{ display:'flex', gap:'10px', marginBottom:'10px', flexShrink:0, flexWrap:'wrap' }}>
            <input value={active.name || ''} onChange={e => updateActive({ name: e.target.value })}
              placeholder="Script name…"
              style={{ ...inp, flex:1, minWidth:'140px' }} />
            <select value={active.scriptType || 'custom'} onChange={e => updateActive({ scriptType: e.target.value })}
              style={{ ...inp, width:'140px', cursor:'pointer' }}>
              {SCRIPT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          {/* Formatting toolbar */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px', flexWrap:'wrap', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>Size</span>
              <select value={active.fontSize || 14} onChange={e => updateActive({ fontSize: parseInt(e.target.value) })}
                style={{ ...inp, width:'60px', padding:'3px 6px', cursor:'pointer' }}>
                {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
              </select>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>Color</span>
              <div style={{ display:'flex', gap:'3px' }}>
                {TEXT_COLORS.map(c => (
                  <button key={c.value} onClick={() => updateActive({ color: c.value })} title={c.label}
                    style={{ width:'18px', height:'18px', borderRadius:'50%', background:c.value, border: active.color===c.value ? '2px solid #fff' : '2px solid transparent', cursor:'pointer', padding:0 }} />
                ))}
              </div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:'6px', alignItems:'center' }}>
              {saveMsg && <span style={{ color: saveMsg.startsWith('Error') ? '#ef4444' : '#4ade80', fontSize:'11px' }}>{saveMsg}</span>}
              {scripts.length > 1 && (
                <button onClick={deleteActive} disabled={deleting}
                  style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'2px', padding:'5px 10px', cursor:'pointer', fontSize:'11px' }}>
                  {deleting ? '…' : '🗑'}
                </button>
              )}
              <button onClick={saveActive} disabled={saving}
                style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'5px 16px', cursor:'pointer', fontSize:'11px', fontWeight:'700' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          {/* Textarea */}
          <textarea
            value={active.content || ''}
            onChange={e => updateActive({ content: e.target.value })}
            placeholder={`Type your script here…\nUse {{firstname}} or {{lastname}} to auto-insert the contact's name.`}
            style={{
              flex:1, width:'100%', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'4px', padding:'16px', color: active.color || '#e8e0d0',
              fontSize: `${active.fontSize || 14}px`, lineHeight: 1.7, outline:'none', resize:'none',
              fontFamily:'Georgia, serif', boxSizing:'border-box', minHeight: expanded ? '0' : '300px',
            }}
          />

          {/* Token hint */}
          <div style={{ marginTop:'8px', color:'#4a5568', fontSize:'10px', flexShrink:0 }}>
            Tokens: <span style={{ color:GOLD, fontFamily:'monospace' }}>{'{{firstname}}'}</span> · <span style={{ color:GOLD, fontFamily:'monospace' }}>{'{{lastname}}'}</span> — replaced with the contact's name when viewing in a contact card.
          </div>

          {/* Preview panel */}
          {(active.content || '').match(/\{\{firstname\}\}|\{\{lastname\}\}/i) && (
            <div style={{ marginTop:'12px', flexShrink:0 }}>
              <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Preview (sample name)</div>
              <div style={{
                background:'rgba(184,147,58,0.05)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'4px',
                padding:'12px 16px', color: active.color || '#e8e0d0', fontSize:`${active.fontSize || 14}px`,
                lineHeight:1.7, fontFamily:'Georgia, serif', whiteSpace:'pre-wrap', maxHeight:'120px', overflowY:'auto',
              }}>
                {substituteTokens(active.content, 'John', 'Smith')}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading scripts…</div>}
    </div>
  );

  if (expanded) {
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.97)', zIndex:99999, display:'flex', flexDirection:'column', padding:'24px', fontFamily:'Georgia, serif' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <span style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>📝 Script Library</span>
          <button onClick={() => setExpanded(false)}
            style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'2px', color:'#e8e0d0', cursor:'pointer', fontSize:'12px', padding:'6px 16px' }}>
            ⊡ Close Fullscreen
          </button>
        </div>
        {editorContent}
      </div>
    );
  }

  return editorContent;
}