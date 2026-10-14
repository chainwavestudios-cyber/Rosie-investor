/**
 * ClosingScriptView.jsx — Expandable step-block view of the closing script.
 *
 * Shows each closing module as a collapsible block with:
 *   - A header (icon, title, progress count e.g. 3/7)
 *   - Checkboxes for each step (syncs with SmartClose's manualDone/autoDone)
 *   - The full script text for that module with keywords highlighted in gold
 *
 * Edit mode (canEdit): inline editing of step text, per-step keywords, and
 * the full module script text. Changes propagate up via onModulesChange and
 * are persisted by the parent (SmartClose) via onSaveScript.
 */
import { useState } from 'react';

const GOLD = '#10b981';
const PURPLE = '#a78bfa';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

// Highlight keywords in script text as gold tag chips
function renderWithKeywords(text, steps) {
  if (!text) return null;
  const keywords = [];
  for (const s of steps) {
    for (const kw of (s.keywords || [])) {
      if (kw && kw.trim()) keywords.push(kw.trim());
    }
  }
  if (keywords.length === 0) return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;

  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isKeyword = keywords.some(k => k.toLowerCase() === part.toLowerCase());
    if (isKeyword) {
      return (
        <span key={i} style={{ background: 'rgba(16,185,129,0.18)', color: GOLD, padding: '1px 5px', borderRadius: '2px', fontWeight: 'bold', border: '1px solid rgba(16,185,129,0.3)' }}>{part}</span>
      );
    }
    return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
  });
}

export default function ClosingScriptView({
  modules,
  done,
  onToggle,
  autoDone,
  smartMode,
  canEdit,
  editMode,
  onEditModeChange,
  onModulesChange,
  onSaveScript,
  saving,
  saveMsg,
}) {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Edit handlers ──
  const updateStepText = (modId, stepIdx, text) => {
    onModulesChange(modules.map(m => m.id === modId ? {
      ...m, steps: m.steps.map((s, i) => i === stepIdx ? { ...s, text } : s)
    } : m));
  };

  const updateStepKeywords = (modId, stepIdx, kwStr) => {
    const keywords = kwStr.split(',').map(s => s.trim()).filter(Boolean);
    onModulesChange(modules.map(m => m.id === modId ? {
      ...m, steps: m.steps.map((s, i) => i === stepIdx ? { ...s, keywords } : s)
    } : m));
  };

  const updateStepScore = (modId, stepIdx, score) => {
    const n = Math.max(0, Math.min(100, parseInt(score) || 0));
    onModulesChange(modules.map(m => m.id === modId ? {
      ...m, steps: m.steps.map((s, i) => i === stepIdx ? { ...s, score: n } : s)
    } : m));
  };

  const updateModuleScript = (modId, scriptText) => {
    onModulesChange(modules.map(m => m.id === modId ? { ...m, scriptText } : m));
  };

  const updateModuleTitle = (modId, title) => {
    onModulesChange(modules.map(m => m.id === modId ? { ...m, title } : m));
  };

  return (
    <div>
      {/* Header bar */}
      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ color: GOLD, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>📜 Closing Script</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {saveMsg && <span style={{ color: saveMsg.startsWith('Error') ? '#ef4444' : '#4ade80', fontSize: '11px' }}>{saveMsg}</span>}
          {canEdit && (
            <>
              <button
                onClick={() => onEditModeChange(!editMode)}
                style={{
                  padding: '5px 12px', borderRadius: '4px',
                  border: `1px solid ${editMode ? GOLD + '66' : 'rgba(255,255,255,0.12)'}`,
                  background: editMode ? `${GOLD}18` : 'rgba(255,255,255,0.05)',
                  color: editMode ? GOLD : '#8a9ab8',
                  cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
                }}
              >
                {editMode ? '✓ Done Editing' : '✏️ Edit Script'}
              </button>
              {editMode && (
                <button
                  onClick={onSaveScript}
                  disabled={saving}
                  style={{
                    padding: '5px 14px', borderRadius: '4px',
                    background: 'linear-gradient(135deg,#10b981,#22c55e)',
                    color: '#0a0f1e', border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '11px', fontWeight: 'bold', opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : '💾 Save'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {editMode && (
        <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '4px', color: AMBER, fontSize: '11px' }}>
          ✏️ Edit mode — change step wording, add keywords (comma-separated), or edit the script text. Keywords auto-check steps when detected in the call transcript. Click Save to persist.
        </div>
      )}

      {/* Expandable module blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {modules.map((mod) => {
          const modSteps = mod.steps.map((_, i) => done?.[`${mod.id}_${i}`]);
          const modDone = modSteps.every(Boolean);
          const modCount = modSteps.filter(Boolean).length;
          const isExpanded = expanded[mod.id] !== undefined ? expanded[mod.id] : !modDone;

          return (
            <div
              key={mod.id}
              style={{
                background: '#0d1b2a',
                border: `1px solid ${modDone ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '6px', overflow: 'hidden',
              }}
            >
              {/* Header — click to expand/collapse */}
              <div
                onClick={() => toggleExpand(mod.id)}
                style={{
                  padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: modDone ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.2)',
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                <span style={{ color: modDone ? GOLD : '#c4dd8', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#6b7280', fontSize: '10px' }}>{isExpanded ? '▼' : '▶'}</span>
                  {mod.icon} {editMode ? (
                    <input
                      value={mod.title}
                      onChange={e => { e.stopPropagation(); updateModuleTitle(mod.id, e.target.value); }}
                      onClick={e => e.stopPropagation()}
                      style={{ ...inp, width: 'auto', minWidth: '180px', padding: '3px 8px', fontSize: '13px', fontWeight: 'bold', color: modDone ? GOLD : '#c4dd8' }}
                    />
                  ) : mod.title}
                </span>
                <span style={{ color: modDone ? GOLD : '#6b7280', fontSize: '10px', fontWeight: 'bold' }}>{modCount}/{mod.steps.length}</span>
              </div>

              {isExpanded && (
                <div style={{ padding: '10px 14px' }}>
                  {/* Step checkboxes */}
                  {mod.steps.map((step, i) => {
                    const key = `${mod.id}_${i}`;
                    const checked = !!done?.[key];
                    const auto = smartMode && autoDone?.[key];
                    return (
                      <div key={key} style={{ marginBottom: editMode ? '10px' : '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '4px 0', cursor: editMode ? 'default' : 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => !editMode && onToggle?.(key)}
                            disabled={editMode}
                            style={{ marginTop: '2px', cursor: 'pointer', accentColor: smartMode ? PURPLE : GOLD, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1 }}>
                            {editMode ? (
                              <div>
                                <input
                                  value={step.text}
                                  onChange={e => updateStepText(mod.id, i, e.target.value)}
                                  placeholder="Step text…"
                                  style={inp}
                                />
                                <input
                                  value={(step.keywords || []).join(', ')}
                                  onChange={e => updateStepKeywords(mod.id, i, e.target.value)}
                                  placeholder="keywords (comma-separated) — auto-checks when heard"
                                  style={{ ...inp, marginTop: '4px', fontSize: '10px', color: BLUE, border: '1px solid rgba(96,165,250,0.2)' }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                  <label style={{ color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>Score</label>
                                  <input
                                    type="number" min="0" max="100"
                                    value={step.score ?? 0}
                                    onChange={e => updateStepScore(mod.id, i, e.target.value)}
                                    style={{ width: '60px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '4px 8px', color: GOLD, fontSize: '11px', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }}
                                  />
                                  <span style={{ color: '#4a5568', fontSize: '9px' }}>points (100 = enrolled)</span>
                                </div>
                                </div>
                            ) : (
                              <span style={{ color: checked ? '#6b7280' : '#c4dd8', fontSize: '12px', lineHeight: 1.5, textDecoration: checked ? 'line-through' : 'none' }}>
                                {step.text}
                                {auto && <span style={{ color: PURPLE, fontSize: '9px', marginLeft: '4px', fontWeight: 'bold' }} title="Auto-detected by Smart Close">✦</span>}
    {step.score > 0 && <span style={{ color: GOLD, fontSize: '9px', marginLeft: '4px', fontWeight: 'bold' }}>+{step.score}pt</span>}
                                {step.keywords?.length > 0 && !editMode && (
                                  <span style={{ marginLeft: '6px' }}>
                                    {step.keywords.map((kw, ki) => (
                                      <span key={ki} style={{ display: 'inline-block', background: 'rgba(16,185,129,0.1)', color: GOLD, fontSize: '9px', padding: '1px 5px', borderRadius: '2px', marginRight: '3px', border: '1px solid rgba(16,185,129,0.2)' }}>{kw}</span>
                                    ))}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}

                  {/* Script text */}
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ ...ls, color: '#4a5568' }}>📜 Script</div>
                    {editMode ? (
                      <textarea
                        value={mod.scriptText || ''}
                        onChange={e => updateModuleScript(mod.id, e.target.value)}
                        placeholder="Full script text for this module…"
                        style={{ ...inp, minHeight: '120px', resize: 'vertical', lineHeight: 1.6, fontSize: '13px' }}
                      />
                    ) : (
                      <div style={{
                        background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '4px', padding: '12px 14px',
                        color: '#e8e0d0', fontSize: '13px', lineHeight: 1.7,
                        fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap',
                      }}>
                        {mod.scriptText
                          ? renderWithKeywords(mod.scriptText, mod.steps)
                          : <span style={{ color: '#4a5568', fontStyle: 'italic' }}>No script text yet. Click "Edit Script" to add the full script for this module.</span>}
                      </div>
                    )}
                  </div>

                  {/* Capture fields */}
                  {mod.capture && mod.capture.length > 0 && !editMode && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ ...ls, color: '#4a5568' }}>Capture</div>
                      {mod.capture.map((c, i) => <div key={i} style={{ color: '#8a9ab8', fontSize: '11px' }}>• {c}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}