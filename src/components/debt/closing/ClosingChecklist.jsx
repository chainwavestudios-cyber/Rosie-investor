/**
 * ClosingChecklist.jsx — Reusable step-by-step closing tool.
 * Renders the CLOSING_MODULES as checkable steps with a progress bar.
 * Progress persists to localStorage (per lead) so it survives tab switches.
 *
 * Supports a controlled mode (used by SmartClose): pass `done` + `onToggle`
 * to drive the checked state externally, and `autoDone` to mark steps that
 * were auto-detected by the AI (shown with a small ✦ indicator).
 */
import { useState, useEffect } from 'react';
import { CLOSING_MODULES } from './ClosingModules';

const GOLD = '#10b981';
const PURPLE = '#a78bfa';

export default function ClosingChecklist({ leadId, compact = false, done: controlledDone, onToggle, autoDone, smartMode }) {
  const storageKey = `closing_progress_${leadId || 'general'}`;
  const [internalDone, setInternalDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(internalDone)); } catch {}
  }, [internalDone, storageKey]);

  // Reset when lead changes
  useEffect(() => {
    try { setInternalDone(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch { setInternalDone({}); }
  }, [storageKey]);

  const isControlled = controlledDone !== undefined;
  const done = isControlled ? controlledDone : internalDone;
  const toggle = onToggle || ((key) => setInternalDone(prev => ({ ...prev, [key]: !prev[key] })));

  const totalSteps = CLOSING_MODULES.reduce((n, m) => n + m.steps.length, 0);
  const completedSteps = Object.values(done).filter(Boolean).length;
  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const completedModules = CLOSING_MODULES.filter(m => m.steps.every((_, i) => done[`${m.id}_${i}`])).length;

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Close Progress {smartMode && <span style={{ color: PURPLE, fontSize: '9px' }}>· Smart</span>}</span>
          <span style={{ color: '#c4cdd8', fontSize: '11px', fontWeight: 'bold' }}>{pct}% · {completedModules}/{CLOSING_MODULES.length} modules</span>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: smartMode ? 'linear-gradient(90deg,#a78bfa,#7c3aed)' : 'linear-gradient(90deg,#10b981,#22c55e)', borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Modules */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {CLOSING_MODULES.map((mod) => {
          const modSteps = mod.steps.map((_, i) => done[`${mod.id}_${i}`]);
          const modDone = modSteps.every(Boolean);
          const modCount = modSteps.filter(Boolean).length;
          return (
            <div key={mod.id} style={{ background: '#0d1b2a', border: `1px solid ${modDone ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: modDone ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.2)' }}>
                <span style={{ color: modDone ? GOLD : '#c4cdd8', fontSize: '13px', fontWeight: 'bold' }}>{mod.icon} {mod.title}</span>
                <span style={{ color: modDone ? GOLD : '#6b7280', fontSize: '10px' }}>{modCount}/{mod.steps.length}</span>
              </div>
              <div style={{ padding: '8px 14px' }}>
                {mod.steps.map((step, i) => {
                  const key = `${mod.id}_${i}`;
                  const checked = !!done[key];
                  const auto = smartMode && autoDone && autoDone[key];
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '5px 0', cursor: 'pointer' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(key)} style={{ marginTop: '2px', cursor: 'pointer', accentColor: smartMode ? PURPLE : GOLD, flexShrink: 0 }} />
                      <span style={{ color: checked ? '#6b7280' : '#c4cdd8', fontSize: '12px', lineHeight: 1.4, textDecoration: checked ? 'line-through' : 'none', flex: 1 }}>
                        {step}
                        {auto && <span style={{ color: PURPLE, fontSize: '9px', marginLeft: '4px', fontWeight: 'bold' }} title="Auto-detected by Smart Close">✦</span>}
                      </span>
                    </label>
                  );
                })}
                {mod.capture && mod.capture.length > 0 && !compact && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>Capture</div>
                    {mod.capture.map((c, i) => <div key={i} style={{ color: '#8a9ab8', fontSize: '11px' }}>• {c}</div>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isControlled && (
        <button onClick={() => { if (confirm('Reset all closing steps for this lead?')) setInternalDone({}); }} style={{ marginTop: '12px', width: '100%', background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontSize: '11px' }}>↺ Reset Progress</button>
      )}
    </div>
  );
}