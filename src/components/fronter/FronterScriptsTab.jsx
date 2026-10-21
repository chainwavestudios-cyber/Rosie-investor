/**
 * FronterScriptsTab.jsx — Full-featured script tab for fronters, mirroring the
 * Debt Call Coach script experience: multiple scripts with tabs, edit mode
 * (WYSIWYG + formatting toolbar + cue insertion), teleprompt mode (voice-synced
 * auto-scroll), auto-save, font size/color controls, and pop-out panel.
 *
 * Uses FronterScript entity (shared with admin-created scripts).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachValue, getDebtCoachValue, setDebtCoachValue } from '@/lib/debtCoachStorage';
import { usePopOutPanel } from '@/hooks/usePopOutPanel';
import FronterScriptsWindow from '@/components/fronter/FronterScriptsWindow';
import ScriptTeleprompter, { CUE_CATEGORIES } from '@/components/debt/ScriptTeleprompter';
import ScriptFormatToolbar from '@/components/debt/ScriptFormatToolbar';
import ScriptWysiwygEditor from '@/components/debt/ScriptWysiwygEditor';
import { htmlToBbcode } from '@/components/debt/ScriptRichText';
import { FRONTER_CONTACT_TABS } from '@/lib/fronterContactFields';

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

const VARIABLES = [
  { token: '{{first name}}', desc: 'First name from contact card' },
  { token: '{{last name}}', desc: 'Last name from contact card' },
  { token: '{{phone}}', desc: 'Phone number from contact card' },
  { token: '{{zip}}', desc: 'Zip code from contact card' },
  { token: '{{city}}', desc: 'City from contact card' },
  { token: '{{state}}', desc: 'State from contact card' },
  { token: '{{email}}', desc: 'Email from contact card' },
  { token: '{{address}}', desc: 'Mailing address from contact card' },
  { token: '{{notice id}}', desc: 'Notice ID from contact card' },
  { token: '{{debt amount}}', desc: 'Debt amount from contact card' },
  { token: '{{frontername}}', desc: 'Fronter first name (from admin panel)' },
];

export default function FronterScriptsTab({ fronterFirstName, username, active = true }) {
  const panel = usePopOutPanel('fronter_scripts', { width: 640, height: 640 }, username, 30000);
  // Docked height — persisted per user, draggable from the bottom edge
  const [dockedHeight, setDockedHeight] = useDebtCoachValue(username, 'fronter_scripts_docked_h', 560);
  const resizeRef = useRef(null);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(0);

  useEffect(() => {
    const onMove = (e) => {
      if (!resizeRef.current) return;
      const dy = e.clientY - resizeStartY.current;
      const next = Math.max(360, Math.min(window.innerHeight - 120, resizeStartH.current + dy));
      setDockedHeight(next);
    };
    const onUp = () => { resizeRef.current = false; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [setDockedHeight]);

  const startDockedResize = (e) => {
    e.preventDefault();
    resizeRef.current = true;
    resizeStartY.current = e.clientY;
    resizeStartH.current = typeof dockedHeight === 'number' ? dockedHeight : 560;
    document.body.style.cursor = 'ns-resize';
  };

  const scriptContent = (
    <FronterScriptsContent fronterFirstName={fronterFirstName} username={username} />
  );

  // Keep the window mounted across workspace tabs and outside clipping containers.
  if (panel.poppedOut) {
    return (
      <>
        {active && (
          <div className="dark flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
            <span>Scripts are open in a floating window.</span>
            <div className="flex gap-2">
              <button type="button" onClick={panel.center} className="rounded border border-border bg-secondary px-3 py-2 text-sm">Bring Window Here</button>
              <button type="button" onClick={panel.toggle} className="rounded border border-border bg-secondary px-3 py-2 text-sm">Dock Scripts</button>
            </div>
          </div>
        )}
        <FronterScriptsWindow panel={panel}>{scriptContent}</FronterScriptsWindow>
      </>
    );
  }
  if (!active) return null;

  // Docked — inline with pop-out button + draggable bottom edge to resize height
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={panel.popOut} aria-label="Pop Out Scripts" style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Pop Out Scripts</button>
      </div>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', height: `${typeof dockedHeight === 'number' ? dockedHeight : 560}px`, maxHeight: '85vh', overflow: 'hidden', position: 'relative' }}>
        {scriptContent}
      </div>
      {/* Drag handle — drag up to shrink, down to expand */}
      <div
        onMouseDown={startDockedResize}
        title="Drag to resize"
        style={{ height: 10, marginTop: 2, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', background: 'rgba(16,185,129,0.06)', borderTop: '1px solid rgba(16,185,129,0.2)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.18)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.06)'}
      >
        <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(16,185,129,0.4)' }} />
      </div>
    </div>
  );
}

// ─── Script Content (shared between docked and popped-out) ──────────────────
function FronterScriptsContent({ fronterFirstName, username }) {
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
  const [mode, setMode] = useDebtCoachValue(username, 'fronter_script_mode', 'edit');
  const textareaRef = useRef(null);
  const skipActiveIdSave = useRef(true);

  const loadScripts = useCallback(async () => {
    setLoading(true);
    try {
      const results = await base44.entities.FronterScript.list('sortOrder', 200);
      setScripts(results || []);
      let initialId = results?.[0]?.id || null;
      if (username && results?.length > 0) {
        const savedId = await getDebtCoachValue(username, 'fronter_active_script');
        if (savedId && results.find(s => s.id === savedId)) initialId = savedId;
      }
      setActiveId(initialId);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [username]);

  useEffect(() => {
    if (!username || !activeId) return;
    if (skipActiveIdSave.current) { skipActiveIdSave.current = false; return; }
    setDebtCoachValue(username, 'fronter_active_script', activeId);
  }, [activeId, username]);

  useEffect(() => {
    if (!username) return;
    const handler = async () => {
      const savedId = await getDebtCoachValue(username, 'fronter_active_script');
      if (savedId && scripts.find(s => s.id === savedId)) {
        skipActiveIdSave.current = true;
        setActiveId(savedId);
      }
    };
    window.addEventListener('layout_restored', handler);
    return () => window.removeEventListener('layout_restored', handler);
  }, [username, scripts]);

  useEffect(() => { loadScripts(); }, [loadScripts]);

  const active = scripts.find(s => s.id === activeId) || scripts[0];
  useEffect(() => { activeRef.current = active; }, [active]);

  const updateActive = (changes) => {
    setScripts(prev => prev.map(s => s.id === activeId ? { ...s, ...changes } : s));
  };

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const cur = activeRef.current;
      if (!cur) return;
      setSaving(true);
      try {
        await base44.entities.FronterScript.update(cur.id, {
          name: cur.name, content: cur.content || '',
          color: cur.color, fontSize: cur.fontSize, scriptType: cur.scriptType,
          alwaysSaveBackup: cur.alwaysSaveBackup || false,
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

  const insertAiFieldTag = (fieldName) => {
    const ce = textareaRef.current;
    if (!ce || !active || !fieldName) return;
    ce.focus();
    document.execCommand('insertHTML', false, ` [[AI:${fieldName}]] `);
    const bbcode = htmlToBbcode(ce.innerHTML);
    updateAndSave({ content: bbcode });
  };

  const insertDebtConfirmTag = () => {
    const ce = textareaRef.current;
    if (!ce || !active) return;
    ce.focus();
    document.execCommand('insertHTML', false, '<br>@@DEBT_CONFIRM@@<br>');
    const bbcode = htmlToBbcode(ce.innerHTML);
    updateAndSave({ content: bbcode });
  };

  const insertCompletedStepsTag = () => {
    const ce = textareaRef.current;
    if (!ce || !active) return;
    ce.focus();
    document.execCommand('insertHTML', false, '<br>@@COMPLETED_STEPS@@<br>');
    const bbcode = htmlToBbcode(ce.innerHTML);
    updateAndSave({ content: bbcode });
  };

  const insertAiInputTag = () => {
    const ce = textareaRef.current;
    if (!ce || !active) return;
    ce.focus();
    document.execCommand('insertHTML', false, '<br>@@AI_INPUT@@<br>');
    const bbcode = htmlToBbcode(ce.innerHTML);
    updateAndSave({ content: bbcode });
  };

  const insertSendEmailTag = () => {
    const ce = textareaRef.current;
    if (!ce || !active) return;
    ce.focus();
    document.execCommand('insertHTML', false, '<br>@@SEND_EMAIL@@<br>');
    const bbcode = htmlToBbcode(ce.innerHTML);
    updateAndSave({ content: bbcode });
  };

  const insertVariableAtCursor = (token) => {
    const ce = textareaRef.current;
    if (!ce || !active) return;
    ce.focus();
    document.execCommand('insertHTML', false, token);
    const bbcode = htmlToBbcode(ce.innerHTML);
    updateAndSave({ content: bbcode });
  };

  const saveActive = async () => {
    if (!active) return;
    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null; }
    setSaving(true); setSaveMsg('');
    try {
      await base44.entities.FronterScript.update(active.id, {
        name: active.name, content: active.content || '',
        color: active.color, fontSize: active.fontSize, scriptType: active.scriptType,
        alwaysSaveBackup: active.alwaysSaveBackup || false,
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
      const created = await base44.entities.FronterScript.create({
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
      await base44.entities.FronterScript.delete(active.id);
      const remaining = scripts.filter(s => s.id !== active.id);
      setScripts(remaining);
      setActiveId(remaining[0]?.id || null);
    } catch (e) { console.error(e); }
    setDeleting(false);
  };

  if (loading) return <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading scripts…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '14px 16px' }}>
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
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={active.name || ''} onChange={e => updateAndSave({ name: e.target.value })} placeholder="Script name…" style={{ ...inp, flex: 1, minWidth: '120px' }} />
            <select value={active.scriptType || 'custom'} onChange={e => updateAndSave({ scriptType: e.target.value })} style={{ ...inp, width: '130px', cursor: 'pointer' }}>
              {SCRIPT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: '4px', border: `1px solid ${active.alwaysSaveBackup ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`, background: active.alwaysSaveBackup ? `${GOLD}12` : 'transparent' }} title="Nightly backup — a copy of this script is saved each night and kept for 1 week">
              <input
                type="checkbox"
                checked={active.alwaysSaveBackup || false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (!checked && active.alwaysSaveBackup) {
                    if (!window.confirm(`Are you sure you want to disable nightly backups for "${active.name || 'this script'}"? This will stop automatic backups of this script.`)) return;
                  }
                  updateAndSave({ alwaysSaveBackup: checked });
                }}
                style={{ cursor: 'pointer', accentColor: GOLD }}
              />
              <span style={{ color: active.alwaysSaveBackup ? GOLD : '#6b7280', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>💾 Always Save</span>
            </label>
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
              {/* Variable insertion toolbar */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Insert Variable:</span>
                {VARIABLES.map(v => (
                  <button key={v.token} onClick={() => insertVariableAtCursor(v.token)} title={v.desc} style={{ padding: '4px 8px', borderRadius: '4px', border: `1px solid ${GOLD}44`, background: `${GOLD}12`, color: GOLD, cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{v.token}</button>
                ))}
              </div>
              {/* Cue block insertion toolbar */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Insert Cue:</span>
                {Object.entries(CUE_CATEGORIES).map(([key, cat]) => (
                  <button key={key} onClick={() => insertCueAtCursor(key)} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${cat.color}44`, background: `${cat.color}12`, color: cat.color, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{cat.icon} {cat.label}</button>
                ))}
                <select
                  onChange={(e) => { if (e.target.value) insertAiFieldTag(e.target.value); e.target.selectedIndex = 0; }}
                  defaultValue=""
                  title="Insert an AI field tag — a cue for the AI (never shown during the call) that the transcript lines near it belong to this contact card field, or to a whole tab of the card"
                  style={{ padding: '4px 8px', borderRadius: '4px', border: `1px solid ${GOLD}55`, background: `${GOLD}15`, color: GOLD, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}
                >
                  <option value="" disabled>🤖 AI Field Tag…</option>
                  {FRONTER_CONTACT_TABS.map(tab => (
                    <optgroup key={tab.key} label={tab.label}>
                      <option value={tab.tag} style={{ color: '#0a0f1e', background: '#fff' }}>🆔 Whole tab — {tab.label}</option>
                      {tab.fields.map(f => (
                        <option key={f.field} value={f.field} style={{ color: '#0a0f1e', background: '#fff' }}>{f.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button onClick={insertDebtConfirmTag} title="Insert Debt Confirm button — fronter presses this to confirm debt type + total + per-type amounts from the transcript. Add [[AI:debtAmount]], [[AI:debtTypesJson]], and [[AI:debtAmountsJson]] tags where each is discussed." style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${GOLD}55`, background: `${GOLD}15`, color: GOLD, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>💰 Debt Confirm</button>
                <button onClick={insertCompletedStepsTag} title="Insert Completed Steps button — everything below this marker becomes the transfer script shown in the merge popup" style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid #22c55e55`, background: 'rgba(34,197,94,0.15)', color: '#22c55e', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✅ Completed Steps</button>
                <button onClick={insertAiInputTag} title="Insert AI Input button — fronter presses this to summarize the transcript so far into the notes" style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid #a78bfa55`, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>🤖 AI Input</button>
                <button onClick={insertSendEmailTag} title="Insert the Send Credentials & Welcome Message Email button — the fronter presses it inside the script to email the lead their portal credentials and welcome message, using the email on the contact card" style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid #60a5fa55`, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📧 Send Credentials &amp; Welcome Email</button>
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
                Tokens: <span style={{ color: GOLD, fontFamily: 'monospace' }}>{'{{first name}} {{last name}} {{phone}} {{zip}} {{city}} {{state}} {{email}} {{address}} {{notice id}} {{debt amount}}'}</span>
                <span style={{ marginLeft: '12px' }}>Format: <span style={{ color: '#a78bfa', fontFamily: 'monospace' }}>[b]..[/b] [i]..[/i] [c=#hex]..[/c] [bg=#hex]..[/bg] [s=18]..[/s] [f=Arial]..[/f]</span></span>
                <span style={{ marginLeft: '12px' }}>Cue: <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>@@CUE:reminder:text@@</span></span>
                <span style={{ marginLeft: '12px' }}>AI Tag: <span style={{ color: GOLD, fontFamily: 'monospace' }}>[[AI:fieldName]]</span> / <span style={{ color: GOLD, fontFamily: 'monospace' }}>[[AI:tab_contact]]</span> <span style={{ color: '#4a5568' }}>— cues the AI that these transcript lines hold that contact card field, or a whole card tab (editor only — never shown while calling)</span></span>
                <span style={{ marginLeft: '12px' }}>Debt Confirm: <span style={{ color: GOLD, fontFamily: 'monospace' }}>@@DEBT_CONFIRM@@</span> <span style={{ color: '#4a5568' }}>— renders a button the fronter presses to confirm debt type + total + per-type amounts (reads [[AI:debtAmount]], [[AI:debtTypesJson]], [[AI:debtAmountsJson]] tags)</span></span>
                <span style={{ marginLeft: '12px' }}>Completed Steps: <span style={{ color: '#22c55e', fontFamily: 'monospace' }}>@@COMPLETED_STEPS@@</span> <span style={{ color: '#4a5568' }}>— renders a button that opens the transfer popup with the script below it</span></span>
                <span style={{ marginLeft: '12px' }}>AI Input: <span style={{ color: '#a78bfa', fontFamily: 'monospace' }}>@@AI_INPUT@@</span> <span style={{ color: '#4a5568' }}>— renders a button that summarizes the transcript so far into the notes</span></span>
                <span style={{ marginLeft: '12px' }}>Send Email: <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>@@SEND_EMAIL@@</span> <span style={{ color: '#4a5568' }}>— renders a button that emails the lead using the email from the contact card</span></span>
              </div>
            </>
          ) : (
            <ScriptTeleprompter content={active.content || ''} color={active.color || '#e8e0d0'} fontSize={active.fontSize || 14} clientFirstName={fronterFirstName} />
          )}
        </div>
      ) : (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>
          No scripts yet. Click <span style={{ color: GOLD, fontSize: '20px' }}>+</span> to create your first script.
        </div>
      )}
    </div>
  );
}