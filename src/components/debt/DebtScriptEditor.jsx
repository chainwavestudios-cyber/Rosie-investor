/**
 * DebtScriptEditor.jsx — Script editor for the Debt Call Coach.
 * Two tabs: My Scripts (CRUD on DebtScript entity) and Agent Scripts (read-only KB imports).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ScriptTeleprompter, { CUE_CATEGORIES } from '@/components/debt/ScriptTeleprompter';
import ScriptFormatToolbar from '@/components/debt/ScriptFormatToolbar';
import ScriptWysiwygEditor from '@/components/debt/ScriptWysiwygEditor';
import { htmlToBbcode } from '@/components/debt/ScriptRichText';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const SCRIPT_TYPES = [
  { id: 'open', label: '📞 Opener' },
  { id: 'close', label: '🎯 Closer' },
  { id: 'discovery', label: '🔍 Discovery' },
  { id: 'rebuttal', label: '🚫 Rebuttal' },
  { id: 'custom', label: '✏️ Custom' },
];

const TEXT_COLORS = [
  { label: 'Cream', value: '#e8e0d0' },
  { label: 'Gold', value: '#10b981' },
  { label: 'Blue', value: '#60a5fa' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Yellow', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
];

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];

const AGENT_CATEGORIES = {
  debt_open_scenario: { label: '📞 Open Scenarios', color: '#60a5fa' },
  debt_close_scenario: { label: '🎯 Close Scenarios', color: '#a78bfa' },
};

export { MyScriptsTab };

export default function DebtScriptEditor() {
  const [tab, setTab] = useState('my');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: '2px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => setTab('my')} style={{ padding: '8px 16px', background: tab === 'my' ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: `2px solid ${tab === 'my' ? GOLD : 'transparent'}`, color: tab === 'my' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: tab === 'my' ? 'bold' : 'normal' }}>📝 My Scripts</button>
        <button onClick={() => setTab('agent')} style={{ padding: '8px 16px', background: tab === 'agent' ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: `2px solid ${tab === 'agent' ? GOLD : 'transparent'}`, color: tab === 'agent' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: tab === 'agent' ? 'bold' : 'normal' }}>🤖 Agent Scripts</button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'my' ? <MyScriptsTab /> : <AgentScriptsTab />}
      </div>
    </div>
  );
}

// ─── My Scripts Tab ──────────────────────────────────────────────────────────
function MyScriptsTab({ liveTranscript, phase, clientFirstName, clientLastName, micLabel, onScriptPositionChange }) {
  const [scripts, setScripts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('custom');
  const [deleting, setDeleting] = useState(false);

  const autoSaveTimer = useRef(null);
  const activeRef = useRef(null);
  const [mode, setMode] = useState('edit'); // 'edit' | 'teleprompt'
  const textareaRef = useRef(null);

  const loadScripts = useCallback(async () => {
    setLoading(true);
    try {
      const results = await base44.entities.DebtScript.list('sortOrder', 200);
      setScripts(results || []);
      if (results?.length > 0) setActiveId(results[0].id);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadScripts(); }, [loadScripts]);

  const active = scripts.find(s => s.id === activeId) || scripts[0];
  useEffect(() => { activeRef.current = active; }, [active]);

  const updateActive = (changes) => {
    setScripts(prev => prev.map(s => s.id === activeId ? { ...s, ...changes } : s));
  };

  // Auto-save with 1.2s debounce — no need to click Save
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const cur = activeRef.current;
      if (!cur) return;
      setSaving(true);
      try {
        await base44.entities.DebtScript.update(cur.id, {
          name: cur.name, content: cur.content || '',
          color: cur.color, fontSize: cur.fontSize, scriptType: cur.scriptType,
        });
        setSaveMsg('Saved ✓');
        setTimeout(() => setSaveMsg(''), 1500);
      } catch (e) { setSaveMsg('Error: ' + e.message); }
      setSaving(false);
    }, 1200);
  }, []);

  const updateAndSave = (changes) => {
    updateActive(changes);
    scheduleAutoSave();
  };

  const insertCueAtCursor = (category) => {
    const ce = textareaRef.current;
    if (!ce || !active) return;
    ce.focus();
    const cue = `<br>@@CUE:${category}:New ${CUE_CATEGORIES[category].label.toLowerCase()}@@<br>`;
    document.execCommand('insertHTML', false, cue);
    const bbcode = htmlToBbcode(ce.innerHTML);
    updateAndSave({ content: bbcode });
  };

  const saveActive = async () => {
    if (!active) return;
    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null; }
    setSaving(true); setSaveMsg('');
    try {
      await base44.entities.DebtScript.update(active.id, {
        name: active.name, content: active.content || '',
        color: active.color, fontSize: active.fontSize, scriptType: active.scriptType,
      });
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
  };

  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  const addScript = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await base44.entities.DebtScript.create({
        name: newName.trim(), scriptType: newType, content: '',
        color: '#e8e0d0', fontSize: 14, sortOrder: scripts.length,
      });
      setScripts(prev => [...prev, created]);
      setActiveId(created.id);
      setNewName(''); setNewType('custom'); setShowNewForm(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const deleteActive = async () => {
    if (!active || scripts.length <= 1) return;
    if (!window.confirm(`Delete "${active.name}"?`)) return;
    setDeleting(true);
    try {
      await base44.entities.DebtScript.delete(active.id);
      const remaining = scripts.filter(s => s.id !== active.id);
      setScripts(remaining);
      setActiveId(remaining[0]?.id || null);
    } catch (e) { console.error(e); }
    setDeleting(false);
  };

  if (loading) return <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading scripts…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Script tabs */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '12px', overflowX: 'auto', flexShrink: 0, gap: 0 }}>
        {scripts.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)}
            style={{ background: activeId === s.id ? `${GOLD}10` : 'none', border: 'none', borderBottom: activeId === s.id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeId === s.id ? GOLD : '#6b7280', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap' }}>
            {s.name}
          </button>
        ))}
        {showNewForm ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', flexShrink: 0, background: 'rgba(0,0,0,0.2)', borderRadius: '4px', margin: '4px' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addScript(); if (e.key === 'Escape') setShowNewForm(false); }} placeholder="Script name…" autoFocus style={{ ...inp, width: '120px', padding: '4px 8px', fontSize: '11px' }} />
            <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...inp, width: '100px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}>
              {SCRIPT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button onClick={addScript} disabled={saving} style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '2px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap' }}>+ Add</button>
            <button onClick={() => setShowNewForm(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px' }}>×</button>
          </div>
        ) : (
          <button onClick={() => setShowNewForm(true)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '20px', padding: '4px 12px', lineHeight: 1, flexShrink: 0 }}>+</button>
        )}
      </div>

      {active ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Name + type row */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
            <input value={active.name || ''} onChange={e => updateAndSave({ name: e.target.value })} placeholder="Script name…" style={{ ...inp, flex: 1, minWidth: '120px' }} />
            <select value={active.scriptType || 'custom'} onChange={e => updateAndSave({ scriptType: e.target.value })} style={{ ...inp, width: '130px', cursor: 'pointer' }}>
              {SCRIPT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          {/* Mode toggle + formatting toolbar — single line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              <button onClick={() => setMode('edit')} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${mode === 'edit' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: mode === 'edit' ? `${GOLD}18` : 'transparent', color: mode === 'edit' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✏️ Edit</button>
              <button onClick={() => setMode('teleprompt')} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${mode === 'teleprompt' ? '#f59e0b66' : 'rgba(255,255,255,0.1)'}`, background: mode === 'teleprompt' ? 'rgba(245,158,11,0.15)' : 'transparent', color: mode === 'teleprompt' ? '#f59e0b' : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📍 Teleprompt</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Size</span>
              <select value={active.fontSize || 14} onChange={e => updateAndSave({ fontSize: parseInt(e.target.value) })} style={{ ...inp, width: '50px', padding: '3px 4px', cursor: 'pointer' }}>
                {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Color</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                {TEXT_COLORS.map(c => (
                  <button key={c.value} onClick={() => updateAndSave({ color: c.value })} title={c.label} style={{ width: '16px', height: '16px', borderRadius: '50%', background: c.value, border: active.color === c.value ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
              {saveMsg && <span style={{ color: saveMsg.startsWith('Error') ? '#ef4444' : '#4ade80', fontSize: '11px' }}>{saveMsg}</span>}
              {scripts.length > 1 && (
                <button onClick={deleteActive} disabled={deleting} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '2px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>{deleting ? '…' : '🗑'}</button>
              )}
              <button onClick={saveActive} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '2px', padding: '4px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>

          {mode === 'edit' ? (
            <>
              {/* Cue block insertion toolbar */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Insert Cue:</span>
                {Object.entries(CUE_CATEGORIES).map(([key, cat]) => (
                  <button key={key} onClick={() => insertCueAtCursor(key)} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${cat.color}44`, background: `${cat.color}12`, color: cat.color, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{cat.icon} {cat.label}</button>
                ))}
              </div>
              {/* Inline formatting toolbar */}
              <div style={{ marginBottom: '8px', flexShrink: 0 }}>
                <ScriptFormatToolbar editorRef={textareaRef} onChange={v => updateAndSave({ content: v })} />
              </div>
              {/* Editor textarea */}
              <ScriptWysiwygEditor
                ref={textareaRef}
                value={active.content || ''}
                onChange={v => updateAndSave({ content: v })}
                style={{
                  flex: 1, width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '4px', padding: '16px', color: active.color || '#e8e0d0',
                  fontSize: `${active.fontSize || 14}px`, lineHeight: 1.7,
                  fontFamily: 'Georgia, serif', boxSizing: 'border-box', minHeight: '200px',
                }}
              />
              <div style={{ marginTop: '6px', color: '#4a5568', fontSize: '10px', flexShrink: 0 }}>
                Tokens: <span style={{ color: GOLD, fontFamily: 'monospace' }}>{'{{firstname}}'}</span> · <span style={{ color: GOLD, fontFamily: 'monospace' }}>{'{{lastname}}'}</span>
                <span style={{ marginLeft: '12px' }}>Format: <span style={{ color: '#a78bfa', fontFamily: 'monospace' }}>[b]..[/b] [i]..[/i] [c=#hex]..[/c] [bg=#hex]..[/bg] [s=18]..[/s] [f=Arial]..[/f]</span></span>
                <span style={{ marginLeft: '12px' }}>Cue: <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>@@CUE:reminder:text@@</span></span>
              </div>
            </>
          ) : (
            <ScriptTeleprompter content={active.content || ''} color={active.color || '#e8e0d0'} fontSize={active.fontSize || 14} liveTranscript={liveTranscript} phase={phase} clientFirstName={clientFirstName} clientLastName={clientLastName} micLabel={micLabel} onPositionChange={onScriptPositionChange} />
          )}
        </div>
      ) : (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>
          No scripts yet. Click <span style={{ color: GOLD, fontSize: '20px' }}>+</span> to create your first debt settlement script.
        </div>
      )}
    </div>
  );
}

// ─── Agent Scripts Tab (KB imports) ──────────────────────────────────────────
function AgentScriptsTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeEntryId, setActiveEntryId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.KnowledgeBase.list('-created_date', 500);
      const filtered = (all || []).filter(e => Object.keys(AGENT_CATEGORIES).includes(e.category));
      setEntries(filtered);
      if (filtered.length > 0) setActiveEntryId(filtered[0].id);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Listen for KB updates
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('debt_kb_updated', handler);
    return () => window.removeEventListener('debt_kb_updated', handler);
  }, [load]);

  const active = entries.find(e => e.id === activeEntryId) || entries[0];

  if (loading) return <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading agent scripts…</div>;

  if (entries.length === 0) return (
    <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>
      No agent scripts yet. These are imported from the Knowledge Base (Open/Close Scenarios).
      <div style={{ marginTop: '8px', fontSize: '11px' }}>Scripts sync automatically every 2 hours, or upload them in BOB's Brain.</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: '12px', height: '100%', minHeight: '300px' }}>
      {/* List */}
      <div style={{ width: '200px', flexShrink: 0, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.07)', paddingRight: '8px' }}>
        {Object.entries(AGENT_CATEGORIES).map(([cat, info]) => {
          const catEntries = entries.filter(e => e.category === cat);
          if (catEntries.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: '12px' }}>
              <div style={{ color: info.color, fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>{info.label}</div>
              {catEntries.map(e => (
                <button key={e.id} onClick={() => setActiveEntryId(e.id)} style={{ display: 'block', width: '100%', textAlign: 'left', background: activeEntryId === e.id ? `${info.color}12` : 'transparent', border: 'none', borderLeft: `2px solid ${activeEntryId === e.id ? info.color : 'transparent'}`, color: activeEntryId === e.id ? '#e8e0d0' : '#8a9ab8', padding: '6px 10px', cursor: 'pointer', fontSize: '11px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.question?.slice(0, 30) || 'Untitled'}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Viewer */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {active ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{active.question}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: AGENT_CATEGORIES[active.category]?.color || '#6b7280', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{AGENT_CATEGORIES[active.category]?.label}</span>
                {active.source && <span style={{ color: '#4a5568', fontSize: '10px' }}>· {active.source}</span>}
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '16px', color: '#e8e0d0', fontSize: '13px', lineHeight: 1.7, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>
              {active.answer || <span style={{ color: '#4a5568', fontStyle: 'italic' }}>No content.</span>}
            </div>
          </div>
        ) : (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>Select a script to view.</div>
        )}
      </div>
    </div>
  );
}