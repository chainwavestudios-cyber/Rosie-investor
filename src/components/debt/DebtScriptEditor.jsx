/**
 * DebtScriptEditor.jsx — Script editor for the Debt Call Coach.
 * Two tabs: My Scripts (CRUD on DebtScript entity) and Agent Scripts (read-only KB imports).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

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
function MyScriptsTab() {
  const [scripts, setScripts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('custom');
  const [deleting, setDeleting] = useState(false);
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

  const updateActive = (changes) => {
    setScripts(prev => prev.map(s => s.id === activeId ? { ...s, ...changes } : s));
  };

  const saveActive = async () => {
    if (!active) return;
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

  // Sync textarea when switching scripts
  useEffect(() => {
    if (textareaRef.current && active) {
      textareaRef.current.value = active.content || '';
    }
  }, [activeId]);

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
            <input value={active.name || ''} onChange={e => updateActive({ name: e.target.value })} placeholder="Script name…" style={{ ...inp, flex: 1, minWidth: '120px' }} />
            <select value={active.scriptType || 'custom'} onChange={e => updateActive({ scriptType: e.target.value })} style={{ ...inp, width: '130px', cursor: 'pointer' }}>
              {SCRIPT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          {/* Formatting toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Size</span>
              <select value={active.fontSize || 14} onChange={e => updateActive({ fontSize: parseInt(e.target.value) })} style={{ ...inp, width: '55px', padding: '3px 6px', cursor: 'pointer' }}>
                {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Color</span>
              <div style={{ display: 'flex', gap: '3px' }}>
                {TEXT_COLORS.map(c => (
                  <button key={c.value} onClick={() => updateActive({ color: c.value })} title={c.label} style={{ width: '18px', height: '18px', borderRadius: '50%', background: c.value, border: active.color === c.value ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
              {saveMsg && <span style={{ color: saveMsg.startsWith('Error') ? '#ef4444' : '#4ade80', fontSize: '11px' }}>{saveMsg}</span>}
              {scripts.length > 1 && (
                <button onClick={deleteActive} disabled={deleting} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '2px', padding: '5px 10px', cursor: 'pointer', fontSize: '11px' }}>{deleting ? '…' : '🗑'}</button>
              )}
              <button onClick={saveActive} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '2px', padding: '5px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>

          {/* Editor textarea */}
          <textarea
            ref={textareaRef}
            value={active.content || ''}
            onChange={e => updateActive({ content: e.target.value })}
            placeholder="Type your script here… Use {{firstname}} or {{lastname}} for auto-insertion."
            style={{
              flex: 1, width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px', padding: '16px', color: active.color || '#e8e0d0',
              fontSize: `${active.fontSize || 14}px`, lineHeight: 1.7, outline: 'none',
              fontFamily: 'Georgia, serif', boxSizing: 'border-box', resize: 'none', minHeight: '200px',
            }}
          />
          <div style={{ marginTop: '6px', color: '#4a5568', fontSize: '10px', flexShrink: 0 }}>
            Tokens: <span style={{ color: GOLD, fontFamily: 'monospace' }}>{'{{firstname}}'}</span> · <span style={{ color: GOLD, fontFamily: 'monospace' }}>{'{{lastname}}'}</span>
          </div>
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